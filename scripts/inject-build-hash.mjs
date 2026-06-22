import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

const files = [
  'www/js/app.js',
  'docs/js/app.js',
];

for (const f of files) {
  try {
    const content = readFileSync(f, 'utf-8');
    const updated = content.replace(/__BUILD_HASH__/g, hash);
    writeFileSync(f, updated);
    console.log(`Injected build hash ${hash} into ${f}`);
  } catch {
    // file may not exist yet on first run
  }
}
