#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionPath = path.join(__dirname, 'public', 'version.json');

// Build date: YYYY.MM.DD.HHmmss
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const buildDate = `${year}.${month}.${day}.${hours}${minutes}${seconds}`;

// Read current version or fall back to default
let currentVersion = '1.0.0';
try {
  const current = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  currentVersion = current.version || '1.0.0';
} catch {
  console.log('No existing version.json found — using default version.');
}

// Optional version override from CLI: node update-version.js 1.2.3
const newVersion = process.argv[2] || currentVersion;

const versionData = { version: newVersion, buildDate };
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
console.log(`Version updated: ${buildDate} v.${newVersion}`);
