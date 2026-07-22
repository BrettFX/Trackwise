#!/usr/bin/env node
/**
 * Local updater test server.
 *
 * Serves a fake latest.json so you can test the update check flow without
 * pushing a real release to GitHub.
 *
 * Usage:
 *   node test-updater.js [--version 1.0.99] [--port 8765]
 *
 * Then run the app with the TAURI_UPDATER_ENDPOINT override:
 *   TAURI_UPDATER_ENDPOINT=http://localhost:8765/latest.json npm run tauri:dev
 *
 * Set --version higher than the current app version to trigger the "update
 * available" path; set it lower (or equal) to test the "up to date" path.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const versionFlag = args.indexOf('--version');
const portFlag = args.indexOf('--port');
const fakeVersion = versionFlag !== -1 ? args[versionFlag + 1] : '99.99.99';
const port = portFlag !== -1 ? parseInt(args[portFlag + 1], 10) : 8765;

// Read the real pubkey so the app's signature check still passes structure-wise.
// The signature field here is a placeholder — local dev builds skip sig verification
// when TAURI_SKIP_UPDATES_SIGN is set (see README note below).
const tauriConf = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src-tauri', 'tauri.conf.json'), 'utf8')
);

const now = new Date().toISOString();

const payload = {
  version: fakeVersion,
  notes: `Test update to v${fakeVersion} — served by test-updater.js`,
  pub_date: now,
  platforms: {
    'windows-x86_64': {
      signature: 'PLACEHOLDER_SIG',
      url: `http://localhost:${port}/Trackwise_${fakeVersion}_x64-setup.exe`,
    },
    'darwin-x86_64': {
      signature: 'PLACEHOLDER_SIG',
      url: `http://localhost:${port}/Trackwise_${fakeVersion}_x64.dmg`,
    },
    'darwin-aarch64': {
      signature: 'PLACEHOLDER_SIG',
      url: `http://localhost:${port}/Trackwise_${fakeVersion}_aarch64.dmg`,
    },
    'linux-x86_64': {
      signature: 'PLACEHOLDER_SIG',
      url: `http://localhost:${port}/Trackwise_${fakeVersion}_amd64.AppImage`,
    },
  },
};

const server = http.createServer((req, res) => {
  if (req.url === '/latest.json') {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    console.log(`[${new Date().toLocaleTimeString()}] GET /latest.json → v${fakeVersion}`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Updater test server running at http://localhost:${port}`);
  console.log(`  Fake version : ${fakeVersion}`);
  console.log(`  App version  : ${tauriConf.version}`);
  console.log(
    fakeVersion > tauriConf.version
      ? '  → "Update available" path will trigger'
      : '  → "Up to date" path will trigger (fake version <= app version)'
  );
  console.log('');
  console.log('To use, set the endpoint in src-tauri/tauri.conf.json to:');
  console.log(`  http://localhost:${port}/latest.json`);
  console.log('Then run: npm run tauri:dev');
  console.log('');
  console.log('Note: signature verification will fail unless you set');
  console.log('  TAURI_SKIP_UPDATES_SIGN=1 in your environment,');
  console.log('  or use a tauri.dev.conf.json override (see comments in this file).');
});
