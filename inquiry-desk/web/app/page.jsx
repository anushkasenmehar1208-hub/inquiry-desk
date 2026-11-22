"use client";

import { useEffect, useState } from "react";

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
    throw new Error("Unable to connect to the server. Is the API running?");
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
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    api("/api/auth/me")
      .then(({ user }) => { if (active) setUser(user); })
      .catch((error) => {
        if (active && error.status !== 401) setError(error.message);
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function signIn(event) {
    event.preventDefault();
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
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    setError("");
    setWorking(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setEmail("");
    } catch (error) {
      setError(error.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">i.</span> Inquiry Desk</div>
        <div className="header-caption">Staff workspace</div>
      </header>

      {checking ? (
        <main className="checking"><p>Checking your session…</p></main>
      ) : user ? (
        <main className="workspace">
          <div className="workspace-topline">
            <span className="overline">WORKSPACE</span>
            <button className="text-button" onClick={signOut} disabled={working}>Sign out</button>
          </div>
          <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
          <p className="lede">You are signed in as <strong>{user.email}</strong>.</p>
          <div className="workspace-panel">
            <span className="panel-index">01 / FOUNDATION</span>
            <h2>Your workspace is connected.</h2>
            <p>Authentication is working. Inquiry creation, search, and status updates are the next part of the build.</p>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </main>
      ) : (
        <main className="login-layout">
          <section className="intro" aria-labelledby="intro-heading">
            <span className="overline">CUSTOMER INQUIRIES, KEPT IN ORDER</span>
            <h1 id="intro-heading">Know what came in.<br />Know what comes next.</h1>
            <p>One practical workspace for customer requests, from the first message to a clear resolution.</p>
            <div className="intro-rule" aria-hidden="true" />
            <p className="small-note">For the people handling the work, not another layer of work.</p>
          </section>

          <section className="sign-in-card" aria-labelledby="sign-in-heading">
            <span className="overline">STAFF SIGN IN</span>
            <h2 id="sign-in-heading">Welcome back.</h2>
            <p className="form-subtitle">Use your staff account to continue.</p>
            <form onSubmit={signIn}>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="username" required value={email}
                onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              {error && <p className="error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={working}>
                {working ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </main>
      )}
      <footer className="site-footer"><span>Inquiry Desk</span><span>Made for clarity.</span></footer>
    </div>
  );
}
