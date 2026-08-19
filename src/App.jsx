import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabaseClient";
import PrivacyPolicy from "./PrivacyPolicy";
import EmailConfirmed from "./EmailConfirmed";
import ResetPassword from "./ResetPassword";
import { T, PALETTE } from "./theme";

const catColor = (name, categories) => {
  const idx = categories.findIndex((c) => c.name === name);
  return PALETTE[idx % PALETTE.length] || T.muted;
};
const money = (n) => `${n < 0 ? "−" : ""}£${Math.abs(n).toFixed(2)}`;
const inputStyle = { borderColor: T.border, color: T.ink };

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalBudget, setTotalBudget] = useState(1500);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  const [tab, setTab] = useState("dashboard");
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    category: "",
    type: "Expenditure",
    amount: "",
    paidBy: "",
  });
  const [editingBudget, setEditingBudget] = useState(false);
  const [draftCategories, setDraftCategories] = useState([]);
  const [draftTotal, setDraftTotal] = useState(1500);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");
  const [newIncomeName, setNewIncomeName] = useState("");

  // --- Auth session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Load profile once logged in ---
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data ?? null);
    })();
  }, [session]);

  const isApproved = profile && ["normal", "viewer", "admin", "super_admin"].includes(profile.role);
  const isEditor = profile && ["normal", "admin", "super_admin"].includes(profile.role);
  const isAdmin = profile && ["admin", "super_admin"].includes(profile.role);
  const isSuperAdmin = profile && profile.role === "super_admin";
  const roleLabel = (r) => r.replace("_", " ").toUpperCase();

  // --- Load app data once approved ---
  useEffect(() => {
    if (!isApproved) return;
    loadData();
    if (isAdmin) loadProfiles();
    if (isSuperAdmin) loadActivityLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved, isAdmin, isSuperAdmin]);

  const loadData = async () => {
    const { data: cats } = await supabase.from("categories").select("*").order("created_at");
    const { data: txns } = await supabase.from("transactions").select("*").order("date", { ascending: false });
    const { data: settings } = await supabase.from("settings").select("*").limit(1).single();
    setCategories(cats || []);
    setTransactions(txns || []);
    if (settings) setTotalBudget(settings.total_budget);
    const defaultExpCat = cats && cats.find((c) => c.type !== "income");
    if (defaultExpCat && !form.category) setForm((f) => ({ ...f, category: defaultExpCat.name }));
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setAllProfiles(data || []);
    setPendingUsers((data || []).filter((p) => p.role === "pending"));
  };

  const loadActivityLog = async () => {
    const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
    setActivityLog(data || []);
  };

  // --- Auth actions ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const { error } =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
        : await supabase.auth.signUp({
            email: authForm.email,
            password: authForm.password,
            options: { emailRedirectTo: `${window.location.origin}/confirmed` },
          });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
    } else if (authMode === "signup") {
      setResendMessage("");
      setResendCooldown(30);
      setShowConfirmModal(true);
    } else {
      setShowLoginSuccess(true);
      setTimeout(() => setShowLoginSuccess(false), 2600);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resendConfirmation = async () => {
    setResendBusy(true);
    setResendMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: authForm.email,
      options: { emailRedirectTo: `${window.location.origin}/confirmed` },
    });
    setResendBusy(false);
    if (error) {
      setResendMessage(error.message);
    } else {
      setResendMessage("Confirmation email resent.");
      setResendCooldown(30);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) setForgotError(error.message);
    else setForgotSent(true);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setTab("dashboard");
  };

  // --- Transactions ---
  const submitTransaction = async (e) => {
    e.preventDefault();
    if (!form.desc.trim() || !form.amount || !form.category) return;
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) return;
    const { error } = await supabase.from("transactions").insert({
      date: form.date,
      description: form.desc,
      category: form.category,
      type: form.type,
      amount: amt,
      paid_by: form.paidBy,
      logged_by: profile.email,
    });
    if (!error) {
      setForm({ ...form, desc: "", amount: "", paidBy: "" });
      loadData();
    }
  };

  const deleteTransaction = async (id) => {
    await supabase.from("transactions").delete().eq("id", id);
    loadData();
  };

  // --- Budget / categories ---
  const openBudgetEditor = () => {
    setDraftCategories(categories.map((c) => ({ ...c })));
    setDraftTotal(totalBudget);
    setEditingBudget(true);
  };

  const saveBudget = async () => {
    await supabase.from("settings").update({ total_budget: parseFloat(draftTotal) || 0 }).eq("id", 1);
    const existingIds = categories.map((c) => c.id);
    const draftIds = draftCategories.filter((c) => c.id).map((c) => c.id);
    const removed = existingIds.filter((id) => !draftIds.includes(id));
    for (const id of removed) await supabase.from("categories").delete().eq("id", id);
    for (const c of draftCategories) {
      if (c.id) {
        await supabase.from("categories").update({ name: c.name, budget: c.budget, type: c.type || "expenditure" }).eq("id", c.id);
      } else {
        await supabase.from("categories").insert({ name: c.name, budget: c.budget, type: c.type || "expenditure" });
      }
    }
    setEditingBudget(false);
    loadData();
  };

  const addDraftCategory = () => {
    if (!newCatName.trim()) return;
    if (draftCategories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) return;
    setDraftCategories([...draftCategories, { name: newCatName.trim(), budget: parseFloat(newCatBudget) || 0, type: "expenditure" }]);
    setNewCatName("");
    setNewCatBudget("");
  };
  const addDraftIncomeSource = () => {
    if (!newIncomeName.trim()) return;
    if (draftCategories.some((c) => c.name.toLowerCase() === newIncomeName.trim().toLowerCase())) return;
    setDraftCategories([...draftCategories, { name: newIncomeName.trim(), budget: 0, type: "income" }]);
    setNewIncomeName("");
  };
  const removeDraftCategory = (name) => setDraftCategories(draftCategories.filter((c) => c.name !== name));
  const updateDraftBudget = (name, budget) => setDraftCategories(draftCategories.map((c) => (c.name === name ? { ...c, budget } : c)));

  // --- Admin ---
  const setRole = async (id, role) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    loadProfiles();
  };

  const deleteProfile = async (id) => {
    if (!window.confirm("Permanently delete this user's profile? This cannot be undone.")) return;
    await supabase.from("profiles").delete().eq("id", id);
    loadProfiles();
  };

  const exportCSV = () => {
    const header = "Date,Description,Category,Type,Amount,Paid By\n";
    const rows = transactions.map((t) => `${t.date},"${t.description.replace(/"/g, '""')}",${t.category},${t.type},${t.amount},"${t.paid_by || ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "riding-club-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === "Income").reduce((s, t) => s + Number(t.amount), 0);
    const expenditure = transactions.filter((t) => t.type === "Expenditure").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenditure, balance: totalBudget + income - expenditure };
  }, [transactions, totalBudget]);

  const expenseCategories = useMemo(() => categories.filter((c) => c.type !== "income"), [categories]);
  const incomeCategories = useMemo(() => categories.filter((c) => c.type === "income"), [categories]);

  const byCategory = useMemo(() => {
    return expenseCategories.map((c) => {
      const spent = transactions.filter((t) => t.type === "Expenditure" && t.category === c.name).reduce((s, t) => s + Number(t.amount), 0);
      return { ...c, spent, remaining: c.budget - spent, pct: c.budget ? spent / c.budget : 0 };
    });
  }, [expenseCategories, transactions]);

  const byIncomeSource = useMemo(() => {
    const totalsBySource = {};
    transactions.filter((t) => t.type === "Income").forEach((t) => {
      const key = t.category || "Uncategorised";
      totalsBySource[key] = (totalsBySource[key] || 0) + Number(t.amount);
    });
    return Object.entries(totalsBySource)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const spendPct = totalBudget ? totals.expenditure / totalBudget : 0;

  // ---------------- RENDER ----------------

  if (window.location.pathname === "/privacy") {
    return <PrivacyPolicy />;
  }

  if (window.location.pathname === "/confirmed") {
    return <EmailConfirmed />;
  }

  if (window.location.pathname === "/reset-password") {
    return <ResetPassword />;
  }

  let content;

  if (session === undefined) {
    content = <Centered>loading…</Centered>;
  } else if (!session) {
    content = (
      <Centered>
        <div className="w-full max-w-sm border-2 p-8" style={{ borderColor: T.border, background: T.panel }}>
          <div className="text-xs tracking-[0.25em] mb-1 font-semibold" style={{ color: T.accent }}>UoL RIDING CLUB</div>
          <h1 className="serif text-3xl mb-6" style={{ color: T.ink }}>The Ledger</h1>

          {showForgot ? (
            forgotSent ? (
              <>
                <h2 className="serif text-xl mb-3" style={{ color: T.ink }}>Check your email</h2>
                <p className="text-xs mb-5" style={{ color: T.muted }}>
                  If an account exists for <strong style={{ color: T.ink }}>{forgotEmail}</strong>, we've sent a link to
                  reset your password.
                </p>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                  className="w-full py-2.5 text-xs tracking-widest font-semibold"
                  style={{ background: T.accent, color: T.accentInk }}
                >
                  BACK TO LOG IN
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <h2 className="serif text-xl mb-3" style={{ color: T.ink }}>Reset your password</h2>
                <p className="text-xs mb-4" style={{ color: T.muted }}>
                  Enter your email and we'll send you a link to set a new password.
                </p>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>EMAIL</label>
                <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                {forgotError && <div className="text-[11px] mt-3" style={{ color: T.danger }}>{forgotError}</div>}
                <button type="submit" disabled={forgotBusy} className="w-full py-2.5 text-xs tracking-widest mt-5 font-semibold" style={{ background: T.accent, color: T.accentInk }}>
                  {forgotBusy ? "…" : "SEND RESET LINK"}
                </button>
                <button type="button" onClick={() => { setShowForgot(false); setForgotError(""); }} className="w-full text-[11px] underline mt-4" style={{ color: T.muted }}>
                  back to log in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleAuth}>
              <div className="flex gap-1 mb-4">
                {["login", "signup"].map((m) => (
                  <button type="button" key={m} onClick={() => { setAuthMode(m); setAuthError(""); }}
                    className="flex-1 text-xs py-2 border" style={{ borderColor: T.border, background: authMode === m ? T.accent : "transparent", color: authMode === m ? T.accentInk : T.ink }}>
                    {m === "login" ? "LOG IN" : "SIGN UP"}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>EMAIL</label>
                  <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>PASSWORD</label>
                  <input type="password" required minLength={6} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
              </div>
              {authMode === "login" && (
                <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(authForm.email); }} className="text-[11px] underline mt-2" style={{ color: T.muted }}>
                  forgot password?
                </button>
              )}
              {authError && <div className="text-[11px] mt-3" style={{ color: T.danger }}>{authError}</div>}
              <button type="submit" disabled={authBusy} className="w-full py-2.5 text-xs tracking-widest mt-5 font-semibold" style={{ background: T.accent, color: T.accentInk }}>
                {authBusy ? "…" : authMode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
              </button>
              {authMode === "signup" && (
                <div className="text-[10px] mt-4" style={{ color: T.faint }}>
                  New accounts need admin approval before they can see club finances. You'll be able to log in once approved.
                </div>
              )}
            </form>
          )}
        </div>

        {showConfirmModal && (
          <div className="fixed inset-0 flex items-center justify-center px-6 z-10" style={{ background: "rgba(6,10,20,0.75)" }}>
            <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: T.border, background: T.panel }}>
              <h2 className="serif text-2xl mb-3" style={{ color: T.ink }}>Check your email</h2>
              <p className="text-xs mb-5" style={{ color: T.muted }}>
                We've sent a confirmation link to <strong style={{ color: T.ink }}>{authForm.email}</strong>. Click it to
                activate your account &mdash; you'll then need committee approval before you can see club finances.
              </p>
              <button
                onClick={resendConfirmation}
                disabled={resendCooldown > 0 || resendBusy}
                className="w-full py-2.5 text-xs tracking-widest border disabled:opacity-50"
                style={{ borderColor: T.border, color: T.ink }}
              >
                {resendBusy ? "…" : resendCooldown > 0 ? `RESEND EMAIL (${resendCooldown}s)` : "RESEND EMAIL"}
              </button>
              {resendMessage && <div className="text-[11px] mt-3" style={{ color: T.muted }}>{resendMessage}</div>}
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-2.5 text-xs tracking-widest mt-3 font-semibold"
                style={{ background: T.accent, color: T.accentInk }}
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </Centered>
    );
  } else if (!isApproved) {
    const revoked = !profile || profile.role === "removed";
    content = (
      <Centered>
        <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: T.border, background: T.panel }}>
          <h1 className="serif text-2xl mb-3" style={{ color: T.ink }}>
            {revoked ? "Access unavailable" : "Awaiting approval"}
          </h1>
          <p className="text-xs mb-5" style={{ color: T.muted }}>
            {revoked
              ? `Your account (${session.user.email}) doesn't currently have access to the club ledger. Contact an admin if you think this is a mistake.`
              : `Your account (${session.user.email}) is registered but hasn't been approved by a club admin yet. Ask the treasurer to approve you from the Admin tab.`}
          </p>
          <button onClick={logout} className="text-[11px] underline" style={{ color: T.danger }}>log out</button>
        </div>
      </Centered>
    );
  } else {
    const tabs = ["dashboard", ...(isEditor ? ["add"] : []), "budget", ...(isAdmin ? ["admin"] : [])];
    content = (
    <div className="min-h-screen w-full" style={{ background: T.bg, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(242,237,225,0.03) 28px)", color: T.ink }}>
      <header className="border-b-2 px-6 pt-10 pb-6 sm:px-10" style={{ borderColor: T.border }}>
        <div className="max-w-5xl mx-auto flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.25em] font-semibold" style={{ color: T.accent }}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>
            <h1 className="serif text-4xl sm:text-5xl mt-1">The Ledger</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest" style={{ color: T.muted }}>{profile.email} &middot; {roleLabel(profile.role)}</div>
            <button onClick={logout} className="text-[10px] underline mt-1" style={{ color: T.danger }}>log out</button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-1 mt-6">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className="text-[11px] px-3 py-1.5 border tracking-wide"
              style={{ borderColor: T.border, background: tab === t ? T.accent : "transparent", color: tab === t ? T.accentInk : T.ink }}>
              {t.toUpperCase()}{t === "admin" && pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-10">
        {tab === "dashboard" && (
          <>
            <section className="flex justify-center">
              <BudgetHorseshoe pct={spendPct} totalBudget={totalBudget} />
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-4 gap-px" style={{ background: T.hairline }}>
              {[
                ["Budget allocation", money(totalBudget), T.ink],
                ["Income logged", money(totals.income), T.success],
                ["Expenditure", money(totals.expenditure), T.danger],
                ["Remaining", money(totals.balance), totals.balance < 0 ? T.danger : T.success],
              ].map(([label, val, color]) => (
                <div key={label} className="p-4" style={{ background: T.panel }}>
                  <div className="text-[10px] tracking-widest" style={{ color: T.muted }}>{label.toUpperCase()}</div>
                  <div className="serif text-2xl mt-1" style={{ color }}>{val}</div>
                </div>
              ))}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="serif text-xl">Category budgets</h2>
                <span className="text-[10px]" style={{ color: T.muted }}>{Math.round(spendPct * 100)}% of total budget spent</span>
              </div>
              <div className="border-2" style={{ borderColor: T.border, background: T.panel }}>
                {byCategory.length === 0 ? (
                  <div className="p-6 text-center text-xs" style={{ color: T.muted }}>No categories yet &mdash; add some under BUDGET.</div>
                ) : byCategory.map((c, i) => (
                  <div key={c.id || c.name} className="px-4 py-3 flex items-center gap-4" style={{ borderBottom: i < byCategory.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                    <div className="w-40 text-xs shrink-0 truncate">{c.name}</div>
                    <div className="flex-1 h-2.5 relative overflow-hidden" style={{ background: T.track }}>
                      <div className="h-full" style={{ width: `${Math.min(100, c.pct * 100)}%`, background: c.pct > 1 ? T.danger : catColor(c.name, categories) }} />
                    </div>
                    <div className="w-32 text-right text-xs shrink-0" style={{ color: c.remaining < 0 ? T.danger : T.ink }}>{money(c.spent)} / {money(c.budget)}</div>
                  </div>
                ))}
              </div>
            </section>

            {byIncomeSource.length > 0 && (
              <section>
                <h2 className="serif text-xl mb-3">Income by source</h2>
                <div className="border-2 p-4" style={{ borderColor: T.border, background: T.panel }}>
                  <ResponsiveContainer width="100%" height={Math.max(120, byIncomeSource.length * 40)}>
                    <BarChart data={byIncomeSource} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.hairline} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `£${v}`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: T.ink }} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 0, borderColor: T.border, background: T.panel, color: T.ink }} labelStyle={{ color: T.ink }} />
                      <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                        {byIncomeSource.map((s) => <Cell key={s.name} fill={catColor(s.name, categories)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {transactions.some((t) => t.type === "Expenditure") && (
              <section>
                <h2 className="serif text-xl mb-3">Spend by category</h2>
                <div className="border-2 p-4" style={{ borderColor: T.border, background: T.panel }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byCategory.filter((c) => c.spent > 0)} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.hairline} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `£${v}`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: T.ink }} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 0, borderColor: T.border, background: T.panel, color: T.ink }} labelStyle={{ color: T.ink }} />
                      <Bar dataKey="spent" radius={[0, 2, 2, 0]}>
                        {byCategory.filter((c) => c.spent > 0).map((c) => <Cell key={c.name} fill={catColor(c.name, categories)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="serif text-xl">Transactions</h2>
                <button onClick={exportCSV} className="text-[10px] px-3 py-1.5 border" style={{ borderColor: T.border }}>EXPORT CSV</button>
              </div>
              <div className="border-2" style={{ borderColor: T.border, background: T.panel }}>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: T.muted }}>No transactions logged yet. Add your first one under ADD.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[440px]">
                      <div className="grid grid-cols-[85px_1fr_120px_100px_30px] text-[10px] tracking-widest px-4 py-2 border-b-2" style={{ borderColor: T.border, color: T.muted }}>
                        <div>DATE</div><div>DESCRIPTION</div><div className="text-right">AMOUNT</div><div className="text-right">CATEGORY</div><div></div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {transactions.map((t) => (
                          <div key={t.id} className="grid grid-cols-[85px_1fr_120px_100px_30px] text-[11px] px-4 py-2 border-b items-center" style={{ borderColor: T.hairline }}>
                            <div style={{ color: T.muted }}>{t.date}</div>
                            <div className="truncate">{t.description}</div>
                            <div className="text-right" style={{ color: t.type === "Income" ? T.success : T.danger }}>
                              {t.type === "Income" ? "+" : "−"}£{Number(t.amount).toFixed(2)}
                            </div>
                            <div className="text-right truncate" style={{ color: T.muted }}>{t.category}</div>
                            {isAdmin && <button onClick={() => deleteTransaction(t.id)} className="text-right" style={{ color: T.danger }}>✕</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {tab === "add" && (
          <section className="max-w-md">
            <h2 className="serif text-xl mb-4">Log a transaction</h2>
            <form onSubmit={submitTransaction} className="space-y-4 border-2 p-5" style={{ borderColor: T.border, background: T.panel }}>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>TYPE</label>
                <div className="flex gap-1">
                  {["Expenditure", "Income"].map((t) => (
                    <button type="button" key={t} onClick={() => {
                      const opts = t === "Income" ? incomeCategories : expenseCategories;
                      setForm({ ...form, type: t, category: opts[0]?.name || "" });
                    }} className="flex-1 text-xs py-2 border"
                      style={{ borderColor: T.border, background: form.type === t ? T.accent : "transparent", color: form.type === t ? T.accentInk : T.ink }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>DATE</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>DESCRIPTION</label>
                <input type="text" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="e.g. Mersey Tunnel tolls x6" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>{form.type === "Income" ? "SOURCE" : "CATEGORY"}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle}>
                  {(form.type === "Income" ? incomeCategories : expenseCategories).length === 0 && (
                    <option value="">{form.type === "Income" ? "No income sources yet" : "No categories yet"}</option>
                  )}
                  {(form.type === "Income" ? incomeCategories : expenseCategories).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>AMOUNT (£)</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>PAID BY</label>
                  <input type="text" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} placeholder="e.g. Treasurer" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 text-xs tracking-widest font-semibold" style={{ background: T.accent, color: T.accentInk }}>SAVE TRANSACTION</button>
            </form>
          </section>
        )}

        {tab === "budget" && (
          <section className="max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="serif text-xl">Budget & categories</h2>
              {isEditor && !editingBudget && <button onClick={openBudgetEditor} className="text-[10px] px-3 py-1.5 border" style={{ borderColor: T.border }}>EDIT</button>}
            </div>
            {!editingBudget ? (
              <>
                <div className="border-2" style={{ borderColor: T.border, background: T.panel }}>
                  <div className="px-4 py-3 flex justify-between border-b-2" style={{ borderColor: T.border }}>
                    <span className="text-xs font-semibold">Total AU allocation</span>
                    <span className="text-xs">{money(totalBudget)}</span>
                  </div>
                  {expenseCategories.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: T.muted }}>No categories set up. Click EDIT to add some.</div>
                  ) : expenseCategories.map((c, i) => (
                    <div key={c.id} className="px-4 py-3 flex justify-between text-xs" style={{ borderBottom: i < expenseCategories.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                      <span>{c.name}</span>
                      <span>{money(c.budget)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] tracking-widest mt-8 mb-2" style={{ color: T.muted }}>INCOME SOURCES</div>
                <div className="border-2" style={{ borderColor: T.border, background: T.panel }}>
                  {incomeCategories.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: T.muted }}>No income sources set up. Click EDIT to add some.</div>
                  ) : incomeCategories.map((c, i) => (
                    <div key={c.id} className="px-4 py-3 flex justify-between text-xs" style={{ borderBottom: i < incomeCategories.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                      <span>{c.name}</span>
                      <span style={{ color: T.success }}>{money(byIncomeSource.find((s) => s.name === c.name)?.amount || 0)} raised</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="border-2 p-5 space-y-3" style={{ borderColor: T.border, background: T.panel }}>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: T.muted }}>TOTAL AU ALLOCATION (£)</label>
                  <input type="number" value={draftTotal} onChange={(e) => setDraftTotal(e.target.value)} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
                <div className="text-[10px] tracking-widest pt-2" style={{ color: T.muted }}>EXPENDITURE CATEGORIES</div>
                {draftCategories.filter((c) => c.type !== "income").map((c) => (
                  <div key={c.id || c.name} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{c.name}</span>
                    <input type="number" value={c.budget} onChange={(e) => updateDraftBudget(c.name, parseFloat(e.target.value) || 0)}
                      className="w-24 border px-2 py-1 text-xs bg-transparent text-right" style={inputStyle} />
                    <button onClick={() => removeDraftCategory(c.name)} style={{ color: T.danger }}>✕</button>
                  </div>
                ))}
                <div className="pt-2 border-t" style={{ borderColor: T.hairline }}>
                  <label className="text-[10px] tracking-widest block mb-1 mt-2" style={{ color: T.muted }}>ADD NEW CATEGORY</label>
                  <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" className="flex-1 border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                    <input type="number" value={newCatBudget} onChange={(e) => setNewCatBudget(e.target.value)} placeholder="£ budget" className="w-24 border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                    <button type="button" onClick={addDraftCategory} className="px-3 text-xs border" style={{ borderColor: T.border }}>ADD</button>
                  </div>
                </div>

                <div className="text-[10px] tracking-widest pt-4 border-t" style={{ color: T.muted, borderColor: T.hairline }}>INCOME SOURCES</div>
                {draftCategories.filter((c) => c.type === "income").map((c) => (
                  <div key={c.id || c.name} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{c.name}</span>
                    <button onClick={() => removeDraftCategory(c.name)} style={{ color: T.danger }}>✕</button>
                  </div>
                ))}
                <div className="pt-2 border-t" style={{ borderColor: T.hairline }}>
                  <label className="text-[10px] tracking-widest block mb-1 mt-2" style={{ color: T.muted }}>ADD NEW INCOME SOURCE</label>
                  <div className="flex gap-2">
                    <input type="text" value={newIncomeName} onChange={(e) => setNewIncomeName(e.target.value)} placeholder="e.g. Memberships" className="flex-1 border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                    <button type="button" onClick={addDraftIncomeSource} className="px-3 text-xs border" style={{ borderColor: T.border }}>ADD</button>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button onClick={saveBudget} className="flex-1 py-2 text-xs tracking-widest font-semibold" style={{ background: T.accent, color: T.accentInk }}>SAVE</button>
                  <button onClick={() => setEditingBudget(false)} className="flex-1 py-2 text-xs tracking-widest border" style={{ borderColor: T.border }}>CANCEL</button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "admin" && isAdmin && (
          <section className="max-w-2xl">
            <h2 className="serif text-xl mb-1">Admin &middot; access control</h2>
            <p className="text-[11px] mb-4" style={{ color: T.muted }}>
              New signups start as "pending" and can't see any data until approved here.
            </p>

            {pendingUsers.length > 0 && (
              <>
                <div className="text-[10px] tracking-widest mb-2 font-semibold" style={{ color: T.accent }}>PENDING APPROVAL</div>
                <div className="border-2 mb-5" style={{ borderColor: T.danger, background: T.panel }}>
                  {pendingUsers.map((u, i) => (
                    <div key={u.id} className="px-4 py-3 flex items-center justify-between text-xs flex-wrap gap-2" style={{ borderBottom: i < pendingUsers.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                      <span>{u.email}</span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button onClick={() => setRole(u.id, "normal")} className="px-2 py-1 border text-[10px]" style={{ borderColor: T.muted, color: T.muted }}>APPROVE (NORMAL)</button>
                        <button onClick={() => setRole(u.id, "viewer")} className="px-2 py-1 border text-[10px]" style={{ borderColor: T.success, color: T.success }}>APPROVE (VIEWER)</button>
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => setRole(u.id, "admin")} className="px-2 py-1 border text-[10px]" style={{ borderColor: T.border, color: T.ink }}>APPROVE (ADMIN)</button>
                            <button onClick={() => setRole(u.id, "super_admin")} className="px-2 py-1 border text-[10px]" style={{ borderColor: T.purple, color: T.purple }}>APPROVE (SUPER ADMIN)</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="text-[10px] tracking-widest mb-2" style={{ color: T.muted }}>ALL MEMBERS</div>
            <p className="text-[11px] mb-2" style={{ color: T.muted }}>
              {isSuperAdmin
                ? "As a super admin you can promote, demote, revoke, or permanently delete any profile except your own."
                : "Admins manage normal/viewer members. Only a super admin can manage other admins."}
            </p>
            <div className="border-2" style={{ borderColor: T.border, background: T.panel }}>
              {allProfiles.filter((p) => p.role !== "pending").map((u, i, arr) => {
                const targetIsElevated = u.role === "admin" || u.role === "super_admin";
                const canManage = u.id !== profile.id && (isSuperAdmin || (isAdmin && !targetIsElevated));
                return (
                  <div key={u.id} className="px-4 py-3 flex items-center justify-between text-xs flex-wrap gap-2" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                    <div>
                      <div>{u.email}</div>
                      <div className="text-[10px]" style={{ color: T.muted }}>{roleLabel(u.role)}</div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 flex-wrap justify-end">
                        {u.role !== "normal" && <button onClick={() => setRole(u.id, "normal")} className="text-[10px] underline" style={{ color: T.ink }}>make normal</button>}
                        {u.role !== "viewer" && <button onClick={() => setRole(u.id, "viewer")} className="text-[10px] underline" style={{ color: T.ink }}>make viewer</button>}
                        {isSuperAdmin && u.role !== "admin" && <button onClick={() => setRole(u.id, "admin")} className="text-[10px] underline" style={{ color: T.ink }}>make admin</button>}
                        {isSuperAdmin && u.role !== "super_admin" && <button onClick={() => setRole(u.id, "super_admin")} className="text-[10px] underline" style={{ color: T.purple }}>make super admin</button>}
                        {u.role !== "removed" && <button onClick={() => setRole(u.id, "removed")} className="text-[10px] underline" style={{ color: T.danger }}>revoke access</button>}
                        {isSuperAdmin && <button onClick={() => deleteProfile(u.id)} className="text-[10px] underline" style={{ color: T.danger }}>delete profile</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isSuperAdmin && (
              <div className="mt-8">
                <div className="text-[10px] tracking-widest mb-2" style={{ color: T.muted }}>ACTIVITY LOG</div>
                <p className="text-[11px] mb-2" style={{ color: T.muted }}>
                  Every transaction/category change and every keep-alive ping to Supabase, most recent first. Only visible to super admins.
                </p>
                <div className="border-2 max-h-96 overflow-y-auto" style={{ borderColor: T.border, background: T.panel }}>
                  {activityLog.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: T.muted }}>No activity recorded yet.</div>
                  ) : (
                    activityLog.map((l, i) => (
                      <div key={l.id} className="px-4 py-2 text-[11px]" style={{ borderBottom: i < activityLog.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                        <div className="flex items-start justify-between gap-3">
                          <span>{l.summary}</span>
                          <span className="shrink-0 whitespace-nowrap" style={{ color: T.muted }}>{new Date(l.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: l.action === "ping" ? T.purple : T.muted }}>
                          {l.action === "ping" ? "automated · keep-alive ping" : l.actor_email || "unknown user"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
    );
  }

  return showLoginSuccess ? <LoginSuccessOverlay /> : content;
}

function Centered({ children }) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: T.bg, color: T.muted }}>
      <div className="flex-1 flex items-center justify-center px-6">{children}</div>
      <Footer />
    </div>
  );
}

function pointOnCircle(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// Angles measured clockwise from the top (12 o'clock = 0deg).
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = pointOnCircle(cx, cy, r, startAngle);
  const end = pointOnCircle(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function BudgetHorseshoe({ pct, totalBudget }) {
  const remainingPct = Math.max(0, Math.min(1, 1 - pct));
  const overBudget = pct > 1;
  const remainingAmount = totalBudget * remainingPct;
  const cx = 110;
  const cy = 108;
  const r = 85;
  const gapHalf = 35; // horseshoe opening: 70deg wide, centered at the bottom
  const startAngle = 180 + gapHalf;
  const endAngle = 180 - gapHalf + 360;
  const filledEnd = startAngle + remainingPct * (endAngle - startAngle);
  const color = overBudget ? T.danger : T.success;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 200" width="220" height="200">
        <path d={describeArc(cx, cy, r, startAngle, endAngle)} fill="none" stroke={T.track} strokeWidth="18" strokeLinecap="round" />
        {remainingPct > 0 && (
          <path d={describeArc(cx, cy, r, startAngle, filledEnd)} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="900" fill={T.ink}>
          {overBudget ? "OVER" : `${Math.round(remainingPct * 100)}%`}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11" letterSpacing="2" fill={T.muted}>
          REMAINING
        </text>
      </svg>
      <div className="text-xs -mt-4" style={{ color: T.muted }}>
        {money(remainingAmount)} of {money(totalBudget)} budget
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="w-full text-center py-5 text-[10px] tracking-wide" style={{ color: T.faint }}>
      <a href="/privacy" className="underline">Privacy &amp; Data Use Policy</a>
    </footer>
  );
}

function LoginSuccessOverlay() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-xs border-2 p-8 text-center" style={{ borderColor: T.border, background: T.panel }}>
        <div className="text-5xl" aria-hidden="true"><span className="gallop">🐎</span></div>
        <div className="h-px mt-2 mb-4" style={{ background: T.hairline }} />
        <h2 className="serif text-xl mb-1" style={{ color: T.ink }}>Login successful</h2>
        <p className="text-xs" style={{ color: T.muted }}>Redirecting&hellip;</p>
      </div>
    </div>
  );
}
