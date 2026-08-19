import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { T } from "./theme";

const inputStyle = { borderColor: T.border, color: T.ink };

export default function ResetPassword() {
  const [ready, setReady] = useState(false); // waiting to confirm a recovery session exists
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link puts an access token in the URL hash; supabase-js
    // parses it automatically on load and fires this once a session exists.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: T.bg, color: T.ink }}>
      <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: T.border, background: T.panel }}>
        <div className="text-xs tracking-[0.25em] mb-1 font-semibold" style={{ color: T.accent }}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>

        {!ready ? (
          <p className="text-xs mt-4" style={{ color: T.muted }}>Loading…</p>
        ) : done ? (
          <>
            <h1 className="serif text-2xl mb-3 mt-2" style={{ color: T.ink }}>Password updated</h1>
            <p className="text-xs mb-6" style={{ color: T.muted }}>
              Your password has been changed. You're signed in &mdash; head back to The Ledger to continue.
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full py-2.5 text-xs tracking-widest font-semibold"
              style={{ background: T.accent, color: T.accentInk }}
            >
              CONTINUE TO THE LEDGER
            </button>
          </>
        ) : !hasSession ? (
          <>
            <h1 className="serif text-2xl mb-3 mt-2" style={{ color: T.ink }}>Link expired</h1>
            <p className="text-xs mb-6" style={{ color: T.muted }}>
              This password reset link is invalid or has expired. Request a new one from the login page.
            </p>
            <a
              href="/"
              className="block w-full py-2.5 text-xs tracking-widest font-semibold"
              style={{ background: T.accent, color: T.accentInk }}
            >
              BACK TO LOG IN
            </a>
          </>
        ) : (
          <>
            <h1 className="serif text-2xl mb-3 mt-2" style={{ color: T.ink }}>Set a new password</h1>
            <form onSubmit={handleSubmit} className="text-left">
              <div className="mb-3">
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>NEW PASSWORD</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              <div className="mb-3">
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>CONFIRM PASSWORD</label>
                <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              {error && <div className="text-[11px] mb-3" style={{ color: T.danger }}>{error}</div>}
              <button type="submit" disabled={busy} className="w-full py-2.5 text-xs tracking-widest font-semibold" style={{ background: T.accent, color: T.accentInk }}>
                {busy ? "…" : "SET NEW PASSWORD"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
