import test from 'node:test';
import assert from 'node:assert/strict';
import { standardRateMismatch } from '../src/lib/research/standard-rate-evidence.ts';
test('post-promotion rate is checked separately from promotional and lower tiers', () => {
 const page = 'Earn 4.35% APY. After boost ends, earn our competitive standard rates: 3.75% APY on balances $5,000 or more. 0.25% APY below $5,000.';
 assert.equal(standardRateMismatch(page, 3.9), true);
 assert.equal(standardRateMismatch(page, 3.75), false);
 assert.equal(standardRateMismatch('Earn 4.35% APY', 3.75), false);
 assert.equal(standardRateMismatch(page, null), false);
});
