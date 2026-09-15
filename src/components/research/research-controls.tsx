"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, PauseCircle, RefreshCw } from "lucide-react";

export function RunResearchScanButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runScan() {
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/research/run", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.message || "Research scan failed.");
      setMessage(
        payload.status === "already_running"
          ? "A scan is already running."
          : `Checked ${payload.checkedOffers} offers · ${payload.changedOffers} changed · ${payload.unreachableOffers} unreachable`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Research scan failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="research-run-control">
      <button className="button primary research-run-button" onClick={runScan} disabled={running}>
        {running ? <LoaderCircle className="research-spin" size={16} /> : <RefreshCw size={16} />}
        {running ? "Scanning official sources…" : "Run Research Scan"}
      </button>
      {message ? <span className="research-run-message">{message}</span> : null}
    </div>
  );
}

export function ResearchActionButtons({
  opportunityId,
  findingId,
  canApprove,
}: {
  opportunityId: string;
  findingId: string | null;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "hold" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve_baseline" | "keep_on_hold") {
    setPending(action === "approve_baseline" ? "approve" : "hold");
    setError(null);
    try {
      const response = await fetch("/api/research/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityId, findingId, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save research action.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save research action.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="research-actions">
      <button
        className="research-action approve"
        type="button"
        disabled={!canApprove || Boolean(pending)}
        onClick={() => act("approve_baseline")}
        title={canApprove ? "Accept this fetched official page as the current monitoring baseline" : "A successful page fetch is required"}
      >
        {pending === "approve" ? <LoaderCircle className="research-spin" size={14} /> : <CheckCircle2 size={14} />}
        Approve current version
      </button>
      <button
        className="research-action hold"
        type="button"
        disabled={Boolean(pending)}
        onClick={() => act("keep_on_hold")}
      >
        {pending === "hold" ? <LoaderCircle className="research-spin" size={14} /> : <PauseCircle size={14} />}
        Keep on hold
      </button>
      {error ? <span className="research-action-error">{error}</span> : null}
    </div>
  );
}
