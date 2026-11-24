import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { InquiryDetail } from "./inquiry-detail";

const fields = [
  { name: "customerName", label: "Customer name", maxLength: 120 },
  { name: "customerContact", label: "Customer contact", maxLength: 200 },
  { name: "subject", label: "Subject", maxLength: 200 },
  { name: "description", label: "Description", maxLength: 4000 },
];
const statuses = ["New", "In Progress", "Resolved"];
const allInquiries = { q: "", status: "" };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function InquiryForm({ draft = {}, onDraftChange, onSaved, onSessionExpired }) {
  const [invalidField, setInvalidField] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveRequest = useRef(null);
  const confirmation = useRef(null);

  useEffect(() => () => saveRequest.current?.abort(), []);
  useEffect(() => {
    if (saved) confirmation.current?.focus();
  }, [saved]);

  function changeField(name, value) {
    onDraftChange({ ...draft, [name]: value });
    setSaved(false);
    if (invalidField === name) {
      setInvalidField("");
      setError("");
    }
  }

  async function saveInquiry(event) {
    event.preventDefault();
    if (saveRequest.current) return;
    setInvalidField("");
    setError("");
    setSaved(false);

    const form = event.currentTarget;
    const input = {};
    for (const { name, label, maxLength } of fields) {
      const value = (draft[name] ?? "").trim();
      if (!value || value.length > maxLength || value.includes("\0")) {
        setInvalidField(name);
        setError(`Enter a ${label.toLowerCase()} between 1 and ${maxLength} characters.`);
        form.elements.namedItem(name)?.focus();
        return;
      }
      input[name] = value;
    }

    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    try {
      await api("/api/inquiries", {
        method: "POST",
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      onDraftChange(null);
      onSaved();
      setSaved(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 401) onSessionExpired();
      else setError(error.message);
    } finally {
      saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <section aria-labelledby="create-inquiry-heading">
      <h2 id="create-inquiry-heading">New inquiry</h2>
      <form onSubmit={saveInquiry} noValidate aria-busy={saving}>
        {fields.map(({ name, label, maxLength }) => {
          const Control = name === "description" ? "textarea" : "input";
          return (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              <Control
                id={name}
                name={name}
                value={draft[name] ?? ""}
                onChange={(event) => changeField(name, event.target.value)}
                maxLength={maxLength}
                required
                readOnly={saving}
                aria-invalid={invalidField === name || undefined}
                aria-describedby={invalidField === name ? "inquiry-save-error" : undefined}
              />
            </div>
          );
        })}
        {error && <p className="error" role="alert" id="inquiry-save-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Saving inquiry…" : "Save inquiry"}
        </button>
      </form>
      <p ref={confirmation} tabIndex={-1} className={saving ? "visually-hidden" : "save-status"} role="status">
        {saving ? "Saving inquiry…" : saved ? "Inquiry saved." : ""}
      </p>
    </section>
  );
}

function InquiryOverview({ filters, onFiltersChange, revision, onRetry, onSessionExpired, onOpen }) {
  const [result, setResult] = useState({ state: "loading" });
  const q = filters.q.trim();
  const { status } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const path = params.size ? `/api/inquiries?${params}` : "/api/inquiries";

    setResult({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const { inquiries } = await api(path, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ state: "ready", inquiries });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 401) onSessionExpired();
        else setResult({ state: "error", message: error.message });
      }
    }, q ? 200 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, status, revision, onSessionExpired]);

  return (
    <section className="inquiry-overview" aria-labelledby="inquiry-overview-heading">
      <h2 id="inquiry-overview-heading" tabIndex={-1}>Your inquiries</h2>
      <div className="inquiry-filters">
        <div>
          <label htmlFor="inquiry-search">Search inquiries</label>
          <input id="inquiry-search" type="search" maxLength={120} value={filters.q}
            onChange={(event) => onFiltersChange({ ...filters, q: event.target.value })} />
        </div>
        <div>
          <label htmlFor="inquiry-status">Status</label>
          <select id="inquiry-status" value={status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>
            <option value="">All</option>
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>

      {result.state === "loading" ? (
        <p className="account-detail" role="status">Loading inquiries…</p>
      ) : result.state === "error" ? (
        <>
          <p className="error" role="alert">Couldn’t load inquiries. {result.message}</p>
          <button className="secondary-button" type="button" onClick={onRetry}>Retry loading</button>
        </>
      ) : result.inquiries.length === 0 ? (
        <p className="account-detail" role="status">
          {q || status ? "No inquiries match those filters." : "No inquiries yet. Use the form to add one."}
        </p>
      ) : (
        <ul className="inquiry-list" aria-label="Inquiry results">
          {result.inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <div className="inquiry-summary">
                <strong>{inquiry.subject}</strong>
                <span>{inquiry.customerName}</span>
                <a className="inquiry-link" href={`/?inquiry=${encodeURIComponent(inquiry.id)}`}
                  aria-label={`Open ${inquiry.subject}`}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onOpen(inquiry.id);
                  }}>Open inquiry</a>
              </div>
              <div className="inquiry-meta">
                <span className="inquiry-status">{inquiry.status}</span>
                <time dateTime={inquiry.createdAt}>{dateFormat.format(new Date(inquiry.createdAt))}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InquiryWorkspace({
  user, headingRef, draft, onDraftChange, onSessionExpired, onSignOut, signingOut, signOutError,
}) {
  const [filters, setFilters] = useState(allInquiries);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const syncSelection = () => setSelectedId(new URLSearchParams(window.location.search).get("inquiry"));
    syncSelection();
    window.addEventListener("popstate", syncSelection);
    return () => window.removeEventListener("popstate", syncSelection);
  }, []);

  function openInquiry(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("inquiry", id);
    window.history.pushState(null, "", url);
    setSelectedId(id);
  }

  function closeInquiry() {
    const url = new URL(window.location.href);
    url.searchParams.delete("inquiry");
    window.history.pushState(null, "", url);
    setSelectedId(null);
    reloadInquiries();
    document.getElementById("inquiry-overview-heading")?.focus();
  }

  const reloadInquiries = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  function inquirySaved() {
    setFilters(allInquiries);
    reloadInquiries();
  }

  return (
    <>
      <div className="workspace-header">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>Inquiries</h1>
          <p className="account-detail">Signed in as <strong>{user.name}</strong>.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {signOutError && <p className="error" role="alert">{signOutError}</p>}
      <div className="workspace-layout">
        <InquiryForm draft={draft} onDraftChange={onDraftChange}
          onSaved={inquirySaved} onSessionExpired={onSessionExpired} />
        <div className="inquiry-column">
          <InquiryOverview filters={filters} onFiltersChange={setFilters} revision={revision}
            onRetry={reloadInquiries} onSessionExpired={onSessionExpired} onOpen={openInquiry} />
          {selectedId && (
            <InquiryDetail key={selectedId} id={selectedId} onClose={closeInquiry}
              onUpdated={reloadInquiries} onSessionExpired={onSessionExpired} />
          )}
        </div>
      </div>
    </>
  );
}
