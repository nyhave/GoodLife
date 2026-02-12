#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Configure gh CLI to use the egress proxy for GitHub API access
if [ -n "${GLOBAL_AGENT_HTTP_PROXY:-}" ]; then
  echo "export HTTPS_PROXY=\"${GLOBAL_AGENT_HTTP_PROXY}\"" >> "$CLAUDE_ENV_FILE"
  echo "export HTTP_PROXY=\"${GLOBAL_AGENT_HTTP_PROXY}\"" >> "$CLAUDE_ENV_FILE"
fi

# Authenticate gh CLI if GH_TOKEN is available
if [ -n "${GH_TOKEN:-}" ]; then
  echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi
