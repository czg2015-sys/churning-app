import test from "node:test";
import assert from "node:assert/strict";
import { distinctAdvertisedBonusAmounts, extractExplicitBonusVariants } from "../src/lib/research/offer-variants.ts";

test("separates three explicit checking bonuses sharing one webpage", () => {
  const page = "Everyday Checking: Earn a $400 bonus with qualifying direct deposits of $1,000 in 90 days. " +
    "Everyday Checking: Receive a $325 bonus with $1,000 in qualifying deposits in 90 days. " +
    "Clear Access Banking: Get a $125 cash bonus after ten qualifying transactions. " +
    "Everyday Checking has a $15 monthly service fee.";
  const variants = extractExplicitBonusVariants(page, "checking_bonus");
  assert.deepEqual(variants.map(x => x.amount), [400, 325, 125]);
  assert.equal(new Set(variants.map(x => x.key)).size, 3);
  assert.ok(variants[0].product.includes("Checking"));
  assert.ok(variants[2].product.includes("Banking"));
  assert.deepEqual(distinctAdvertisedBonusAmounts(page), [400, 325, 125]);
});

test("does not mix a checking bonus and a savings bonus from a shared page", () => {
  const page = "Smart Advantage Checking: Get a $600 bonus with qualifying monthly direct deposits. " +
    "Savings Builder: Earn a $60 bonus after increasing the balance monthly. " +
    "The savings balance must increase by $200 each month.";
  const checking = extractExplicitBonusVariants(page, "checking_bonus");
  const savings = extractExplicitBonusVariants(page, "savings_bonus");
  assert.deepEqual(checking.map(x=>x.amount), [600]);
  assert.deepEqual(savings.map(x=>x.amount), [60]);
  assert.deepEqual(distinctAdvertisedBonusAmounts(page), [600, 60]);
});

test("ignores qualifying deposit thresholds, account balances and unrelated fees", () => {
  const page = "Everyday Checking: Get a $400 bonus when you receive $1,000 in direct deposits. " +
    "Open with $25 and pay no monthly $15 fee if you keep a $1,500 balance.";
  assert.deepEqual(extractExplicitBonusVariants(page,"checking_bonus").map(x=>x.amount), [400]);
  assert.deepEqual(distinctAdvertisedBonusAmounts(page), [400]);
  assert.deepEqual(extractExplicitBonusVariants("Earn $500 by transferring money, $100 fee applies","checking_bonus"), []);
});

test("does not invent product names on a generic multi-offer marketing page", () => {
  const page = "Earn a $400 bonus. Or get a $125 bonus. Offers subject to terms.";
  assert.equal(extractExplicitBonusVariants(page,"checking_bonus").length, 0);
  assert.deepEqual(distinctAdvertisedBonusAmounts(page), [400,125]);
});

test("duplicate mentions of the same promotion do not create additional candidates", () => {
  const page = "Everyday Checking: Get a $400 bonus. Everyday Checking: Earn a $400 bonus.";
  assert.equal(extractExplicitBonusVariants(page, "checking_bonus").length, 1);
});
