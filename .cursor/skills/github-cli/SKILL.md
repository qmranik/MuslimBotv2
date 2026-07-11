---
name: github-cli
description: Use the GitHub CLI (gh) to manage this multi-platform liteERP project — repositories, pull requests, issues, GitHub Actions CI, and releases. Use when the user wants to create or link a remote, open/review PRs, manage issues, inspect or rerun workflow runs, cut releases, or call the GitHub API via gh.
---

# GitHub CLI (gh) Workflows

`gh` (2.88+) is installed. Use it for all GitHub tasks; prefer `gh` over raw `git` for GitHub-side operations and over the web UI.

## Authenticate

```bash
gh auth status || gh auth login        # choose HTTPS + browser; grant repo, workflow, read:org
```

## Repository setup (no remote yet)

This repo currently has no remote. Create one and push:

```bash
gh repo create <owner>/liteERP --private --source=. --remote=origin --push
# or link an existing remote:
git remote add origin https://github.com/<owner>/liteERP.git && git push -u origin HEAD
```

## Pull requests

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Test plan
- [ ] <how to verify>
EOF
)"
gh pr list                              # open PRs
gh pr view <num> --web                  # open in browser
gh pr checks <num>                      # CI status for a PR
gh pr diff <num>                        # review the diff
gh pr merge <num> --squash --delete-branch
```

## Issues

```bash
gh issue create --title "<title>" --body "<details>" --label bug
gh issue list --state open
gh issue view <num>
gh issue close <num>
```

## GitHub Actions (CI)

This project ships workflows (e.g. `Punk_AI-dev/.github/workflows/backend.yml`, `frontend.yml`).

```bash
gh workflow list
gh run list --workflow=backend.yml --limit 10
gh run view <run-id> --log                 # full logs
gh run view <run-id> --log-failed          # only failing steps
gh run rerun <run-id> --failed             # rerun failed jobs
gh run watch <run-id>                      # live status
```

When investigating a failed check, use `gh run view <id> --log-failed` first to isolate the failing step before reading full logs.

## Releases

```bash
gh release create v1.0.0 --generate-notes
gh release list
```

## Raw API (anything not covered above)

```bash
gh api repos/<owner>/<repo>/pulls/<num>/comments        # PR review comments
gh api -X POST repos/<owner>/<repo>/issues -f title=... -f body=...
```

## Safety

- Never run `gh auth login` non-interactively with a token on the command line that could be logged; prefer the browser flow or `GH_TOKEN` env.
- Do not force-push to `main`/`master` or merge PRs unless the user explicitly asks.
- Confirm the target repo (`gh repo view`) before mutating issues/PRs/releases.
