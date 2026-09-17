import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Eye,
  FileSearch2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { DiscoveryPanel } from "@/components/research/discovery-panel";
import { ResearchActionButtons, RunResearchScanButton } from "@/components/research/research-controls";
import { getResearchDashboardData } from "@/lib/research/dashboard";
import { getResearchAdminSession, hasResearchServerConfig } from "@/lib/research/server";
import styles from "./research.module.css";

export const metadata: Metadata = { title: "Research Center" };
export const dynamic = "force-dynamic";

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

function friendlyStatus(status: string) {
  const labels: Record<string, string> = {
    verified: "Verified",
    changed: "Changed",
    needs_review: "Needs review",
    hold: "On hold",
    stale: "Stale",
    unreachable: "Unreachable",
    unmonitored: "Not monitored",
  };
  return labels[status] || status.replaceAll("_", " ");
}

export default async function ResearchCenterPage() {
  const admin = await getResearchAdminSession();
  if (!admin.userId) redirect("/auth?next=/research");

  if (!admin.configured || !hasResearchServerConfig()) {
    return (
      <main className={styles.page}>
        <div className={`shell ${styles.shell}`}>
          <section className={styles.setupCard}>
            <DatabaseZap size={28} />
            <span className="kicker">OWNER SETUP REQUIRED</span>
            <h1>Research Center is installed, but server access is not configured yet.</h1>
            <p>
              Add <code>RESEARCH_ADMIN_EMAILS</code>, <code>SUPABASE_SECRET_KEY</code> and <code>CRON_SECRET</code> to Vercel. The Research Center stays locked until those server-only values are present.
            </p>
            <Link href="/my-plan" className="button secondary">Back to My Plan</Link>
          </section>
        </div>
      </main>
    );
  }

  if (!admin.authorized) redirect("/my-plan");

  const dashboard = await getResearchDashboardData();
  const latestRun = dashboard.runs[0] || null;

  return (
    <main className={styles.page}>
      <div className={`shell ${styles.shell}`}>
        <div className={styles.topline}>
          <div>
            <span className="kicker">PRIVATE OWNER WORKSPACE</span>
            <h1>Research Center</h1>
            <p>Monitor official offer pages, discover new opportunities, catch changes, and keep questionable data out of recommendations.</p>
          </div>
          <RunResearchScanButton />
        </div>

        <section className={styles.guardrail}>
          <ShieldAlert size={18} />
          <div>
            <strong>The agent can flag risk, but it cannot silently Safety Clear a changed or newly discovered offer.</strong>
            <span>New discoveries stay private. Official-page changes automatically move existing offers to review/hold. A human approval only accepts the page baseline; credit, ChexSystems, EWS, tax, insurance and closing-rule reviews remain separate.</span>
          </div>
        </section>

        <section className={styles.metrics}>
          <article><span>LIVE OFFERS</span><strong>{dashboard.metrics.totalOffers}</strong><small>currently monitored</small></article>
          <article><span>CHECKED THIS WEEK</span><strong>{dashboard.metrics.checkedThisWeek}</strong><small>official source checks</small></article>
          <article><span>VERIFIED BASELINES</span><strong>{dashboard.metrics.verified}</strong><small>approved + unchanged</small></article>
          <article className={dashboard.metrics.changed ? styles.warningMetric : ""}><span>CHANGED</span><strong>{dashboard.metrics.changed}</strong><small>needs human review</small></article>
          <article><span>NEEDS REVIEW</span><strong>{dashboard.metrics.needsReview}</strong><small>not auto-recommended</small></article>
          <article><span>UNREACHABLE</span><strong>{dashboard.metrics.unreachable}</strong><small>blocked / failed checks</small></article>
        </section>

        <section className={styles.runSummary}>
          <div><RefreshCw size={17} /><span>Latest scan</span></div>
          {latestRun ? (
            <>
              <strong>{friendlyStatus(latestRun.status)}</strong>
              <span>{formatDate(latestRun.started_at)}</span>
              <span>{latestRun.checked_offers}/{latestRun.total_offers} checked</span>
              <span>{latestRun.changed_offers} changed</span>
              <span>{latestRun.unreachable_offers} unreachable</span>
            </>
          ) : <span>No scan has run yet. Run the first baseline scan above.</span>}
        </section>

        <DiscoveryPanel />

        <div className={styles.sectionHeading}>
          <div><span className="kicker">OFFICIAL SOURCE MONITOR</span><h2>Every live opportunity</h2></div>
          <p>“Approve current version” means the agent may use this exact official page as its comparison baseline. It does not override a separate safety hold.</p>
        </div>

        <section className={styles.offerList}>
          {dashboard.offers.map((offer) => {
            const canApprove = Boolean(
              offer.latestFindingId &&
              offer.lastFetchStatus === "ok" &&
              !offer.latestMaterialChange &&
              offer.latestMismatchFlags.length === 0,
            );
            return (
              <article className={styles.offerCard} key={offer.id}>
                <div className={styles.offerHead}>
                  <div>
                    <span className={styles.institution}>{offer.institution}</span>
                    <h3>{offer.productName}</h3>
                    <div className={styles.metaRow}>
                      <span>{offer.category.replaceAll("_", " ")}</span>
                      <span>Safety gate: <b>{offer.safetyGate}</b></span>
                      <span>Last verified: {formatDate(offer.lastVerifiedAt)}</span>
                    </div>
                  </div>
                  <span className={`${styles.statusPill} ${styles[offer.monitorStatus] || ""}`}>{friendlyStatus(offer.monitorStatus)}</span>
                </div>

                <div className={styles.monitorGrid}>
                  <div><Clock3 size={15} /><span>Last checked</span><strong>{formatDate(offer.lastCheckedAt)}</strong></div>
                  <div><Eye size={15} /><span>Page fetch</span><strong>{offer.lastFetchStatus || "Not checked"}{offer.lastHttpStatus ? ` · ${offer.lastHttpStatus}` : ""}</strong></div>
                  <div><FileSearch2 size={15} /><span>Latest result</span><strong>{offer.latestChangeStatus ? friendlyStatus(offer.latestChangeStatus) : "No baseline yet"}</strong></div>
                  <div><CheckCircle2 size={15} /><span>Baseline approved</span><strong>{formatDate(offer.approvedAt)}</strong></div>
                </div>

                {offer.latestTermDiffs.length ? (
                  <div className={styles.termDiffs}>
                    <strong>Detected term changes</strong>
                    {offer.latestTermDiffs.slice(0, 6).map((diff, index) => (
                      <span key={`${diff.field}-${index}`}>
                        {diff.field}: {diff.previous ?? diff.stored ?? "—"} → {diff.current ?? "—"}
                      </span>
                    ))}
                  </div>
                ) : null}
                {offer.latestMismatchFlags.length ? (
                  <div className={styles.flags}>
                    <AlertTriangle size={15} />
                    <span>{offer.latestMismatchFlags.map((flag) => flag.replaceAll("_", " ")).join(" · ")}</span>
                  </div>
                ) : null}
                {offer.latestError ? <div className={styles.errorBox}>{offer.latestError}</div> : null}

                <div className={styles.offerFoot}>
                  <a href={offer.officialUrl} target="_blank" rel="noreferrer">Open official terms <ArrowUpRight size={14} /></a>
                  <ResearchActionButtons opportunityId={offer.id} findingId={offer.latestFindingId} canApprove={canApprove} />
                </div>
              </article>
            );
          })}
        </section>

        <section className={styles.history}>
          <div className={styles.sectionHeading}><div><span className="kicker">AUDIT TRAIL</span><h2>Recent scans</h2></div><p>Every automated and manual scan stays recorded in Supabase.</p></div>
          <div className={styles.historyTable}>
            <div className={styles.historyHeader}><span>Started</span><span>Trigger</span><span>Status</span><span>Checked</span><span>Changed</span><span>Unreachable</span></div>
            {dashboard.runs.length ? dashboard.runs.map((run) => (
              <div className={styles.historyRow} key={run.id}>
                <span>{formatDate(run.started_at)}</span><span>{run.trigger_type}</span><span>{run.status}</span><span>{run.checked_offers}/{run.total_offers}</span><span>{run.changed_offers}</span><span>{run.unreachable_offers}</span>
              </div>
            )) : <div className={styles.emptyHistory}>No research scans yet.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
