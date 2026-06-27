#!/bin/bash
set -euo pipefail

COMMAND="${1:-}"

# ── Helpers ──

check_prereqs() {
  command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js required (https://nodejs.org)"; exit 1; }
}

ensure_auth() {
  if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "  Logging in to Cloudflare..."
    npx wrangler login
  fi
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
  npx wrangler pages deploy .svelte-kit/cloudflare --project-name slowdm
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
  echo "$AUTH_PASSWORD" | npx wrangler pages secret put AUTH_PASSWORD --project-name slowdm 2>/dev/null || \
  echo "$AUTH_PASSWORD" | npx wrangler secret put AUTH_PASSWORD 2>/dev/null || true
  echo "  Password set."
  echo ""

  echo "  Paste your Google Cloud service account JSON key."
  read -p "  Set service account now? [Y/n] " -r SA_CHOICE
  if [[ "${SA_CHOICE:-Y}" =~ ^[Yy]?$ ]]; then
    echo "  Paste the JSON (then press Enter):"
    read -r SA_JSON
    if [ -n "$SA_JSON" ]; then
      echo "$SA_JSON" | npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_JSON --project-name slowdm 2>/dev/null || \
      echo "$SA_JSON" | npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON 2>/dev/null || true
      echo "  Service account set."
    fi
  else
    echo "  Skipped. Run './deploy.sh secrets' later."
  fi
  echo ""

  do_build_deploy

  echo ""
  echo "  Setup complete! Visit your deployment URL above."
  echo "  Future deploys: npm run deploy"
  echo ""
}

do_deploy() {
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
  npx wrangler pages secret put AUTH_PASSWORD --project-name slowdm 2>/dev/null || \
  npx wrangler secret put AUTH_PASSWORD 2>/dev/null
  echo ""
  echo "  Set GOOGLE_SERVICE_ACCOUNT_JSON:"
  npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_JSON --project-name slowdm 2>/dev/null || \
  npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON 2>/dev/null
}

# ── Main ──

case "$COMMAND" in
  setup)   do_setup ;;
  deploy)  do_deploy ;;
  secrets) do_secrets ;;
  *)
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "  setup    First-time setup (create resources, set secrets, deploy)"
    echo "  deploy   Ensure resources, build, deploy (idempotent)"
    echo "  secrets  Update secrets (password, service account)"
    ;;
esac
