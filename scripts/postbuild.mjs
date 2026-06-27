#!/usr/bin/env node

// Wraps the SvelteKit worker output to add a scheduled (cron) handler.
// The cron handler self-invokes /api/enforce with a CRON_SECRET header.

import { readFileSync, writeFileSync, existsSync } from 'fs';

const workerPath = '.svelte-kit/cloudflare/_worker.js';
if (!existsSync(workerPath)) {
	console.error('ERROR: _worker.js not found. Run `npm run build` first.');
	process.exit(1);
}

let code = readFileSync(workerPath, 'utf-8');

// Find the default export and wrap it to add scheduled handler
// SvelteKit adapter-cloudflare outputs: export { X as default } or export default X
const namedExport = code.match(/export\s*\{\s*(\w+)\s+as\s+default\s*\}/);
const directExport = code.match(/export\s+default\s+(\w+)\s*;/);

let exportName;
let replacePattern;

if (namedExport) {
	exportName = namedExport[1];
	replacePattern = namedExport[0];
} else if (directExport) {
	exportName = directExport[1];
	replacePattern = directExport[0];
} else {
	console.warn('WARNING: Could not find default export in _worker.js. Cron trigger will not work.');
	process.exit(0);
}

const wrapper = `
const __slowdm_wrapped__ = {
	fetch: ${exportName}.fetch.bind(${exportName}),
	async scheduled(event, env, ctx) {
		const headers = new Headers({ 'Content-Type': 'application/json' });
		if (env.CRON_SECRET) headers.set('X-Cron-Secret', env.CRON_SECRET);
		const request = new Request('http://localhost/api/enforce', {
			method: 'POST',
			headers
		});
		const response = await ${exportName}.fetch(request, env, ctx);
		if (!response.ok) {
			console.error('Cron enforce failed:', response.status, await response.text());
		}
	}
};
export { __slowdm_wrapped__ as default };
`;

code = code.replace(replacePattern, wrapper);
writeFileSync(workerPath, code);
console.log('  Added scheduled handler to worker.');
