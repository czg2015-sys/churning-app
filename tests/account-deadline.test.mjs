import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDeadline } from '../src/lib/account-deadline.ts';
const mission = {opened_at:'2026-10-01', first_dd_at:'2026-11-01', opportunity:{qualification_days:90,direct_deposit_required:1000}};
test('Wells clock uses opening date rather than first DD and shows target', () => {
 const result = accountDeadline(mission,'2026-11-03');
 assert.equal(result.deadline,'2026-12-30');
 assert.match(result.label,/Reach \$1,000 qualifying DD by Dec 30, 2026/);
 assert.match(result.detail,/57 days left/);
});
test('event-based offers wait for actual trigger and use their own duration', () => {
 const offer = {...mission,opened_at:'2026-10-01',first_dd_at:null,opportunity:{qualification_days:25,qualification_start_trigger:'first_dd_at',direct_deposit_required:5000}};
 assert.equal(accountDeadline(offer,'2026-11-03').deadline,null);
 assert.match(accountDeadline(offer,'2026-11-03').label,/Add first qualifying DD date/);
 assert.equal(accountDeadline({...offer,first_dd_at:'2026-11-01'},'2026-11-03').deadline,'2026-11-26');
});
test('savings hold uses funding date and updated event replaces stale deadline', () => {
 const offer = {...mission,funded_at:'2026-10-29',qualification_deadline:'2026-12-30',opportunity:{qualification_days:90,qualification_start_trigger:'funded_at',required_balance:5000}};
 assert.equal(accountDeadline(offer,'2026-11-03').deadline,'2027-01-27');
 assert.match(accountDeadline(offer,'2026-11-03').label,/Maintain \$5,000 through/);
});
test('missing and past dates are explicit; no default 90 days', () => {
 assert.equal(accountDeadline({opportunity:{}},'2026-11-03').deadline,null);
 assert.match(accountDeadline(mission,'2027-01-01').detail,/deadline passed/);
});
