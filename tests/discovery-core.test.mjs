import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, extractOfferLinks, offerSignal, uniqueSources } from '../src/lib/research/discovery-core.ts';

test('deduplicates tracking URLs while retaining offer eligibility codes', () => {
  assert.equal(canonicalizeUrl('https://www.example.com/bonus/?utm_source=a#terms'), 'https://example.com/bonus');
  assert.notEqual(canonicalizeUrl('https://example.com/bonus?ref=A'), canonicalizeUrl('https://example.com/bonus?ref=B'));
});
test('follows only relevant same-host HTTPS links, excluding applications and scripts', () => {
  const html = `<a href='/offers/new?code=A&amp;utm_source=x'>Bonus</a>
    <a href='https://evil.example/bonus'>Bonus</a><a href='http://bank.example/bonus'>Bonus</a>
    <a href='/apply/bonus'>Apply</a><a href='/business/offer'>Business</a>
    <script><a href='/offers/fake'>Bonus</a></script><a href='/contact'>Contact</a>`;
  assert.deepEqual(extractOfferLinks(html, 'https://bank.example/offers'), ['https://bank.example/offers/new?code=A&utm_source=x']);
});
test('caps linked discovery and avoids current-page fragments', () => {
  const html = `<a href='#bonus'>Bonus</a>` + [1,2,3,4].map(n => `<a href='/offer/${n}'>Bonus</a>`).join('');
  assert.equal(extractOfferLinks(html, 'https://bank.example/offers', 2).length, 2);
});
test('does not mistake generic direct deposit copy for a bonus', () => {
  assert.equal(offerSignal('Open checking with direct deposit and a $12 monthly fee.', 'checking_bonus'), null);
  assert.ok(offerSignal('Earn a $300 bonus with qualifying deposits.', 'checking_bonus'));
  assert.ok(offerSignal('Earn 4.25% APY on savings.', 'hysa'));
  assert.equal(offerSignal('Learn about APY and savings.', 'hysa'), null);
  assert.ok(offerSignal('Earn 1% cash back on debit purchases.', 'debit_spend'));
});
test('retains different categories on a shared page and rejects unsafe seeds', () => {
  const a = { institution: 'Bank', url: 'https://bank.example/offer', category: 'checking_bonus' };
  assert.equal(uniqueSources([a, a, {...a, category: 'savings_bonus'}, {...a, url: 'http://bank.example'}, {...a,url:'https://user:password@bank.example'}]).length, 2);
});
