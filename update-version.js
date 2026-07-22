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

// Read authoritative version from tauri.conf.json, fall back to version.json, then default
let currentVersion = '1.0.0';
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
try {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  currentVersion = tauriConf.version || '1.0.0';
} catch {
  try {
    const current = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    currentVersion = current.version || '1.0.0';
  } catch {
    console.log('No version source found — using default version.');
  }
}

// Optional version override from CLI: node update-version.js 1.2.3
const newVersion = process.argv[2] || currentVersion;

const versionData = { version: newVersion, buildDate };
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');

// Keep tauri.conf.json in sync when the version changes
try {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
} catch (err) {
  console.error(`Warning: could not update tauri.conf.json — ${err.message}`);
}

console.log(`Version updated: ${buildDate} v.${newVersion}`);
