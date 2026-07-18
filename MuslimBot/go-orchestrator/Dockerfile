# Stage 1: Build the Go binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

# Stage 2: Runtime image
# Base on oven/bun so the orchestrator can spawn the Chatwoot stdio MCP server
# (fazer-ai/mcp-chatwoot, `bun run start`). bash + git support the launcher
# (scripts/mcp/run-chatwoot-mcp.sh) and `bun install`. See docs/architecture/ADR-0001.
#
# NOTE: the mcp-chatwoot source is a submodule OUTSIDE this build context
# (mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot), so it is NOT copied here — it
# must be bind-mounted at runtime and pointed to via env, e.g. in compose:
#   volumes:
#     - ../mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot:/opt/mcp/chatwoot-mcp/vendor/mcp-chatwoot:ro
#     - ./scripts/mcp:/opt/mcp/scripts/mcp:ro   # (or bake scripts into the context)
#   environment:
#     MCP_CHATWOOT_CWD: /opt/mcp
#     MCP_CHATWOOT_COMMAND: "bash scripts/mcp/run-chatwoot-mcp.sh"
# Without the mount, only TryPost's HTTP MCP tools connect (TryPost still works).
FROM oven/bun:1-alpine
RUN apk --no-cache add ca-certificates bash git
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["/app/main"]
