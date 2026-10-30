import test from "node:test";
import assert from "node:assert/strict";
import { visibleRewardHistory, hasRecordedReward, hasRealProgress } from "../src/lib/reward-history-rules.ts";

const at = "2026-10-01T12:00:00.000Z";
function mission(status, kind, extra = {}) {
  const steps = kind === "paid" ? [{step_type:"bonus_received",current_amount:400,is_complete:true}] :
    kind === "unpaid" ? [{step_type:"bonus_received",current_amount:0,is_complete:false}] :
    [{step_type:"direct_deposit",current_amount:0,is_complete:false,updated_at:at}];
  return {id:status + kind,institution:"Example Bank",status,created_at:at,opened_at:null,
    expected_bonus:400,mission_steps:steps,...extra};
}
test("committed cash does not imply receipt of a bonus", () => {
  const savings = mission("active","unpaid",{amount_committed:10000,opened_at:"2026-09-01"});
  assert.equal(hasRecordedReward(savings),false);
  assert.equal(visibleRewardHistory([savings],[]).completed.length,0);
});
test("a mission marked complete without a recorded payout is not shown as earned", () => {
  assert.equal(hasRecordedReward(mission("complete","unpaid")),false);
});
test("reward history shows paid rewards but omits no-progress abandoned offers", () => {
  const paid=mission("complete","paid");
  const cancelled=mission("cancelled","no-work");
  const other=mission("cancelled","worked",{opened_at:"2026-09-01"});
  const raw=[{institution:"Example Bank",bonus_received:false,bonus_amount:0,notes:"Prior offer added"},{institution:"Other Bank",bonus_received:true,bonus_amount:250,notes:"paid"}];
  const r=visibleRewardHistory([paid,cancelled,other],raw);
  assert.equal(r.completed.length,1);
  assert.deepEqual(r.stopped.map(x=>x.id),[other.id]);
  assert.equal(r.standalone.length,1);
  assert.equal(hasRealProgress(cancelled),false);
});
test("manual DD progress counts, but prefilled planning amounts do not", () => {
  const initial=mission("cancelled","none",{amount_committed:10000});
  initial.mission_steps=[{step_type:"hold",current_amount:10000,is_complete:false,updated_at:at}];
  assert.equal(hasRealProgress(initial),false);
  initial.mission_steps[0].updated_at="2026-10-02T12:00:00.000Z";
  assert.equal(hasRealProgress(initial),true);
});
