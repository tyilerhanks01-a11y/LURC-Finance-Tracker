import React from "react";

// Bump this whenever the wording below materially changes.
const LAST_UPDATED = "19 August 2026";

const muted = { color: "#6b6350" };

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="serif text-xl font-semibold mb-2" style={{ color: "#1c2a44" }}>{title}</h2>
      <div className="text-xs leading-relaxed space-y-2" style={{ color: "#3d3626" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#f2ede1", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(28,42,68,0.045) 28px)", color: "#1c2a44" }}>
      <header className="border-b-2 px-6 pt-10 pb-6 sm:px-10" style={{ borderColor: "#1c2a44" }}>
        <div className="max-w-3xl mx-auto">
          <a href="/" className="text-[10px] tracking-widest underline" style={muted}>&larr; BACK TO THE LEDGER</a>
          <div className="text-xs tracking-[0.25em] mt-3" style={muted}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>
          <h1 className="serif text-4xl font-semibold mt-1">Privacy &amp; Data Use Policy</h1>
          <div className="text-[11px] mt-2" style={muted}>Last updated {LAST_UPDATED}</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <Section title="Who runs this">
          <p>
            "The Ledger" is a finance-tracking tool built and run by the Treasurer of the University of
            Liverpool Riding Club (UoL RC), for the club's committee and members. It is not a commercial
            product and your data is never sold, shared with advertisers, or used for marketing.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> your email address and password. Your password is handled entirely by our authentication provider (Supabase Auth) — we never see or store it in plain text.</li>
            <li><strong>Membership status:</strong> your approval role (pending, viewer, normal member, admin, or super admin) and when your account was created.</li>
            <li><strong>Financial records:</strong> transactions logged in the ledger — date, description, category, amount, who paid, and who logged the entry.</li>
            <li><strong>Budget data:</strong> category names and their budgets, and the club's total allocation.</li>
            <li><strong>Activity log:</strong> visible only to super admins — a record of who added, edited, or deleted which transactions and categories, and when, plus timestamps of automated system health-check pings that keep the database active.</li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <ul className="list-disc pl-5 space-y-1">
            <li>To run the club's finance tracking and budgeting for the committee and members.</li>
            <li>To restrict access to club finances to approved members only.</li>
            <li>To keep an accountable record of who changed what, in case of a dispute or audit.</li>
          </ul>
        </Section>

        <Section title="Who can see your data">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Pending / removed accounts</strong> can't see any club data.</li>
            <li><strong>Viewers</strong> can see transactions and budgets, read-only.</li>
            <li><strong>Normal members</strong> can additionally log and edit transactions and budgets.</li>
            <li><strong>Admins</strong> can additionally see all member profiles, approve signups, and manage normal/viewer accounts.</li>
            <li><strong>Super admins</strong> can additionally manage other admins, permanently delete a profile, and view the activity log.</li>
          </ul>
        </Section>

        <Section title="Where it's stored">
          <p>
            Data is stored in a <a className="underline" href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a> database
            (authentication and Postgres), and the website itself is hosted on <a className="underline" href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel</a>.
            Both act as data processors on the club's behalf — see their own privacy policies for how they
            handle infrastructure-level data. We don't use any other third-party service to process your data.
          </p>
        </Section>

        <Section title="Cookies & local storage">
          <p>
            The app stores your login session in your browser's local storage (via Supabase Auth) so you stay
            logged in between visits. We don't use third-party tracking, analytics, or advertising cookies.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Your data is kept for as long as your account is active or as long as needed for club accounting
            records. If you'd like your profile removed, ask a super admin — they can permanently delete your
            profile record. (Deleting your profile doesn't delete your login account itself; contact a super
            admin if you'd like that removed too.)
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under UK data protection law you can ask to see the data we hold about you, ask us to correct it,
            or ask for it to be deleted. Contact the Treasurer (below) to make a request. If you're unhappy with
            how a request is handled, you can complain to the UK Information Commissioner's Office (ICO) at{" "}
            <a className="underline" href="https://ico.org.uk" target="_blank" rel="noreferrer">ico.org.uk</a>.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            This page is part of the app's own codebase, so it updates automatically the moment a change is
            deployed — there's no separate document to keep in sync. The "last updated" date above reflects
            the most recent time the wording changed.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data: contact the Treasurer at{" "}
            <a className="underline" href="mailto:sgthanks@liverpool.ac.uk">sgthanks@liverpool.ac.uk</a>.
          </p>
        </Section>
      </main>
    </div>
  );
}
