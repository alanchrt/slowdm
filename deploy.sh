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
    # Auto-detect account ID
    CF_ACCOUNT=$(npx wrangler whoami 2>&1 | grep -oP '(?<=id: )[0-9a-f]+' | head -1)
    if [ -z "$CF_ACCOUNT" ]; then
      echo "  Could not detect account ID automatically."
      echo "  Find it in the Cloudflare dashboard URL: dash.cloudflare.com/<account-id>"
      read -p "  Cloudflare account ID: " -r CF_ACCOUNT
    else
      echo "  Detected account ID: $CF_ACCOUNT"
    fi

    if [ -n "$CF_ACCOUNT" ]; then
      echo "$CF_ACCOUNT" | npx wrangler secret put CF_ACCOUNT_ID 2>/dev/null || true
    fi

    echo ""
    echo "  Create an API token with these permissions:"
    echo "    - Account > Zero Trust: Edit"
    echo "    - Account > Account Settings: Read"
    echo ""
    echo "  Opening Cloudflare dashboard..."

    # Try to open browser
    TOKEN_URL="https://dash.cloudflare.com/profile/api-tokens"
    xdg-open "$TOKEN_URL" 2>/dev/null || open "$TOKEN_URL" 2>/dev/null || echo "  Visit: $TOKEN_URL"
    echo ""
    read -p "  Paste the API token: " -r CF_TOKEN
    if [ -n "$CF_TOKEN" ]; then
      echo "$CF_TOKEN" | npx wrangler secret put CF_API_TOKEN 2>/dev/null || true
      echo "  CF_API_TOKEN set."
    fi
    echo ""
    echo "  After deploy, set your Zero Trust team name in Settings."
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
