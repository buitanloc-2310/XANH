import test from 'node:test';
import assert from 'node:assert/strict';
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from '../functions/_lib/crypto.js';

test('PBKDF2 iteration count is hard-pinned to 100000', () => {
  assert.equal(PBKDF2_ITERATIONS, 100000);
});

test('password hash stores exactly 100000 rounds and verifies', async () => {
  const hash = await hashPassword('XanhProduction!2026');
  assert.match(hash, /^pbkdf2\$sha256\$100000\$/);
  assert.equal(await verifyPassword('XanhProduction!2026', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('hashes above the supported 100000-round cost are rejected', async () => {
  const hash = await hashPassword('XanhProduction!2026');
  const unsupportedRounds = String(PBKDF2_ITERATIONS * 2 + 10000);
  const bad = hash.replace('$100000$', `$${unsupportedRounds}$`);
  assert.equal(await verifyPassword('XanhProduction!2026', bad), false);
});
