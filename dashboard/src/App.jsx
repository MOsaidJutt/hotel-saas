import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { BotSetupWizard } from "./components/BotSetup";
import { KnowledgeBasePage, DepartmentStaffApp } from "./components/StaffComponents";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, MessageSquare, ClipboardList, Building2, BarChart3, Users,
  Settings, Bell, LogOut, Wifi, WifiOff, ChevronRight, Activity, Clock,
  CheckCircle, AlertTriangle, Bot, Send, Plus, Save, TrendingUp, TrendingDown,
  RefreshCw, X, Eye, EyeOff, Trash2, Edit2, Shield, Globe, Phone, Key,
  CheckSquare, ToggleLeft, ChevronDown, Loader, Building, UserCheck,
  BookOpen, Wand2, Hotel, UtensilsCrossed, Star, FileText, Wrench, Hash,
  ChevronLeft, Info, Coffee, Bed, CreditCard, Receipt, TrendingUp as TrendUp,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
const STATUS_STYLES = {
  Active:               "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  New:                  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "In Progress":        "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Escalated:            "bg-red-500/15 text-red-400 border-red-500/25",
  Completed:            "bg-slate-500/15 text-slate-400 border-slate-500/25",
  "Needs Verification": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  Online:               "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Offline:              "bg-slate-500/15 text-slate-500 border-slate-700",
  active:               "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  suspended:            "bg-red-500/15 text-red-400 border-red-500/25",
  trial:                "bg-amber-500/15 text-amber-400 border-amber-500/25",
  authorized:           "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  notAuthorized:        "bg-red-500/15 text-red-400 border-red-500/25",
  notConfigured:        "bg-slate-500/15 text-slate-400 border-slate-700",
};
const TOOLTIP_STYLE = { backgroundColor:"#1e293b", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px", color:"#e2e8f0" };
const FIELD_TYPES = ["text","number","dropdown","timepicker","toggle"];

// ─── API helper ───────────────────────────────────────────────────────────────
function api(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
      {status}
    </span>
  );
}
function Card({ children, className="" }) {
  return <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>{children}</div>;
}
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
function Modal({ title, onClose, children, width="max-w-lg" }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${width} shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={16}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <input {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" />
    </div>
  );
}
function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <select {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition">
        {children}
      </select>
    </div>
  );
}
function Btn({ variant="primary", children, className="", ...props }) {
  const base = "px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50";
  const vars = {
    primary:  "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
    secondary:"bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger:   "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25",
    ghost:    "text-slate-400 hover:text-white hover:bg-slate-800",
  };
  return <button className={`${base} ${vars[variant]} ${className}`} {...props}>{children}</button>;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await api("/api/auth/login", { method:"POST", body:{ email, password } });
      localStorage.setItem("token", data.token);
      onLogin(data.user);
    } catch(err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-emerald-500/30 mx-auto mb-4">O</div>
          <h1 className="text-xl font-bold text-white">Onesol Hotel SaaS</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@yourhotel.com" required autoFocus />

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                />
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <Btn type="submit" variant="primary" disabled={loading} className="w-full justify-center">
              {loading ? <><Loader size={14} className="animate-spin"/>Signing in…</> : "Sign In"}
            </Btn>
          </form>
        </Card>
        <p className="text-center text-xs text-slate-600 mt-4">Onesol Tech Hotel · Powered by GPT-4o-mini</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TENANT DETAIL VIEW (Super Admin)
// ══════════════════════════════════════════════════════════════════════════════
function TenantDetailView({ tenant, onBack, onUpdate }) {
  const [detail, setDetail]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [invoices, setInvoices]   = useState([]);
  const [showInvModal, setShowInvModal] = useState(false);
  const [invForm, setInvForm]     = useState({ period:"", amount:"", plan:"starter", notes:"" });
  const [invSaving, setInvSaving] = useState(false);

  const PLANS = ["starter","professional","business","enterprise"];
  const STATUS_COLORS = { issued:"text-blue-400", paid:"text-emerald-400", overdue:"text-red-400", void:"text-slate-500", draft:"text-slate-400" };

  useEffect(()=>{
    api(`/api/superadmin/tenants/${tenant._id}`)
      .then(d=>{ setDetail(d); setLoading(false); })
      .catch(()=>setLoading(false));
    api(`/api/superadmin/invoices?tenantId=${tenant._id}`)
      .then(d=>setInvoices(d||[])).catch(()=>{});
  },[tenant._id]);

  async function createInvoice(e) {
    e.preventDefault(); setInvSaving(true);
    try {
      const inv = await api("/api/superadmin/invoices",{ method:"POST", body:{
        tenantId: tenant._id,
        period: invForm.period,
        amount: Math.round(parseFloat(invForm.amount) * 100), // store cents
        plan: invForm.plan,
        notes: invForm.notes,
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      }});
      setInvoices(p=>[inv,...p]);
      setShowInvModal(false);
      setInvForm({ period:"", amount:"", plan:"starter", notes:"" });
    } catch(e){ alert(e.message); }
    setInvSaving(false);
  }

  async function markPaid(id) {
    const updated = await api(`/api/superadmin/invoices/${id}`,{method:"PUT",body:{status:"paid"}});
    setInvoices(p=>p.map(i=>i._id===id?updated:i));
  }

  async function voidInv(id) {
    if (!confirm("Void this invoice?")) return;
    const updated = await api(`/api/superadmin/invoices/${id}`,{method:"PUT",body:{status:"void"}});
    setInvoices(p=>p.map(i=>i._id===id?updated:i));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader size={22} className="text-emerald-400 animate-spin"/></div>;

  const t = detail?.tenant || tenant;
  const u = detail?.usage || {};

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-white transition">← Back</button>
        <h1 className="text-xl font-bold text-white">{t.name}</h1>
        <StatusBadge status={t.status}/>
        <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded capitalize">{t.plan}</span>
      </div>

      {/* Usage stats this month */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:"Requests (month)",  value: u.requestsThisMonth ?? "—", color:"text-blue-400" },
          { label:"Conversations (month)", value: u.convsThisMonth ?? "—",  color:"text-violet-400" },
          { label:"Escalated (total)", value: u.escalatedCount ?? "—",  color:"text-red-400" },
          { label:"Completed (total)", value: u.completedCount ?? "—",  color:"text-emerald-400" },
        ].map((s,i)=>(
          <Card key={i} className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"Email",       value: t.email },
          { label:"Webhook URL", value: t.webhookUrl || "Not set" },
          { label:"Slug",        value: t.slug },
        ].map((item,i)=>(
          <Card key={i} className="p-4">
            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
            <p className="text-xs font-medium text-white truncate">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-3">WhatsApp Status</h3>
        <div className="flex items-center gap-3">
          <StatusBadge status={t.greenApi?.instanceState || "notConfigured"}/>
          <span className="text-xs text-slate-500">{t.greenApi?.phoneNumber || "No number configured"}</span>
          <button onClick={async()=>{
            const d = await api(`/api/superadmin/tenants/${t._id}/whatsapp-status`);
            setDetail(p=>p?{...p,tenant:{...p.tenant,greenApi:{...p.tenant.greenApi,instanceState:d.state}}}:p);
          }} className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><RefreshCw size={12}/>Refresh</button>
        </div>
      </Card>

      {detail?.admins?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Admin Users</h3>
          <div className="space-y-2">
            {detail.admins.map((a,i)=>(
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.email}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs ${a.active?"text-emerald-400":"text-slate-500"}`}>{a.active?"Active":"Inactive"}</p>
                  <p className="text-[10px] text-slate-600">{a.lastLogin?`Last: ${new Date(a.lastLogin).toLocaleDateString()}`:"Never logged in"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invoices */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Invoice History</h3>
          <button onClick={()=>setShowInvModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition font-medium">
            <Plus size={13}/>Create Invoice
          </button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No invoices yet</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv,i)=>(
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{inv.invoiceNo}</span>
                    <span className={`text-xs font-semibold capitalize ${STATUS_COLORS[inv.status]||"text-slate-400"}`}>{inv.status}</span>
                  </div>
                  <p className="text-sm font-medium text-white mt-0.5">{inv.period}</p>
                  {inv.notes && <p className="text-[11px] text-slate-500 mt-0.5">{inv.notes}</p>}
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">${(inv.amount/100).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-600 capitalize">{inv.plan}</p>
                  </div>
                  {inv.status === "issued" && (
                    <div className="flex gap-1">
                      <button onClick={()=>markPaid(inv._id)} className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition">Paid</button>
                      <button onClick={()=>voidInv(inv._id)} className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-500 hover:text-red-400 transition">Void</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showInvModal && (
        <Modal title="Create Invoice" onClose={()=>setShowInvModal(false)}>
          <form onSubmit={createInvoice} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Billing Period *</label>
              <input value={invForm.period} onChange={e=>setInvForm(f=>({...f,period:e.target.value}))}
                placeholder="e.g. April 2026"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" required/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (USD) *</label>
              <input value={invForm.amount} onChange={e=>setInvForm(f=>({...f,amount:e.target.value}))}
                type="number" step="0.01" min="0" placeholder="149.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" required/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
              <select value={invForm.plan} onChange={e=>setInvForm(f=>({...f,plan:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition">
                {PLANS.map(p=><option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
              <input value={invForm.notes} onChange={e=>setInvForm(f=>({...f,notes:e.target.value}))}
                placeholder="Optional notes"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"/>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={()=>setShowInvModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition">Cancel</button>
              <button type="submit" disabled={invSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition disabled:opacity-50">
                {invSaving?<><Loader size={13} className="animate-spin"/>Creating…</>:<><Receipt size={13}/>Create</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN APP
// ══════════════════════════════════════════════════════════════════════════════
function SuperAdminApp({ user, onLogout }) {
  const [page, setPage]             = useState("Tenants");
  const [tenants, setTenants]       = useState([]);
  const [dashStats, setDashStats]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [form, setForm] = useState({ name:"", email:"", phone:"", plan:"starter", adminName:"", adminEmail:"", adminPassword:"", idInstance:"", apiTokenInstance:"" });
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, d] = await Promise.all([
        api("/api/superadmin/tenants"),
        api("/api/superadmin/dashboard"),
      ]);
      setTenants(t.tenants);
      setDashStats(d);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function createTenant(e) {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      await api("/api/superadmin/tenants", { method:"POST", body: form });
      setShowCreate(false);
      setForm({ name:"", email:"", phone:"", plan:"starter", adminName:"", adminEmail:"", adminPassword:"", idInstance:"", apiTokenInstance:"" });
      loadData();
    } catch(err) { setFormErr(err.message); }
    setSaving(false);
  }

  async function toggleStatus(tenant) {
    const action = tenant.status === "active" ? "suspend" : "activate";
    await api(`/api/superadmin/tenants/${tenant._id}/${action}`, { method:"POST" });
    loadData();
  }

  async function deleteTenant(id) {
    if (!confirm("Delete this tenant and ALL their data? This cannot be undone.")) return;
    await api(`/api/superadmin/tenants/${id}`, { method:"DELETE" });
    loadData();
  }

  const statCards = [
    { label:"Total Clients",    value: dashStats.tenantCount  || 0, icon:<Building size={18}/>,     color:"from-blue-500 to-blue-700" },
    { label:"Total Staff",      value: dashStats.userCount    || 0, icon:<Users size={18}/>,         color:"from-violet-500 to-violet-700" },
    { label:"Total Requests",   value: dashStats.requestCount || 0, icon:<ClipboardList size={18}/>, color:"from-emerald-500 to-teal-600" },
    { label:"Total Conversations",value:dashStats.convCount   || 0, icon:<MessageSquare size={18}/>, color:"from-amber-500 to-orange-600" },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#0b111e] border-r border-slate-800/60 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/20">SA</div>
            <div><div className="text-xs font-bold text-white leading-tight">Super Admin</div><div className="text-[10px] text-slate-500">Platform Control</div></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { icon:<LayoutDashboard size={16}/>, label:"Overview" },
            { icon:<Building size={16}/>,        label:"Tenants" },
            { icon:<Users size={16}/>,           label:"All Users" },
          ].map(item => (
            <button key={item.label} onClick={()=>setPage(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-left ${page===item.label ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"}`}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-800/60">
          <button onClick={onLogout} className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition px-2 py-1.5">
            <LogOut size={13}/> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] shrink-0 bg-[#0d1525] border-b border-slate-800/60 flex items-center px-6">
          <Shield size={16} className="text-violet-400 mr-2"/>
          <span className="text-sm font-semibold text-white">Super Admin Panel</span>
          <span className="ml-3 text-xs text-slate-500">{user.name}</span>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-slate-950">
          {loading && <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={24} className="animate-spin mr-2"/>Loading…</div>}

          {/* Overview */}
          {!loading && page==="Overview" && (
            <div className="space-y-6">
              <SectionHeader title="Platform Overview" subtitle="All hotels across the SaaS"/>
              <div className="grid grid-cols-4 gap-4">
                {statCards.map((k,i) => (
                  <Card key={i} className="p-4">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center text-white shadow-lg mb-3`}>{k.icon}</div>
                    <div className="text-2xl font-bold text-white">{k.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Recent Clients</h3>
                <div className="space-y-2">
                  {(dashStats.recentTenants||[]).map((t,i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-800 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xs font-bold">{t.name[0]}</div>
                      <div className="flex-1"><p className="text-sm font-medium text-white">{t.name}</p><p className="text-xs text-slate-500">{t.email}</p></div>
                      <StatusBadge status={t.status}/>
                      <span className="text-xs text-slate-600">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Tenants */}
          {!loading && page==="Tenants" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionHeader title="Hotel Clients" subtitle={`${tenants.length} registered clients`}/>
                <Btn variant="primary" onClick={()=>setShowCreate(true)}><Plus size={15}/>New Client</Btn>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-600 text-[11px] uppercase tracking-wider">
                      {["Hotel","Email","Plan","WhatsApp","Status","Created","Actions"].map(h=>(
                        <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tenants.map((t,i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">{t.name[0]}</div>
                            <div><p className="font-medium text-white text-xs">{t.name}</p><p className="text-[10px] text-slate-500 font-mono">{t.slug}</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{t.email}</td>
                        <td className="px-5 py-3.5"><span className="text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400 capitalize">{t.plan}</span></td>
                        <td className="px-5 py-3.5"><StatusBadge status={t.greenApi?.instanceState || "notConfigured"}/></td>
                        <td className="px-5 py-3.5"><StatusBadge status={t.status}/></td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={()=>{setSelectedTenant(t);setPage("TenantDetail");}} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"><Eye size={13}/></button>
                            <button onClick={()=>toggleStatus(t)} className={`p-1.5 rounded-lg border text-xs transition ${t.status==="active" ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"}`}>
                              {t.status==="active" ? "Suspend" : "Activate"}
                            </button>
                            <button onClick={()=>deleteTenant(t._id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Tenant Detail */}
          {!loading && page==="TenantDetail" && selectedTenant && (
            <TenantDetailView tenant={selectedTenant} onBack={()=>setPage("Tenants")} onUpdate={setSelectedTenant}/>
          )}
        </main>
      </div>

      {/* Create Tenant Modal */}
      {showCreate && (
        <Modal title="Add New Hotel Client" onClose={()=>setShowCreate(false)} width="max-w-xl">
          <form onSubmit={createTenant} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Hotel Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Grand Luxury Hotel" required/>
              <Input label="Hotel Email *" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="info@grandluxury.com" required/>
              <Input label="Phone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1 234 567 8900"/>
              <Select label="Plan" value={form.plan} onChange={e=>setForm(f=>({...f,plan:e.target.value}))}>
                {["starter","professional","business","enterprise"].map(p=><option key={p} value={p} className="capitalize">{p}</option>)}
              </Select>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-500 mb-3">Admin Account</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Admin Name" value={form.adminName} onChange={e=>setForm(f=>({...f,adminName:e.target.value}))} placeholder="Hotel Manager"/>
                <Input label="Admin Email *" type="email" value={form.adminEmail} onChange={e=>setForm(f=>({...f,adminEmail:e.target.value}))} placeholder="admin@grandluxury.com" required/>
                <Input label="Admin Password *" type="password" value={form.adminPassword} onChange={e=>setForm(f=>({...f,adminPassword:e.target.value}))} placeholder="Min 8 characters" required/>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-500 mb-1">WhatsApp — Green API <span className="text-slate-600">(optional, can be added later in Settings)</span></p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <Input label="Instance ID" value={form.idInstance} onChange={e=>setForm(f=>({...f,idInstance:e.target.value}))} placeholder="7103xxxxxxx"/>
                <Input label="API Token" value={form.apiTokenInstance} onChange={e=>setForm(f=>({...f,apiTokenInstance:e.target.value}))} placeholder="Paste token"/>
              </div>
            </div>
            {formErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formErr}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="secondary" type="button" onClick={()=>setShowCreate(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={saving}>{saving?<><Loader size={14} className="animate-spin"/>Creating…</>:"Create Client"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT BUILDER
// ══════════════════════════════════════════════════════════════════════════════
function DepartmentBuilder() {
  const [depts, setDepts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  function blankForm() {
    return { name:"", icon:"🛎", color:"#10b981", keywords:"", escalationMinutes:30, maxConcurrentLoad:5, fields:[] };
  }

  const load = useCallback(async()=>{
    setLoading(true);
    try { const d = await api("/api/admin/departments"); setDepts(d); } catch(e){console.error(e);}
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  function openCreate() { setEditing(null); setForm(blankForm()); setErr(""); setShowModal(true); }
  function openEdit(d)  { setEditing(d); setForm({ ...d, keywords: d.keywords.join(", ") }); setErr(""); setShowModal(true); }

  function addField() {
    setForm(f=>({ ...f, fields:[...f.fields, { name:"", type:"text", required:false, options:[], placeholder:"" }] }));
  }
  function updateField(i, key, val) {
    setForm(f=>{ const fields=[...f.fields]; fields[i]={...fields[i],[key]:val}; return {...f,fields}; });
  }
  function removeField(i) {
    setForm(f=>{ const fields=f.fields.filter((_,j)=>j!==i); return {...f,fields}; });
  }

  async function save(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      const body = { ...form, keywords: form.keywords.split(",").map(k=>k.trim()).filter(Boolean) };
      if (editing) { await api(`/api/admin/departments/${editing._id}`, { method:"PUT", body }); }
      else          { await api("/api/admin/departments", { method:"POST", body }); }
      setShowModal(false); load();
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }

  async function del(id) {
    if (!confirm("Delete this department?")) return;
    await api(`/api/admin/departments/${id}`, { method:"DELETE" });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading departments…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Department Builder" subtitle="Create departments — custom fields appear automatically in requests"/>
        <Btn variant="primary" onClick={openCreate}><Plus size={15}/>New Department</Btn>
      </div>

      {depts.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 size={40} className="mx-auto mb-4 text-slate-700"/>
          <p className="text-slate-500 text-sm">No departments yet</p>
          <p className="text-slate-700 text-xs mt-1">Click "New Department" to get started</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {depts.map((d,i) => (
          <Card key={d._id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{d.icon}</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">{d.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{d.fields.length} custom field{d.fields.length!==1?"s":""} · Menu order #{d.menuOrder}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={()=>openEdit(d)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"><Edit2 size={13}/></button>
                <button onClick={()=>del(d._id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"><Trash2 size={13}/></button>
              </div>
            </div>

            {/* Keywords */}
            {d.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {d.keywords.map((k,j) => (
                  <span key={j} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded-full border border-slate-700">{k}</span>
                ))}
              </div>
            )}

            {/* Custom fields preview */}
            {d.fields.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-800 pt-3">
                {d.fields.map((f,j) => (
                  <div key={j} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-500/60">
                      {f.type==="toggle" ? <ToggleLeft size={12}/> : f.type==="dropdown" ? <ChevronDown size={12}/> : <CheckSquare size={12}/>}
                    </span>
                    <span>{f.name}</span>
                    <span className="text-slate-700 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">{f.type}</span>
                    {f.required && <span className="text-[10px] text-red-400/70">required</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-600">Escalate after {d.escalationMinutes} min</span>
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}/>
            </div>
          </Card>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {showModal && form && (
        <Modal title={editing ? `Edit — ${editing.name}` : "New Department"} onClose={()=>setShowModal(false)} width="max-w-2xl">
          <form onSubmit={save} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Pool Services" required/>
              <Input label="Icon (emoji)" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} placeholder="🏊"/>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer"/>
                  <span className="text-xs text-slate-500 font-mono">{form.color}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Menu Order" type="number" value={form.menuOrder||99} onChange={e=>setForm(f=>({...f,menuOrder:e.target.value}))}/>
              <Input label="Escalate After (mins)" type="number" value={form.escalationMinutes} onChange={e=>setForm(f=>({...f,escalationMinutes:e.target.value}))}/>
              <Input label="Max Load (requests)" type="number" value={form.maxConcurrentLoad} onChange={e=>setForm(f=>({...f,maxConcurrentLoad:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Keywords (comma separated)</label>
              <input
                value={form.keywords} onChange={e=>setForm(f=>({...f,keywords:e.target.value}))}
                placeholder="towel, clean, bedsheet, pillow"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
              />
              <p className="text-[10px] text-slate-600 mt-1">Bot routes to this dept when guest message contains these words</p>
            </div>

            {/* Custom fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-slate-400">Custom Fields</label>
                <button type="button" onClick={addField} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Field</button>
              </div>
              <div className="space-y-3">
                {form.fields.map((field, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        value={field.name} onChange={e=>updateField(i,"name",e.target.value)}
                        placeholder="Field name (e.g. Request Type)"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                      />
                      <select value={field.type} onChange={e=>updateField(i,"type",e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50">
                        {FIELD_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e=>updateField(i,"required",e.target.checked)} className="accent-emerald-500"/>
                        Required
                      </label>
                      <button type="button" onClick={()=>removeField(i)} className="text-slate-600 hover:text-red-400 transition"><X size={13}/></button>
                    </div>
                    {field.type==="dropdown" && (
                      <div>
                        <input
                          value={(field.options||[]).join(", ")}
                          onChange={e=>updateField(i,"options",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
                          placeholder="Option 1, Option 2, Option 3"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Comma-separated dropdown options</p>
                      </div>
                    )}
                    {(field.type==="text"||field.type==="number") && (
                      <input
                        value={field.placeholder||""}
                        onChange={e=>updateField(i,"placeholder",e.target.value)}
                        placeholder="Placeholder text (optional)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <Btn variant="secondary" type="button" onClick={()=>setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={saving}>{saving?<><Loader size={14} className="animate-spin"/>{editing?"Saving…":"Creating…"}</>:editing?"Save Changes":"Create Department"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WHATSAPP CONFIG PAGE
// ══════════════════════════════════════════════════════════════════════════════
function WhatsAppConfig({ tenant }) {
  const [form, setForm]     = useState({ idInstance: tenant?.greenApi?.idInstance||"", apiTokenInstance:"" });
  const [status, setStatus] = useState(tenant?.greenApi?.instanceState || "notConfigured");
  const [qr, setQr]         = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [err, setErr]       = useState("");

  async function save(e) {
    e.preventDefault(); setSaving(true); setErr(""); setMsg("");
    try {
      const d = await api("/api/admin/whatsapp", { method:"PUT", body: form });
      setStatus(d.state); setMsg("WhatsApp configured! Webhook registered at: " + d.webhookUrl);
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }
  async function refreshStatus() {
    const d = await api("/api/admin/whatsapp/status");
    setStatus(d.state);
  }
  async function getQR() {
    const d = await api("/api/admin/whatsapp/qr");
    if (d.type === "qrCode") setQr(d.message);
    else setMsg("Already connected — no QR needed.");
  }

  return (
    <div className="space-y-5 max-w-xl">
      <SectionHeader title="WhatsApp Setup" subtitle="Connect your hotel's WhatsApp number via Green API"/>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Connection Status</h3>
          <button onClick={refreshStatus} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><RefreshCw size={12}/>Refresh</button>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status}/>
          <span className="text-xs text-slate-500">{tenant?.greenApi?.phoneNumber || "No number connected"}</span>
        </div>
        {status !== "authorized" && status !== "notConfigured" && (
          <Btn variant="secondary" className="mt-4" onClick={getQR}><Key size={13}/>Get QR Code to Scan</Btn>
        )}
        {qr && (
          <div className="mt-4 p-4 bg-white rounded-xl inline-block">
            <img src={`data:image/png;base64,${qr}`} alt="WhatsApp QR" className="w-48 h-48"/>
            <p className="text-center text-xs text-slate-700 mt-2">Scan with WhatsApp on your hotel phone</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Green API Credentials</h3>
        <form onSubmit={save} className="space-y-4">
          <Input label="Instance ID" value={form.idInstance} onChange={e=>setForm(f=>({...f,idInstance:e.target.value}))} placeholder="7103xxxxxxx" required/>
          <Input label="API Token" type="password" value={form.apiTokenInstance} onChange={e=>setForm(f=>({...f,apiTokenInstance:e.target.value}))} placeholder="Paste your API token" required/>
          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{msg}</p>}
          <Btn type="submit" variant="primary" disabled={saving}>{saving?<><Loader size={14} className="animate-spin"/>Verifying…</>:"Save & Connect"}</Btn>
        </form>
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            1. Create an account at <span className="text-emerald-400">green-api.com</span><br/>
            2. Create a WhatsApp instance and note the Instance ID + Token<br/>
            3. Paste them above — webhook will be auto-registered
          </p>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL DASHBOARD (Client Admin)
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authState, setAuthState] = useState({ loading:true, user:null });

  useEffect(()=>{
    const token = localStorage.getItem("token");
    if (!token) { setAuthState({ loading:false, user:null }); return; }
    api("/api/auth/me").then(user=>setAuthState({ loading:false, user })).catch(()=>{
      localStorage.removeItem("token");
      setAuthState({ loading:false, user:null });
    });
  },[]);

  function handleLogin(user)  { setAuthState({ loading:false, user }); }
  function handleLogout()     { localStorage.removeItem("token"); setAuthState({ loading:false, user:null }); }

  if (authState.loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader size={28} className="text-emerald-400 animate-spin"/></div>;
  }
  if (!authState.user) return <LoginPage onLogin={handleLogin}/>;
  if (authState.user.role === "superadmin") return <SuperAdminApp user={authState.user} onLogout={handleLogout}/>;
  if (authState.user.role === "staff" || authState.user.role === "manager") return <DepartmentStaffApp user={authState.user} onLogout={handleLogout}/>;
  return <HotelDashboard user={authState.user} onLogout={handleLogout}/>;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL DASHBOARD INNER
// ══════════════════════════════════════════════════════════════════════════════
function HotelDashboard({ user, onLogout }) {
  const [activePage, setActivePage]   = useState("Dashboard");
  const [connected, setConnected]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedConv, setSelectedConv]   = useState(null);
  const selectedConvRef = useRef(null);
  useEffect(()=>{ selectedConvRef.current = selectedConv; },[selectedConv]);
  const [replyText, setReplyText]     = useState("");
  const chatEndRef = useRef(null);

  const tenant = user.tenantId; // populated in /me

  const [stats, setStats] = useState({ totalRequests:0, activeConversations:0, avgResponseTime:"—", escalatedRequests:0, completedRequests:0, aiVsHuman:"—" });
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [weeklyData, setWeeklyData] = useState(
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>({ day:d, value:0 }))
  );
  const [deptData, setDeptData] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [reqUpdating, setReqUpdating] = useState(null);
  const [guestProfile, setGuestProfile] = useState(null);
  const [guestProfileOpen, setGuestProfileOpen] = useState(false);
  const [guestProfileLoading, setGuestProfileLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Load staff list once for assignment dropdown
  useEffect(()=>{
    api("/api/admin/staff").then(s=>setStaffList(s.filter(x=>x.active))).catch(()=>{});
  },[]);

  // When global search changes, re-fetch conversations and requests
  function handleSearchChange(val) {
    setGlobalSearch(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(async ()=>{
      try {
        const q = val ? `?search=${encodeURIComponent(val)}` : "?limit=50";
        if (activePage === "Conversations" || val) {
          const d = await api(`/api/admin/conversations${q}&limit=30`);
          if (d.conversations) setConversations(d.conversations);
        }
        if (activePage === "Requests" || val) {
          const d = await api(`/api/admin/requests${q}&limit=50`);
          if (d.requests) setRequests(d.requests);
        }
      } catch {}
    }, 350);
    setSearchTimeout(t);
  }

  // Static chart data
  const responseTimeHistory = [
    {time:"8AM",value:2.1},{time:"10AM",value:1.8},{time:"12PM",value:1.6},
    {time:"2PM",value:1.9},{time:"4PM",value:1.4},{time:"6PM",value:2.3},{time:"8PM",value:1.7},
  ];
  const aiVsHumanHistory = [
    {day:"Mon",ai:75,human:25},{day:"Tue",ai:80,human:20},{day:"Wed",ai:72,human:28},
    {day:"Thu",ai:85,human:15},{day:"Fri",ai:78,human:22},{day:"Sat",ai:88,human:12},{day:"Sun",ai:82,human:18},
  ];
  const peakHoursData = [
    {hour:"08:00",value:10},{hour:"10:00",value:22},{hour:"12:00",value:35},
    {hour:"14:00",value:28},{hour:"16:00",value:18},{hour:"18:00",value:30},{hour:"20:00",value:15},
  ];
  const pieStatusData = [
    {name:"New",value:20},{name:"In Progress",value:30},{name:"Escalated",value:10},{name:"Completed",value:60},
  ];
  const escalationData = [
    {name:"Technical Issue",value:8},{name:"VIP Request",value:5},{name:"High Quantity",value:3},{name:"Complaint",value:4},
  ];

  // Socket.io
  useEffect(()=>{
    const token = localStorage.getItem("token");
    const socket = io(window.location.origin, { query:{ token }, reconnectionDelay:1000, reconnectionAttempts:Infinity });
    socket.on("connect",    ()=>setConnected(true));
    socket.on("disconnect", ()=>setConnected(false));
    socket.on("liveUpdate", (data)=>{
      if (data.stats)              setStats(s=>({...s,...data.stats}));
      if (data.conversations)      setConversations(data.conversations);
      if (data.requests)           setRequests(data.requests);
      if (data.weeklyData?.length) setWeeklyData(data.weeklyData);
      if (data.deptData?.length)   setDeptData(data.deptData);

      // If a conversation is open in the right panel, refresh its messages live
      const current = selectedConvRef.current;
      if (current && data.conversations?.some(c => c.chatId === current.chatId)) {
        api(`/api/admin/conversations/${encodeURIComponent(current.chatId)}`)
          .then(full => setSelectedConv(full))
          .catch(()=>{});
      }

      const ts = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
      let msg = data._alert?.message || (data.requests?.length ? `${data.requests.length} request(s) updated` : data.conversations?.length ? "New conversation activity" : "Live data updated");
      setNotifications(p=>[{id:Date.now(),text:msg,time:ts,alert:!!data._alert},...p.slice(0,19)]);
    });
    // Initial REST load
    api("/api/admin/stats").then(data=>{
      if (data.totalRequests   !== undefined) setStats(s=>({...s,...data}));
      if (data.deptBreakdown)  setDeptData(data.deptBreakdown);
      if (data.weeklyData)     setWeeklyData(data.weeklyData);
    }).catch(()=>{});
    api("/api/admin/conversations?limit=30").then(d=>{ if(d.conversations) setConversations(d.conversations); }).catch(()=>{});
    api("/api/admin/requests?limit=50").then(d=>{ if(d.requests) setRequests(d.requests); }).catch(()=>{});
    return ()=>socket.disconnect();
  },[]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selectedConv?.messages?.length]);

  const kpiCards = [
    {title:"Total Requests",       value:stats.totalRequests,       icon:<Activity size={18}/>,      color:"from-blue-500 to-blue-700",    trend:"+12%",up:true},
    {title:"Active Conversations", value:stats.activeConversations, icon:<MessageSquare size={18}/>, color:"from-violet-500 to-violet-700",trend:"-4%", up:false},
    {title:"Avg Response Time",    value:stats.avgResponseTime,     icon:<Clock size={18}/>,         color:"from-emerald-500 to-teal-600", trend:"-18%",up:false},
    {title:"Escalated",            value:stats.escalatedRequests,   icon:<AlertTriangle size={18}/>, color:"from-red-500 to-red-700",      trend:"+2%", up:true},
    {title:"Completed",            value:stats.completedRequests,   icon:<CheckCircle size={18}/>,   color:"from-teal-500 to-teal-700",    trend:"+18%",up:true},
    {title:"AI Handled",           value:stats.aiVsHuman,           icon:<Bot size={18}/>,           color:"from-amber-500 to-orange-600", trend:"+6%", up:true},
  ];

  const navItems = [
    {icon:<LayoutDashboard size={17}/>, label:"Dashboard"},
    {icon:<MessageSquare size={17}/>,   label:"Conversations"},
    {icon:<ClipboardList size={17}/>,   label:"Requests"},
    {icon:<Building2 size={17}/>,       label:"Departments"},
    {icon:<BarChart3 size={17}/>,       label:"Analytics"},
    {icon:<Users size={17}/>,           label:"Staff"},
    {icon:<Wand2 size={17}/>,           label:"Bot Setup"},
    {icon:<BookOpen size={17}/>,        label:"Knowledge Base"},
    {icon:<FileText size={17}/>,        label:"Templates"},
    {icon:<CreditCard size={17}/>,      label:"Billing"},
    {icon:<Settings size={17}/>,        label:"Settings"},
  ];

  const SidebarItem = ({ icon, label }) => (
    <button onClick={()=>setActivePage(label)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-left group ${
        activePage===label ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"}`}>
      <span className={activePage===label ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400"}>{icon}</span>
      <span>{label}</span>
      {activePage===label && <ChevronRight size={13} className="ml-auto text-emerald-500/60"/>}
    </button>
  );

  const hotelName = tenant?.botPersona?.hotelName || tenant?.name || "Hotel";

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside className="w-60 shrink-0 bg-[#0b111e] border-r border-slate-800/60 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-emerald-500/20">
              {(hotelName[0]||"H").toUpperCase()}
            </div>
            <div><div className="text-sm font-bold text-white leading-tight truncate max-w-[110px]">{hotelName}</div><div className="text-xs text-slate-500 capitalize">{user.role}</div></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-2">Main</p>
          {navItems.slice(0,3).map(item=><SidebarItem key={item.label} {...item}/>)}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mt-4 mb-2">Management</p>
          {navItems.slice(3,6).map(item=><SidebarItem key={item.label} {...item}/>)}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mt-4 mb-2">Bot Config</p>
          {navItems.slice(6).map(item=><SidebarItem key={item.label} {...item}/>)}
        </nav>
        <div className="px-4 py-4 border-t border-slate-800/60 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${connected?"bg-emerald-400 animate-pulse":"bg-slate-600"}`}/>
            <span className={`text-xs font-medium ${connected?"text-emerald-400":"text-slate-600"}`}>{connected?"Live":"Disconnected"}</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-xs text-slate-600 hover:text-red-400 transition w-full px-0.5 py-1"><LogOut size={12}/>Sign Out</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] shrink-0 bg-[#0d1525] border-b border-slate-800/60 flex items-center px-6 gap-4">
          <div className="flex-1">
            <input
              value={globalSearch}
              onChange={e=>handleSearchChange(e.target.value)}
              placeholder="Search guest, room, request ID…"
              className="w-80 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${connected?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>
              {connected?<Wifi size={12}/>:<WifiOff size={12}/>}{connected?"Live":"Offline"}
            </div>
            <div className="relative">
              <button onClick={()=>setNotifOpen(p=>!p)} className="relative p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 hover:bg-slate-700/60 transition text-slate-400 hover:text-white">
                <Bell size={16}/>
                {notifications.length>0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white">{notifications.length>9?"9+":notifications.length}</span>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    <button onClick={()=>{setNotifications([]);setNotifOpen(false);}} className="text-slate-500 hover:text-white"><X size={14}/></button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                    {notifications.length===0?(<p className="text-sm text-slate-500 text-center py-6">No notifications</p>):
                      notifications.map(n=>(
                        <div key={n.id} className={`px-4 py-3 hover:bg-slate-800/50 transition ${n.alert?"border-l-2 border-red-500/50":""}`}>
                          <p className={`text-xs ${n.alert?"text-red-400":"text-slate-300"}`}>{n.text}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{n.time}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-bold text-white">{user.name[0]}</div>
              <div className="hidden sm:block"><p className="text-xs font-semibold text-white leading-tight">{user.name}</p><p className="text-[10px] text-slate-500 capitalize leading-tight">{user.role}</p></div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-slate-950">

          {/* ═══════ DASHBOARD ═══════ */}
          {activePage==="Dashboard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <SectionHeader title="Overview" subtitle="Real-time hotel operations"/>
                <div className="flex items-center gap-2 text-xs text-slate-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Live · updates instantly</div>
              </div>
              {tenant && !tenant?.setupCompleted && <OnboardingChecklist tenant={tenant} onNavigate={setActivePage}/>}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {kpiCards.map((k,i)=>(
                  <Card key={i} className="p-4 hover:border-slate-700 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center text-white shadow-lg`}>{k.icon}</div>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${k.up?"text-emerald-400":"text-red-400"}`}>{k.up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{k.trend}</span>
                    </div>
                    <div className="text-2xl font-bold text-white tabular-nums">{k.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{k.title}</div>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Requests This Week</h3>
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={weeklyData}>
                      <defs><linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="day" stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/><YAxis stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
                      <Tooltip contentStyle={TOOLTIP_STYLE}/>
                      <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#gW)" dot={{fill:"#10b981",r:3}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Requests by Department</h3>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={deptData}>
                      <XAxis dataKey="dept" stroke="#334155" tick={{fontSize:10,fill:"#64748b"}}/><YAxis stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
                      <Tooltip contentStyle={TOOLTIP_STYLE}/>
                      <Bar dataKey="value" radius={[4,4,0,0]}>{deptData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              {requests.length>0&&(
                <Card className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Recent Requests</h3>
                    <button onClick={()=>setActivePage("Requests")} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">View all<ChevronRight size={12}/></button>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {requests.slice(0,5).map((r,i)=>(
                      <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition text-sm">
                        <span className="font-mono text-xs text-slate-600 w-20 shrink-0">{r.reqId||r.id}</span>
                        <span className="text-slate-200 font-medium w-36 shrink-0 truncate">{r.guestLabel||r.guest}</span>
                        <span className="text-slate-400 flex-1 truncate">{r.type}</span>
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 shrink-0">{r.departmentName||r.dept}</span>
                        <StatusBadge status={r.status}/>
                        <span className="text-slate-600 text-xs w-12 text-right shrink-0">{r.time}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ═══════ CONVERSATIONS ═══════ */}
          {activePage==="Conversations" && (
            <div className="flex gap-5 h-full min-h-0" style={{height:"calc(100vh - 124px)"}}>
            {/* Guest profile side panel */}
            {guestProfileOpen && selectedConv && (
              <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
                {guestProfileLoading ? (
                  <Card className="p-8 flex items-center justify-center"><Loader size={20} className="text-emerald-400 animate-spin"/></Card>
                ) : guestProfile ? (
                  <>
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-white uppercase tracking-wider">Guest Profile</p>
                        <button onClick={()=>setGuestProfileOpen(false)} className="text-slate-600 hover:text-white"><X size={12}/></button>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-sm font-bold text-white mb-3">
                        {(guestProfile.guest.name||"G")[0]}
                      </div>
                      <p className="text-sm font-semibold text-white">{guestProfile.guest.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{guestProfile.guest.phone}</p>
                      {guestProfile.guest.roomNumber && <p className="text-xs text-slate-400 mt-1">Room {guestProfile.guest.roomNumber}</p>}
                      <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                        {[
                          {l:"Total Req",v:guestProfile.requestCounts.total},
                          {l:"Completed", v:guestProfile.requestCounts.completed,c:"text-emerald-400"},
                          {l:"Escalated", v:guestProfile.requestCounts.escalated,c:"text-red-400"},
                          {l:"Open",      v:guestProfile.requestCounts.open,      c:"text-amber-400"},
                        ].map(s=>(
                          <div key={s.l} className="bg-slate-800/60 rounded-lg p-2 text-center">
                            <p className={`text-lg font-bold ${s.c||"text-white"}`}>{s.v}</p>
                            <p className="text-[10px] text-slate-500">{s.l}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider">Dates</p>
                        <p className="text-xs text-slate-500">First: {new Date(guestProfile.guest.firstSeen).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">Last: {new Date(guestProfile.guest.lastSeen).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">Messages: {guestProfile.guest.totalMessages}</p>
                      </div>
                    </Card>
                    {guestProfile.requests.length > 0 && (
                      <Card className="p-4">
                        <p className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">Request History</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {guestProfile.requests.map((r,i)=>(
                            <div key={i} className="bg-slate-800/60 rounded-lg p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-slate-500">{r.reqId}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                  r.status==="Completed"?"bg-slate-500/15 text-slate-400 border-slate-500/25":
                                  r.status==="Escalated"?"bg-red-500/15 text-red-400 border-red-500/25":
                                  "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                }`}>{r.status}</span>
                              </div>
                              <p className="text-xs text-white">{r.type}</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">{r.departmentName}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-xs text-slate-500">Could not load guest profile</p>
                  </Card>
                )}
              </div>
            )}
              <div className="w-72 shrink-0 flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white">Conversations</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{conversations.length} guests</p>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                    {conversations.length===0?(
                      <div className="p-8 text-center"><MessageSquare size={32} className="mx-auto mb-3 text-slate-700"/><p className="text-sm text-slate-600">No conversations yet</p></div>
                    ):conversations.map((c,i)=>(
                      <button key={i} onClick={async()=>{
                        setConvLoading(true);
                        try {
                          const full = await api(`/api/admin/conversations/${encodeURIComponent(c.chatId)}`);
                          setSelectedConv(full);
                        } catch { setSelectedConv(c); }
                        setConvLoading(false);
                      }}
                        className={`w-full text-left px-4 py-3.5 hover:bg-slate-800/50 transition ${selectedConv?.chatId===c.chatId?"bg-slate-800/70":""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white truncate">{c.guestName||c.guestLabel||c.guest}</span>
                          <StatusBadge status={c.status||"Active"}/>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{c.lastMessage}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-slate-700">{c.time || new Date(c.updatedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</p>
                          {c.humanMode && <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full">Human</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
              <div className="flex-1 min-w-0">
                <Card className="h-full flex flex-col overflow-hidden">
                  {convLoading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader size={24} className="text-emerald-400 animate-spin"/></div>
                  ) : selectedConv ? (
                    <>
                      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <div>
                          <p className="text-sm font-semibold text-white">{selectedConv.guestName||selectedConv.guestLabel||selectedConv.guest}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500 font-mono">{selectedConv.chatId}</p>
                            {selectedConv.roomNumber && <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Room {selectedConv.roomNumber}</span>}
                            <StatusBadge status={selectedConv.status||"Active"}/>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={async()=>{
                            setGuestProfileOpen(p=>!p);
                            if (!guestProfile || guestProfile.guest?.chatId !== selectedConv.chatId) {
                              setGuestProfileLoading(true);
                              try { const d = await api(`/api/admin/guest/${encodeURIComponent(selectedConv.chatId)}`); setGuestProfile(d); }
                              catch { setGuestProfile(null); }
                              setGuestProfileLoading(false);
                            }
                          }} className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-700 text-xs hover:bg-slate-700 transition font-medium flex items-center gap-1.5"><Eye size={12}/>Profile</button>
                          {!selectedConv.humanMode ? (
                            <button onClick={async()=>{
                              await api(`/api/admin/conversations/${encodeURIComponent(selectedConv.chatId)}/takeover`,{method:"PUT"});
                              setSelectedConv(c=>({...c,humanMode:true,status:"Escalated"}));
                            }} className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 text-xs hover:bg-amber-500/25 transition font-medium flex items-center gap-1.5"><UserCheck size={12}/>Take Over</button>
                          ) : (
                            <button onClick={async()=>{
                              await api(`/api/admin/conversations/${encodeURIComponent(selectedConv.chatId)}/handback`,{method:"PUT"});
                              setSelectedConv(c=>({...c,humanMode:false,status:"Active"}));
                            }} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-xs hover:bg-emerald-500/25 transition font-medium flex items-center gap-1.5"><Bot size={12}/>Back to AI</button>
                          )}
                        </div>
                      </div>
                      {selectedConv.humanMode && (
                        <div className="px-5 py-2 bg-amber-500/5 border-b border-amber-500/20 flex items-center gap-2">
                          <AlertTriangle size={12} className="text-amber-400"/>
                          <p className="text-xs text-amber-400/80">Human mode active — you are replying as staff. The AI will not respond.</p>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {(selectedConv.messages||[]).length === 0 ? (
                          <div className="flex items-center justify-center h-full"><p className="text-slate-600 text-sm">No messages yet</p></div>
                        ) : (selectedConv.messages||[]).map((m,i)=>(
                          <div key={i} className={`flex ${m.from==="guest"?"justify-start":"justify-end"}`}>
                            <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.from==="guest"?"bg-slate-800 text-slate-200 rounded-tl-md":"bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-md"}`}>
                              <p className="whitespace-pre-wrap">{m.text}</p>
                              <p className={`text-[10px] mt-1.5 ${m.from==="guest"?"text-slate-500":"text-white/60"}`}>{m.time}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef}/>
                      </div>
                      {selectedConv.humanMode && (
                        <div className="border-t border-slate-800 shrink-0">
                          <TemplatePickerBar onSelect={text=>setReplyText(text)}/>
                          <div className="p-4 flex gap-2.5">
                            <input value={replyText} onChange={e=>setReplyText(e.target.value)}
                              placeholder="Type a reply as staff…"
                              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                              onKeyDown={async e=>{
                                if(e.key==="Enter" && !e.shiftKey && replyText.trim()) {
                                  e.preventDefault();
                                  setSendingReply(true);
                                  try {
                                    await api(`/api/admin/conversations/${encodeURIComponent(selectedConv.chatId)}/send`,{method:"POST",body:{text:replyText.trim()}});
                                    const ts = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
                                    setSelectedConv(c=>({...c,messages:[...(c.messages||[]),{from:"bot",text:replyText.trim(),time:ts}]}));
                                    setReplyText("");
                                  } catch(e){ alert(e.message); }
                                  setSendingReply(false);
                                }
                              }}
                            />
                            <Btn disabled={sendingReply||!replyText.trim()} onClick={async()=>{
                              if (!replyText.trim()) return;
                              setSendingReply(true);
                              try {
                                await api(`/api/admin/conversations/${encodeURIComponent(selectedConv.chatId)}/send`,{method:"POST",body:{text:replyText.trim()}});
                                const ts = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
                                setSelectedConv(c=>({...c,messages:[...(c.messages||[]),{from:"bot",text:replyText.trim(),time:ts}]}));
                                setReplyText("");
                              } catch(e){ alert(e.message); }
                              setSendingReply(false);
                            }}>
                              {sendingReply?<Loader size={14} className="animate-spin"/>:<Send size={14}/>}Send
                            </Btn>
                          </div>
                        </div>
                      )}
                    </>
                  ):(
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center"><MessageSquare size={44} className="mx-auto mb-4 text-slate-800"/><p className="text-sm text-slate-500 font-medium">Select a conversation</p><p className="text-xs text-slate-700 mt-1">Click any guest to view full chat history</p></div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ═══════ REQUESTS ═══════ */}
          {activePage==="Requests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionHeader title="Service Requests" subtitle={`${requests.length} requests tracked`}/>
                <div className="flex items-center gap-2">
                  {["All","New","In Progress","Escalated","Completed"].map(s=>(
                    <button key={s} onClick={()=>setReqUpdating(s==="All"?null:s)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${reqUpdating===s||(s==="All"&&!reqUpdating)?"bg-emerald-500/15 text-emerald-400 border-emerald-500/30":"bg-slate-800 text-slate-500 border-slate-700 hover:text-white"}`}>{s}</button>
                  ))}
                  <a
                    href={`/api/admin/requests/export${reqUpdating?`?status=${encodeURIComponent(reqUpdating)}`:""}`}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border bg-slate-800 text-slate-400 border-slate-700 hover:text-emerald-400 hover:border-emerald-500/30 transition font-medium"
                  ><Save size={11}/>Export CSV</a>
                </div>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-600 text-[11px] uppercase tracking-wider">
                      {["ID","Guest","Room","Request","Department","Assigned","Status","Time","Actions"].map(h=><th key={h} className="px-4 py-3.5 text-left font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(reqUpdating ? requests.filter(r=>r.status===reqUpdating) : requests).length===0?(
                      <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-600 text-sm"><RefreshCw size={24} className="mx-auto mb-3 opacity-30 animate-spin" style={{animationDuration:"3s"}}/>No requests yet…</td></tr>
                    ):(reqUpdating ? requests.filter(r=>r.status===reqUpdating) : requests).map((r,i)=>(
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{r.reqId||r.id}</td>
                        <td className="px-4 py-3.5 font-medium text-white text-xs">{r.guestLabel||r.guest}</td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">{r.roomNumber||r.room||"—"}</td>
                        <td className="px-4 py-3.5 text-slate-400 max-w-[160px] truncate text-xs">{r.type}</td>
                        <td className="px-4 py-3.5"><span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded-md text-slate-400">{r.departmentName||r.dept}</span></td>
                        <td className="px-4 py-3.5">
                          {r.assignedTo ? (
                            <span className="text-xs text-emerald-400">{r.assignedTo.name||r.assignedTo}</span>
                          ) : (
                            <span className="text-xs text-slate-600">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={r.status}/></td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">{r.time}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {r.status==="New" && (
                              <button onClick={async()=>{
                                await api(`/api/admin/requests/${r._id}/status`,{method:"PUT",body:{status:"In Progress"}});
                                setRequests(p=>p.map(x=>x._id===r._id?{...x,status:"In Progress"}:x));
                              }} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium hover:bg-amber-500/20 transition whitespace-nowrap">Accept</button>
                            )}
                            {(r.status==="New"||r.status==="In Progress") && (
                              <button onClick={async()=>{
                                await api(`/api/admin/requests/${r._id}/status`,{method:"PUT",body:{status:"Completed"}});
                                setRequests(p=>p.map(x=>x._id===r._id?{...x,status:"Completed"}:x));
                              }} className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium hover:bg-emerald-500/20 transition whitespace-nowrap">Done</button>
                            )}
                            {r.status!=="Escalated"&&r.status!=="Completed" && (
                              <button onClick={async()=>{
                                await api(`/api/admin/requests/${r._id}/status`,{method:"PUT",body:{status:"Escalated"}});
                                setRequests(p=>p.map(x=>x._id===r._id?{...x,status:"Escalated"}:x));
                              }} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-medium hover:bg-red-500/20 transition whitespace-nowrap">Escalate</button>
                            )}
                            {staffList.length>0 && r.status!=="Completed" && (
                              <select
                                value={r.assignedTo?._id||r.assignedTo||""}
                                onChange={async e=>{
                                  const uid = e.target.value;
                                  await api(`/api/admin/requests/${r._id}/assign`,{method:"PUT",body:{userId:uid||null}});
                                  setRequests(p=>p.map(x=>x._id===r._id?{...x,assignedTo:uid?staffList.find(s=>s._id===uid):null}:x));
                                }}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:border-emerald-500/50 max-w-[110px]"
                              >
                                <option value="">Assign…</option>
                                {staffList.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ═══════ DEPARTMENTS ═══════ */}
          {activePage==="Departments" && <DepartmentBuilder/>}

          {/* ═══════ ANALYTICS ═══════ */}
          {activePage==="Analytics" && <AnalyticsPage/>}

          {/* ═══════ STAFF ═══════ */}
          {activePage==="Staff" && <StaffPage/>}

          {/* ═══════ SETTINGS ═══════ */}
          {activePage==="Settings" && (
            <div className="space-y-6 max-w-2xl">
              <SectionHeader title="Settings" subtitle="Configure your hotel, bot persona, and integrations"/>

              {/* Onboarding checklist — shown until setupCompleted */}
              {tenant && !tenant?.setupCompleted && <OnboardingChecklist tenant={tenant} onNavigate={setActivePage}/>}

              <WhatsAppConfig tenant={tenant}/>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 mb-4">Integration Status</h3>
                <div className="space-y-2">
                  {[
                    {name:"WhatsApp (Green API)", status: tenant?.greenApi?.instanceState==="authorized"?"Active":"Escalated"},
                    {name:"OpenAI GPT-4o-mini",   status:"Active"},
                    {name:"Dashboard WebSocket",  status:connected?"Active":"Escalated"},
                  ].map((item,i)=>(
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                      <span className="text-sm text-slate-400">{item.name}</span><StatusBadge status={item.status}/>
                    </div>
                  ))}
                </div>
              </Card>

              <EmailNotificationsCard/>

              <ChangePasswordCard/>
            </div>
          )}

          {activePage==="Bot Setup" && <BotSetupWizard/>}
          {activePage==="Knowledge Base" && <KnowledgeBasePage/>}
          {activePage==="Templates" && <TemplatesPage/>}
          {activePage==="Billing" && <BillingPage/>}

        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING CHECKLIST
// ══════════════════════════════════════════════════════════════════════════════
function OnboardingChecklist({ tenant, onNavigate }) {
  const [config, setConfig]   = useState(null);
  const [depts, setDepts]     = useState([]);
  const [staff, setStaff]     = useState([]);

  useEffect(()=>{
    Promise.all([
      api("/api/botconfig").catch(()=>null),
      api("/api/admin/departments").catch(()=>[]),
      api("/api/admin/staff").catch(()=>[]),
    ]).then(([c,d,s])=>{ setConfig(c); setDepts(d||[]); setStaff(s||[]); });
  },[]);

  const waConnected = tenant?.greenApi?.instanceState === "authorized";
  const botSetup    = config?.setupCompleted === true || config?.hotelName;
  const hasDepts    = depts.length > 0;
  const hasStaff    = staff.length > 0;
  const hasKb       = false; // optimistic — they'll see KB page

  const steps = [
    { label:"Connect WhatsApp",   done: waConnected,  page:"Settings",      desc:"Add Green API credentials and scan QR" },
    { label:"Configure Bot",      done: !!botSetup,   page:"Bot Setup",     desc:"Fill in hotel info, rooms, menu, persona" },
    { label:"Build Departments",  done: hasDepts,     page:"Departments",   desc:"Create at least one service department" },
    { label:"Add Staff",          done: hasStaff,     page:"Staff",         desc:"Invite your team and assign departments" },
    { label:"Add Knowledge Base", done: hasKb,        page:"Knowledge Base",desc:"Add custom Q&A your bot should know" },
  ];
  const completed = steps.filter(s=>s.done).length;
  const pct = Math.round((completed / steps.length) * 100);
  if (completed === steps.length) return null; // hide when done

  return (
    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Get Started — Setup Checklist</h3>
          <p className="text-xs text-slate-400 mt-0.5">{completed} of {steps.length} steps complete</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400">{pct}%</div>
          <div className="text-[10px] text-slate-500">ready</div>
        </div>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
        <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-1.5 rounded-full transition-all" style={{width:`${pct}%`}}/>
      </div>
      <div className="space-y-2">
        {steps.map((s,i)=>(
          <div key={i} onClick={()=>onNavigate(s.page)}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${s.done?"bg-emerald-500/5 border border-emerald-500/10":"bg-slate-800/60 border border-slate-700/60 hover:border-slate-600"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.done?"bg-emerald-500":"bg-slate-700"}`}>
              {s.done ? <CheckCircle size={12} className="text-white"/> : <span className="text-[10px] text-slate-400 font-bold">{i+1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${s.done?"text-emerald-400 line-through opacity-60":"text-white"}`}>{s.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.desc}</p>
            </div>
            {!s.done && <ChevronRight size={13} className="text-slate-600 shrink-0"/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD CARD
// ══════════════════════════════════════════════════════════════════════════════
function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword:"", newPassword:"", confirm:"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]   = useState("");
  const [err, setErr]   = useState("");

  async function submit(e) {
    e.preventDefault(); setMsg(""); setErr("");
    if (form.newPassword !== form.confirm) { setErr("Passwords don't match"); return; }
    if (form.newPassword.length < 8) { setErr("New password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await api("/api/auth/change-password", { method:"POST", body:{ currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setMsg("Password updated successfully");
      setForm({ currentPassword:"", newPassword:"", confirm:"" });
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 mb-4">Change Password</h3>
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Password</label>
          <input type="password" value={form.currentPassword} onChange={e=>setForm(f=>({...f,currentPassword:e.target.value}))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" required/>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
          <input type="password" value={form.newPassword} onChange={e=>setForm(f=>({...f,newPassword:e.target.value}))}
            placeholder="Min 8 characters"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" required/>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
          <input type="password" value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" required/>
        </div>
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{msg}</p>}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition disabled:opacity-50">
          {saving ? <><Loader size={14} className="animate-spin"/>Updating…</> : <><Save size={14}/>Update Password</>}
        </button>
      </form>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS PAGE — live DB data
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api("/api/admin/analytics")
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>setLoading(false));
  },[]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading analytics…</div>;
  if (!data)   return <div className="flex items-center justify-center h-64 text-slate-500">Could not load analytics</div>;

  const { statusPie, deptBreakdown, hourlyData, escalatedByDept, aiRate, humanRate, escalationRate, completionRate, daily30 } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Analytics" subtitle="Live performance insights — last 30 days"/>
        <button onClick={()=>{ setLoading(true); api("/api/admin/analytics").then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false)); }}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">
          <RefreshCw size={12}/>Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:"Completion Rate", value:`${completionRate}%`, color:"text-emerald-400", sub:"Requests resolved" },
          { label:"Escalation Rate", value:`${escalationRate}%`, color:"text-red-400",     sub:"Required attention" },
          { label:"AI Handled",      value:`${aiRate}%`,         color:"text-blue-400",    sub:"No human needed" },
          { label:"Human Takeover",  value:`${humanRate}%`,      color:"text-amber-400",   sub:"Staff intervened" },
        ].map((m,i)=>(
          <Card key={i} className="p-5 text-center">
            <div className={`text-4xl font-bold ${m.color} mb-1 tabular-nums`}>{m.value}</div>
            <div className="text-sm font-semibold text-white">{m.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Peak Request Hours (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData}>
              <XAxis dataKey="hour" stroke="#334155" tick={{fontSize:9,fill:"#64748b"}} interval={2}/>
              <YAxis stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
              <Tooltip contentStyle={TOOLTIP_STYLE}/>
              <Bar dataKey="value" name="Requests" radius={[3,3,0,0]} fill="#3b82f6"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Request Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3} label={({name,percent})=>percent>0?`${(percent*100).toFixed(0)}%`:""} labelLine={false} fontSize={11}>
                {statusPie.map((_,i)=><Cell key={i} fill={CHART_COLORS[i]}/>)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE}/>
              <Legend wrapperStyle={{fontSize:"11px",color:"#94a3b8"}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Requests by Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptBreakdown} layout="vertical">
              <XAxis type="number" stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
              <YAxis type="category" dataKey="name" stroke="#334155" tick={{fontSize:10,fill:"#94a3b8"}} width={100}/>
              <Tooltip contentStyle={TOOLTIP_STYLE}/>
              <Bar dataKey="value" name="Requests" radius={[0,4,4,0]}>
                {deptBreakdown.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Escalations by Department</h3>
          {escalatedByDept.length === 0 ? (
            <div className="flex items-center justify-center h-[180px]">
              <p className="text-slate-600 text-sm">No escalations yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={escalatedByDept} layout="vertical">
                <XAxis type="number" stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
                <YAxis type="category" dataKey="name" stroke="#334155" tick={{fontSize:10,fill:"#94a3b8"}} width={100}/>
                <Tooltip contentStyle={TOOLTIP_STYLE}/>
                <Bar dataKey="value" name="Escalated" radius={[0,4,4,0]} fill="#ef4444"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Daily trend */}
      {daily30.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Request Volume (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily30}>
              <defs>
                <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#334155" tick={{fontSize:9,fill:"#64748b"}} interval={Math.floor(daily30.length/6)}/>
              <YAxis stroke="#334155" tick={{fontSize:11,fill:"#64748b"}}/>
              <Tooltip contentStyle={TOOLTIP_STYLE}/>
              <Area type="monotone" dataKey="count" name="Requests" stroke="#10b981" strokeWidth={2} fill="url(#gDaily)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAFF PAGE (inside HotelDashboard, uses real API)
// ══════════════════════════════════════════════════════════════════════════════
function StaffPage() {
  const [staff, setStaff]         = useState([]);
  const [depts, setDepts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ name:"", email:"", password:"", role:"staff", departments:[] });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [s, d] = await Promise.all([api("/api/admin/staff"), api("/api/admin/departments")]);
      setStaff(s); setDepts(d);
    } catch(e){ console.error(e); }
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  function openCreate() {
    setEditing(null);
    setForm({ name:"", email:"", password:"", role:"staff", departments:[] });
    setErr(""); setShowModal(true);
  }
  function openEdit(s) {
    setEditing(s);
    setForm({ name:s.name, email:s.email, password:"", role:s.role, departments:(s.departments||[]).map(d=>d._id||d) });
    setErr(""); setShowModal(true);
  }

  function toggleDept(id) {
    setForm(f=>{
      const has = f.departments.includes(id);
      return { ...f, departments: has ? f.departments.filter(d=>d!==id) : [...f.departments, id] };
    });
  }

  async function save(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      const body = { ...form };
      if (!body.password) delete body.password; // don't send empty password on edit
      if (editing) { await api(`/api/admin/staff/${editing._id}`,{method:"PUT",body}); }
      else          { await api("/api/admin/staff",{method:"POST",body}); }
      setShowModal(false); load();
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }
  async function toggle(id, active) {
    await api(`/api/admin/staff/${id}`,{method:"PUT",body:{active:!active}});
    load();
  }
  async function del(id) {
    if (!confirm("Remove this staff member?")) return;
    await api(`/api/admin/staff/${id}`,{method:"DELETE"});
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading staff…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Staff Management" subtitle={`${staff.length} members · assign departments so staff only see their queue`}/>
        <Btn variant="primary" onClick={openCreate}><Plus size={15}/>Add Staff</Btn>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-600 text-[11px] uppercase tracking-wider">
              {["Member","Email","Role","Departments","Status","Last Login","Actions"].map(h=><th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {staff.length===0?(
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-600 text-sm">No staff members yet</td></tr>
            ):staff.map((s,i)=>{
              const assignedDepts = depts.filter(d=>(s.departments||[]).map(x=>x._id||x).includes(d._id));
              return (
              <tr key={i} className="hover:bg-slate-800/30 transition">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{backgroundColor:CHART_COLORS[i%CHART_COLORS.length]}}>{s.name[0]}</div><span className="font-semibold text-white">{s.name}</span></div></td>
                <td className="px-5 py-4 text-slate-400 text-xs">{s.email}</td>
                <td className="px-5 py-4"><span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md text-slate-400 capitalize">{s.role}</span></td>
                <td className="px-5 py-4">
                  {assignedDepts.length===0 ? <span className="text-xs text-slate-600">None</span> : (
                    <div className="flex gap-1 flex-wrap">
                      {assignedDepts.map(d=>(
                        <span key={d._id} className="text-[10px] px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400" style={{borderColor:d.color+"50",color:d.color}}>{d.icon} {d.name}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${s.active?"bg-emerald-400":"bg-slate-600"}`}/><span className={s.active?"text-emerald-400 text-sm":"text-slate-500 text-sm"}>{s.active?"Active":"Inactive"}</span></div></td>
                <td className="px-5 py-4 text-slate-500 text-xs">{s.lastLogin?new Date(s.lastLogin).toLocaleDateString():"Never"}</td>
                <td className="px-5 py-4"><div className="flex items-center gap-1.5">
                  <button onClick={()=>openEdit(s)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition" title="Edit"><Edit2 size={13}/></button>
                  <button onClick={()=>toggle(s._id,s.active)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition" title={s.active?"Deactivate":"Activate"}><UserCheck size={13}/></button>
                  <button onClick={()=>del(s._id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition" title="Delete"><Trash2 size={13}/></button>
                </div></td>
              </tr>
            );})}
          </tbody>
        </table>
      </Card>
      {showModal && (
        <Modal title={editing ? `Edit — ${editing.name}` : "Add Staff Member"} onClose={()=>setShowModal(false)} width="max-w-lg">
          <form onSubmit={save} className="space-y-4">
            <Input label="Full Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
            <Input label="Email *" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required/>
            <Input label={editing ? "New Password (leave blank to keep)" : "Password *"} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 8 characters" {...(!editing && {required:true})}/>
            <Select label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </Select>
            {depts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Assign to Departments</label>
                <div className="grid grid-cols-2 gap-2">
                  {depts.map(d=>(
                    <label key={d._id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition ${form.departments.includes(d._id) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                      <input type="checkbox" checked={form.departments.includes(d._id)} onChange={()=>toggleDept(d._id)} className="hidden"/>
                      <span>{d.icon}</span>
                      <span className="text-xs font-medium">{d.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5">Staff/managers only see requests from their assigned departments.</p>
              </div>
            )}
            {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="secondary" type="button" onClick={()=>setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={saving}>{saving?<><Loader size={14} className="animate-spin"/>{editing?"Saving…":"Adding…"}</>:editing?"Save Changes":"Add Member"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE PICKER BAR — shown above reply input during human takeover
// ══════════════════════════════════════════════════════════════════════════════
function TemplatePickerBar({ onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen]           = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    api("/api/botconfig/templates").then(t=>setTemplates(t||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    function handleClick(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return ()=>document.removeEventListener("mousedown", handleClick);
  },[]);

  const active = templates.filter(t=>t.active);
  if (active.length === 0) return null;

  return (
    <div ref={ref} className="relative px-4 pt-2">
      <button onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition">
        <FileText size={11}/>Templates
        <ChevronDown size={11} className={`transition ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <div className="absolute bottom-full left-4 mb-1 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quick Replies</p>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {active.map((t,i)=>(
              <button key={i} onClick={()=>{ onSelect(t.content); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition border-b border-slate-800/60 last:border-0">
                <p className="text-xs font-semibold text-white">{t.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{t.content}</p>
                {t.category !== "General" && <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-500 px-1.5 py-0.5 rounded mt-1 inline-block">{t.category}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PAGE — full CRUD for reply templates
// ══════════════════════════════════════════════════════════════════════════════
function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ title:"", content:"", category:"General" });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const CATEGORIES = ["General","Greeting","Service","Apology","Confirmation","Follow-up"];

  useEffect(()=>{
    api("/api/botconfig/templates")
      .then(d=>{ setTemplates(d||[]); setLoading(false); })
      .catch(()=>setLoading(false));
  },[]);

  function openCreate() {
    setEditing(null); setForm({ title:"", content:"", category:"General" }); setErr(""); setShowModal(true);
  }
  function openEdit(t) {
    setEditing(t); setForm({ title:t.title, content:t.content, category:t.category||"General" }); setErr(""); setShowModal(true);
  }

  async function save(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      if (editing) {
        const updated = await api(`/api/botconfig/templates/${editing._id}`,{method:"PUT",body:form});
        setTemplates(tt=>tt.map(t=>t._id===editing._id?updated:t));
      } else {
        const created = await api("/api/botconfig/templates",{method:"POST",body:form});
        setTemplates(tt=>[...tt,created]);
      }
      setShowModal(false);
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }

  async function toggleActive(t) {
    const updated = await api(`/api/botconfig/templates/${t._id}`,{method:"PUT",body:{active:!t.active}});
    setTemplates(tt=>tt.map(x=>x._id===t._id?updated:x));
  }

  async function del(id) {
    if (!confirm("Delete this template?")) return;
    await api(`/api/botconfig/templates/${id}`,{method:"DELETE"});
    setTemplates(tt=>tt.filter(t=>t._id!==id));
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading…</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <SectionHeader title="Reply Templates" subtitle="Quick-reply messages staff can use during human takeover"/>
        <Btn variant="primary" onClick={openCreate}><Plus size={15}/>New Template</Btn>
      </div>

      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText size={32} className="mx-auto mb-3 text-slate-700"/>
          <p className="text-sm text-slate-500">No templates yet.</p>
          <p className="text-xs text-slate-600 mt-1">Create reusable replies for common guest requests — they appear in the conversation reply box.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t,i)=>(
            <Card key={i} className={`p-4 transition ${!t.active?"opacity-50":""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{t.title}</p>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-500 px-1.5 py-0.5 rounded">{t.category}</span>
                    {!t.active && <span className="text-[10px] bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded border border-slate-700">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{t.content}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={()=>toggleActive(t)} className={`p-1.5 rounded-lg border transition ${t.active?"bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20":"bg-slate-800 border-slate-700 text-slate-500 hover:text-white"}`} title={t.active?"Deactivate":"Activate"}>
                    {t.active?<Eye size={13}/>:<EyeOff size={13}/>}
                  </button>
                  <button onClick={()=>openEdit(t)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white transition"><Edit2 size={13}/></button>
                  <button onClick={()=>del(t._id)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"><Trash2 size={13}/></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing?"Edit Template":"New Template"} onClose={()=>setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <Input label="Title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Welcome Message" required/>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Content *</label>
              <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={5}
                placeholder="Your quick reply text… Use {name} for guest name, {room} for room number."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition resize-none" required/>
            </div>
            <Select label="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </Select>
            {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="secondary" type="button" onClick={()=>setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={saving}>{saving?<><Loader size={14} className="animate-spin"/>{editing?"Saving…":"Creating…"}</>:editing?"Save Changes":"Create Template"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS CARD — Settings page
// ══════════════════════════════════════════════════════════════════════════════
function EmailNotificationsCard() {
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState("");
  const [err, setErr]         = useState("");
  const [email, setEmail]     = useState("");

  async function sendDigest(e) {
    e.preventDefault(); setResult(""); setErr(""); setSending(true);
    try {
      const body = email.trim() ? { email: email.trim() } : {};
      const d = await api("/api/admin/digest/send", { method:"POST", body });
      setResult(`Digest sent to ${d.sentTo}`);
    } catch(e){ setErr(e.message); }
    setSending(false);
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 mb-4">Email Notifications</h3>
      <div className="space-y-4">
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400"/>
            <p className="text-xs font-semibold text-white">Auto-Escalation Alerts</p>
          </div>
          <p className="text-xs text-slate-500">Sent automatically when requests are escalated. Configure SMTP in <code className="bg-slate-700 px-1 rounded text-slate-300">.env</code> to enable.</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-400"/>
            <p className="text-xs font-semibold text-white">Daily Operations Digest</p>
          </div>
          <p className="text-xs text-slate-500 mb-3">Sent daily at {process?.env?.DIGEST_HOUR ?? "8"}:00 AM with stats, dept breakdown, and recent escalations.</p>
          <form onSubmit={sendDigest} className="flex gap-2">
            <input value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Override recipient email (optional)"
              type="email"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"/>
            <button type="submit" disabled={sending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 transition disabled:opacity-50 whitespace-nowrap">
              {sending ? <Loader size={12} className="animate-spin"/> : <Send size={12}/>}
              Send Now
            </button>
          </form>
        </div>
        {result && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{result}</p>}
        {err    && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BILLING PAGE — plan, usage bars, invoice history
// ══════════════════════════════════════════════════════════════════════════════
function BillingPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api("/api/admin/billing")
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>setLoading(false));
  },[]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading billing…</div>;
  if (!data)   return <div className="flex items-center justify-center h-64 text-slate-500">Could not load billing info</div>;

  const { plan, planLabel, status, trialEnds, bars, invoices } = data;

  const PLAN_COLORS = { starter:"from-slate-500 to-slate-600", professional:"from-blue-500 to-blue-600", business:"from-violet-500 to-violet-600", enterprise:"from-emerald-500 to-teal-600" };
  const INV_STATUS_STYLE = { issued:"text-blue-400 bg-blue-500/10 border-blue-500/25", paid:"text-emerald-400 bg-emerald-500/10 border-emerald-500/25", overdue:"text-red-400 bg-red-500/10 border-red-500/25", void:"text-slate-500 bg-slate-700/30 border-slate-700", draft:"text-slate-400 bg-slate-800 border-slate-700" };

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader title="Billing & Plan" subtitle="Your subscription, usage limits, and invoice history"/>

      {/* Plan card */}
      <div className={`bg-gradient-to-r ${PLAN_COLORS[plan]||PLAN_COLORS.starter} rounded-2xl p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Current Plan</p>
            <p className="text-2xl font-bold text-white capitalize mt-1">{plan}</p>
            <p className="text-white/60 text-sm mt-0.5">{planLabel?.price || ""}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${status==="active"?"bg-white/20 border-white/30 text-white":status==="trial"?"bg-amber-500/30 border-amber-400/40 text-amber-200":"bg-red-500/30 border-red-400/40 text-red-200"}`}>{status}</span>
            {status==="trial" && trialEnds && (
              <p className="text-white/50 text-[11px] mt-1.5">Trial ends {new Date(trialEnds).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage bars */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Usage This Period</h3>
        <div className="space-y-4">
          {bars.map((b,i)=>{
            const unlimited = b.limit === -1;
            const danger = !unlimited && b.pct >= 90;
            const warn   = !unlimited && b.pct >= 70;
            const barColor = danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-emerald-500";
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-300">{b.label}</span>
                  <span className={`text-xs font-semibold ${danger?"text-red-400":warn?"text-amber-400":"text-slate-400"}`}>
                    {b.used.toLocaleString()} {unlimited ? "" : `/ ${b.limit.toLocaleString()}`}
                    {unlimited && <span className="text-slate-500"> (unlimited)</span>}
                  </span>
                </div>
                {!unlimited && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{width:`${b.pct}%`}}/>
                  </div>
                )}
                {danger && <p className="text-[10px] text-red-400 mt-1">Approaching limit — consider upgrading your plan</p>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invoice history */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Invoice History</h3>
        </div>
        {!invoices || invoices.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt size={28} className="mx-auto mb-2 text-slate-700"/>
            <p className="text-xs text-slate-500">No invoices yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-600 text-[11px] uppercase tracking-wider">
                {["Invoice","Period","Plan","Amount","Status","Date"].map(h=><th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invoices.map((inv,i)=>(
                <tr key={i} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{inv.invoiceNo}</td>
                  <td className="px-5 py-3.5 text-white text-xs font-medium">{inv.period}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs capitalize">{inv.plan}</td>
                  <td className="px-5 py-3.5 text-white font-semibold">${(inv.amount/100).toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${INV_STATUS_STYLE[inv.status]||"text-slate-400"}`}>{inv.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
