import { spawn, fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.resolve(process.env.FORMFIX_BACKEND_DIR ?? path.join(root, '../formfix-ai'));
const python = path.resolve(root, '../../work/venv/Scripts/python.exe');
const tesseract = path.resolve(root, '../../work/tesseract');
const env = { ...process.env, APP_ORIGIN: 'http://localhost:5174', VITE_APP_MODE: 'live',
  API_PROXY_TARGET: 'http://127.0.0.1:8080', DEV_API_PORT: '8080' };
for (const [host, port] of [['localhost', 5174], ['127.0.0.1', 8080]]) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', () => reject(new Error(`Port ${port} is occupied. Stop the previous connected launch first.`))); probe.listen(port, host, resolve); });
  await new Promise(resolve => probe.close(resolve));
}
if (!env.PYTHON && fs.existsSync(python)) env.PYTHON = python;
if (fs.existsSync(path.join(tesseract, 'tesseract.exe'))) {
  env.PATH = `${tesseract}${path.delimiter}${env.PATH ?? env.Path ?? ''}`;
  delete env.Path;
  env.TESSDATA_PREFIX ??= path.join(tesseract, 'tessdata');
}
async function run(file, args, cwd) {
  const child = spawn(process.execPath, [file, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
  await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code})`))); });
}
await run('node_modules/typescript/bin/tsc', ['--noEmit', 'false', '--outDir', 'dist'], backend);
await run('scripts/copy-assets.mjs', [], backend);
await run('scripts/sync-backend.mjs', [], root);
fs.mkdirSync(path.join(backend, 'work'), { recursive: true });
const api = fork(path.join(backend, 'dist/scripts/dev-server.js'), [], { cwd: backend, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true });
let vite;
let exiting = false;
api.on('exit', code => {
  if (!exiting && vite) {
    console.error(`Backend stopped (${code}). Restart npm run dev:connected.`);
    process.exitCode = code || 1;
    vite.kill();
  }
});
async function stop() {
  if (exiting) return;
  exiting = true;
  vite?.kill();
  if (api.connected) api.send('stop');
  await new Promise(r => { if (api.exitCode !== null) r(); else api.once('exit', r); });
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try {
  await new Promise((resolve, reject) => { api.once('message', m => m === 'ready' && resolve()); api.once('exit', () => reject(new Error('Backend failed to start.'))); api.once('error', reject); });
  vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', 'localhost', '--port', '5174'], {
    cwd: path.join(root, 'apps/web'), env, stdio: 'inherit', windowsHide: true });
  if (process.argv.includes('--test')) {
    await run('node_modules/@playwright/test/cli.js', ['test', '--config', 'apps/web/playwright.connected.config.ts'], root);
  } else {
    console.log('Open http://localhost:5174. Ctrl+C stops the demo and removes its temporary data.');
    await new Promise((resolve, reject) => { vite.once('exit', resolve); vite.once('error', reject); });
  }
} finally { await stop(); }
