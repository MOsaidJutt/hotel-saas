import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import {
  BookOpen, Plus, Trash2, Edit2, Save, X, Loader, CheckCircle,
  AlertTriangle, ClipboardList, MessageSquare, LogOut, RefreshCw,
  ChevronDown, Bell, Bot, UserCheck,
} from "lucide-react";

// ─── Shared helpers (duplicated from App.jsx so this file is self-contained)
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

function Card({ children, className = "" }) {
  return <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>{children}</div>;
}
function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <input {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" />
    </div>
  );
}
function Textarea({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <textarea {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition resize-none" />
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
function Btn({ variant = "primary", children, className = "", ...props }) {
  const base = "px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50";
  const vars = {
    primary:   "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger:    "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25",
    ghost:     "text-slate-400 hover:text-white hover:bg-slate-800",
    amber:     "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25",
  };
  return <button className={`${base} ${vars[variant] || vars.primary} ${className}`} {...props}>{children}</button>;
}
function Modal({ title, onClose, children, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${width} shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  New:           "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "In Progress": "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Escalated:     "bg-red-500/15 text-red-400 border-red-500/25",
  Completed:     "bg-slate-500/15 text-slate-400 border-slate-500/25",
};
function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
      {status}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function KnowledgeBasePage() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ question:"", answer:"", category:"General", priority:0, active:true });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [filter, setFilter]       = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/api/botconfig/kb"); setItems(d); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = ["All", ...Array.from(new Set(items.map(i => i.category)))];

  const filtered = filter === "All" ? items : items.filter(i => i.category === filter);

  function openCreate() {
    setEditing(null);
    setForm({ question:"", answer:"", category:"General", priority:0, active:true });
    setErr("");
    setShowModal(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({ question: item.question, answer: item.answer, category: item.category, priority: item.priority, active: item.active });
    setErr("");
    setShowModal(true);
  }
  async function save(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      if (editing) {
        await api(`/api/botconfig/kb/${editing._id}`, { method:"PUT", body: form });
      } else {
        await api("/api/botconfig/kb", { method:"POST", body: form });
      }
      setShowModal(false);
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  async function del(id) {
    if (!confirm("Delete this Q&A entry?")) return;
    try { await api(`/api/botconfig/kb/${id}`, { method:"DELETE" }); load(); }
    catch (e) { alert(e.message); }
  }
  async function toggleActive(item) {
    try { await api(`/api/botconfig/kb/${item._id}`, { method:"PUT", body:{ ...item, active: !item.active } }); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-0.5">Custom Q&A that the bot will use when answering guests</p>
        </div>
        <Btn variant="primary" onClick={openCreate}><Plus size={15}/>Add Entry</Btn>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              filter === c
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-slate-800 text-slate-500 border-slate-700 hover:text-white"
            }`}
          >{c}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"Total Entries",  value: items.length },
          { label:"Active",         value: items.filter(i=>i.active).length, color:"text-emerald-400" },
          { label:"Categories",     value: categories.length - 1 },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color || "text-white"}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader size={24} className="text-emerald-400 animate-spin"/></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen size={32} className="text-slate-700 mx-auto mb-3"/>
          <p className="text-slate-500 text-sm">No knowledge base entries yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add Q&A pairs the bot should know about your hotel.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <Card key={item._id} className={`p-5 transition ${!item.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-400">{item.category}</span>
                    {item.priority > 0 && (
                      <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Priority {item.priority}</span>
                    )}
                    {!item.active && <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1.5">Q: {item.question}</p>
                  <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">A: {item.answer}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleActive(item)}
                    title={item.active ? "Deactivate" : "Activate"}
                    className={`p-1.5 rounded-lg border transition ${item.active ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" : "bg-slate-800 border-slate-700 text-slate-500 hover:text-white"}`}
                  ><CheckCircle size={13}/></button>
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"><Edit2 size={13}/></button>
                  <button onClick={() => del(item._id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition border border-slate-700"><Trash2 size={13}/></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Knowledge Entry" : "Add Knowledge Entry"} onClose={() => setShowModal(false)} width="max-w-xl">
          <form onSubmit={save} className="space-y-4">
            <Input
              label="Question / Trigger *"
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="e.g. What time does the pool close?"
              required
            />
            <Textarea
              label="Answer *"
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="The pool is open from 6 AM to 10 PM daily."
              rows={4}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Category"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="General, Pool, Dining…"
              />
              <Input
                label="Priority (higher = first)"
                type="number"
                min="0"
                max="100"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="kb-active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500"
              />
              <label htmlFor="kb-active" className="text-sm text-slate-400">Active (bot uses this entry)</label>
            </div>
            {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={saving}>
                {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>{editing ? "Update" : "Add Entry"}</>}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT STAFF APP
// ══════════════════════════════════════════════════════════════════════════════
export function DepartmentStaffApp({ user, onLogout }) {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [deptInfo, setDeptInfo]     = useState(null);
  const [connected, setConnected]   = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const notifRef = React.useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/admin/my-department");
      setRequests(d.requests || []);
      setDeptInfo(d.departments?.[0] || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Socket.io live updates
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io(window.location.origin, { query: { token }, reconnectionDelay: 1000 });
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("liveUpdate", (data) => {
      const myDeptIds = (user.departments || []).map(String);
      if (data.requests) {
        const filtered = myDeptIds.length > 0
          ? data.requests.filter(r => myDeptIds.includes(String(r.departmentId || "")))
          : data.requests;
        setRequests(filtered);

        // Build meaningful notification
        const ts = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
        const newReqs = data.requests.filter(r => r.status === "New" &&
          (myDeptIds.length === 0 || myDeptIds.includes(String(r.departmentId || ""))));
        if (newReqs.length > 0) {
          const msg = newReqs.length === 1
            ? `New request: ${newReqs[0].type?.slice(0, 40) || "Service request"} (${newReqs[0].departmentName})`
            : `${newReqs.length} new requests received`;
          setNotifications(p => [{ id: Date.now(), text: msg, time: ts, alert: false }, ...p.slice(0, 19)]);
        }
      }
      if (data._alert?.type === "escalation") {
        const ts = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
        setNotifications(p => [{ id: Date.now(), text: "⚠️ Request auto-escalated — needs attention", time: ts, alert: true }, ...p.slice(0, 19)]);
      }
    });
    return () => socket.disconnect();
  }, [user]);

  // Close notification panel on outside click
  React.useEffect(() => {
    function handle(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    try {
      await api(`/api/admin/requests/${id}/status`, { method:"PUT", body:{ status } });
      setRequests(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    } catch (e) { alert(e.message); }
    setUpdatingId(null);
  }

  const STATUS_FLOW = {
    "New":         ["In Progress"],
    "In Progress": ["Completed", "Escalated"],
    "Escalated":   ["In Progress", "Completed"],
    "Completed":   [],
  };

  const counts = {
    All:          requests.length,
    New:          requests.filter(r => r.status === "New").length,
    "In Progress":requests.filter(r => r.status === "In Progress").length,
    Escalated:    requests.filter(r => r.status === "Escalated").length,
    Completed:    requests.filter(r => r.status === "Completed").length,
  };

  const filtered = filter === "All" ? requests : requests.filter(r => r.status === filter);

  const roleLabel = user.role === "manager" ? "Manager" : "Staff";

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-bold text-white">O</div>
          <div>
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-slate-500 capitalize">{roleLabel} · {deptInfo?.name || "All Departments"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}/>
            {connected ? "Live" : "Offline"}
          </div>
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(p => !p)}
              className="relative p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 hover:bg-slate-700/60 transition text-slate-400 hover:text-white">
              <Bell size={15}/>
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-11 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <button onClick={() => { setNotifications([]); setNotifOpen(false); }}
                    className="text-slate-500 hover:text-white transition text-xs">
                    Clear all
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                  {notifications.length === 0
                    ? <p className="text-sm text-slate-500 text-center py-8">No notifications</p>
                    : notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 hover:bg-slate-800/50 transition ${n.alert ? "border-l-2 border-red-500/60" : ""}`}>
                          <p className={`text-xs leading-snug ${n.alert ? "text-red-400" : "text-slate-300"}`}>{n.text}</p>
                          <p className="text-[10px] text-slate-600 mt-1">{n.time}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20">
            <LogOut size={13}/>Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              {deptInfo ? deptInfo.name : "Service Requests"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and respond to incoming guest requests</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">
            <RefreshCw size={12}/>Refresh
          </button>
        </div>

        {/* Stat chips */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(counts).map(([label, count]) => (
            <button
              key={label}
              onClick={() => setFilter(label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                filter === label
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-500 border-slate-700 hover:text-white"
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === label ? "bg-emerald-500/30" : "bg-slate-700"}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Request list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader size={24} className="text-emerald-400 animate-spin"/></div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <ClipboardList size={32} className="text-slate-700 mx-auto mb-3"/>
            <p className="text-slate-500 text-sm">No {filter === "All" ? "" : filter.toLowerCase() + " "}requests right now.</p>
            <p className="text-slate-600 text-xs mt-1">New guest requests will appear here in real time.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <RequestCard
                key={req._id}
                req={req}
                onUpdate={updateStatus}
                updating={updatingId === req._id}
                statusFlow={STATUS_FLOW}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ req, onUpdate, updating, statusFlow }) {
  const [expanded, setExpanded] = useState(false);
  const actions = statusFlow[req.status] || [];

  const actionStyles = {
    "In Progress": "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-amber-500/25",
    Completed:     "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/25",
    Escalated:     "bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/25",
  };
  const actionIcons = {
    "In Progress": <AlertTriangle size={12}/>,
    Completed:     <CheckCircle size={12}/>,
    Escalated:     <AlertTriangle size={12}/>,
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-mono text-slate-500">{req.reqId}</span>
              <StatusBadge status={req.status}/>
              {req.roomNumber && (
                <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded">Room {req.roomNumber}</span>
              )}
              <span className="text-xs text-slate-600">{req.time}</span>
            </div>
            <p className="text-sm font-medium text-white">{req.type}</p>
            <p className="text-xs text-slate-500 mt-0.5">{req.guestLabel} · {req.departmentName}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {actions.map(action => (
              <button
                key={action}
                onClick={() => onUpdate(req._id, action)}
                disabled={updating}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-50 ${actionStyles[action]}`}
              >
                {updating ? <Loader size={11} className="animate-spin"/> : actionIcons[action]}
                {action}
              </button>
            ))}
            {Object.keys(req.fieldValues || {}).length > 0 && (
              <button
                onClick={() => setExpanded(p => !p)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
              ><ChevronDown size={13} className={`transition ${expanded ? "rotate-180" : ""}`}/></button>
            )}
          </div>
        </div>

        {expanded && Object.keys(req.fieldValues || {}).length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
            {Object.entries(req.fieldValues).map(([k, v]) => (
              <div key={k} className="bg-slate-800/60 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{k}</p>
                <p className="text-sm text-white mt-0.5">{String(v)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
