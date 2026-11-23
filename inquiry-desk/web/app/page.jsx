"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Couldn’t reach Inquiry Desk. Check your connection and try again.");
  }
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const requestPending = useRef(false);
  const emailField = useRef(null);
  const passwordField = useRef(null);
  const workspaceHeading = useRef(null);
  const wasSignedIn = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/auth/me", { signal: controller.signal })
      .then(({ user }) => {
        if (controller.signal.aborted) return;
        setUser(user);
        setSessionStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSessionStatus(error.status === 401 ? "ready" : "unavailable");
      });
    return () => controller.abort();
  }, [sessionAttempt]);

  useEffect(() => {
    if (user) workspaceHeading.current?.focus();
    else if (wasSignedIn.current) emailField.current?.focus();
    wasSignedIn.current = Boolean(user);
  }, [user]);

  function retrySession() {
    setSessionStatus("checking");
    setSessionAttempt((attempt) => attempt + 1);
  }

  async function signIn(event) {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setError("");
    setWorking(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setPassword("");
    } catch (error) {
      setError(error.message);
      if (error.status === 401) setPassword("");
      passwordField.current?.focus();
    } finally {
      requestPending.current = false;
      setWorking(false);
    }
  }

  async function signOut() {
    if (requestPending.current) return;
    requestPending.current = true;
    setError("");
    setWorking(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setEmail("");
    } catch (error) {
      setError(`Couldn’t sign out. ${error.message}`);
    } finally {
      requestPending.current = false;
      setWorking(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <span className="brand">Inquiry Desk</span>
      </header>

      <main className="content">
        {sessionStatus === "checking" ? (
          <>
            <h1>Staff sign-in</h1>
            <p className="account-detail" role="status">Checking your session…</p>
          </>
        ) : sessionStatus === "unavailable" ? (
          <>
            <h1>Staff sign-in</h1>
            <p className="error" role="alert">Couldn’t check your session. Try again.</p>
            <button className="primary-button" type="button" onClick={retrySession}>Try again</button>
          </>
        ) : user ? (
          <>
            <h1 ref={workspaceHeading} tabIndex={-1}>Staff workspace</h1>
            <p className="account-detail">Signed in as <strong>{user.name}</strong> ({user.email}).</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="secondary-button" type="button" onClick={signOut} disabled={working}>
              {working ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <h1>Staff sign-in</h1>
            <form onSubmit={signIn} aria-busy={working}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input ref={emailField} id="email" name="email" type="email" autoComplete="username"
                  autoCapitalize="none" spellCheck={false} maxLength={254} required readOnly={working}
                  value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input ref={passwordField} id="password" name="password" type="password"
                  autoComplete="current-password" maxLength={1024} required readOnly={working}
                  value={password} onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={error ? "sign-in-error" : undefined} />
              </div>
              {error && <p id="sign-in-error" className="error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={working}>
                {working ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}
        <p className="visually-hidden" role="status">
          {working ? (user ? "Signing out…" : "Signing in…") : ""}
        </p>
      </main>
    </>
  );
}
