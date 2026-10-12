#!/usr/bin/env node
import {readFileSync, readdirSync, statSync} from 'fs';
import {join, relative} from 'path';

// Patterns that must NOT appear in template-committed files
const FORBIDDEN_PATTERNS = [
  {pattern: /client_id\s*=\s*["'][a-f0-9]{32}["']/i, description: 'Shopify client_id in config'},
  {pattern: /uid\s*=\s*["'][a-f0-9-]{36,}["']/i, description: 'Extension uid in config'},
  {pattern: /[a-zA-Z0-9_-]+\.myshopify\.com/i, description: 'Real myshopify.com store domain'},
  {pattern: /shpat_[a-fA-F0-9]{32,}/i, description: 'Shopify Admin Access Token (shpat_)'},
  {pattern: /shpss_[a-fA-F0-9]{32,}/i, description: 'Shopify Shared Secret (shpss_)'},
  {pattern: /SHOPIFY_API_SECRET/i, description: 'Shopify API Secret reference'},
];

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.shopify', 'dist', 'build', '.gemini']);
const IGNORE_FILES = new Set(['scripts/check-secrets.mjs', 'docs/DECISIONS.md', 'package-lock.json', 'pnpm-lock.yaml']);

let violations = 0;

function scanDir(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const relPath = relative(process.cwd(), fullPath);

    if (IGNORE_FILES.has(relPath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile()) {
      checkFile(fullPath, relPath);
    }
  }
}

function checkFile(fullPath, relPath) {
  try {
    const content = readFileSync(fullPath, 'utf8');
    for (const {pattern, description} of FORBIDDEN_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        console.error(`❌ Secret/Identity Leak [${description}]: ${relPath}`);
        console.error(`   Matched: "${match[0]}"`);
        violations++;
      }
    }
  } catch {
    // Ignore non-text or binary files
  }
}

console.log('🔍 Running check-secrets script on repository files...');
scanDir(process.cwd());

if (violations > 0) {
  console.error(`\n❌ Failed: Found ${violations} forbidden secret/identity patterns.`);
  process.exit(1);
} else {
  console.log('✅ Passed: No secrets, client IDs, uids, or myshopify domains found in template files.');
  process.exit(0);
}
