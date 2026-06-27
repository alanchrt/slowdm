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

  echo ""

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
