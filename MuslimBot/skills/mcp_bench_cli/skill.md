# Skill: mcp_bench_cli

## Description
This skill outlines how to interact with the `bench` CLI (the Frappe framework package manager) via the internal Model Context Protocol (MCP) server. It allows agents to safely manage Frappe sites, execute patches, and restart services without raw terminal access.

## Context
Running raw `bench` commands in a bash shell inside Docker can be brittle. The `bench-mcp` server exposes safe, structured endpoints for standard bench operations.

## Available MCP Tools

### 1. `bench_migrate`
- **Purpose:** Runs database migrations after pulling new code or creating new DocTypes.
- **Usage Context:** Trigger this after applying code changes to `small_erp`.
- **Arguments:** `site_name` (default: `small.localhost`)

### 2. `bench_build`
- **Purpose:** Rebuilds JS/CSS assets for the frontend.
- **Usage Context:** Rarely used since MuslimBot is headless, but required if updating internal Frappe UI components.

### 3. `bench_execute`
- **Purpose:** Runs specific Python methods from the Frappe environment.
- **Usage Context:** Used for seeding data or running permissions scripts.
  - *Example Argument:* `method="small_erp.setup_permissions.run"`

## Safety Rules
- Never use the raw `bash` tool to enter the Frappe container if the MCP server is available.
- Always check the output of a `bench_migrate` call for schema errors before proceeding.