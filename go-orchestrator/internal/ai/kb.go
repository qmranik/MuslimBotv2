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

	"cloud.google.com/go/storage"
	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	aiplatformpb "cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	"github.com/livekit/protocol/auth"
	"github.com/redis/go-redis/v9"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"golang.org/x/oauth2/google"
	"muslimbot-orchestrator/internal/config"
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

// getRedisClient returns a Redis client pointing to the shared cache
func getRedisClient(cfg *config.Config) *redis.Client {
	if cfg.RedisURL == "" {
		return nil
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Printf("[kb/redis] Failed to parse Redis URL: %v", err)
		return nil
	}
	return redis.NewClient(opt)
}

// --- Route Handlers ---

func (h *KBHandler) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":          "ok",
		"indexed_sources": 0,
	})
}

func (h *KBHandler) ListSourcesHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}

	var sources []store.KBSource
	if store.DB != nil {
		if err := store.DB.Where("tenant_id = ?", tid).Order("id desc").Find(&sources).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items": sources,
		"total": len(sources),
	})
}

func (h *KBHandler) GetSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	var source store.KBSource
	if store.DB != nil {
		if err := store.DB.First(&source, "id = ?", sourceID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
			return
		}
	}
	c.JSON(http.StatusOK, source)
}

func (h *KBHandler) DeleteSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	var source store.KBSource
	if store.DB != nil {
		if err := store.DB.First(&source, "id = ?", sourceID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
			return
		}
	}

	// Delete from Vertex AI RAG Corpus if registered
	if source.RagFileID != "" && h.config.GCPProjectID != "" {
		go func(ragFileID string) {
			ctx := context.Background()
			client, err := aiplatform.NewVertexRagDataClient(ctx)
			if err != nil {
				log.Printf("[kb/delete] Failed to create Vertex RAG client: %v", err)
				return
			}
			defer client.Close()

			req := &aiplatformpb.DeleteRagFileRequest{
				Name: ragFileID,
			}
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

	if store.DB != nil {
		if err := store.DB.Delete(&source).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"deleted": sourceID})
}

func (h *KBHandler) SyncSourceHandler(c *gin.Context) {
	sourceID := c.Param("source_id")
	c.JSON(http.StatusOK, gin.H{"source": sourceID, "status": "queued"})
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

	// Create KBSource in DB
	sourceID := GenerateKBSID()
	source := store.KBSource{
		ID:         sourceID,
		TenantID:   tid,
		Title:      title,
		SourceType: sourceType,
		Status:     "indexing",
	}

	if store.DB != nil {
		if err := store.DB.Create(&source).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create source record"})
			return
		}
	}

	// Process upload asynchronously
	go func() {
		ctx := context.Background()
		srcFile, err := file.Open()
		if err != nil {
			updateSourceStatus(sourceID, "failed", "")
			return
		}
		defer srcFile.Close()

		fileBytes, err := io.ReadAll(srcFile)
		if err != nil {
			updateSourceStatus(sourceID, "failed", "")
			return
		}

		// Upload to GCS
		gcsURI, err := uploadToGCS(ctx, h.config, file.Filename, fileBytes)
		if err != nil {
			log.Printf("[kb/upload] GCS upload failed: %v", err)
			updateSourceStatus(sourceID, "failed", "")
			return
		}

		// Import to Vertex
		ragFileID, err := importToVertex(ctx, h.config, gcsURI, file.Filename)
		if err != nil {
			log.Printf("[kb/upload] Vertex import failed: %v", err)
			updateSourceStatus(sourceID, "failed", "")
		} else {
			updateSourceStatus(sourceID, "indexed", ragFileID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"source": sourceID, "status": "queued"})
}

func (h *KBHandler) URLHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}

	var req struct {
		Title string `json:"title"`
		URL   string `json:"url"`
		Depth int    `json:"depth"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	title := req.Title
	if title == "" {
		title = req.URL
	}

	sourceID := GenerateKBSID()
	source := store.KBSource{
		ID:         sourceID,
		TenantID:   tid,
		Title:      title,
		SourceType: "scrape",
		URL:        req.URL,
		Status:     "indexing",
	}

	if store.DB != nil {
		if err := store.DB.Create(&source).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create source record"})
			return
		}
	}

	// Process URL Ingestion asynchronously
	go func() {
		ctx := context.Background()
		// Scrape content
		text, err := scrapeURLText(req.URL)
		if err != nil {
			log.Printf("[kb/url] Scraping failed: %v", err)
			updateSourceStatus(sourceID, "failed", "")
			return
		}

		filename := fmt.Sprintf("%s.txt", sourceID)
		gcsURI, err := uploadToGCS(ctx, h.config, filename, []byte(text))
		if err != nil {
			log.Printf("[kb/url] GCS upload failed: %v", err)
			updateSourceStatus(sourceID, "failed", "")
			return
		}

		ragFileID, err := importToVertex(ctx, h.config, gcsURI, filename)
		if err != nil {
			log.Printf("[kb/url] Vertex import failed: %v", err)
			updateSourceStatus(sourceID, "failed", "")
		} else {
			updateSourceStatus(sourceID, "indexed", ragFileID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"source": sourceID, "status": "scrape_queued"})
}

func (h *KBHandler) RetrieveHandler(c *gin.Context) {
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
	chunks, err := RetrieveContextsFromVertex(ctx, h.config, req.Query, req.TopK)
	if err != nil {
		log.Printf("[kb/retrieve] Vertex retrieve failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":       req.Query,
		"chunks":      chunks,
		"chunks_used": len(chunks),
	})
}

func (h *KBHandler) ChatHandler(c *gin.Context) {
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
	chunks, err := RetrieveContextsFromVertex(ctx, h.config, req.Message, req.TopK)
	if err != nil {
		log.Printf("[kb/chat] Context retrieve failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pull knowledge context"})
		return
	}

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
		"reply":       reply,
		"session_id":  sessionID,
		"chunks":      chunks,
		"chunks_used": len(chunks),
		"status":      "ok",
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

	livekitURL := os.Getenv("LIVEKIT_URL")
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")
	agentName := os.Getenv("LIVEKIT_AGENT_NAME")
	if agentName == "" {
		agentName = "muslimbot"
	}

	if livekitURL == "" || apiKey == "" || apiSecret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "LiveKit is not configured",
			"details": "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
		})
		return
	}

	roomName := strings.TrimSpace(req.RoomName)
	if roomName == "" {
		roomName = fmt.Sprintf("muslimbot-%s", GenerateKBSID()[:10])
	}
	participantIdentity := fmt.Sprintf("user-%s", GenerateKBSID()[:8])
	participantName := strings.TrimSpace(req.ParticipantName)
	if participantName == "" {
		participantName = "Knowledge Hub User"
	}

	// Generate Join Token
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
		SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sign LiveKit token"})
		return
	}

	// Dispatch agent via Twirp REST POST
	httpURL := strings.Replace(livekitURL, "wss://", "https://", 1)
	httpURL = strings.Replace(httpURL, "ws://", "http://", 1)
	dispatchURL := fmt.Sprintf("%s/twirp/livekit.AgentDispatchService/CreateDispatch", httpURL)

	// Admin access token for dispatch
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
	}
	payloadBytes, _ := json.Marshal(dispatchReqPayload)

	reqDispatch, err := http.NewRequest("POST", dispatchURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent dispatch request"})
		return
	}
	reqDispatch.Header.Set("Content-Type", "application/json")
	reqDispatch.Header.Set("Authorization", "Bearer "+adminToken)

	client := &http.Client{}
	respDispatch, err := client.Do(reqDispatch)
	if err != nil {
		log.Printf("[kb/voice] Agent dispatch failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to dispatch voice agent", "details": err.Error()})
		return
	}
	defer respDispatch.Body.Close()

	if respDispatch.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(respDispatch.Body)
		log.Printf("[kb/voice] Dispatch API returned status %d: %s", respDispatch.StatusCode, string(body))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to dispatch voice agent", "details": string(body)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":                token,
		"url":                  livekitURL,
		"room_name":            roomName,
		"participant_identity": participantIdentity,
	})
}

func (h *KBHandler) VoiceBriefHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}

	ctx := context.Background()
	brief := getVoiceBriefCached(ctx, h.config, tid)
	if brief == "" {
		var err error
		brief, err = rebuildVoiceBrief(ctx, h.config, tid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id": tid,
		"context":   brief,
	})
}

func (h *KBHandler) RebuildVoiceBriefHandler(c *gin.Context) {
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
	}

	ctx := context.Background()
	brief, err := rebuildVoiceBrief(ctx, h.config, tid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id": tid,
		"context":   brief,
	})
}

// --- Helpers & Background Processing ---

func updateSourceStatus(id, status, ragFileID string) {
	if store.DB == nil {
		return
	}
	updates := map[string]interface{}{"status": status}
	if ragFileID != "" {
		updates["rag_file_id"] = ragFileID
	}
	if err := store.DB.Model(&store.KBSource{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		log.Printf("[kb/db] Failed to update source status: %v", err)
	}
}

func uploadToGCS(ctx context.Context, cfg *config.Config, filename string, data []byte) (string, error) {
	if cfg.GCSBucketName == "" {
		return "", fmt.Errorf("GCS_BUCKET_NAME not set")
	}

	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create storage client: %w", err)
	}
	defer storageClient.Close()

	objectName := fmt.Sprintf("rag-imports/%s", filename)
	wc := storageClient.Bucket(cfg.GCSBucketName).Object(objectName).NewWriter(ctx)
	if _, err := wc.Write(data); err != nil {
		_ = wc.Close()
		return "", err
	}
	if err := wc.Close(); err != nil {
		return "", err
	}

	return fmt.Sprintf("gs://%s/%s", cfg.GCSBucketName, objectName), nil
}

func importToVertex(ctx context.Context, cfg *config.Config, gcsURI, filename string) (string, error) {
	if cfg.GCPProjectID == "" || cfg.GCPLocation == "" || cfg.GCPRagCorpusID == "" {
		return "", fmt.Errorf("Vertex AI configs not set")
	}

	client, err := aiplatform.NewVertexRagDataClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create Vertex RAG Data client: %w", err)
	}
	defer client.Close()

	parent := fmt.Sprintf("projects/%s/locations/%s/ragCorpora/%s", cfg.GCPProjectID, cfg.GCPLocation, cfg.GCPRagCorpusID)

	req := &aiplatformpb.ImportRagFilesRequest{
		Parent: parent,
		ImportRagFilesConfig: &aiplatformpb.ImportRagFilesConfig{
			ImportSource: &aiplatformpb.ImportRagFilesConfig_GcsSource{
				GcsSource: &aiplatformpb.GcsSource{
					Uris: []string{gcsURI},
				},
			},
		},
	}

	op, err := client.ImportRagFiles(ctx, req)
	if err != nil {
		return "", err
	}

	_, err = op.Wait(ctx)
	if err != nil {
		return "", err
	}

	// File imported successfully. Find RAG file ID using list API
	ragFileID, err := findRagFileByName(ctx, client, parent, filename)
	if err != nil {
		log.Printf("[kb/import] Failed to find imported file resource ID: %v", err)
		return gcsURI, nil // Return GCS URI as fallback
	}

	return ragFileID, nil
}

func findRagFileByName(ctx context.Context, client *aiplatform.VertexRagDataClient, parentCorpus, displayName string) (string, error) {
	req := &aiplatformpb.ListRagFilesRequest{
		Parent: parentCorpus,
	}
	it := client.ListRagFiles(ctx, req)
	for {
		resp, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return "", err
		}
		if resp.DisplayName == displayName {
			return resp.Name, nil
		}
	}
	return "", fmt.Errorf("rag file not found")
}

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

func RetrieveContextsFromVertex(ctx context.Context, cfg *config.Config, query string, topK int) ([]RagChunk, error) {
	if cfg.GCPProjectID == "" || cfg.GCPLocation == "" || cfg.GCPRagCorpusID == "" {
		return nil, fmt.Errorf("Vertex AI RAG configurations not set")
	}

	urlStr := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s:retrieveContexts",
		cfg.GCPLocation, cfg.GCPProjectID, cfg.GCPLocation)

	requestBody := map[string]interface{}{
		"vertex_rag_store": map[string]interface{}{
			"rag_resources": []map[string]interface{}{
				{
					"rag_corpus": fmt.Sprintf("projects/%s/locations/%s/ragCorpora/%s",
						cfg.GCPProjectID, cfg.GCPLocation, cfg.GCPRagCorpusID),
				},
			},
			"vector_distance_threshold": 0.3,
		},
		"query": map[string]interface{}{
			"text": query,
		},
	}

	jsonBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("failed to create Google client: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", urlStr, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Vertex retrieveContexts returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var responseData struct {
		Contexts struct {
			Contexts []struct {
				Text  string  `json:"text"`
				Score float64 `json:"score"`
			} `json:"contexts"`
		} `json:"contexts"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		return nil, err
	}

	var chunks []RagChunk
	for _, c := range responseData.Contexts.Contexts {
		if strings.TrimSpace(c.Text) != "" {
			chunks = append(chunks, RagChunk{
				Text:  c.Text,
				Score: c.Score,
			})
		}
	}

	return chunks, nil
}

func getVoiceBriefCached(ctx context.Context, cfg *config.Config, tenantID string) string {
	rdb := getRedisClient(cfg)
	if rdb == nil {
		return ""
	}
	val, err := rdb.Get(ctx, "voice_brief:"+tenantID).Result()
	if err != nil {
		return ""
	}
	return val
}

func setVoiceBriefCached(ctx context.Context, cfg *config.Config, tenantID string, val string) {
	rdb := getRedisClient(cfg)
	if rdb == nil {
		return
	}
	_ = rdb.Set(ctx, "voice_brief:"+tenantID, val, 0).Err()
}

func rebuildVoiceBrief(ctx context.Context, cfg *config.Config, tenantID string) (string, error) {
	var snippets []string
	seen := make(map[string]bool)
	totalLen := 0
	maxChars := 4000

	cannedQueries := []string{
		"What is your return policy?",
		"What are your business hours?",
		"Do you offer delivery?",
		"What payment methods do you accept?",
		"How can I contact customer support?",
		"What is your warranty policy?",
		"Do you have a loyalty program?",
		"What are your shipping times?",
		"Where are you located?",
		"What products do you sell?",
		"How do I place an order?",
		"What is your refund process?",
		"Do you offer bulk discounts?",
		"What areas do you deliver to?",
		"What is your privacy policy?",
	}

	for _, q := range cannedQueries {
		chunks, err := RetrieveContextsFromVertex(ctx, cfg, q, 2)
		if err == nil {
			for _, chunk := range chunks {
				txt := strings.TrimSpace(chunk.Text)
				if txt != "" && !seen[txt] {
					seen[txt] = true
					if len(txt) > 500 {
						txt = txt[:500]
					}
					snippets = append(snippets, txt)
					totalLen += len(txt)
				}
			}
		}
		if totalLen >= maxChars {
			break
		}
	}

	brief := ""
	if len(snippets) > 0 {
		var err error
		brief, err = compressWithGemini(ctx, cfg, snippets)
		if err != nil {
			log.Printf("[kb/voice_brief] Gemini compression failed: %v", err)
			joined := strings.Join(snippets, "\n\n")
			if len(joined) > maxChars {
				joined = joined[:maxChars]
			}
			brief = joined
		}
	}

	if strings.TrimSpace(brief) == "" {
		brief = "No indexed knowledge yet."
	}

	setVoiceBriefCached(ctx, cfg, tenantID, brief)
	return brief, nil
}

func compressWithGemini(ctx context.Context, cfg *config.Config, snippets []string) (string, error) {
	if cfg.GeminiAPIKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	prompt := "Compress the following knowledge snippets into a spoken-friendly FAQ brief for a voice assistant. Max 4000 characters. Use plain sentences, no markdown, no bullet symbols.\n\n" +
		strings.Join(snippets, "\n\n---\n\n")

	genClient, err := genai.NewClient(ctx, option.WithAPIKey(cfg.GeminiAPIKey))
	if err != nil {
		return "", err
	}
	defer genClient.Close()

	model := genClient.GenerativeModel("gemini-1.5-flash")
	model.SetTemperature(0.2)
	model.SetMaxOutputTokens(1200)

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				sb.WriteString(fmt.Sprintf("%v", part))
			}
		}
	}

	return strings.TrimSpace(sb.String()), nil
}
