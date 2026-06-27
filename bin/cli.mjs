#!/usr/bin/env node

import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const STATE_DIR = join(homedir(), '.slowdm');
const STATE_CONFIG = join(STATE_DIR, 'wrangler.jsonc');

// ── Helpers ──

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function run(cmd) {
  execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env } });
  } catch (e) {
    // Return combined output for checks like whoami, d1 list
    return (e.stdout || '') + (e.stderr || '');
  }
}

function wrangler(args) {
  return `npx wrangler ${args} --config "${STATE_CONFIG}"`;
}

function parseJsonc(text) {
  const stripped = text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(stripped);
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptSecret(question) {
  process.stdout.write(question);
  const rl = createInterface({ input: process.stdin, terminal: false });
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      rl.close();
      process.stdout.write('\n');
      resolve(line);
    });
  });
}

// ── Config Management ──

function initConfig() {
  ensureStateDir();
  if (!existsSync(STATE_CONFIG)) {
    const template = readFileSync(join(PKG_ROOT, 'wrangler.jsonc'), 'utf-8');
    // Point migrations_dir to the package's drizzle directory
    const updated = template.replace(
      '"migrations_dir": "drizzle"',
      `"migrations_dir": "${join(PKG_ROOT, 'drizzle').replace(/\\/g, '/')}"`
    );
    writeFileSync(STATE_CONFIG, updated);
  }
}

function getConfig() {
  return parseJsonc(readFileSync(STATE_CONFIG, 'utf-8'));
}

function updateDatabaseId(dbId) {
  let raw = readFileSync(STATE_CONFIG, 'utf-8');
  raw = raw.replace(/"database_id": "local"/, `"database_id": "${dbId}"`);
  writeFileSync(STATE_CONFIG, raw);
}

// ── Resource Provisioning ──

function isAuthenticated() {
  const output = runCapture('npx wrangler whoami');
  return !output.toLowerCase().includes('not authenticated');
}

function ensureAuth() {
  if (!isAuthenticated()) {
    console.log('  You need to log in to Cloudflare.');
    run('npx wrangler login');
    if (!isAuthenticated()) {
      console.error('  ERROR: Cloudflare login failed. Run "npx wrangler login" manually.');
      process.exit(1);
    }
  }
  console.log('  Cloudflare authenticated.');
}

function ensureResources() {
  const config = getConfig();

  if (config.d1_databases?.length) {
    const existing = runCapture('npx wrangler d1 list');

    for (const db of config.d1_databases) {
      const name = db.database_name;
      if (existing.includes(name)) {
        console.log(`  D1 "${name}" exists`);
      } else {
        console.log(`  D1 "${name}" creating...`);
        const output = runCapture(`npx wrangler d1 create ${name}`);
        const match = output.match(/([0-9a-f-]{36})/);
        if (match) {
          console.log(`  D1 "${name}" created (${match[1]})`);
          if (db.database_id === 'local') {
            updateDatabaseId(match[1]);
          }
        } else {
          console.error(`  ERROR: Failed to create D1 "${name}":`);
          console.error(output);
          process.exit(1);
        }
      }

      console.log(`  D1 "${name}" applying migrations...`);
      run(wrangler(`d1 migrations apply ${name} --remote`));
    }
  }

  console.log('  Resources ready.');
}

// ── Deploy ──

function deploy() {
  const distDir = join(PKG_ROOT, 'dist');
  if (!existsSync(distDir)) {
    console.error('  ERROR: dist/ not found. Package may not be built correctly.');
    process.exit(1);
  }

  console.log('  Deploying to Cloudflare Pages...');
  run(wrangler(`pages deploy "${distDir}" --project-name slowdm`));
}

// ── Commands ──

async function cmdSetup() {
  console.log('');
  console.log('  SlowDM Setup');
  console.log('  ─────────────');
  console.log('');

  initConfig();
  ensureAuth();

  console.log('  Ensuring Cloudflare resources...');
  ensureResources();
  console.log('');

  // Secrets
  console.log('  Setting secrets...');
  console.log('');

  const password = await promptSecret('  Admin password: ');
  if (!password) {
    console.error('  ERROR: Password cannot be empty.');
    process.exit(1);
  }
  const pwResult = spawnSync('npx', ['wrangler', 'pages', 'secret', 'put', 'AUTH_PASSWORD', '--project-name', 'slowdm'], {
    input: password,
    encoding: 'utf-8',
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (pwResult.status !== 0) {
    // Fallback for Workers
    spawnSync('npx', ['wrangler', 'secret', 'put', 'AUTH_PASSWORD', '--config', STATE_CONFIG], {
      input: password,
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit']
    });
  }
  console.log('  Password set.');
  console.log('');

  const saChoice = await prompt('  Set Google service account JSON now? [Y/n] ');
  if (!saChoice || saChoice.match(/^[Yy]/)) {
    const saJson = await prompt('  Paste the JSON: ');
    if (saJson) {
      const saResult = spawnSync('npx', ['wrangler', 'pages', 'secret', 'put', 'GOOGLE_SERVICE_ACCOUNT_JSON', '--project-name', 'slowdm'], {
        input: saJson,
        encoding: 'utf-8',
        stdio: ['pipe', 'inherit', 'inherit']
      });
      if (saResult.status !== 0) {
        spawnSync('npx', ['wrangler', 'secret', 'put', 'GOOGLE_SERVICE_ACCOUNT_JSON', '--config', STATE_CONFIG], {
          input: saJson,
          encoding: 'utf-8',
          stdio: ['pipe', 'inherit', 'inherit']
        });
      }
      console.log('  Service account set.');
    }
  } else {
    console.log('  Skipped. Run "npx slowdm secrets" later.');
  }
  console.log('');

  deploy();

  console.log('');
  console.log('  Setup complete! Visit your deployment URL above.');
  console.log('  Future deploys: npx slowdm deploy');
  console.log('');
}

function cmdDeploy() {
  if (!existsSync(STATE_CONFIG)) {
    console.error('  No SlowDM config found. Run "npx slowdm setup" first.');
    process.exit(1);
  }

  ensureAuth();

  console.log('  Ensuring resources...');
  ensureResources();
  console.log('');

  deploy();

  console.log('');
  console.log('  Deployed.');
  console.log('');
}

async function cmdSecrets() {
  ensureAuth();
  console.log('  Set AUTH_PASSWORD:');
  run('npx wrangler pages secret put AUTH_PASSWORD --project-name slowdm 2>/dev/null || npx wrangler secret put AUTH_PASSWORD');
  console.log('');
  console.log('  Set GOOGLE_SERVICE_ACCOUNT_JSON:');
  run('npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_JSON --project-name slowdm 2>/dev/null || npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON');
}

// ── Main ──

const command = process.argv[2];

switch (command) {
  case 'setup':
    await cmdSetup();
    break;
  case 'deploy':
    cmdDeploy();
    break;
  case 'secrets':
    await cmdSecrets();
    break;
  default:
    console.log('');
    console.log('  SlowDM - Personal MDM for Android devices');
    console.log('');
    console.log('  Usage: npx slowdm <command>');
    console.log('');
    console.log('    setup    First-time setup (create resources, set secrets, deploy)');
    console.log('    deploy   Ensure resources and deploy (idempotent)');
    console.log('    secrets  Update secrets (password, service account)');
    console.log('');
    break;
}
