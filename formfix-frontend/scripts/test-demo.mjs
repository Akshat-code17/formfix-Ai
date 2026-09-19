// Own the Vite child directly so Windows teardown does not depend on an npm shell tree.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, VITE_APP_MODE: 'demo', FORMFIX_E2E_ORIGIN: 'http://localhost:4175' };
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'apps/web', '--mode', 'demo', '--host', 'localhost', '--port', '4175', '--strictPort'], {
  cwd: root, env, stdio: 'inherit', windowsHide: true });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (vite.exitCode !== null) throw new Error('Demo test server exited. Check whether port 4175 is occupied.');
    try { if ((await fetch(env.FORMFIX_E2E_ORIGIN)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Demo test server failed to start.');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.config.ts', ...process.argv.slice(2)], {
    cwd: path.join(root, 'apps/web'), env, stdio: 'inherit', windowsHide: true });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally {
  const exited = new Promise(r => vite.once('exit', r));
  if (vite.exitCode === null) { vite.kill(); await exited; }
}
