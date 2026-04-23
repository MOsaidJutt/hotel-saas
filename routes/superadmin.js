const router  = require("express").Router();
const axios   = require("axios");
const Tenant  = require("../models/Tenant");
const User    = require("../models/User");
const Department = require("../models/Department");
const ServiceRequest = require("../models/ServiceRequest");
const Conversation   = require("../models/Conversation");
const Invoice        = require("../models/Invoice");
const { PLAN_LABELS, getLimits } = require("../utils/planLimits");
const { authenticate, isSuperAdmin } = require("../middleware/auth");

// All super admin routes require authentication + superadmin role
router.use(authenticate, isSuperAdmin);

// ─── GET /api/superadmin/dashboard
// Overview stats across all tenants
router.get("/dashboard", async (req, res) => {
  const [tenantCount, userCount, requestCount, convCount] = await Promise.all([
    Tenant.countDocuments(),
    User.countDocuments({ role: { $ne: "superadmin" } }),
    ServiceRequest.countDocuments(),
    Conversation.countDocuments(),
  ]);

  const byPlan = await Tenant.aggregate([
    { $group: { _id: "$plan", count: { $sum: 1 } } },
  ]);

  const byStatus = await Tenant.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const recentTenants = await Tenant.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name email plan status createdAt greenApi.instanceState");

  res.json({ tenantCount, userCount, requestCount, convCount, byPlan, byStatus, recentTenants });
});

// ─── GET /api/superadmin/tenants
router.get("/tenants", async (req, res) => {
  const { search, status, plan, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plan)   filter.plan = plan;
  if (search) filter.$or = [
    { name: new RegExp(search, "i") },
    { email: new RegExp(search, "i") },
  ];

  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-greenApi.apiTokenInstance"), // never expose token in list
    Tenant.countDocuments(filter),
  ]);

  res.json({ tenants, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// ─── GET /api/superadmin/tenants/:id
router.get("/tenants/:id", async (req, res) => {
  const tenant = await Tenant.findById(req.params.id).select("-greenApi.apiTokenInstance");
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  const [admins, deptCount, requestCount, convCount, requestsThisMonth, convsThisMonth, escalatedCount, completedCount] = await Promise.all([
    User.find({ tenantId: tenant._id, role: "admin" }).select("name email lastLogin active"),
    Department.countDocuments({ tenantId: tenant._id }),
    ServiceRequest.countDocuments({ tenantId: tenant._id }),
    Conversation.countDocuments({ tenantId: tenant._id }),
    ServiceRequest.countDocuments({ tenantId: tenant._id, createdAt: { $gte: monthStart } }),
    Conversation.countDocuments({ tenantId: tenant._id, createdAt: { $gte: monthStart } }),
    ServiceRequest.countDocuments({ tenantId: tenant._id, status: "Escalated" }),
    ServiceRequest.countDocuments({ tenantId: tenant._id, status: "Completed" }),
  ]);

  res.json({
    tenant, admins, deptCount, requestCount, convCount,
    usage: { requestsThisMonth, convsThisMonth, escalatedCount, completedCount }
  });
});

// ─── POST /api/superadmin/tenants
// Create new hotel client + their admin user
router.post("/tenants", async (req, res) => {
  const { name, email, phone, plan, adminName, adminEmail, adminPassword, idInstance, apiTokenInstance } = req.body;

  if (!name || !email || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: "name, email, adminEmail, adminPassword required" });
  }

  // Build slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Check uniqueness
  const [emailTaken, slugTaken] = await Promise.all([
    Tenant.findOne({ email: email.toLowerCase() }),
    Tenant.findOne({ slug }),
  ]);
  if (emailTaken) return res.status(400).json({ error: "Tenant email already registered" });
  if (slugTaken)  return res.status(400).json({ error: "Hotel name too similar to existing tenant" });

  const adminEmailTaken = await User.findOne({ email: adminEmail.toLowerCase() });
  if (adminEmailTaken) return res.status(400).json({ error: "Admin email already in use" });

  // Create tenant
  const tenant = await Tenant.create({
    name, slug, email, phone, plan: plan || "starter",
    botPersona: { hotelName: name },
    ...(idInstance && apiTokenInstance ? {
      greenApi: { idInstance, apiTokenInstance, instanceState: "notAuthorized" }
    } : {}),
  });

  // Set webhook URL (will be updated once domain is known)
  tenant.webhookUrl = `${process.env.BASE_URL || "http://localhost:3000"}/webhook/${tenant.slug}`;
  await tenant.save();

  // Create admin user
  const admin = await User.create({
    name: adminName || `${name} Admin`,
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    tenantId: tenant._id,
  });

  // Seed default departments
  await seedDefaultDepartments(tenant._id);

  res.status(201).json({
    message: "Tenant created",
    tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, webhookUrl: tenant.webhookUrl },
    admin: { id: admin._id, email: admin.email },
  });
});

// ─── PUT /api/superadmin/tenants/:id
router.put("/tenants/:id", async (req, res) => {
  const allowed = ["name", "plan", "status", "phone", "primaryColor"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const tenant = await Tenant.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  res.json(tenant);
});

// ─── DELETE /api/superadmin/tenants/:id
router.delete("/tenants/:id", async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  await Promise.all([
    User.deleteMany({ tenantId: tenant._id }),
    Department.deleteMany({ tenantId: tenant._id }),
    ServiceRequest.deleteMany({ tenantId: tenant._id }),
    Conversation.deleteMany({ tenantId: tenant._id }),
    tenant.deleteOne(),
  ]);

  res.json({ message: "Tenant and all associated data deleted" });
});

// ─── POST /api/superadmin/tenants/:id/suspend
router.post("/tenants/:id/suspend", async (req, res) => {
  const tenant = await Tenant.findByIdAndUpdate(req.params.id, { status: "suspended" }, { new: true });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  res.json({ message: "Tenant suspended", status: tenant.status });
});

// ─── POST /api/superadmin/tenants/:id/activate
router.post("/tenants/:id/activate", async (req, res) => {
  const tenant = await Tenant.findByIdAndUpdate(req.params.id, { status: "active" }, { new: true });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  res.json({ message: "Tenant activated", status: tenant.status });
});

// ─── GET /api/superadmin/tenants/:id/whatsapp-status
// Poll Green API instance state and update DB
router.get("/tenants/:id/whatsapp-status", async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Not found" });

  const { idInstance, apiTokenInstance } = tenant.greenApi;
  if (!idInstance || !apiTokenInstance) {
    return res.json({ state: "notConfigured" });
  }

  try {
    const url = `https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiTokenInstance}`;
    const { data } = await axios.get(url);
    tenant.greenApi.instanceState = data.stateInstance || "unknown";
    tenant.greenApi.lastChecked = new Date();
    await tenant.save();
    res.json({ state: tenant.greenApi.instanceState });
  } catch {
    res.json({ state: "error" });
  }
});

// ════════════════════════════════════════════════════════
// INVOICES — superadmin creates/manages invoices per tenant
// ════════════════════════════════════════════════════════

// GET /api/superadmin/invoices?tenantId=
router.get("/invoices", async (req, res) => {
  const filter = {};
  if (req.query.tenantId) filter.tenantId = req.query.tenantId;
  const invoices = await Invoice.find(filter)
    .populate("tenantId", "name email plan")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(invoices);
});

// POST /api/superadmin/invoices — create invoice for a tenant
router.post("/invoices", async (req, res) => {
  const { tenantId, period, periodStart, periodEnd, amount, plan, notes, lineItems } = req.body;
  if (!tenantId || !period || !amount) {
    return res.status(400).json({ error: "tenantId, period, amount required" });
  }

  // Auto-generate invoice number
  const count = await Invoice.countDocuments();
  const invoiceNo = `INV-${String(count + 1).padStart(4, "0")}`;

  const invoice = await Invoice.create({
    tenantId, invoiceNo, period,
    periodStart: periodStart ? new Date(periodStart) : new Date(),
    periodEnd:   periodEnd   ? new Date(periodEnd)   : new Date(),
    plan: plan || "starter",
    amount: Number(amount),
    notes: notes || "",
    lineItems: lineItems || [],
    status: "issued",
  });

  res.status(201).json(invoice);
});

// PUT /api/superadmin/invoices/:id — update status (mark paid, void, etc.)
router.put("/invoices/:id", async (req, res) => {
  const allowed = ["status", "paidAt", "notes"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (req.body.status === "paid" && !updates.paidAt) updates.paidAt = new Date();

  const invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json(invoice);
});

// DELETE /api/superadmin/invoices/:id
router.delete("/invoices/:id", async (req, res) => {
  await Invoice.findByIdAndDelete(req.params.id);
  res.json({ message: "Invoice deleted" });
});

// ─── Helper: seed default departments when a new tenant is created
async function seedDefaultDepartments(tenantId) {
  const defaults = [
    {
      name: "Housekeeping",
      icon: "🧹",
      color: "#10b981",
      menuOrder: 1,
      keywords: ["towel", "clean", "housekeeping", "bedsheet", "pillow", "toiletries", "laundry"],
      fields: [
        { name: "Request Type", type: "dropdown", options: ["Extra Towels", "Extra Pillows", "Room Cleaning", "Bedsheet Change", "Toiletries Refill"], required: true },
        { name: "Urgent", type: "toggle", required: false },
      ],
      escalationMinutes: 15,
    },
    {
      name: "Room Service",
      icon: "🍽",
      color: "#f59e0b",
      menuOrder: 2,
      keywords: ["food", "order", "biryani", "pizza", "burger", "steak", "pasta", "coffee", "tea", "juice", "meal", "drink"],
      fields: [
        { name: "Order Details", type: "text", required: true, placeholder: "What would you like to order?" },
        { name: "Special Instructions", type: "text", required: false },
      ],
      escalationMinutes: 10,
    },
    {
      name: "Concierge",
      icon: "🚕",
      color: "#3b82f6",
      menuOrder: 3,
      keywords: ["taxi", "cab", "airport", "pickup", "tour", "car rental", "reservation", "shuttle"],
      fields: [
        { name: "Service Type", type: "dropdown", options: ["Taxi Booking", "Airport Pickup", "Airport Drop", "Tour Guide", "Car Rental", "Restaurant Reservation"], required: true },
        { name: "Pickup Time", type: "timepicker", required: false },
        { name: "Destination", type: "text", required: false },
      ],
      escalationMinutes: 8,
    },
    {
      name: "Maintenance",
      icon: "🔧",
      color: "#ef4444",
      menuOrder: 4,
      keywords: ["ac", "air condition", "maintenance", "repair", "broken", "not working", "leak", "light", "bulb", "wifi", "internet"],
      fields: [
        { name: "Issue Type", type: "dropdown", options: ["AC / Air Conditioning", "WiFi / Internet", "Light / Electricity", "Plumbing / Leak", "Broken Furniture", "Other"], required: true },
        { name: "Description", type: "text", required: false },
        { name: "Urgent", type: "toggle", required: false },
      ],
      escalationMinutes: 20,
    },
  ];

  await Department.insertMany(defaults.map(d => ({ ...d, tenantId })));
}

module.exports = router;
