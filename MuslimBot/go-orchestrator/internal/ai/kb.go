package ai

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	aiplatformpb "cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	"github.com/livekit/protocol/auth"
	"google.golang.org/api/option"
	authpkg "muslimbot-orchestrator/internal/auth"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/knowledge"
	"muslimbot-orchestrator/internal/store"
)

func boolPtr(b bool) *bool {
	return &b
}

type RagChunk struct {
	Text  string  `json:"text"`
	Score float64 `json:"score"`
}

type KBHandler struct {
	config *config.Config
}

func NewKBHandler(cfg *config.Config) *KBHandler {
	return &KBHandler{config: cfg}
}

// GenerateKBSID generates a unique ID for KB sources
func GenerateKBSID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return fmt.Sprintf("KBS-%X", b)
}

// --- Route Handlers ---

func (h *KBHandler) HealthHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	indexed := 0
	if store.DB != nil {
		var count int64
		_ = store.DB.Model(&store.KBSource{}).
			Where("tenant_id = ? AND status = ? AND deleted_at IS NULL", tid, "indexed").
			Count(&count).Error
		indexed = int(count)
	}
	c.JSON(http.StatusOK, gin.H{
		"status":                 "ok",
		"indexed_sources":        indexed,
		"tenant_id":              tid,
		"vertex_rag":             knowledge.VertexConfigured(h.config),
		"rag_tenancy_mode":       h.config.RagTenancyMode,
		"rag_corpus_id":          h.config.ActiveRagCorpusID(),
		"filtered_retrieval":     !h.config.RagAllowUnfiltered && knowledge.VertexConfigured(h.config),
		"kb_generation":          knowledge.CurrentGeneration(tid),
		"metadata_schema_version": h.config.RagMetadataSchemaVersion,
	})
}

func (h *KBHandler) ListSourcesHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	staff := knowledge.IsStaff(groups)

	var sources []store.KBSource
	if store.DB != nil {
		if err := store.DB.Where("tenant_id = ? AND deleted_at IS NULL", tid).Order("id desc").Find(&sources).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	visible := knowledge.FilterVisible(sources, tid, staff)

	c.JSON(http.StatusOK, gin.H{
		"items":    visible,
		"total":    len(visible),
		"as_staff": staff,
	})
}

func (h *KBHandler) GetSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	staff := knowledge.IsStaff(groups)

	var source store.KBSource
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	if err := store.DB.Where("id = ? AND tenant_id = ?", sourceID, tid).First(&source).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}
	if !staff && source.Visibility == "private" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Source not visible"})
		return
	}
	c.JSON(http.StatusOK, source)
}

func (h *KBHandler) DeleteSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if !knowledge.IsStaff(groups) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff role required to delete sources"})
		return
	}

	var source store.KBSource
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	if err := store.DB.Where("id = ? AND tenant_id = ?", sourceID, tid).First(&source).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}

	if err := knowledge.SoftDeleteSource(h.config, &source); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Vertex delete is best-effort after soft-delete + generation bump.
	if source.RagFileID != "" && h.config.GCPProjectID != "" {
		go func(ragFileID string) {
			ctx := context.Background()
			client, err := aiplatform.NewVertexRagDataClient(ctx)
			if err != nil {
				log.Printf("[kb/delete] Failed to create Vertex RAG client: %v", err)
				return
			}
			defer client.Close()

			req := &aiplatformpb.DeleteRagFileRequest{Name: ragFileID}
			op, err := client.DeleteRagFile(ctx, req)
			if err != nil {
				log.Printf("[kb/delete] DeleteRagFile failed: %v", err)
				return
			}
			if err := op.Wait(ctx); err != nil {
				log.Printf("[kb/delete] Waiting for DeleteRagFile failed: %v", err)
			} else {
				log.Printf("[kb/delete] Successfully deleted RAG file: %s", ragFileID)
			}
		}(source.RagFileID)
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted":       sourceID,
		"tenant_id":     tid,
		"kb_generation": knowledge.CurrentGeneration(tid),
	})
}

func (h *KBHandler) SyncSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if !knowledge.IsStaff(groups) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff role required to sync sources"})
		return
	}
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var source store.KBSource
	if err := store.DB.Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", sourceID, tid).First(&source).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}
	source.Revision++
	source.Status = "queued"
	source.UpdatedAt = time.Now().UTC()
	_ = store.DB.Save(&source).Error
	job, err := knowledge.CreateIngestionJob(tid, sourceID, source.Revision)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"source":    sourceID,
		"status":    "queued",
		"job_id":    job.ID,
		"revision":  source.Revision,
		"tenant_id": tid,
	})
}

func (h *KBHandler) ClassifyURLHandler(c *gin.Context) {
	var req struct {
		URL string `json:"url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	urlType := "website"
	depth := 1
	if strings.Contains(strings.ToLower(req.URL), ".pdf") {
		urlType = "document"
		depth = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"url_type":       urlType,
		"depth_default":  depth,
		"normalized_url": req.URL,
	})
}

func (h *KBHandler) UploadHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if !knowledge.IsStaff(groups) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff role required to upload sources"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	title := c.PostForm("title")
	if title == "" {
		title = file.Filename
	}
	sourceType := c.PostForm("source_type")
	if sourceType == "" {
		sourceType = "document"
	}
	visibility := strings.ToLower(strings.TrimSpace(c.PostForm("visibility")))
	if visibility != knowledge.VisibilityPublic {
		visibility = knowledge.VisibilityPrivate
	}
	uploadedBy, _ := c.Get("user_email")
	uploader, _ := uploadedBy.(string)

	if !knowledge.VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)",
		})
		return
	}

	// Read multipart into memory before returning so the async worker is safe.
	srcFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to open upload"})
		return
	}
	fileBytes, err := io.ReadAll(srcFile)
	_ = srcFile.Close()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read upload"})
		return
	}

	sourceID := GenerateKBSID()
	source := store.KBSource{
		ID:             sourceID,
		TenantID:       tid,
		Title:          title,
		SourceType:     sourceType,
		Visibility:     visibility,
		UploadedBy:     uploader,
		Status:         "indexing",
		Revision:       1,
		MetadataStatus: store.KBMetaPending,
	}

	if store.DB != nil {
		if err := store.DB.Create(&source).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create source record"})
			return
		}
		if _, err := knowledge.CreateIngestionJob(tid, sourceID, 1); err != nil {
			log.Printf("[kb/upload] failed to create ingestion job: %v", err)
		}
	}

	filename := file.Filename
	go func(src store.KBSource, name string, data []byte) {
		ctx := context.Background()
		if err := knowledge.IngestBytes(ctx, h.config, src, name, data); err != nil {
			log.Printf("[kb/upload] ingest failed source=%s: %v", src.ID, err)
		}
	}(source, filename, fileBytes)

	c.JSON(http.StatusOK, gin.H{"source": sourceID, "status": "queued", "revision": 1})
}

func (h *KBHandler) URLHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if !knowledge.IsStaff(groups) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff role required to ingest URLs"})
		return
	}

	var req struct {
		Title      string `json:"title"`
		URL        string `json:"url"`
		Depth      int    `json:"depth"`
		Visibility string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url required"})
		return
	}

	if !knowledge.VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)",
		})
		return
	}

	title := req.Title
	if title == "" {
		title = req.URL
	}
	visibility := strings.ToLower(strings.TrimSpace(req.Visibility))
	if visibility != knowledge.VisibilityPublic {
		visibility = knowledge.VisibilityPrivate
	}
	uploadedBy, _ := c.Get("user_email")
	uploader, _ := uploadedBy.(string)

	sourceID := GenerateKBSID()
	source := store.KBSource{
		ID:             sourceID,
		TenantID:       tid,
		Title:          title,
		SourceType:     "scrape",
		URL:            req.URL,
		Visibility:     visibility,
		UploadedBy:     uploader,
		Status:         "indexing",
		Revision:       1,
		MetadataStatus: store.KBMetaPending,
	}

	if store.DB != nil {
		if err := store.DB.Create(&source).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create source record"})
			return
		}
		if _, err := knowledge.CreateIngestionJob(tid, sourceID, 1); err != nil {
			log.Printf("[kb/url] failed to create ingestion job: %v", err)
		}
	}

	go func(src store.KBSource, pageURL string) {
		ctx := context.Background()
		text, err := scrapeURLText(pageURL)
		if err != nil {
			log.Printf("[kb/url] Scraping failed: %v", err)
			knowledge.MarkSourceFailed(src.ID, err.Error())
			return
		}
		filename := fmt.Sprintf("%s.txt", src.ID)
		if err := knowledge.IngestBytes(ctx, h.config, src, filename, []byte(text)); err != nil {
			log.Printf("[kb/url] ingest failed source=%s: %v", src.ID, err)
		}
	}(source, req.URL)

	c.JSON(http.StatusOK, gin.H{"source": sourceID, "status": "scrape_queued", "revision": 1})
}

func (h *KBHandler) RetrieveHandler(c *gin.Context) {
	if !knowledge.VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)",
		})
		return
	}
	access, err := knowledge.PolicyFromCaller(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Query string `json:"query"`
		TopK  int    `json:"top_k"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.TopK <= 0 {
		req.TopK = 8
	}

	ctx := context.Background()
	result, err := knowledge.RetrieveFiltered(ctx, h.config, access, req.Query, req.TopK)
	if err != nil {
		log.Printf("[kb/retrieve] Vertex retrieve failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":          result.Query,
		"chunks":         result.Chunks,
		"chunks_used":    result.ChunksUsed,
		"kb_generation":  result.KBGeneration,
		"access_policy":  result.AccessPolicy,
		"metadata_filter": result.MetadataFilter,
	})
}

func (h *KBHandler) ChatHandler(c *gin.Context) {
	if !knowledge.VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)",
		})
		return
	}
	access, err := knowledge.PolicyFromCaller(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Message   string `json:"message"`
		SessionID string `json:"session_id"`
		TopK      int    `json:"top_k"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.TopK <= 0 {
		req.TopK = 8
	}
	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = GenerateKBSID()
	}

	ctx := context.Background()
	result, err := knowledge.RetrieveFiltered(ctx, h.config, access, req.Message, req.TopK)
	if err != nil {
		log.Printf("[kb/chat] Context retrieve failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to pull knowledge context from Vertex AI RAG"})
		return
	}
	chunks := result.Chunks

	var snippetTexts []string
	for _, chunk := range chunks {
		snippetTexts = append(snippetTexts, chunk.Text)
	}
	contextBlock := strings.Join(snippetTexts, "\n\n---\n\n")

	prompt := fmt.Sprintf(
		"You are a customer support agent for a pharmacy/retail business.\n"+
			"Use the KNOWLEDGE CONTEXT below for policies and FAQs.\n"+
			"For stock, price, or live orders, say you will check inventory if not in context.\n"+
			"Be concise and helpful.\n\n"+
			"KNOWLEDGE CONTEXT:\n%s\n\n"+
			"CUSTOMER MESSAGE:\n%s",
		contextBlock,
		req.Message,
	)

	reply := ""
	if h.config.GeminiAPIKey != "" {
		genClient, err := genai.NewClient(ctx, option.WithAPIKey(h.config.GeminiAPIKey))
		if err == nil {
			defer genClient.Close()
			model := genClient.GenerativeModel("gemini-1.5-flash")
			model.SetTemperature(0.3)
			model.SetMaxOutputTokens(600)
			resp, err := model.GenerateContent(ctx, genai.Text(prompt))
			if err == nil {
				var sb strings.Builder
				for _, cand := range resp.Candidates {
					if cand.Content != nil {
						for _, part := range cand.Content.Parts {
							sb.WriteString(fmt.Sprintf("%v", part))
						}
					}
				}
				reply = strings.TrimSpace(sb.String())
			}
		}
	}

	if reply == "" {
		if len(chunks) > 0 {
			reply = fmt.Sprintf("Based on our knowledge base: %s", chunks[0].Text)
		} else {
			reply = "Knowledge base is empty. Please upload documents first."
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"reply":         reply,
		"session_id":    sessionID,
		"chunks":        chunks,
		"chunks_used":   len(chunks),
		"kb_generation": result.KBGeneration,
		"access_policy": result.AccessPolicy,
		"status":        "ok",
	})
}

// PatchSourceHandler: PATCH /v1/kb/sources/:source_id — staff visibility/title updates.
func (h *KBHandler) PatchSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if !knowledge.IsStaff(groups) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff role required"})
		return
	}
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var req struct {
		Visibility string `json:"visibility"`
		Title      string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var source store.KBSource
	if err := store.DB.Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", sourceID, tid).First(&source).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}
	visibility := strings.ToLower(strings.TrimSpace(req.Visibility))
	if visibility == "" {
		visibility = source.Visibility
	}
	if err := knowledge.UpdateSourceVisibility(h.config, &source, visibility, req.Title); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"source":        source,
		"kb_generation": knowledge.CurrentGeneration(tid),
	})
}

func (h *KBHandler) VoiceSessionHandler(c *gin.Context) {
	var req struct {
		RoomName        string `json:"room_name"`
		ParticipantName string `json:"participant_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}
	userEmail, _ := c.Get("user_email")
	email, _ := userEmail.(string)
	userName, _ := c.Get("user_name")
	uname, _ := userName.(string)

	livekitInternal := firstNonEmpty(h.config.LiveKitInternalURL, os.Getenv("LIVEKIT_URL"))
	livekitPublic := firstNonEmpty(h.config.LiveKitPublicURL, livekitInternal)
	apiKey := firstNonEmpty(h.config.LiveKitAPIKey, os.Getenv("LIVEKIT_API_KEY"))
	apiSecret := firstNonEmpty(h.config.LiveKitAPISecret, os.Getenv("LIVEKIT_API_SECRET"))
	agentName := firstNonEmpty(h.config.LiveKitAgentName, os.Getenv("LIVEKIT_AGENT_NAME"), "muslimbot")

	if livekitInternal == "" || apiKey == "" || apiSecret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "LiveKit is not configured",
			"details": "Set LIVEKIT_INTERNAL_URL/LIVEKIT_PUBLIC_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
		})
		return
	}

	// Always mint a unique room — never allow callers to join arbitrary existing rooms.
	roomName := fmt.Sprintf("muslimbot-%s", GenerateKBSID())
	if strings.TrimSpace(req.RoomName) != "" {
		// Allow optional suffix only; keep unique prefix to avoid collisions.
		roomName = fmt.Sprintf("muslimbot-%s-%s", GenerateKBSID()[:8], sanitizeRoomSuffix(req.RoomName))
	}
	sessionID := "VS-" + GenerateKBSID()
	participantIdentity := fmt.Sprintf("user-%s", GenerateKBSID()[:8])
	participantName := strings.TrimSpace(req.ParticipantName)
	if participantName == "" {
		participantName = firstNonEmpty(uname, "Knowledge Hub User")
	}

	scopes := authpkg.DefaultVoiceScopes()
	workloadToken, workloadJTI, err := authpkg.MintWorkloadToken(
		h.config, tid, roomName, sessionID, email, participantName, scopes, time.Hour,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mint worker credential", "details": err.Error()})
		return
	}

	access := knowledge.PolicyStaff(tid)
	// Browser-visible participant metadata must NOT include the workload JWT.
	participantMeta, _ := json.Marshal(map[string]any{
		"tenant_id":  tid,
		"session_id": sessionID,
		"user_email": email,
		"user_name":  participantName,
	})
	// Agent dispatch metadata includes the workload token (not browser-visible).
	dispatchMeta, _ := json.Marshal(map[string]any{
		"tenant_id":      tid,
		"session_id":     sessionID,
		"user_email":     email,
		"user_name":      participantName,
		"scopes":         scopes,
		"workload_token": workloadToken,
		"kb_generation":  knowledge.CurrentGeneration(tid),
	})

	// Generate Join Token for the browser participant.
	at := auth.NewAccessToken(apiKey, apiSecret)
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   boolPtr(true),
		CanSubscribe: boolPtr(true),
	}
	at.SetVideoGrant(grant).
		SetIdentity(participantIdentity).
		SetName(participantName).
		SetMetadata(string(participantMeta)).
		SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sign LiveKit token"})
		return
	}

	httpURL := strings.Replace(livekitInternal, "wss://", "https://", 1)
	httpURL = strings.Replace(httpURL, "ws://", "http://", 1)
	dispatchURL := fmt.Sprintf("%s/twirp/livekit.AgentDispatchService/CreateDispatch", httpURL)

	adminAt := auth.NewAccessToken(apiKey, apiSecret)
	adminAt.SetVideoGrant(&auth.VideoGrant{RoomAdmin: true}).
		SetIdentity("dispatch-client").
		SetValidFor(time.Minute * 5)

	adminToken, err := adminAt.ToJWT()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sign admin LiveKit token"})
		return
	}

	dispatchReqPayload := map[string]interface{}{
		"agent_name": agentName,
		"room":       roomName,
		"metadata":   string(dispatchMeta),
	}
	payloadBytes, _ := json.Marshal(dispatchReqPayload)

	reqDispatch, err := http.NewRequest("POST", dispatchURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent dispatch request"})
		return
	}
	reqDispatch.Header.Set("Content-Type", "application/json")
	reqDispatch.Header.Set("Authorization", "Bearer "+adminToken)

	client := &http.Client{Timeout: 10 * time.Second}
	respDispatch, err := client.Do(reqDispatch)
	if err != nil {
		log.Printf("[kb/voice] Agent dispatch failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to dispatch voice agent"})
		return
	}
	defer respDispatch.Body.Close()

	if respDispatch.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(respDispatch.Body)
		log.Printf("[kb/voice] Dispatch API returned status %d: %s", respDispatch.StatusCode, string(body))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to dispatch voice agent"})
		return
	}

	now := time.Now().UTC()
	if store.DB != nil {
		_ = store.DB.Create(&store.VoiceSession{
			ID:                      sessionID,
			TenantID:                tid,
			RoomName:                roomName,
			UserEmail:               email,
			UserName:                participantName,
			ParticipantID:           participantIdentity,
			ScopesJSON:              string(mustJSON(scopes)),
			AllowedVisibilitiesJSON: access.VisibilitiesJSON(),
			KBGeneration:            knowledge.CurrentGeneration(tid),
			WorkloadJTI:             workloadJTI,
			Status:                  "active",
			CreatedAt:               now,
			UpdatedAt:               now,
			LastHeartbeatAt:         &now,
		}).Error
	}

	c.JSON(http.StatusOK, gin.H{
		"token":                token,
		"url":                  livekitPublic,
		"room_name":            roomName,
		"participant_identity": participantIdentity,
		"session_id":           sessionID,
		"tenant_id":            tid,
		"kb_generation":        knowledge.CurrentGeneration(tid),
	})
}

func sanitizeRoomSuffix(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	var b strings.Builder
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
		if b.Len() >= 24 {
			break
		}
	}
	if b.Len() == 0 {
		return "call"
	}
	return b.String()
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (h *KBHandler) VoiceBriefHandler(c *gin.Context) {
	access, err := knowledge.PolicyFromCaller(c)
	if err != nil {
		// Workload JWT path may call this via agent handler after setting tenant.
		access, err = knowledge.PolicyFromWorkload(c)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
	}
	ctx := context.Background()
	brief, err := knowledge.GetOrBuildVoiceBrief(ctx, h.config, access)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	etag := fmt.Sprintf(`W/"kb-%d-%s"`, brief.KBGeneration, brief.Digest)
	if match := c.GetHeader("If-None-Match"); match != "" && match == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("ETag", etag)
	c.JSON(http.StatusOK, gin.H{
		"tenant_id":     brief.TenantID,
		"context":       brief.Context,
		"kb_generation": brief.KBGeneration,
		"generated_at":  brief.GeneratedAt,
		"digest":        brief.Digest,
		"access_policy": brief.AccessPolicy,
	})
}

func (h *KBHandler) RebuildVoiceBriefHandler(c *gin.Context) {
	access, err := knowledge.PolicyFromCaller(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	brief, err := knowledge.RebuildVoiceBrief(ctx, h.config, access)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"tenant_id":     brief.TenantID,
		"context":       brief.Context,
		"kb_generation": brief.KBGeneration,
		"generated_at":  brief.GeneratedAt,
		"digest":        brief.Digest,
		"access_policy": brief.AccessPolicy,
	})
}

// AgentContextHandler: GET /v1/agent/kb/context — compact session state for watchers.
func (h *KBHandler) AgentContextHandler(c *gin.Context) {
	if !authpkg.HasScope(c, authpkg.ScopeKBRead) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing kb:read scope"})
		return
	}
	access, err := knowledge.PolicyFromWorkload(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	brief, err := knowledge.GetOrBuildVoiceBrief(ctx, h.config, access)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	etag := fmt.Sprintf(`W/"kb-%d-%s"`, brief.KBGeneration, brief.Digest)
	if match := c.GetHeader("If-None-Match"); match != "" && match == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("ETag", etag)
	c.JSON(http.StatusOK, gin.H{
		"tenant_id":     brief.TenantID,
		"kb_generation": brief.KBGeneration,
		"revision":      brief.KBGeneration,
		"digest":        brief.Digest,
		"context":       brief.Context,
		"generated_at":  brief.GeneratedAt,
	})
}

// --- Helpers & Background Processing ---

func scrapeURLText(urlStr string) (string, error) {
	resp, err := http.Get(urlStr)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	html := string(bodyBytes)

	// Strip script and style tags
	reScript := regexp.MustCompile(`(?s)<script.*?>.*?</script>`)
	html = reScript.ReplaceAllString(html, "")

	reStyle := regexp.MustCompile(`(?s)<style.*?>.*?</style>`)
	html = reStyle.ReplaceAllString(html, "")

	// Strip other HTML tags
	reTags := regexp.MustCompile(`<[^>]*>`)
	text := reTags.ReplaceAllString(html, " ")

	// Normalize spaces
	reSpace := regexp.MustCompile(`\s+`)
	text = reSpace.ReplaceAllString(text, " ")

	return strings.TrimSpace(text), nil
}

// RetrieveContextsFromVertex is removed; use knowledge.RetrieveFiltered with a
// server-derived KnowledgeAccess. This stub remains only to fail closed if any
// legacy caller still references the old unfiltered path.
func RetrieveContextsFromVertex(ctx context.Context, cfg *config.Config, query string, topK int) ([]RagChunk, error) {
	_ = ctx
	_ = cfg
	_ = query
	_ = topK
	return nil, fmt.Errorf("unfiltered Vertex retrieve is disabled; use knowledge.RetrieveFiltered (ADR-0002)")
}
