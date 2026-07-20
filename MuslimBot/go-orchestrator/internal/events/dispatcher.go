package events

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/knowledge"
	"muslimbot-orchestrator/internal/store"
)

type Dispatcher struct {
	cfg      *config.Config
	http     *http.Client
	workerID string
}

func NewDispatcher(cfg *config.Config) *Dispatcher {
	host, _ := os.Hostname()
	return &Dispatcher{
		cfg:      cfg,
		http:     &http.Client{Timeout: 15 * time.Second},
		workerID: fmt.Sprintf("%s-%s", host, uuid.NewString()[:8]),
	}
}

func (d *Dispatcher) Start() {
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			d.flush()
		}
	}()
	log.Println("[events] outbox dispatcher started")
}

func (d *Dispatcher) flush() {
	if store.DB == nil {
		return
	}
	now := time.Now().UTC()
	var rows []store.EventOutbox
	// Claim pending rows that are available (lease-friendly poll).
	if err := store.DB.
		Where("status = ? AND (available_at IS NULL OR available_at <= ?)", "pending", now).
		Order("id asc").
		Limit(25).
		Find(&rows).Error; err != nil {
		log.Printf("[events] outbox poll failed: %v", err)
		return
	}
	for _, row := range rows {
		claimed := store.DB.Model(&store.EventOutbox{}).
			Where("id = ? AND status = ?", row.ID, "pending").
			Updates(map[string]interface{}{
				"status":    "processing",
				"locked_at": now,
				"locked_by": d.workerID,
				"attempts":  row.Attempts + 1,
			})
		if claimed.RowsAffected == 0 {
			continue
		}
		row.Attempts++

		var err error
		dest := row.Destination
		if dest == "" {
			dest = knowledge.DestN8N
		}
		switch dest {
		case knowledge.DestRedisStream:
			err = d.publishRedisStream(row)
		default:
			target := d.n8nTarget(row.TenantID, row.Source)
			err = d.post(target, row)
		}

		if err != nil {
			log.Printf("[events] dispatch id=%d dest=%s failed: %v", row.ID, dest, err)
			d.failOrRetry(row, err)
			continue
		}
		sent := time.Now().UTC()
		_ = store.DB.Model(&store.EventOutbox{}).Where("id = ?", row.ID).Updates(map[string]interface{}{
			"status":     "sent",
			"sent_at":    sent,
			"last_error": "",
			"locked_at":  nil,
			"locked_by":  "",
		}).Error
	}
}

func (d *Dispatcher) failOrRetry(row store.EventOutbox, err error) {
	max := row.MaxAttempts
	if max <= 0 {
		max = 8
	}
	updates := map[string]interface{}{
		"last_error": err.Error(),
		"locked_at":  nil,
		"locked_by":  "",
	}
	if row.Attempts >= max {
		updates["status"] = "dead"
	} else {
		backoff := time.Duration(row.Attempts*row.Attempts) * time.Second
		if backoff > 5*time.Minute {
			backoff = 5 * time.Minute
		}
		next := time.Now().UTC().Add(backoff)
		updates["status"] = "pending"
		updates["available_at"] = next
	}
	_ = store.DB.Model(&store.EventOutbox{}).Where("id = ?", row.ID).Updates(updates).Error
}

func (d *Dispatcher) publishRedisStream(row store.EventOutbox) error {
	var payload knowledge.GenerationChangedPayload
	if err := json.Unmarshal([]byte(row.Payload), &payload); err != nil {
		return fmt.Errorf("invalid kb stream payload: %w", err)
	}
	if payload.EventID == "" {
		payload.EventID = row.EventID
	}
	if payload.TenantID == "" {
		payload.TenantID = row.TenantID
	}
	return knowledge.PublishGenerationStream(context.Background(), d.cfg, payload)
}

func (d *Dispatcher) n8nTarget(tenant, source string) string {
	base := d.cfg.N8NBaseURL
	if d.cfg.N8NURLTemplate != "" {
		base = strings.ReplaceAll(d.cfg.N8NURLTemplate, "{tenant}", tenant)
	}
	if source == "" {
		source = "events"
	}
	return strings.TrimRight(base, "/") + "/webhook/" + source
}

func (d *Dispatcher) post(target string, row store.EventOutbox) error {
	body := []byte(row.Payload)
	if !json.Valid(body) {
		wrapped, _ := json.Marshal(map[string]any{
			"type":      row.Type,
			"tenant_id": row.TenantID,
			"source":    row.Source,
			"payload":   row.Payload,
		})
		body = wrapped
	}
	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-Id", row.TenantID)
	req.Header.Set("X-Event-Type", row.Type)
	req.Header.Set("X-Event-Source", row.Source)
	if row.IdempotencyKey != "" {
		req.Header.Set("X-Idempotency-Key", row.IdempotencyKey)
	}
	res, err := d.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<16))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return errStatus(res.StatusCode)
	}
	return nil
}

type statusError int

func (e statusError) Error() string {
	return "n8n returned non-2xx"
}

func errStatus(code int) error {
	return statusError(code)
}
