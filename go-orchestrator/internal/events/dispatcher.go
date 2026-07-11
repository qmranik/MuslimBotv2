package events

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Dispatcher struct {
	cfg  *config.Config
	http *http.Client
}

func NewDispatcher(cfg *config.Config) *Dispatcher {
	return &Dispatcher{
		cfg:  cfg,
		http: &http.Client{Timeout: 15 * time.Second},
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
	var rows []store.EventOutbox
	if err := store.DB.Where("status = ?", "pending").Order("id asc").Limit(25).Find(&rows).Error; err != nil {
		log.Printf("[events] outbox poll failed: %v", err)
		return
	}
	for _, row := range rows {
		target := d.n8nTarget(row.TenantID, row.Source)
		if err := d.post(target, row); err != nil {
			log.Printf("[events] dispatch id=%d → %s failed: %v", row.ID, target, err)
			_ = store.DB.Model(&row).Update("status", "failed").Error
			continue
		}
		_ = store.DB.Model(&row).Update("status", "sent").Error
	}
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
