import { ArrowUpRight, Search } from "lucide-react";
import { RunDiscoverySweepButton } from "@/components/research/research-controls";
import { getDiscoveryDashboardData } from "@/lib/research/discovery-dashboard";
import styles from "@/app/research/research.module.css";

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}


function durationLabel(days: number | null) {
  if (!days) return null;
  const months = Math.round(days / 30.4375);
  if (months >= 1 && Math.abs(days - months * 30.4375) <= 8) return `${months} month${months === 1 ? "" : "s"}`;
  return `${days} days`;
}

export async function DiscoveryPanel() {
  const discovery = await getDiscoveryDashboardData();
  const latestCompleted = discovery.runs.find((run) => run.status === "completed") || null;
  const visibleCandidates = discovery.candidates.filter((candidate) => candidate.candidateStatus !== "duplicate").slice(0, 16);

  return (
    <>
      <div className={styles.sectionHeading}>
        <div>
          <span className="kicker">FREE OFFICIAL-PAGE CHECKS</span>
          <h2>Check additional bank products</h2>
        </div>
        <p>Checks official pages for all live offers, additional banks, and linked promotions daily, with no paid search API. This is not a whole-web search. New candidates stay private until their terms and eligibility have been reviewed.</p>
      </div>

      <section className={styles.runSummary}>
        <div><Search size={17} /><span>Daily discovery schedule</span></div>
        <strong>{discovery.configured ? "16:30 UTC daily" : "Search key required"}</strong>
        <span>{latestCompleted ? `Last completed ${formatDate(latestCompleted.completed_at)}` : "No completed discovery sweep yet"}</span>
        <RunDiscoverySweepButton configured={discovery.configured} />
      </section>

      {discovery.runs[0] ? <section className={styles.guardrail}>
        <Search size={18} />
        <div><strong>Latest run: {discovery.runs[0].status}</strong>
          <span>{discovery.runs[0].queries_count} pages checked · {discovery.runs[0].new_candidates} new candidates · {formatDate(discovery.runs[0].started_at)}</span>
          {discovery.runs[0].error_message ? <p>{discovery.runs[0].error_message}</p> : null}
        </div>
      </section> : null}

      <section className={styles.metrics}>
        <article><span>DISCOVERED</span><strong>{discovery.metrics.totalCandidates}</strong><small>recent candidate records</small></article>
        <article><span>NEW QUEUE</span><strong>{discovery.metrics.newCandidates}</strong><small>waiting for research</small></article>
        <article><span>POSSIBLE OFFICIAL</span><strong>{discovery.metrics.possibleOfficial}</strong><small>source looks institution-owned</small></article>
        <article><span>NEEDS OFFICIAL SOURCE</span><strong>{discovery.metrics.needsOfficialSource}</strong><small>discovery source only</small></article>
        <article><span>DUPLICATES</span><strong>{discovery.metrics.duplicates}</strong><small>already known / already seen</small></article>
      </section>

      <section className={styles.offerList}>
        {visibleCandidates.length ? visibleCandidates.map((candidate) => (
          <article className={styles.offerCard} key={candidate.id}>
            <div className={styles.offerHead}>
              <div>
                <span className={styles.institution}>{candidate.institutionGuess || candidate.sourceDomain || "New candidate"}</span>
                <h3>{candidate.productNameGuess || candidate.sourceTitle || "Untitled discovery"}</h3>
                <div className={styles.metaRow}>
                  <span>{candidate.categoryGuess.replaceAll("_", " ")}</span>
                  <span>Source: <b>{candidate.officialSourceStatus.replaceAll("_", " ")}</b></span>
                  <span>Seen: {formatDate(candidate.lastSeenAt)}</span>
                  {candidate.detectedBenefitDurationDays ? <span>Limited benefit signal: <b>{durationLabel(candidate.detectedBenefitDurationDays)}</b></span> : null}
                </div>
              </div>
              <span className={styles.statusPill}>{candidate.candidateStatus.replaceAll("_", " ")}</span>
            </div>
            {candidate.detectedBenefitDurationDays ? <p><strong>Time-limit flag:</strong> Search text suggests a {durationLabel(candidate.detectedBenefitDurationDays)} limited benefit. Confirm this on the official terms before publishing.</p> : null}
            {candidate.sourceSnippet ? <p>{candidate.sourceSnippet}</p> : null}
            <div className={styles.offerFoot}>
              <a href={candidate.officialUrl || candidate.sourceUrl} target="_blank" rel="noreferrer">Open discovered source <ArrowUpRight size={14} /></a>
              <span>Not public · not recommendation eligible</span>
            </div>
          </article>
        )) : (
          <section className={styles.guardrail}>
            <Search size={18} />
            <div><strong>No discovery candidates yet.</strong><span>The first successful sweep will populate this private queue.</span></div>
          </section>
        )}
      </section>
    </>
  );
}
