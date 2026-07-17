package voice

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/livekit/protocol/auth"
	"muslimbot-orchestrator/internal/config"
)

type Handler struct {
	cfg *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

func (h *Handler) GetToken(c *gin.Context) {
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	if apiKey == "" || apiSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "LiveKit credentials not configured"})
		return
	}

	// Assuming user is authenticated and we have their identity
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous-" + fmt.Sprintf("%d", time.Now().Unix())
	}

	roomName := "muslimbot-call-" + userID

	at := auth.NewAccessToken(apiKey, apiSecret)
	
	// Set the token's validity
	at.SetValidFor(2 * time.Hour)
	
	// Add room permissions
	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}
	at.AddGrant(grant)
	
	// Inject metadata to provide context to the Voice Agent
	source := c.Query("source")
	if source == "" {
		source = "Web App (Generative UI)"
	}
	metadataMap := map[string]string{
		"source":  source,
		"user_id": userID,
	}
	metadataBytes, _ := json.Marshal(metadataMap)
	at.SetMetadata(string(metadataBytes))
	at.SetIdentity(userID)
	at.SetName(userID)

	token, err := at.ToJWT()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"room":  roomName,
		"url":   os.Getenv("LIVEKIT_URL"),
	})
}
