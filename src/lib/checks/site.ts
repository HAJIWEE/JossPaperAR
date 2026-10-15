/**
 * check:site — the PLAY CONSOLE website contract, asserted.
 *
 * Google's org verification needs a LIVE URL that names the org and carries
 * the two declared contact channels. Three files must agree with SCRUM-71:
 *
 *   public/index.html   → org name · email · phone · privacy link
 *   public/privacy.html → standalone policy URL + deletion contact
 *   public/_redirects   → must NOT touch `/` or `/.well-known/`
 *
 * ⚠️ WHAT THIS GATE DOES NOT PROVE: that the domain serves these files.
 * That is a real deploy + `curl -sI https://josspaperar.app/` (200, no
 * redirect). See public/.well-known/README.md.
 *
 * Dependency-free (Node 22 strips the types), same as check:links.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The SCRUM-71 values — the site must carry THESE, not lookalikes. */
const ORG_NAME = 'JOSSPAPERAR';
const EMAIL = 'superAdmin@josspaperar.app';
const PHONE_TEL = 'tel:+6597830688';

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

console.log('\nsite · the Play Console website contract (SCRUM-71 values)\n');

const index = read('public/index.html');
check('index.html names the org', index.includes(ORG_NAME));
check('index.html carries the contact email', index.includes(EMAIL));
check('index.html carries the contact phone', index.includes(PHONE_TEL));
check('index.html links the privacy policy', index.includes('/privacy.html'));
check('index.html names the Play package', index.includes('app.josspaperar'));

const privacy = read('public/privacy.html');
check('privacy.html exists and is standalone', privacy.length > 1000);
check('privacy.html names the controller', privacy.includes(ORG_NAME));
check('privacy.html carries the deletion contact', privacy.includes(EMAIL));
check('privacy.html states the photo window', privacy.includes('7 days'));
check('privacy.html states what Google keeps', privacy.includes('Held by Google'));

const redirects = read('public/_redirects');
const lines = redirects.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
check(
  'no redirect touches `/` or `/.well-known/` (Apple no-redirect rule)',
  lines.every((l) => {
    const src = l.split(/\s+/)[0] ?? '';
    return src.startsWith('/join');
  }),
  lines.filter((l) => !(l.split(/\s+/)[0] ?? '').startsWith('/join')).join('; '),
);

console.log('\n────────────────────────────────────────────────────────────────');
if (failures.length > 0) {
  console.log(`✗ ${failures.length} of ${passed + failures.length} site checks FAILED:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log(`✓ all ${passed} site checks passed`);
