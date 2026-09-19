import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.resolve(process.env.FORMFIX_BACKEND_DIR ?? path.join(root, '../formfix-ai'));
const schema = await fs.readFile(path.join(backend, 'packages/contracts/index.ts'), 'utf8');
const target = path.join(root, 'packages/contracts/src/backend.ts');
const content = '// Generated from formfix-ai/packages/contracts/index.ts; run scripts/sync-backend.mjs.\n' + schema;
if (await fs.readFile(target, 'utf8').catch(() => '') !== content)
  await fs.writeFile(target, content);
await fs.mkdir(path.join(root, 'apps/web/public/samples'), { recursive: true });
await fs.copyFile(path.join(backend, 'fixtures/demo/sample-student-support.pdf'),
  path.join(root, 'apps/web/public/samples/backend-sample.pdf'));
