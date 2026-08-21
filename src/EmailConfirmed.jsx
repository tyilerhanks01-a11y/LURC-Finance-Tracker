import React, { useEffect, useState } from "react";
import { T } from "./theme";

const REDIRECT_SECONDS = 10;

export default function EmailConfirmed() {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      window.location.href = "/";
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: T.bg, color: T.ink }}>
      <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: T.border, background: T.panel }}>
        <div className="text-xs tracking-[0.25em] mb-1 font-semibold" style={{ color: T.accent }}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>
        <h1 className="serif text-2xl mb-3" style={{ color: T.ink }}>Email confirmed</h1>
        <p className="text-xs mb-6" style={{ color: T.muted }}>
          Your email address has been confirmed. You'll be redirected to The Ledger in {secondsLeft}{" "}
          second{secondsLeft === 1 ? "" : "s"}. Your account will still need treasurer approval
          before you can see club finances.
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="w-full py-2.5 text-xs tracking-widest font-semibold"
          style={{ background: T.accent, color: T.accentInk }}
        >
          CONTINUE NOW
        </button>
      </div>
    </div>
  );
}
