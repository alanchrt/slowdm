#!/bin/bash
set -euo pipefail

echo "=== SlowDM Deploy ==="

# Check prerequisites
command -v npx >/dev/null 2>&1 || { echo "Node.js/npm required"; exit 1; }

# Install dependencies
echo "Installing dependencies..."
npm install

# Create D1 database if it doesn't exist
echo "Creating D1 database..."
npx wrangler d1 create slowdm-db 2>/dev/null || echo "Database may already exist"

echo ""
echo "IMPORTANT: Update wrangler.jsonc with the database_id from above output."
echo ""

# Run migrations
echo "Applying migrations..."
npx wrangler d1 migrations apply slowdm-db --remote

# Build
echo "Building..."
npm run build

# Deploy
echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy .svelte-kit/cloudflare

echo ""
echo "=== Deploy complete ==="
echo ""
echo "Next steps:"
echo "1. Set AUTH_PASSWORD secret: npx wrangler pages secret put AUTH_PASSWORD"
echo "2. Set GOOGLE_SERVICE_ACCOUNT_JSON secret: npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_JSON"
echo "3. Visit your deployment URL to complete setup"
