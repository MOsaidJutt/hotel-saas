const router  = require("express").Router();
const axios   = require("axios");
const Tenant  = require("../models/Tenant");
const User    = require("../models/User");
const Department     = require("../models/Department");
const ServiceRequest = require("../models/ServiceRequest");
const Conversation   = require("../models/Conversation");
const Invoice        = require("../models/Invoice");
const { getLimits, PLAN_LABELS, isUnlimited, usagePct } = require("../utils/planLimits");
const { authenticate, isAdmin, isManager, isStaff } = require("../middleware/auth");

router.use(authenticate);

// Helper: resolve tenantId from authenticated user
function getTenantId(req) {
  return req.user.role === "superadmin" ? req.params.tenantId : req.user.tenantId;
}

// Helper: check a plan limit and return 429 if exceeded
async function checkLimit(res, tenantId, resourceType) {
  const { isAtLimit } = require("../utils/planLimits");
  const tenant = await require("../models/Tenant").findById(tenantId).lean();
  if (!tenant) return false; // don't block if tenant not found
  const limits = getLimits(tenant.plan);

  let used, limit, label;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  if (resourceType === "staff") {
    used  = await User.countDocuments({ tenantId, role: { $nin: ["superadmin"] } });
    limit = limits.staff; label = "staff members";
  } else if (resourceType === "department") {
    used  = await Department.countDocuments({ tenantId, active: true });
    limit = limits.departments; label = "departments";
  } else if (resourceType === "request") {
    used  = await ServiceRequest.countDocuments({ tenantId, createdAt: { $gte: monthStart } });
    limit = limits.requestsPerMonth; label = "requests this month";
  } else {
    return false;
  }

  if (isAtLimit(used, limit)) {
    res.status(429).json({ error: `Plan limit reached: your ${tenant.plan} plan allows ${limit} ${label}. Upgrade to continue.` });
    return true; // blocked
  }
  return false; // ok
}

// ════════════════════════════════════════════════════════
// TENANT PROFILE (client admin reads/updates their own)
// ════════════════════════════════════════════════════════

// GET /api/admin/profile
router.get("/profile", isAdmin, async (req, res) => {
  const tenant = await Tenant.findById(getTenantId(req)).select("-greenApi.apiTokenInstance");
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  res.json(tenant);
});

// PUT /api/admin/profile
router.put("/profile", isAdmin, async (req, res) => {
  const allowed = ["name", "phone", "primaryColor", "timezone"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const tenant = await Tenant.findByIdAndUpdate(getTenantId(req), updates, { new: true })
    .select("-greenApi.apiTokenInstance");
  res.json(tenant);
});

// ════════════════════════════════════════════════════════
// BOT PERSONA
// ════════════════════════════════════════════════════════

// PUT /api/admin/persona
router.put("/persona", isAdmin, async (req, res) => {
  const { name, role, hotelName, customPrompt } = req.body;
  const updates = { botPersona: { name, role, hotelName, customPrompt } };
  const tenant = await Tenant.findByIdAndUpdate(getTenantId(req), updates, { new: true });
  res.json(tenant.botPersona);
});

// ════════════════════════════════════════════════════════
// GREEN API (WhatsApp) CONFIG
// ════════════════════════════════════════════════════════

// PUT /api/admin/whatsapp
router.put("/whatsapp", isAdmin, async (req, res) => {
  const { idInstance, apiTokenInstance } = req.body;
  if (!idInstance || !apiTokenInstance) {
    return res.status(400).json({ error: "idInstance and apiTokenInstance required" });
  }

  const tenantId = getTenantId(req);
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  // Verify credentials with Green API
  try {
    const stateUrl = `https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiTokenInstance}`;
    const { data } = await axios.get(stateUrl, { timeout: 8000 });
    tenant.greenApi.instanceState = data.stateInstance || "unknown";
  } catch {
    return res.status(400).json({ error: "Could not verify Green API credentials. Check your Instance ID and Token." });
  }

  tenant.greenApi.idInstance = idInstance;
  tenant.greenApi.apiTokenInstance = apiTokenInstance;
  tenant.greenApi.lastChecked = new Date();

  // Register webhook with Green API
  const webhookUrl = `${process.env.BASE_URL || "http://localhost:3000"}/webhook/${tenant.slug}`;
  tenant.webhookUrl = webhookUrl;

  try {
    const settingsUrl = `https://api.green-api.com/waInstance${idInstance}/setSettings/${apiTokenInstance}`;
    await axios.post(settingsUrl, {
      webhookUrl,
      webhookUrlToken: "",
      delaySendMessagesMilliseconds: 1000,
      markIncomingMessagesReaded: "yes",
      incomingWebhook: "yes",
    }, { timeout: 8000 });
  } catch {
    // Webhook registration failed but credentials are fine — save anyway
    console.warn("⚠️  Could not auto-register webhook with Green API");
  }

  await tenant.save();
  res.json({
    message: "WhatsApp configured",
    state: tenant.greenApi.instanceState,
    webhookUrl: tenant.webhookUrl,
  });
});

// GET /api/admin/whatsapp/status
router.get("/whatsapp/status", isAdmin, async (req, res) => {
  const tenant = await Tenant.findById(getTenantId(req));
  if (!tenant?.greenApi?.idInstance) return res.json({ state: "notConfigured" });

  const { idInstance, apiTokenInstance } = tenant.greenApi;
  try {
    const url = `https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiTokenInstance}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    tenant.greenApi.instanceState = data.stateInstance || "unknown";
    tenant.greenApi.lastChecked = new Date();
    await tenant.save();
    res.json({ state: tenant.greenApi.instanceState, phone: tenant.greenApi.phoneNumber });
  } catch {
    res.json({ state: "error" });
  }
});

// GET /api/admin/whatsapp/qr
// Get QR code for scanning (when not yet authorized)
router.get("/whatsapp/qr", isAdmin, async (req, res) => {
  const tenant = await Tenant.findById(getTenantId(req));
  if (!tenant?.greenApi?.idInstance) return res.status(400).json({ error: "Not configured" });

  const { idInstance, apiTokenInstance } = tenant.greenApi;
  try {
    const url = `https://api.green-api.com/waInstance${idInstance}/qr/${apiTokenInstance}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    res.json(data); // { type: "qrCode", message: "base64..." } or { type: "alreadyLogged" }
  } catch {
    res.status(500).json({ error: "Could not fetch QR code" });
  }
});

// ════════════════════════════════════════════════════════
// DEPARTMENT BUILDER
// ════════════════════════════════════════════════════════

// GET /api/admin/departments
router.get("/departments", isManager, async (req, res) => {
  const depts = await Department.find({ tenantId: getTenantId(req) }).sort({ menuOrder: 1 });
  res.json(depts);
});

// GET /api/admin/departments/:id
router.get("/departments/:id", isManager, async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, tenantId: getTenantId(req) });
  if (!dept) return res.status(404).json({ error: "Department not found" });
  res.json(dept);
});

// POST /api/admin/departments
router.post("/departments", isAdmin, async (req, res) => {
  if (await checkLimit(res, getTenantId(req), "department")) return;

  const { name, icon, color, keywords, fields, menuOrder, escalationMinutes, maxConcurrentLoad } = req.body;
  if (!name) return res.status(400).json({ error: "Department name required" });

  const dept = await Department.create({
    tenantId: getTenantId(req),
    name, icon, color, keywords, fields,
    menuOrder: menuOrder ?? 99,
    escalationMinutes: escalationMinutes ?? 30,
    maxConcurrentLoad: maxConcurrentLoad ?? 5,
  });
  res.status(201).json(dept);
});

// PUT /api/admin/departments/:id
router.put("/departments/:id", isAdmin, async (req, res) => {
  const allowed = ["name", "icon", "color", "keywords", "fields", "menuOrder", "escalationMinutes", "maxConcurrentLoad", "active"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const dept = await Department.findOneAndUpdate(
    { _id: req.params.id, tenantId: getTenantId(req) },
    updates,
    { new: true }
  );
  if (!dept) return res.status(404).json({ error: "Department not found" });
  res.json(dept);
});

// DELETE /api/admin/departments/:id
router.delete("/departments/:id", isAdmin, async (req, res) => {
  const dept = await Department.findOneAndDelete({ _id: req.params.id, tenantId: getTenantId(req) });
  if (!dept) return res.status(404).json({ error: "Department not found" });
  res.json({ message: "Department deleted" });
});

// ════════════════════════════════════════════════════════
// STAFF MANAGEMENT
// ════════════════════════════════════════════════════════

// GET /api/admin/staff
router.get("/staff", isAdmin, async (req, res) => {
  const staff = await User.find({ tenantId: getTenantId(req), role: { $ne: "superadmin" } })
    .populate("departments", "name icon")
    .select("-password")
    .sort({ createdAt: -1 });
  res.json(staff);
});

// POST /api/admin/staff
router.post("/staff", isAdmin, async (req, res) => {
  if (await checkLimit(res, getTenantId(req), "staff")) return;

  const { name, email, password, role, departments } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }
  if (!["admin", "manager", "staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(400).json({ error: "Email already in use" });

  const user = await User.create({
    name, email, password, role,
    tenantId: getTenantId(req),
    departments: departments || [],
  });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

// PUT /api/admin/staff/:id
router.put("/staff/:id", isAdmin, async (req, res) => {
  const allowed = ["name", "role", "departments", "active"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, tenantId: getTenantId(req) },
    updates,
    { new: true }
  ).select("-password");
  if (!user) return res.status(404).json({ error: "Staff not found" });
  res.json(user);
});

// DELETE /api/admin/staff/:id
router.delete("/staff/:id", isAdmin, async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.params.id, tenantId: getTenantId(req) });
  if (!user) return res.status(404).json({ error: "Staff not found" });
  res.json({ message: "Staff removed" });
});

// ════════════════════════════════════════════════════════
// REQUESTS (department view)
// ════════════════════════════════════════════════════════

// GET /api/admin/requests
router.get("/requests", isManager, async (req, res) => {
  const { dept, status, search, page = 1, limit = 50 } = req.query;
  const filter = { tenantId: getTenantId(req) };
  if (dept)   filter.departmentName = dept;
  if (status) filter.status = status;
  if (search) filter.$or = [
    { guestLabel: new RegExp(search, "i") },
    { roomNumber: new RegExp(search, "i") },
    { type:       new RegExp(search, "i") },
    { reqId:      new RegExp(search, "i") },
  ];

  const [requests, total] = await Promise.all([
    ServiceRequest.find(filter)
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    ServiceRequest.countDocuments(filter),
  ]);

  res.json({ requests, total });
});

// GET /api/admin/requests/export  — CSV download
router.get("/requests/export", isManager, async (req, res) => {
  const { status, dept } = req.query;
  const filter = { tenantId: getTenantId(req) };
  if (status) filter.status = status;
  if (dept)   filter.departmentName = dept;

  const requests = await ServiceRequest.find(filter)
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headers = ["ID","Guest","Room","Department","Request Type","Status","Assigned To","Created At","Completed At"];
  const rows = requests.map(r => [
    r.reqId,
    r.guestLabel || "",
    r.roomNumber  || "",
    r.departmentName || "",
    r.type || "",
    r.status || "",
    r.assignedTo?.name || "Unassigned",
    r.createdAt ? new Date(r.createdAt).toISOString() : "",
    r.completedAt ? new Date(r.completedAt).toISOString() : "",
  ].map(escape).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="requests-${Date.now()}.csv"`);
  res.send(csv);
});

// PUT /api/admin/requests/:id/status
router.put("/requests/:id/status", isStaff, async (req, res) => {
  const { status, assignedTo } = req.body;
  const updates = { status };
  if (assignedTo) updates.assignedTo = assignedTo;
  if (status === "Completed") updates.completedAt = new Date();
  if (status === "Escalated") updates.escalatedAt = new Date();

  const req_ = await ServiceRequest.findOneAndUpdate(
    { _id: req.params.id, tenantId: getTenantId(req) },
    updates,
    { new: true }
  );
  if (!req_) return res.status(404).json({ error: "Request not found" });
  res.json(req_);
});

// ════════════════════════════════════════════════════════
// CONVERSATIONS (human takeover)
// ════════════════════════════════════════════════════════

// GET /api/admin/conversations
router.get("/conversations", isManager, async (req, res) => {
  const { status, search, page = 1, limit = 30 } = req.query;
  const filter = { tenantId: getTenantId(req) };
  if (status) filter.status = status;
  if (search) filter.$or = [
    { guestName:  new RegExp(search, "i") },
    { guestLabel: new RegExp(search, "i") },
    { phone:      new RegExp(search, "i") },
    { roomNumber: new RegExp(search, "i") },
  ];

  const [convs, total] = await Promise.all([
    Conversation.find(filter)
      .populate("assignedTo", "name")
      .select("-messages") // exclude full message history in list view
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Conversation.countDocuments(filter),
  ]);

  res.json({ conversations: convs, total });
});

// GET /api/admin/conversations/:chatId
router.get("/conversations/:chatId", isManager, async (req, res) => {
  const conv = await Conversation.findOne({ tenantId: getTenantId(req), chatId: req.params.chatId });
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  res.json(conv);
});

// PUT /api/admin/conversations/:chatId/takeover
// Human takes over from AI
router.put("/conversations/:chatId/takeover", isManager, async (req, res) => {
  const conv = await Conversation.findOneAndUpdate(
    { tenantId: getTenantId(req), chatId: req.params.chatId },
    { humanMode: true, assignedTo: req.user._id, status: "Escalated" },
    { new: true }
  );
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Human takeover activated", conv });
});

// POST /api/admin/conversations/:chatId/send
// Staff sends a manual message during human takeover
router.post("/conversations/:chatId/send", isStaff, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

  const tenantId = getTenantId(req);
  const conv = await Conversation.findOne({ tenantId, chatId: req.params.chatId });
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const tenant = await Tenant.findById(tenantId);
  const { idInstance, apiTokenInstance } = tenant?.greenApi || {};

  // Send via Green API
  if (idInstance && apiTokenInstance) {
    try {
      const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
      await axios.post(url, { chatId: conv.chatId, message: text }, { timeout: 8000 });
    } catch (e) {
      return res.status(500).json({ error: "Failed to send via WhatsApp: " + e.message });
    }
  }

  // Store in conversation history
  const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  conv.messages.push({ from: "human", text, time: ts });
  conv.lastMessage = text;
  conv.updatedAt = new Date();
  await conv.save();

  // Broadcast via Socket.io
  if (global.io) {
    global.io.to(`tenant:${tenantId}`).emit("liveUpdate", {
      conversations: [conv],
    });
  }

  res.json({ success: true, message: text });
});

// PUT /api/admin/conversations/:chatId/handback
// Return control to AI
router.put("/conversations/:chatId/handback", isManager, async (req, res) => {
  const conv = await Conversation.findOneAndUpdate(
    { tenantId: getTenantId(req), chatId: req.params.chatId },
    { humanMode: false, assignedTo: null, status: "Active" },
    { new: true }
  );
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Handed back to AI", conv });
});

// GET /api/admin/stats
router.get("/stats", isManager, async (req, res) => {
  const tenantId = getTenantId(req);

  const [totalRequests, openRequests, completedRequests, activeConvs, deptBreakdown] = await Promise.all([
    ServiceRequest.countDocuments({ tenantId }),
    ServiceRequest.countDocuments({ tenantId, status: { $in: ["New", "In Progress"] } }),
    ServiceRequest.countDocuments({ tenantId, status: "Completed" }),
    Conversation.countDocuments({ tenantId, status: "Active" }),
    ServiceRequest.aggregate([
      { $match: { tenantId: require("mongoose").Types.ObjectId.createFromHexString(tenantId.toString()) } },
      { $group: { _id: "$departmentName", count: { $sum: 1 } } },
    ]),
  ]);

  // Last 7 days request counts
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyRaw = await ServiceRequest.aggregate([
    { $match: { tenantId: require("mongoose").Types.ObjectId.createFromHexString(tenantId.toString()), createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
    { $group: { _id: { $dayOfWeek: "$createdAt" }, count: { $sum: 1 } } },
  ]);
  const weeklyMap = {};
  weeklyRaw.forEach(w => { weeklyMap[days[w._id - 1]] = w.count; });
  const weeklyData = days.map(d => ({ day: d, value: weeklyMap[d] || 0 }));

  res.json({
    totalRequests, openRequests, completedRequests, activeConvs,
    deptBreakdown: deptBreakdown.map(d => ({ dept: d._id, value: d.count })),
    weeklyData,
  });
});

// ════════════════════════════════════════════════════════
// DEPARTMENT STAFF VIEW — scoped stats for manager/staff
// ════════════════════════════════════════════════════════

// GET /api/admin/my-department
// Returns requests + stats scoped to the logged-in user's departments
router.get("/my-department", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(403).json({ error: "No tenant" });

  // Determine which departments this user can see
  const Department = require("../models/Department");
  let deptNames = [];

  if (req.user.role === "admin") {
    // admin sees all
    const all = await Department.find({ tenantId, active: true });
    deptNames = all.map(d => d.name);
  } else {
    // manager/staff sees only their assigned departments
    const depts = await Department.find({ _id: { $in: req.user.departments || [] }, tenantId, active: true });
    deptNames = depts.map(d => d.name);
  }

  if (deptNames.length === 0) return res.json({ requests: [], stats: {}, deptNames: [] });

  const filter = { tenantId, departmentName: { $in: deptNames } };

  const [requests, openCount, completedCount, escalatedCount] = await Promise.all([
    ServiceRequest.find(filter)
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(100),
    ServiceRequest.countDocuments({ ...filter, status: { $in: ["New", "In Progress"] } }),
    ServiceRequest.countDocuments({ ...filter, status: "Completed" }),
    ServiceRequest.countDocuments({ ...filter, status: "Escalated" }),
  ]);

  res.json({
    requests,
    stats: { open: openCount, completed: completedCount, escalated: escalatedCount, total: requests.length },
    deptNames,
  });
});

// ════════════════════════════════════════════════════════
// ANALYTICS — real DB-driven data
// ════════════════════════════════════════════════════════

// GET /api/admin/analytics
router.get("/analytics", isManager, async (req, res) => {
  const tenantId = getTenantId(req);
  const oid = require("mongoose").Types.ObjectId.createFromHexString(tenantId.toString());

  const [
    statusBreakdown,
    deptBreakdown,
    hourlyBreakdown,
    escalatedByDept,
    totalReqs,
    humanConvs,
    totalConvs,
    daily30,
  ] = await Promise.all([
    // Count by status
    ServiceRequest.aggregate([
      { $match: { tenantId: oid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // Count by department (top 8)
    ServiceRequest.aggregate([
      { $match: { tenantId: oid } },
      { $group: { _id: "$departmentName", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 },
    ]),

    // Requests by hour of day
    ServiceRequest.aggregate([
      { $match: { tenantId: oid, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } },
    ]),

    // Escalated count by department
    ServiceRequest.aggregate([
      { $match: { tenantId: oid, status: "Escalated" } },
      { $group: { _id: "$departmentName", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 6 },
    ]),

    // Totals
    ServiceRequest.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId, humanMode: true }),
    Conversation.countDocuments({ tenantId }),

    // Daily requests last 30 days
    ServiceRequest.aggregate([
      { $match: { tenantId: oid, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } },
    ]),
  ]);

  // Build hourly array [0..23]
  const hourlyMap = {};
  hourlyBreakdown.forEach(h => { hourlyMap[h._id] = h.count; });
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2,"0")}:00`,
    value: hourlyMap[i] || 0,
  }));

  // Status pie
  const statusPie = ["New","In Progress","Escalated","Completed"].map(s => ({
    name: s,
    value: (statusBreakdown.find(x => x._id === s) || {}).count || 0,
  }));

  // AI vs Human rate
  const humanRate = totalConvs > 0 ? Math.round((humanConvs / totalConvs) * 100) : 0;
  const aiRate    = 100 - humanRate;

  res.json({
    statusPie,
    deptBreakdown: deptBreakdown.map(d => ({ name: d._id || "Unknown", value: d.count })),
    hourlyData,
    escalatedByDept: escalatedByDept.map(d => ({ name: d._id || "Unknown", value: d.count })),
    totalReqs,
    aiRate,
    humanRate,
    escalationRate: totalReqs > 0 ? Math.round(((statusBreakdown.find(x=>x._id==="Escalated")||{}).count||0) / totalReqs * 100) : 0,
    completionRate: totalReqs > 0 ? Math.round(((statusBreakdown.find(x=>x._id==="Completed")||{}).count||0) / totalReqs * 100) : 0,
    daily30: daily30.map(d => ({ date: d._id, count: d.count })),
  });
});

// ════════════════════════════════════════════════════════
// GUEST PROFILE — history for a specific guest phone
// ════════════════════════════════════════════════════════

// GET /api/admin/guest/:chatId
router.get("/guest/:chatId", isManager, async (req, res) => {
  const tenantId = getTenantId(req);
  const chatId = decodeURIComponent(req.params.chatId);

  const [conv, requests] = await Promise.all([
    Conversation.findOne({ tenantId, chatId }),
    ServiceRequest.find({ tenantId, chatId })
      .sort({ createdAt: -1 })
      .limit(50),
  ]);

  if (!conv) return res.status(404).json({ error: "Guest not found" });

  res.json({
    guest: {
      chatId:    conv.chatId,
      phone:     conv.phone || chatId.replace("@c.us",""),
      name:      conv.guestName || conv.guestLabel || "Guest",
      label:     conv.guestLabel,
      roomNumber:conv.roomNumber,
      status:    conv.status,
      firstSeen: conv.createdAt,
      lastSeen:  conv.updatedAt,
      totalMessages: (conv.messages || []).length,
    },
    requests,
    requestCounts: {
      total:      requests.length,
      completed:  requests.filter(r => r.status === "Completed").length,
      escalated:  requests.filter(r => r.status === "Escalated").length,
      open:       requests.filter(r => ["New","In Progress"].includes(r.status)).length,
    },
  });
});

// ════════════════════════════════════════════════════════
// REQUEST ASSIGNMENT — assign to a staff member
// ════════════════════════════════════════════════════════

// PUT /api/admin/requests/:id/assign
router.put("/requests/:id/assign", isManager, async (req, res) => {
  const { userId } = req.body;
  const tenantId = getTenantId(req);

  const updated = await ServiceRequest.findOneAndUpdate(
    { _id: req.params.id, tenantId },
    { assignedTo: userId || null },
    { new: true }
  ).populate("assignedTo", "name email");

  if (!updated) return res.status(404).json({ error: "Request not found" });
  res.json(updated);
});

// ════════════════════════════════════════════════════════
// BILLING — plan info, usage vs limits, invoice history
// ════════════════════════════════════════════════════════

// GET /api/admin/billing
router.get("/billing", isAdmin, async (req, res) => {
  const tenantId = getTenantId(req);
  const tenant   = await Tenant.findById(tenantId).lean();
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const limits = getLimits(tenant.plan);

  // Month window
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthEnd   = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);

  const [requestsThisMonth, staffCount, deptCount, invoices] = await Promise.all([
    ServiceRequest.countDocuments({ tenantId, createdAt: { $gte: monthStart } }),
    User.countDocuments({ tenantId, role: { $nin: ["superadmin"] } }),
    Department.countDocuments({ tenantId, active: true }),
    Invoice.find({ tenantId }).sort({ createdAt: -1 }).limit(12).lean(),
  ]);

  const usage = {
    requestsThisMonth,
    staffCount,
    deptCount,
    aiResponses: tenant.stats?.aiResponses || 0,
  };

  const bars = [
    { label: "Requests / Month", used: usage.requestsThisMonth, limit: limits.requestsPerMonth, pct: usagePct(usage.requestsThisMonth, limits.requestsPerMonth) },
    { label: "Staff Members",    used: usage.staffCount,         limit: limits.staff,            pct: usagePct(usage.staffCount, limits.staff) },
    { label: "Departments",      used: usage.deptCount,          limit: limits.departments,       pct: usagePct(usage.deptCount, limits.departments) },
    { label: "AI Responses",     used: usage.aiResponses,        limit: limits.aiResponses,       pct: usagePct(usage.aiResponses, limits.aiResponses) },
  ];

  res.json({
    plan: tenant.plan,
    planLabel: PLAN_LABELS[tenant.plan] || PLAN_LABELS.starter,
    trialEnds: tenant.trialEnds,
    status: tenant.status,
    limits,
    usage,
    bars,
    invoices,
  });
});

// ════════════════════════════════════════════════════════
// DAILY DIGEST — on-demand send
// ════════════════════════════════════════════════════════

// POST /api/admin/digest/send
router.post("/digest/send", isAdmin, async (req, res) => {
  const { sendDailyDigest } = require("../utils/emailService");
  const HotelConfig = require("../models/HotelConfig");
  const mongoose    = require("mongoose");

  const tenantId = getTenantId(req);
  const oid = mongoose.Types.ObjectId.createFromHexString(tenantId.toString());

  const [adminUser, config, total, open, completed, escalated, topDepts, recentEscalated] = await Promise.all([
    User.findOne({ tenantId, role: "admin" }).select("email").lean(),
    HotelConfig.findOne({ tenantId }).select("hotelName").lean(),
    ServiceRequest.countDocuments({ tenantId }),
    ServiceRequest.countDocuments({ tenantId, status: { $in: ["New","In Progress"] } }),
    ServiceRequest.countDocuments({ tenantId, status: "Completed" }),
    ServiceRequest.countDocuments({ tenantId, status: "Escalated" }),
    ServiceRequest.aggregate([
      { $match: { tenantId: oid } },
      { $group: { _id: "$departmentName",
          open:      { $sum: { $cond: [{ $in: ["$status", ["New","In Progress"]] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq:  ["$status", "Completed"]           }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $eq:  ["$status", "Escalated"]           }, 1, 0] } },
      }},
      { $sort: { open: -1 } }, { $limit: 5 },
    ]),
    ServiceRequest.find({ tenantId, status: "Escalated" }).sort({ escalatedAt: -1 }).limit(5).lean(),
  ]);

  const toEmail = req.body.email || adminUser?.email;
  if (!toEmail) return res.status(400).json({ error: "No admin email configured. Pass { email } in body or set one on the admin account." });

  try {
    await sendDailyDigest({
      to: toEmail,
      hotelName: config?.hotelName || "Your Hotel",
      stats: { total, open, completed, escalated },
      topDepts: topDepts.map(d => ({ name: d._id || "Unknown", open: d.open, completed: d.completed, escalated: d.escalated })),
      recentEscalated: recentEscalated.map(r => ({ reqId: r.reqId, guestLabel: r.guestLabel, type: r.type, departmentName: r.departmentName })),
    });
    res.json({ success: true, sentTo: toEmail });
  } catch (err) {
    res.status(500).json({ error: "Failed to send digest: " + err.message });
  }
});

module.exports = router;
