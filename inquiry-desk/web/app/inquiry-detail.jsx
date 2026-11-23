import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const nextStatus = {
  "New": "In Progress",
  "In Progress": "Resolved",
  "Resolved": "In Progress",
};
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function InquiryDetail({ id, onClose, onUpdated, onSessionExpired }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ state: "loading" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setResult({ state: "loading" });
    api(`/api/inquiries/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(({ inquiry }) => {
        if (!controller.signal.aborted) setResult({ state: "ready", inquiry });
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) onSessionExpired();
        else setResult({ state: "error", status: failure.status, message: failure.message });
      });
    return () => controller.abort();
  }, [id, revision, onSessionExpired]);

  function refresh() {
    setError("");
    setConflict(false);
    setRevision((count) => count + 1);
  }

  async function changeStatus() {
    if (pending.current || result.state !== "ready" || conflict) return;
    const { inquiry } = result;
    const status = nextStatus[inquiry.status];
    if (!status) return;
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      const response = await api(`/api/inquiries/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, version: inquiry.version }),
      });
      setResult({ state: "ready", inquiry: response.inquiry });
      onUpdated();
    } catch (failure) {
      if (failure.status === 401) onSessionExpired();
      else if (failure.status === 409) {
        setConflict(true);
        setError("This inquiry changed in another tab. Refresh to see its latest status.");
      } else if (failure.status === 404) {
        setResult({ state: "error", status: 404 });
      } else {
        setError(failure.message);
      }
    } finally {
      pending.current = false;
      setWorking(false);
    }
  }

  return (
    <section className="inquiry-detail" aria-labelledby="inquiry-detail-heading">
      <div className="detail-heading">
        <h2 id="inquiry-detail-heading">Inquiry details</h2>
        <button className="secondary-button" type="button" onClick={onClose}>Close details</button>
      </div>

      {result.state === "loading" ? (
        <p role="status" className="account-detail">Loading inquiry details…</p>
      ) : result.state === "error" ? (
        <>
          <p className="error" role="alert">
            {result.status === 404
              ? "Inquiry not found, or you do not have access to it."
              : result.status === 400
                ? "This inquiry link is invalid."
                : `Couldn't load this inquiry. ${result.message}`}
          </p>
          {result.status !== 404 && result.status !== 400 && (
            <button className="secondary-button" type="button" onClick={refresh}>Retry details</button>
          )}
        </>
      ) : (
        <>
          <h3 className="detail-subject">{result.inquiry.subject}</h3>
          <dl className="detail-fields">
            <div><dt>Customer</dt><dd>{result.inquiry.customerName}</dd></div>
            <div><dt>Contact</dt><dd>{result.inquiry.customerContact}</dd></div>
            <div><dt>Description</dt><dd className="detail-description">{result.inquiry.description}</dd></div>
            <div><dt>Created</dt><dd>{dateFormat.format(new Date(result.inquiry.createdAt))}</dd></div>
            <div><dt>Status</dt><dd><strong>{result.inquiry.status}</strong></dd></div>
          </dl>

          {error && <p className="error" role="alert">{error}</p>}
          <div className="detail-actions">
            {!conflict && nextStatus[result.inquiry.status] && (
              <button className="primary-button" type="button" onClick={changeStatus} disabled={working}>
                {working ? "Updating status…" : result.inquiry.status === "Resolved"
                  ? "Reopen inquiry" : result.inquiry.status === "New"
                    ? "Start progress" : "Mark resolved"}
              </button>
            )}
            <button className="secondary-button" type="button" onClick={refresh} disabled={working}>
              Refresh inquiry
            </button>
          </div>
        </>
      )}
    </section>
  );
}
