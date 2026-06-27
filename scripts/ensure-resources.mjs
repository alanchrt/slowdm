#!/usr/bin/env node

// Reads wrangler.jsonc and ensures all declared resources exist on Cloudflare.
// Idempotent -- safe to run on every deploy.

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
}

function parseJsonc(text) {
  const stripped = text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(stripped);
}

// ── Auth check ──

const whoami = runCapture('npx wrangler whoami 2>&1');
if (whoami.toLowerCase().includes('not authenticated')) {
  console.error('  ERROR: Not authenticated with Cloudflare. Run "npx wrangler login" first.');
  process.exit(1);
}

const config = parseJsonc(readFileSync('wrangler.jsonc', 'utf-8'));

// ── D1 Databases ──

if (config.d1_databases?.length) {
  const existing = runCapture('npx wrangler d1 list 2>&1');

  for (const db of config.d1_databases) {
    const name = db.database_name;
    if (existing.includes(name)) {
      console.log(`  D1 "${name}" exists`);
    } else {
      console.log(`  D1 "${name}" creating...`);
      const output = runCapture(`npx wrangler d1 create ${name} 2>&1`);
      const match = output.match(/([0-9a-f-]{36})/);
      if (match) {
        console.log(`  D1 "${name}" created (${match[1]})`);
        if (db.database_id === 'local') {
          const raw = readFileSync('wrangler.jsonc', 'utf-8');
          writeFileSync('wrangler.jsonc', raw.replace('"database_id": "local"', `"database_id": "${match[1]}"`));
        }
      } else {
        console.error(`  ERROR: Failed to create D1 "${name}":`);
        console.error(output);
        process.exit(1);
      }
    }

    if (db.migrations_dir) {
      console.log(`  D1 "${name}" applying migrations...`);
      run(`npx wrangler d1 migrations apply ${name} --remote`);
    }
  }
}

// ── KV Namespaces ──

if (config.kv_namespaces?.length) {
  const existing = runCapture('npx wrangler kv namespace list 2>&1');

  for (const kv of config.kv_namespaces) {
    const title = kv.title || kv.binding;
    if (existing.includes(title)) {
      console.log(`  KV "${title}" exists`);
    } else {
      console.log(`  KV "${title}" creating...`);
      run(`npx wrangler kv namespace create ${title}`);
    }
  }
}

// ── R2 Buckets ──

if (config.r2_buckets?.length) {
  const existing = runCapture('npx wrangler r2 bucket list 2>&1');

  for (const bucket of config.r2_buckets) {
    if (existing.includes(bucket.bucket_name)) {
      console.log(`  R2 "${bucket.bucket_name}" exists`);
    } else {
      console.log(`  R2 "${bucket.bucket_name}" creating...`);
      run(`npx wrangler r2 bucket create ${bucket.bucket_name}`);
    }
  }
}

console.log('  Resources ready.');
