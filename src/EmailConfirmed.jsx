import React, { useEffect, useState } from "react";

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
    <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: "#f2ede1", color: "#1c2a44" }}>
      <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
        <div className="text-xs tracking-[0.25em] mb-1" style={{ color: "#6b6350" }}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>
        <h1 className="serif text-2xl font-semibold mb-3">Email confirmed</h1>
        <p className="text-xs mb-6" style={{ color: "#6b6350" }}>
          Your email address has been confirmed. You'll be redirected to The Ledger in {secondsLeft}{" "}
          second{secondsLeft === 1 ? "" : "s"} &mdash; your account will still need committee approval
          before you can see club finances.
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="w-full py-2.5 text-xs tracking-widest"
          style={{ background: "#1c2a44", color: "#f2ede1" }}
        >
          CONTINUE NOW
        </button>
      </div>
    </div>
  );
}
