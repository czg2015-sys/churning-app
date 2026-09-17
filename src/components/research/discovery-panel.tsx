import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
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

function nextSweepDate(completedAt: string | null) {
  if (!completedAt) return "Runs as soon as search is configured";
  return formatDate(new Date(new Date(completedAt).getTime() + 14 * 86_400_000).toISOString());
}

export async function DiscoveryPanel() {
  const discovery = await getDiscoveryDashboardData();
  const latestCompleted = discovery.runs.find((run) => run.status === "completed") || null;
  const visibleCandidates = discovery.candidates.filter((candidate) => candidate.candidateStatus !== "duplicate").slice(0, 16);

  return (
    <>
      <div className={styles.sectionHeading}>
        <div>
          <span className="kicker">BIWEEKLY DISCOVERY ENGINE</span>
          <h2>Find offers we do not know about yet</h2>
        </div>
        <p>Every 14 days Churning searches multiple offer categories. New discoveries stay in this private queue until an official source and research review are completed.</p>
      </div>

      <section className={styles.runSummary}>
        <div><Search size={17} /><span>Next discovery sweep</span></div>
        <strong>{discovery.configured ? nextSweepDate(latestCompleted?.completed_at || null) : "Search key required"}</strong>
        <span>{latestCompleted ? `Last completed ${formatDate(latestCompleted.completed_at)}` : "No completed discovery sweep yet"}</span>
        <RunDiscoverySweepButton configured={discovery.configured} />
      </section>

      {!discovery.configured ? (
        <section className={styles.guardrail}>
          <ShieldCheck size={18} />
          <div>
            <strong>The discovery pipeline is installed but web search is not active yet.</strong>
            <span>Add the server-only <code>DISCOVERY_SEARCH_API_KEY</code> in Vercel. The rest of the pipeline and the 14-day scheduling gate are already installed.</span>
          </div>
        </section>
      ) : null}

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
                </div>
              </div>
              <span className={styles.statusPill}>{candidate.candidateStatus.replaceAll("_", " ")}</span>
            </div>
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
