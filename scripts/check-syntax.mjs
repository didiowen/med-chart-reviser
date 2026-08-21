#!/usr/bin/env node
// Build-time JavaScript syntax check.
//
// Parses the inline <script> in index.html and every serverless function with
// `node --check`. A syntax error (e.g. a dropped function declaration) exits
// non-zero so the Netlify build fails instead of shipping a page whose entire
// script block silently fails to parse. See PRs #3 and #5 for why this exists.

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failed = false;

// ext: 'cjs' forces classic-script parsing (browser inline scripts),
//      'mjs' forces ES-module parsing (Netlify functions use export/import).
// Pinning the extension makes the check independent of the build image's
// Node version and its module auto-detection behavior.
function check(label, code, ext) {
  const dir = mkdtempSync(join(tmpdir(), 'synchk-'));
  const tmp = join(dir, `chk.${ext}`);
  writeFileSync(tmp, code);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`  ok    ${label}`);
  } catch (e) {
    failed = true;
    console.error(`  FAIL  ${label}`);
    console.error(String(e.stderr || e.stdout || e.message).trim().replace(/^/gm, '        '));
  }
}

// 1. Inline <script> blocks in index.html (skip any with a src= attribute).
const html = readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, count = 0;
while ((m = re.exec(html)) !== null) {
  check(`index.html <script> #${++count}`, m[1], 'cjs');
}
if (count === 0) console.log('  (no inline scripts found in index.html)');

// 2. Serverless functions.
const fnDir = 'netlify/functions';
if (existsSync(fnDir)) {
  for (const f of readdirSync(fnDir)) {
    if (f.endsWith('.js') || f.endsWith('.mjs')) {
      check(`${fnDir}/${f}`, readFileSync(join(fnDir, f), 'utf8'), 'mjs');
    }
  }
}

if (failed) {
  console.error('\nJavaScript syntax check FAILED — aborting build.');
  process.exit(1);
}
console.log('\nAll JavaScript syntax checks passed.');
