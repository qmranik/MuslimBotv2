---
name: implement_spec
description: Reads a target specification file and implements the feature.
---

# Implement Spec Skill

## Instructions
1. Locate and read the target specification file.
2. Ensure the spec file has an "Acceptance Criteria" section. If it doesn't, reject the prompt and ask the user to add it.
3. If the "Acceptance Criteria" section exists, follow the API contract strictly.
4. Update schemas, routes, and services as dictated by the specification.
5. Run a local smoke test (e.g. via playwright-mcp or manual curl) to verify the implementation.
