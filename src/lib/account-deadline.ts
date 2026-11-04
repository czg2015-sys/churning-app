import type { Mission } from './types';

function validDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return null;
  const date = value.slice(0, 10);
  const time = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? date : null;
}

export function accountDeadline(mission: Mission, today: string) {
  const offer = mission.opportunity;
  const days = Number(offer?.qualification_days || offer?.direct_deposit_window_days || 0);
  const trigger = offer?.qualification_start_trigger || 'opened_at';
  const event = trigger === 'funded_at' ? 'funding date' : trigger === 'first_dd_at' ? 'first qualifying DD date' : 'opening date';
  const start = validDate(trigger === 'funded_at' ? mission.funded_at : trigger === 'first_dd_at' ? mission.first_dd_at : trigger === 'opened_at' ? mission.opened_at : mission.qualification_start_date);
  // Derive from the event so a newly edited date does not leave a stale card deadline.
  const deadline = start && days > 0
    ? new Date(Date.parse(start + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
    : validDate(mission.qualification_deadline);
  const amount = Number(offer?.direct_deposit_required || 0);
  const balance = Number(offer?.required_balance || 0);
  const currency = (value: number) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  const recurring = /per month|each month|monthly direct|monthly qualifying/i.test(offer?.terms_summary || '');
  const goal = amount > 0 ? (recurring ? 'Complete monthly DD requirements' : `Reach ${currency(amount)} qualifying DD`) : balance > 0 ? `Maintain ${currency(balance)}` : 'Complete deposit requirements';
  if (!deadline) return { deadline: null, label: `${days > 0 ? days + '-day window · ' : ''}Add ${event}`, detail: `${goal}${days > 0 ? ' · clock starts from ' + event : ' · timing needs verification'}` };
  const formatted = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(deadline + 'T00:00:00Z'));
  const left = Math.round((Date.parse(deadline + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  return {
    deadline,
    label: `${goal} ${amount > 0 ? 'by' : 'through'} ${formatted}`,
    detail: `Estimated${days > 0 ? ' · ' + days + ' days from ' + event : ''} · ${left < 0 ? 'deadline passed' : left === 0 ? 'due today' : left + ' days left'}`,
  };
}
