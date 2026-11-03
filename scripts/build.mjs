import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('dist');
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const path of ['index.html', 'manifest.webmanifest', 'src', 'icons']) await cp(path, resolve(out, path), { recursive: true });
const files = ['index.html', 'src/app.js', 'src/model.js', 'src/storage.js', 'src/dates.js', 'src/styles.css', 'sw.js', 'manifest.webmanifest'];
for (const file of files) await readFile(file);
const buildId = `${Date.now().toString(36)}-${process.env.GITHUB_SHA?.slice(0, 8) || 'local'}`;
const serviceWorker = (await readFile('sw.js', 'utf8')).replace('`${CACHE_PREFIX}dev`', `\`${'${CACHE_PREFIX}'}${buildId}\``);
await writeFile(resolve(out, 'sw.js'), serviceWorker);
console.log(`Built ${files.length} core files in dist/ (cache ${buildId})`);
