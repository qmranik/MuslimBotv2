package knowledge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
	"muslimbot-orchestrator/internal/config"
)

// VoiceBrief is the warm context payload for voice agents.
type VoiceBrief struct {
	TenantID     string          `json:"tenant_id"`
	Context      string          `json:"context"`
	KBGeneration int64           `json:"kb_generation"`
	GeneratedAt  time.Time       `json:"generated_at"`
	Digest       string          `json:"digest"`
	AccessPolicy KnowledgeAccess `json:"access_policy"`
}

// GetOrBuildVoiceBrief returns a generation-scoped brief, rebuilding on miss.
func GetOrBuildVoiceBrief(ctx context.Context, cfg *config.Config, access KnowledgeAccess) (*VoiceBrief, error) {
	if err := access.Validate(); err != nil {
		return nil, err
	}
	generation := CurrentGeneration(access.TenantID)
	access.KBGeneration = generation
	if cached := GetVoiceBrief(ctx, cfg, access, generation); cached != "" {
		return &VoiceBrief{
			TenantID:     access.TenantID,
			Context:      cached,
			KBGeneration: generation,
			GeneratedAt:  time.Now().UTC(),
			Digest:       briefDigest(cached),
			AccessPolicy: access,
		}, nil
	}
	return RebuildVoiceBrief(ctx, cfg, access)
}

// RebuildVoiceBrief runs filtered canned queries and caches the result.
func RebuildVoiceBrief(ctx context.Context, cfg *config.Config, access KnowledgeAccess) (*VoiceBrief, error) {
	if err := access.Validate(); err != nil {
		return nil, err
	}
	generation := CurrentGeneration(access.TenantID)
	access.KBGeneration = generation

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
		result, err := RetrieveFiltered(ctx, cfg, access, q, 2)
		if err != nil {
			log.Printf("[kb/voice_brief] retrieve failed for %q: %v", q, err)
			continue
		}
		for _, chunk := range result.Chunks {
			txt := strings.TrimSpace(chunk.Text)
			if txt == "" || seen[txt] {
				continue
			}
			seen[txt] = true
			if len(txt) > 500 {
				txt = txt[:500]
			}
			snippets = append(snippets, txt)
			totalLen += len(txt)
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

	if err := SetVoiceBriefCAS(ctx, cfg, access, generation, brief); err != nil {
		log.Printf("[kb/voice_brief] cache write failed: %v", err)
	}

	return &VoiceBrief{
		TenantID:     access.TenantID,
		Context:      brief,
		KBGeneration: generation,
		GeneratedAt:  time.Now().UTC(),
		Digest:       briefDigest(brief),
		AccessPolicy: access,
	}, nil
}

func briefDigest(brief string) string {
	sum := sha256.Sum256([]byte(brief))
	return hex.EncodeToString(sum[:8])
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
