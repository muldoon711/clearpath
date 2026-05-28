#!/usr/bin/env node
/**
 * privacy-audit.js — Static scan for common telemetry and analytics patterns.
 *
 * Exits with code 1 if any violation is found so CI can block the build.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BANNED_PATTERNS = [
  { pattern: /google-analytics\.com/i, label: 'Google Analytics URL' },
  { pattern: /googletagmanager\.com/i, label: 'Google Tag Manager URL' },
  { pattern: /segment\.io|segment\.com\/analytics/i, label: 'Segment analytics' },
  { pattern: /mixpanel\.init/i, label: 'Mixpanel init' },
  { pattern: /amplitude\.getInstance/i, label: 'Amplitude init' },
  { pattern: /\.track\s*\(\s*['"`]/i, label: 'Analytics .track() call (verify intent)' },
  { pattern: /firebase\s*\.\s*analytics/i, label: 'Firebase Analytics' },
  { pattern: /crashlytics/i, label: 'Crashlytics' },
  { pattern: /sentry\.init/i, label: 'Sentry init' },
  { pattern: /bugsnag/i, label: 'Bugsnag' },
  { pattern: /IDFA|advertisingIdentifier/i, label: 'Advertising ID access' },
  { pattern: /device_fingerprint|deviceFingerprint/i, label: 'Device fingerprinting' },
  { pattern: /navigator\.sendBeacon/i, label: 'sendBeacon (telemetry risk)' },
];

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.swift', '.kt', '.java'];
const SCAN_DIRS = ['src', 'ios', 'android'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'build', 'dist', '__generated__', '__tests__']);
// Files that define detection blocklists — they contain the banned strings intentionally
const IGNORE_FILES = new Set([
  'src/utils/privacy.ts',
  'scripts/privacy-audit.js',
]);

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const root = path.resolve(__dirname, '..');
let violations = 0;

for (const dir of SCAN_DIRS) {
  const files = walk(path.join(root, dir));
  for (const file of files) {
    const rel = path.relative(root, file);
    if (IGNORE_FILES.has(rel)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      for (const { pattern, label } of BANNED_PATTERNS) {
        if (pattern.test(line)) {
          const rel = path.relative(root, file);
          console.error(`VIOLATION [${label}]\n  ${rel}:${i + 1}  ${line.trim()}\n`);
          violations++;
        }
      }
    });
  }
}

if (violations === 0) {
  console.log('Privacy audit passed — no telemetry patterns detected.');
  process.exit(0);
} else {
  console.error(`Privacy audit FAILED — ${violations} violation(s) found.`);
  process.exit(1);
}
