import test from "node:test";
import assert from "node:assert/strict";
import { categorizeBankHeadline, parseBankAccountRss } from "../src/lib/research/doctor-of-credit.ts";

test("reads only bank-deal titles and the original article links", () => {
  const rss = '<?xml version="1.0"?><rss><channel>' +
    '<item><title><![CDATA[[ID only] Cap Ed Credit Union $200 Checking Bonus – No Direct Deposit Required]]></title><link>https://www.doctorofcredit.com/cap-ed-bonus/</link><description>Full article must not be copied</description></item>' +
    '<item><title><![CDATA[Peak Bank 4.27% APY High Yield Savings]]></title><link>https://www.doctorofcredit.com/peak-rate/</link></item>' +
    '<item><title><![CDATA[Chase United Explorer 90,000 Miles Credit Card Offer]]></title><link>https://www.doctorofcredit.com/card/</link></item>' +
    '<item><title>Unrelated Shopping Coupon</title><link>https://www.doctorofcredit.com/shop/</link></item>' +
    '</channel></rss>';
  const leads = parseBankAccountRss(rss);
  assert.equal(leads.length, 2);
  assert.deepEqual(leads.map((x) => x.category), ["checking_bonus", "hysa"]);
  assert.equal(leads[0].institution, "Cap Ed Credit Union");
  assert.equal(leads[0].title.includes("Full article"), false);
  assert.equal(leads[1].articleUrl, "https://www.doctorofcredit.com/peak-rate/");
});

test("rejects offsite links and repeat feed items", () => {
  const rss = '<rss><channel>' +
    '<item><title>Axos Bank $300 Checking Bonus</title><link>https://www.doctorofcredit.com/axos/</link></item>' +
    '<item><title>Axos Bank $300 Checking Bonus</title><link>https://www.doctorofcredit.com/axos/</link></item>' +
    '<item><title>Fake Bank $900 Checking Bonus</title><link>https://evil.example/fake/</link></item>' +
    '</channel></rss>';
  assert.equal(parseBankAccountRss(rss).length, 1);
});

test("excludes ordinary financial news", () => {
  assert.equal(categorizeBankHeadline("Bank of America credit card 100,000 bonus miles"), null);
  assert.equal(categorizeBankHeadline("Robinhood IRA Transfer Bonus"), null);
  assert.equal(categorizeBankHeadline("Bank loan rates updated"), null);
  assert.equal(categorizeBankHeadline("E*TRADE $400 Savings Bonus"), "savings_bonus");
  assert.equal(categorizeBankHeadline("Citi $325 Checking Bonus"), "checking_bonus");
});
