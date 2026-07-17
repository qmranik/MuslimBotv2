# Bench CLI MCP Server

This directory contains the configuration and implementation for the `bench-mcp` server. 

## Purpose
Exposes safe, structured execution of Frappe `bench` commands (like `migrate`, `build`, `execute`) to AI agents utilizing the Model Context Protocol.

## Integration
This server is designed to run alongside the `go-orchestrator` and proxy requests directly into the `frappe-web` Docker container.

## Configuration
*(Implementation pending based on chosen MCP runtime)*
