import test from 'node:test';
import assert from 'node:assert/strict';
import {offerResearchStatus} from '../src/lib/offer-research.ts';
const now=new Date('2026-11-05T12:00:00Z');
const offer={category:'savings_bonus',safety_gate:'green',evidence_confidence:95,last_verified_at:'2026-11-04T12:00:00Z',opportunity_reviews:[{reviewed_at:'2026-11-04',hard_pull_status:'none',chexsystems_status:'checked',ews_status:'checked',tax_status:'checked',insurance_status:'checked',close_rule_status:'checked'}]};
test('fresh evidence and complete review are required for public research badge',()=>{
 assert.equal(offerResearchStatus(offer,now).cleared,true);
 assert.equal(offerResearchStatus({...offer,opportunity_reviews:[]},now).cleared,false);
 assert.equal(offerResearchStatus({...offer,last_verified_at:null},now).cleared,false);
 assert.equal(offerResearchStatus({...offer,last_verified_at:'2026-10-01'},now).cleared,false);
 assert.equal(offerResearchStatus({...offer,last_verified_at:'2026-12-01'},now).cleared,false);
});
test('expired application dates override a green stored gate',()=>{
 assert.equal(offerResearchStatus({...offer,expires_at:'2026-11-04'},now).label,'Deadline passed');
 assert.equal(offerResearchStatus({...offer,expires_at:'2026-11-05'},now).cleared,true);
});
test('newest incomplete review overrides an older complete review',()=>{
 assert.equal(offerResearchStatus({...offer,opportunity_reviews:[...offer.opportunity_reviews,{reviewed_at:'2026-11-05',close_rule_status:'pending'}]},now).cleared,false);
});
