import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabaseClient";
import PrivacyPolicy from "./PrivacyPolicy";

const PALETTE = ["#c99a3e", "#8a3f3f", "#a4623f", "#5c6b4a", "#7a5c99", "#3f6b8a", "#6b6350", "#a13d2f", "#4a7a6b", "#8a5f3f"];
const catColor = (name, categories) => {
  const idx = categories.findIndex((c) => c.name === name);
  return PALETTE[idx % PALETTE.length] || "#6b6350";
};
const money = (n) => `${n < 0 ? "\u2212" : ""}\u00a3${Math.abs(n).toFixed(2)}`;
const inputStyle = { borderColor: "#1c2a44" };

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

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
    if (cats && cats.length && !form.category) setForm((f) => ({ ...f, category: cats[0].name }));
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
        : await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
    setAuthBusy(false);
    if (error) setAuthError(error.message);
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
        await supabase.from("categories").update({ name: c.name, budget: c.budget }).eq("id", c.id);
      } else {
        await supabase.from("categories").insert({ name: c.name, budget: c.budget });
      }
    }
    setEditingBudget(false);
    loadData();
  };

  const addDraftCategory = () => {
    if (!newCatName.trim()) return;
    if (draftCategories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) return;
    setDraftCategories([...draftCategories, { name: newCatName.trim(), budget: parseFloat(newCatBudget) || 0 }]);
    setNewCatName("");
    setNewCatBudget("");
  };
  const removeDraftCategory = (name) => setDraftCategories(draftCategories.filter((c) => c.name !== name));

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

  const byCategory = useMemo(() => {
    return categories.map((c) => {
      const spent = transactions.filter((t) => t.type === "Expenditure" && t.category === c.name).reduce((s, t) => s + Number(t.amount), 0);
      return { ...c, spent, remaining: c.budget - spent, pct: c.budget ? spent / c.budget : 0 };
    });
  }, [categories, transactions]);

  const spendPct = totalBudget ? totals.expenditure / totalBudget : 0;

  // ---------------- RENDER ----------------

  if (window.location.pathname === "/privacy") {
    return <PrivacyPolicy />;
  }

  if (session === undefined) {
    return <Centered>loading…</Centered>;
  }

  // Not logged in
  if (!session) {
    return (
      <Centered>
        <form onSubmit={handleAuth} className="w-full max-w-sm border-2 p-8" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
          <div className="text-xs tracking-[0.25em] mb-1" style={{ color: "#6b6350" }}>UoL RIDING CLUB</div>
          <h1 className="serif text-3xl font-semibold mb-6" style={{ color: "#1c2a44" }}>The Ledger</h1>
          <div className="flex gap-1 mb-4">
            {["login", "signup"].map((m) => (
              <button type="button" key={m} onClick={() => { setAuthMode(m); setAuthError(""); }}
                className="flex-1 text-xs py-2 border" style={{ borderColor: "#1c2a44", background: authMode === m ? "#1c2a44" : "transparent", color: authMode === m ? "#f2ede1" : "#1c2a44" }}>
                {m === "login" ? "LOG IN" : "SIGN UP"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>EMAIL</label>
              <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>PASSWORD</label>
              <input type="password" required minLength={6} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
            </div>
          </div>
          {authError && <div className="text-[11px] mt-3" style={{ color: "#a13d2f" }}>{authError}</div>}
          <button type="submit" disabled={authBusy} className="w-full py-2.5 text-xs tracking-widest mt-5" style={{ background: "#1c2a44", color: "#f2ede1" }}>
            {authBusy ? "…" : authMode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
          </button>
          {authMode === "signup" && (
            <div className="text-[10px] mt-4" style={{ color: "#8a8270" }}>
              New accounts need admin approval before they can see club finances. You'll be able to log in once approved.
            </div>
          )}
        </form>
      </Centered>
    );
  }

  // Logged in but not yet approved (or revoked / profile deleted)
  if (!isApproved) {
    const revoked = !profile || profile.role === "removed";
    return (
      <Centered>
        <div className="w-full max-w-sm border-2 p-8 text-center" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
          <h1 className="serif text-2xl font-semibold mb-3" style={{ color: "#1c2a44" }}>
            {revoked ? "Access unavailable" : "Awaiting approval"}
          </h1>
          <p className="text-xs mb-5" style={{ color: "#6b6350" }}>
            {revoked
              ? `Your account (${session.user.email}) doesn't currently have access to the club ledger. Contact an admin if you think this is a mistake.`
              : `Your account (${session.user.email}) is registered but hasn't been approved by a club admin yet. Ask the treasurer to approve you from the Admin tab.`}
          </p>
          <button onClick={logout} className="text-[11px] underline" style={{ color: "#a13d2f" }}>log out</button>
        </div>
      </Centered>
    );
  }

  const tabs = ["dashboard", ...(isEditor ? ["add"] : []), "budget", ...(isAdmin ? ["admin"] : [])];

  return (
    <div className="min-h-screen w-full" style={{ background: "#f2ede1", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(28,42,68,0.045) 28px)", color: "#1c2a44" }}>
      <header className="border-b-2 px-6 pt-10 pb-6 sm:px-10" style={{ borderColor: "#1c2a44" }}>
        <div className="max-w-5xl mx-auto flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.25em]" style={{ color: "#6b6350" }}>UNIVERSITY OF LIVERPOOL &middot; RIDING CLUB</div>
            <h1 className="serif text-4xl sm:text-5xl font-semibold mt-1">The Ledger</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest" style={{ color: "#6b6350" }}>{profile.email} &middot; {roleLabel(profile.role)}</div>
            <button onClick={logout} className="text-[10px] underline mt-1" style={{ color: "#a13d2f" }}>log out</button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-1 mt-6">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className="text-[11px] px-3 py-1.5 border tracking-wide"
              style={{ borderColor: "#1c2a44", background: tab === t ? "#1c2a44" : "transparent", color: tab === t ? "#f2ede1" : "#1c2a44" }}>
              {t.toUpperCase()}{t === "admin" && pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-10">
        {tab === "dashboard" && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-px" style={{ background: "#1c2a44" }}>
              {[
                ["Budget allocation", money(totalBudget), "#1c2a44"],
                ["Income logged", money(totals.income), "#5c6b4a"],
                ["Expenditure", money(totals.expenditure), "#a13d2f"],
                ["Remaining", money(totals.balance), totals.balance < 0 ? "#a13d2f" : "#5c6b4a"],
              ].map(([label, val, color]) => (
                <div key={label} className="p-4" style={{ background: "#faf7ee" }}>
                  <div className="text-[10px] tracking-widest" style={{ color: "#6b6350" }}>{label.toUpperCase()}</div>
                  <div className="serif text-2xl font-semibold mt-1" style={{ color }}>{val}</div>
                </div>
              ))}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="serif text-xl font-semibold">Category budgets</h2>
                <span className="text-[10px]" style={{ color: "#6b6350" }}>{Math.round(spendPct * 100)}% of total budget spent</span>
              </div>
              <div className="border-2" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                {byCategory.length === 0 ? (
                  <div className="p-6 text-center text-xs" style={{ color: "#6b6350" }}>No categories yet &mdash; add some under BUDGET.</div>
                ) : byCategory.map((c, i) => (
                  <div key={c.id || c.name} className="px-4 py-3 flex items-center gap-4" style={{ borderBottom: i < byCategory.length - 1 ? "1px solid #e7ddc8" : "none" }}>
                    <div className="w-40 text-xs shrink-0 truncate">{c.name}</div>
                    <div className="flex-1 h-2.5 bg-[#e7ddc8] relative overflow-hidden">
                      <div className="h-full" style={{ width: `${Math.min(100, c.pct * 100)}%`, background: c.pct > 1 ? "#a13d2f" : catColor(c.name, categories) }} />
                    </div>
                    <div className="w-32 text-right text-xs shrink-0" style={{ color: c.remaining < 0 ? "#a13d2f" : "#1c2a44" }}>{money(c.spent)} / {money(c.budget)}</div>
                  </div>
                ))}
              </div>
            </section>

            {transactions.some((t) => t.type === "Expenditure") && (
              <section>
                <h2 className="serif text-xl font-semibold mb-3">Spend by category</h2>
                <div className="border-2 p-4" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byCategory.filter((c) => c.spent > 0)} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7ddc8" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#6b6350" }} tickFormatter={(v) => `£${v}`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#1c2a44" }} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 0, borderColor: "#1c2a44" }} />
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
                <h2 className="serif text-xl font-semibold">Transactions</h2>
                <button onClick={exportCSV} className="text-[10px] px-3 py-1.5 border" style={{ borderColor: "#1c2a44" }}>EXPORT CSV</button>
              </div>
              <div className="border-2" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: "#6b6350" }}>No transactions logged yet. Add your first one under ADD.</div>
                ) : (
                  <div className="overflow-x-auto">
                  <div className="min-w-[440px]">
                    <div className="grid grid-cols-[85px_1fr_120px_100px_30px] text-[10px] tracking-widest px-4 py-2 border-b-2" style={{ borderColor: "#1c2a44", color: "#6b6350" }}>
                      <div>DATE</div><div>DESCRIPTION</div><div className="text-right">AMOUNT</div><div className="text-right">CATEGORY</div><div></div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {transactions.map((t) => (
                        <div key={t.id} className="grid grid-cols-[85px_1fr_120px_100px_30px] text-[11px] px-4 py-2 border-b items-center" style={{ borderColor: "#e7ddc8" }}>
                          <div style={{ color: "#6b6350" }}>{t.date}</div>
                          <div className="truncate">{t.description}</div>
                          <div className="text-right" style={{ color: t.type === "Income" ? "#5c6b4a" : "#a13d2f" }}>
                            {t.type === "Income" ? "+" : "\u2212"}£{Number(t.amount).toFixed(2)}
                          </div>
                          <div className="text-right truncate" style={{ color: "#6b6350" }}>{t.category}</div>
                          {isAdmin && <button onClick={() => deleteTransaction(t.id)} className="text-right" style={{ color: "#a13d2f" }}>✕</button>}
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
            <h2 className="serif text-xl font-semibold mb-4">Log a transaction</h2>
            <form onSubmit={submitTransaction} className="space-y-4 border-2 p-5" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>TYPE</label>
                <div className="flex gap-1">
                  {["Expenditure", "Income"].map((t) => (
                    <button type="button" key={t} onClick={() => setForm({ ...form, type: t })} className="flex-1 text-xs py-2 border"
                      style={{ borderColor: "#1c2a44", background: form.type === t ? "#1c2a44" : "transparent", color: form.type === t ? "#f2ede1" : "#1c2a44" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>DATE</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>DESCRIPTION</label>
                <input type="text" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="e.g. Mersey Tunnel tolls x6" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>CATEGORY</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle}>
                  {categories.length === 0 && <option value="">No categories yet</option>}
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>AMOUNT (£)</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>PAID BY</label>
                  <input type="text" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} placeholder="e.g. Treasurer" className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 text-xs tracking-widest" style={{ background: "#1c2a44", color: "#f2ede1" }}>SAVE TRANSACTION</button>
            </form>
          </section>
        )}

        {tab === "budget" && (
          <section className="max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="serif text-xl font-semibold">Budget & categories</h2>
              {isEditor && !editingBudget && <button onClick={openBudgetEditor} className="text-[10px] px-3 py-1.5 border" style={{ borderColor: "#1c2a44" }}>EDIT</button>}
            </div>
            {!editingBudget ? (
              <div className="border-2" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                <div className="px-4 py-3 flex justify-between border-b-2" style={{ borderColor: "#1c2a44" }}>
                  <span className="text-xs font-semibold">Total AU allocation</span>
                  <span className="text-xs">{money(totalBudget)}</span>
                </div>
                {categories.length === 0 ? (
                  <div className="p-6 text-center text-xs" style={{ color: "#6b6350" }}>No categories set up. Click EDIT to add some.</div>
                ) : categories.map((c, i) => (
                  <div key={c.id} className="px-4 py-3 flex justify-between text-xs" style={{ borderBottom: i < categories.length - 1 ? "1px solid #e7ddc8" : "none" }}>
                    <span>{c.name}</span>
                    <span>{money(c.budget)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 p-5 space-y-3" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "#6b6350" }}>TOTAL AU ALLOCATION (£)</label>
                  <input type="number" value={draftTotal} onChange={(e) => setDraftTotal(e.target.value)} className="w-full border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                </div>
                {draftCategories.map((c, i) => (
                  <div key={c.id || c.name} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{c.name}</span>
                    <input type="number" value={c.budget} onChange={(e) => {
                      const next = [...draftCategories];
                      next[i] = { ...next[i], budget: parseFloat(e.target.value) || 0 };
                      setDraftCategories(next);
                    }} className="w-24 border px-2 py-1 text-xs bg-transparent text-right" style={inputStyle} />
                    <button onClick={() => removeDraftCategory(c.name)} style={{ color: "#a13d2f" }}>✕</button>
                  </div>
                ))}
                <div className="pt-2 border-t" style={{ borderColor: "#e7ddc8" }}>
                  <label className="text-[10px] tracking-widest block mb-1 mt-2" style={{ color: "#6b6350" }}>ADD NEW CATEGORY</label>
                  <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" className="flex-1 border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                    <input type="number" value={newCatBudget} onChange={(e) => setNewCatBudget(e.target.value)} placeholder="£ budget" className="w-24 border px-2 py-1.5 text-xs bg-transparent" style={inputStyle} />
                    <button type="button" onClick={addDraftCategory} className="px-3 text-xs border" style={{ borderColor: "#1c2a44" }}>ADD</button>
                  </div>
                </div>
                <div className="flex gap-2 pt-3">
                  <button onClick={saveBudget} className="flex-1 py-2 text-xs tracking-widest" style={{ background: "#1c2a44", color: "#f2ede1" }}>SAVE</button>
                  <button onClick={() => setEditingBudget(false)} className="flex-1 py-2 text-xs tracking-widest border" style={{ borderColor: "#1c2a44" }}>CANCEL</button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "admin" && isAdmin && (
          <section className="max-w-2xl">
            <h2 className="serif text-xl font-semibold mb-1">Admin &middot; access control</h2>
            <p className="text-[11px] mb-4" style={{ color: "#6b6350" }}>
              New signups start as "pending" and can't see any data until approved here.
            </p>

            {pendingUsers.length > 0 && (
              <>
                <div className="text-[10px] tracking-widest mb-2" style={{ color: "#a13d2f" }}>PENDING APPROVAL</div>
                <div className="border-2 mb-5" style={{ borderColor: "#a13d2f", background: "#faf7ee" }}>
                  {pendingUsers.map((u, i) => (
                    <div key={u.id} className="px-4 py-3 flex items-center justify-between text-xs flex-wrap gap-2" style={{ borderBottom: i < pendingUsers.length - 1 ? "1px solid #e7ddc8" : "none" }}>
                      <span>{u.email}</span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button onClick={() => setRole(u.id, "normal")} className="px-2 py-1 border text-[10px]" style={{ borderColor: "#6b6350", color: "#6b6350" }}>APPROVE (NORMAL)</button>
                        <button onClick={() => setRole(u.id, "viewer")} className="px-2 py-1 border text-[10px]" style={{ borderColor: "#5c6b4a", color: "#5c6b4a" }}>APPROVE (VIEWER)</button>
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => setRole(u.id, "admin")} className="px-2 py-1 border text-[10px]" style={{ borderColor: "#1c2a44" }}>APPROVE (ADMIN)</button>
                            <button onClick={() => setRole(u.id, "super_admin")} className="px-2 py-1 border text-[10px]" style={{ borderColor: "#7a5c99", color: "#7a5c99" }}>APPROVE (SUPER ADMIN)</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="text-[10px] tracking-widest mb-2" style={{ color: "#6b6350" }}>ALL MEMBERS</div>
            <p className="text-[11px] mb-2" style={{ color: "#6b6350" }}>
              {isSuperAdmin
                ? "As a super admin you can promote, demote, revoke, or permanently delete any profile except your own."
                : "Admins manage normal/viewer members. Only a super admin can manage other admins."}
            </p>
            <div className="border-2" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
              {allProfiles.filter((p) => p.role !== "pending").map((u, i, arr) => {
                const targetIsElevated = u.role === "admin" || u.role === "super_admin";
                const canManage = u.id !== profile.id && (isSuperAdmin || (isAdmin && !targetIsElevated));
                return (
                  <div key={u.id} className="px-4 py-3 flex items-center justify-between text-xs flex-wrap gap-2" style={{ borderBottom: i < arr.length - 1 ? "1px solid #e7ddc8" : "none" }}>
                    <div>
                      <div>{u.email}</div>
                      <div className="text-[10px]" style={{ color: "#6b6350" }}>{roleLabel(u.role)}</div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 flex-wrap justify-end">
                        {u.role !== "normal" && <button onClick={() => setRole(u.id, "normal")} className="text-[10px] underline" style={{ color: "#1c2a44" }}>make normal</button>}
                        {u.role !== "viewer" && <button onClick={() => setRole(u.id, "viewer")} className="text-[10px] underline" style={{ color: "#1c2a44" }}>make viewer</button>}
                        {isSuperAdmin && u.role !== "admin" && <button onClick={() => setRole(u.id, "admin")} className="text-[10px] underline" style={{ color: "#1c2a44" }}>make admin</button>}
                        {isSuperAdmin && u.role !== "super_admin" && <button onClick={() => setRole(u.id, "super_admin")} className="text-[10px] underline" style={{ color: "#7a5c99" }}>make super admin</button>}
                        {u.role !== "removed" && <button onClick={() => setRole(u.id, "removed")} className="text-[10px] underline" style={{ color: "#a13d2f" }}>revoke access</button>}
                        {isSuperAdmin && <button onClick={() => deleteProfile(u.id)} className="text-[10px] underline" style={{ color: "#a13d2f" }}>delete profile</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isSuperAdmin && (
              <div className="mt-8">
                <div className="text-[10px] tracking-widest mb-2" style={{ color: "#6b6350" }}>ACTIVITY LOG</div>
                <p className="text-[11px] mb-2" style={{ color: "#6b6350" }}>
                  Every transaction/category change and every keep-alive ping to Supabase, most recent first. Only visible to super admins.
                </p>
                <div className="border-2 max-h-96 overflow-y-auto" style={{ borderColor: "#1c2a44", background: "#faf7ee" }}>
                  {activityLog.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: "#6b6350" }}>No activity recorded yet.</div>
                  ) : (
                    activityLog.map((l, i) => (
                      <div key={l.id} className="px-4 py-2 text-[11px]" style={{ borderBottom: i < activityLog.length - 1 ? "1px solid #e7ddc8" : "none" }}>
                        <div className="flex items-start justify-between gap-3">
                          <span>{l.summary}</span>
                          <span className="shrink-0 whitespace-nowrap" style={{ color: "#6b6350" }}>{new Date(l.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: l.action === "ping" ? "#7a5c99" : "#6b6350" }}>
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

function Centered({ children }) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#f2ede1", color: "#6b6350" }}>
      <div className="flex-1 flex items-center justify-center px-6">{children}</div>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="w-full text-center py-5 text-[10px] tracking-wide" style={{ color: "#8a8270" }}>
      <a href="/privacy" className="underline">Privacy &amp; Data Use Policy</a>
    </footer>
  );
}
