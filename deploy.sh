#!/bin/bash
set -euo pipefail

COMMAND="${1:-}"

# ── Helpers ──

check_prereqs() {
  command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js required (https://nodejs.org)"; exit 1; }
}

ensure_auth() {
  if npx wrangler whoami 2>&1 | grep -qi "not authenticated"; then
    echo "  You need to log in to Cloudflare."
    npx wrangler login
    if npx wrangler whoami 2>&1 | grep -qi "not authenticated"; then
      echo "  ERROR: Cloudflare login failed. Run 'npx wrangler login' manually."
      exit 1
    fi
  fi
  echo "  Cloudflare authenticated."
}

ensure_deps() {
  [ -d node_modules ] || npm install --silent
}

ensure_resources() {
  echo "  Ensuring Cloudflare resources..."
  node scripts/ensure-resources.mjs
}

do_build_deploy() {
  echo "  Building..."
  npm run build

  echo "  Deploying..."
  npx wrangler deploy
}

# ── Commands ──

do_setup() {
  echo ""
  echo "  SlowDM Setup"
  echo "  ─────────────"
  echo ""

  check_prereqs
  ensure_auth
  ensure_deps
  ensure_resources

  echo ""
  echo "  Setting secrets..."
  echo ""
  echo "  Choose a password for the SlowDM admin interface."
  read -s -p "  Admin password: " AUTH_PASSWORD
  echo ""
  [ -z "$AUTH_PASSWORD" ] && { echo "  ERROR: Password cannot be empty."; exit 1; }
  echo "$AUTH_PASSWORD" | npx wrangler secret put AUTH_PASSWORD 2>/dev/null || true
  echo "  Password set."
  echo ""

  # Gateway setup (optional)
  read -p "  Enable DNS filtering (Cloudflare Gateway)? [y/N] " -r GW_CHOICE
  if [[ "${GW_CHOICE}" =~ ^[Yy]$ ]]; then
    # Account ID (detect first, needed for URLs)
    CF_ACCOUNT=$(npx wrangler whoami 2>&1 | grep -oP '[0-9a-f]{32}' | head -1)

    echo ""
    echo "  First, activate Cloudflare Zero Trust (if you haven't already):"
    echo ""
    echo "    1. Open the Zero Trust dashboard"
    echo "    2. Click 'Get Started' and select the Free plan"
    echo "    3. Choose a team name when prompted (e.g. 'myfamily')"
    echo ""
    ZT_URL="https://one.dash.cloudflare.com/${CF_ACCOUNT}"
    xdg-open "$ZT_URL" 2>/dev/null || open "$ZT_URL" 2>/dev/null || echo "  Open: $ZT_URL"
    echo ""
    read -p "  Press Enter once Zero Trust is activated..." -r
    if [ -z "$CF_ACCOUNT" ]; then
      echo "  Find your account ID in the Cloudflare dashboard URL: dash.cloudflare.com/<account-id>"
      read -p "  Cloudflare account ID: " -r CF_ACCOUNT
    else
      echo "  Detected account ID: $CF_ACCOUNT"
    fi
    if [ -n "$CF_ACCOUNT" ]; then
      printf '%s' "$CF_ACCOUNT" | npx wrangler secret put CF_ACCOUNT_ID
    fi

    # API token
    echo ""
    echo "  Create an API token with these permissions:"
    echo "    - Account > Zero Trust: Edit"
    echo "    - Account > Account Settings: Read"
    echo ""
    TOKEN_URL="https://dash.cloudflare.com/${CF_ACCOUNT}/api-tokens"
    xdg-open "$TOKEN_URL" 2>/dev/null || open "$TOKEN_URL" 2>/dev/null || echo "  Open: $TOKEN_URL"
    echo ""
    read -p "  Paste the API token (or Enter to skip if already set): " -r CF_TOKEN
    if [ -n "$CF_TOKEN" ]; then
      printf '%s' "$CF_TOKEN" | npx wrangler secret put CF_API_TOKEN
      echo "  CF_API_TOKEN set."
    fi

    # Team name — always prompt if we can, regardless of whether token was just entered
    echo ""
    echo "  Detecting Zero Trust team name..."
    API_TOKEN="${CF_TOKEN}"
    # If no token entered this run, try to read from curl test (won't work without token)
    if [ -n "$API_TOKEN" ] && [ -n "$CF_ACCOUNT" ]; then
      CF_TEAM=$(curl -sf -H "Authorization: Bearer $API_TOKEN" \
        "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/access/organizations" 2>/dev/null \
        | grep -oP '"auth_domain"\s*:\s*"[^"]+' | grep -oP '[^"]+$' | sed 's/\.cloudflareaccess\.com//' || true)
    fi
    if [ -n "${CF_TEAM:-}" ]; then
      echo "  Detected team name: $CF_TEAM"
    else
      echo "  Could not auto-detect team name."
      echo "  Your team name is the subdomain you chose during Zero Trust activation."
      echo "  (e.g., if your dashboard shows myteam.cloudflareaccess.com, enter 'myteam')"
      read -p "  Zero Trust team name: " -r CF_TEAM
    fi
    if [ -n "${CF_TEAM:-}" ]; then
      printf '%s' "$CF_TEAM" | npx wrangler secret put CF_TEAM_NAME
      echo "  CF_TEAM_NAME set."
    fi

    echo ""
  fi

  do_build_deploy

  echo ""
  echo "  Setup complete! Visit your deployment URL above."
  echo "  Future updates: npm run update"
  echo ""
}

do_update() {
  check_prereqs
  ensure_auth
  ensure_deps
  ensure_resources
  do_build_deploy
  echo ""
  echo "  Deployed."
  echo ""
}

do_secrets() {
  ensure_auth
  echo "  Set AUTH_PASSWORD:"
  npx wrangler secret put AUTH_PASSWORD
  echo ""
  echo "  Set GOOGLE_SERVICE_ACCOUNT_JSON:"
  npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
}

# ── Main ──

case "$COMMAND" in
  setup)   do_setup ;;
  update)  do_update ;;
  secrets) do_secrets ;;
  *)
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "  setup    First-time setup (create resources, set secrets, deploy)"
    echo "  update   Ensure resources, build, deploy (idempotent)"
    echo "  secrets  Update secrets (password, service account)"
    ;;
esac
