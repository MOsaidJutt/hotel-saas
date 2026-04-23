const router      = require("express").Router();
const HotelConfig = require("../models/HotelConfig");
const KnowledgeBase = require("../models/KnowledgeBase");
const { authenticate, isAdmin, isManager } = require("../middleware/auth");

router.use(authenticate);

function tid(req) {
  return req.user.role === "superadmin" ? req.params.tenantId : req.user.tenantId;
}

// ── Upsert helper — get or create config for tenant
async function getOrCreate(tenantId) {
  let config = await HotelConfig.findOne({ tenantId });
  if (!config) config = await HotelConfig.create({ tenantId });
  return config;
}

// ════════════════════════════════════════
// GET full config
// ════════════════════════════════════════
router.get("/", isManager, async (req, res) => {
  const config = await getOrCreate(tid(req));
  res.json(config);
});

// ════════════════════════════════════════
// STEP 1 — Basic hotel info
// ════════════════════════════════════════
router.put("/basic", isAdmin, async (req, res) => {
  const fields = ["hotelName","hotelType","address","city","country","phone","email","website","description"];
  const updates = {};
  fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  updates.setupStep = Math.max(1, (await getOrCreate(tid(req))).setupStep);

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, updates, { new: true, upsert: true }
  );
  res.json(config);
});

// ════════════════════════════════════════
// STEP 2 — Check-in / Check-out
// ════════════════════════════════════════
router.put("/checkin", isAdmin, async (req, res) => {
  const fields = ["checkInTime","checkOutTime","earlyCheckIn","lateCheckOut","receptionHours"];
  const updates = {};
  fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, updates, { new: true, upsert: true }
  );
  res.json(config);
});

// ════════════════════════════════════════
// STEP 3 — Room Types (full replace)
// ════════════════════════════════════════
router.put("/rooms", isAdmin, async (req, res) => {
  const { roomTypes } = req.body;
  if (!Array.isArray(roomTypes)) return res.status(400).json({ error: "roomTypes must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { roomTypes }, { new: true, upsert: true }
  );
  res.json(config.roomTypes);
});

// ════════════════════════════════════════
// STEP 4 — Facilities (full replace)
// ════════════════════════════════════════
router.put("/facilities", isAdmin, async (req, res) => {
  const { facilities } = req.body;
  if (!Array.isArray(facilities)) return res.status(400).json({ error: "facilities must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { facilities }, { new: true, upsert: true }
  );
  res.json(config.facilities);
});

// ════════════════════════════════════════
// STEP 5 — Room Service Menu (full replace)
// ════════════════════════════════════════
router.put("/menu", isAdmin, async (req, res) => {
  const { menuItems } = req.body;
  if (!Array.isArray(menuItems)) return res.status(400).json({ error: "menuItems must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { menuItems }, { new: true, upsert: true }
  );
  res.json(config.menuItems);
});

// ════════════════════════════════════════
// STEP 6 — Policies (full replace)
// ════════════════════════════════════════
router.put("/policies", isAdmin, async (req, res) => {
  const { policies } = req.body;
  if (!Array.isArray(policies)) return res.status(400).json({ error: "policies must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { policies }, { new: true, upsert: true }
  );
  res.json(config.policies);
});

// ════════════════════════════════════════
// STEP 7 — Additional Services (full replace)
// ════════════════════════════════════════
router.put("/services", isAdmin, async (req, res) => {
  const { additionalServices } = req.body;
  if (!Array.isArray(additionalServices)) return res.status(400).json({ error: "additionalServices must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { additionalServices }, { new: true, upsert: true }
  );
  res.json(config.additionalServices);
});

// ════════════════════════════════════════
// STEP 8 — Housekeeping Limits (full replace)
// ════════════════════════════════════════
router.put("/limits", isAdmin, async (req, res) => {
  const { itemLimits } = req.body;
  if (!Array.isArray(itemLimits)) return res.status(400).json({ error: "itemLimits must be an array" });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { itemLimits }, { new: true, upsert: true }
  );
  res.json(config.itemLimits);
});

// ════════════════════════════════════════
// STEP 9 — Bot Persona
// ════════════════════════════════════════
router.put("/persona", isAdmin, async (req, res) => {
  const fields = ["botName","botRole","botVoice","botLanguage","customGreeting","customInstructions"];
  const updates = {};
  fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, updates, { new: true, upsert: true }
  );
  res.json({ botName: config.botName, botRole: config.botRole, botVoice: config.botVoice, botLanguage: config.botLanguage, customGreeting: config.customGreeting, customInstructions: config.customInstructions });
});

// ════════════════════════════════════════
// Mark setup complete
// ════════════════════════════════════════
router.post("/complete", isAdmin, async (req, res) => {
  const config = await HotelConfig.findOneAndUpdate(
    { tenantId: tid(req) }, { setupCompleted: true, setupStep: 9 }, { new: true, upsert: true }
  );
  res.json({ setupCompleted: config.setupCompleted });
});

// ════════════════════════════════════════
// KNOWLEDGE BASE — CRUD
// ════════════════════════════════════════

// GET all entries
router.get("/kb", isManager, async (req, res) => {
  const { category } = req.query;
  const filter = { tenantId: tid(req) };
  if (category) filter.category = category;
  const entries = await KnowledgeBase.find(filter).sort({ priority: -1, createdAt: -1 });
  res.json(entries);
});

// POST new entry
router.post("/kb", isAdmin, async (req, res) => {
  const { question, answer, category, priority } = req.body;
  if (!question || !answer) return res.status(400).json({ error: "question and answer required" });

  const entry = await KnowledgeBase.create({
    tenantId: tid(req), question, answer,
    category: category || "General",
    priority: priority || 0,
  });
  res.status(201).json(entry);
});

// PUT update entry
router.put("/kb/:id", isAdmin, async (req, res) => {
  const entry = await KnowledgeBase.findOneAndUpdate(
    { _id: req.params.id, tenantId: tid(req) },
    req.body,
    { new: true }
  );
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json(entry);
});

// DELETE entry
router.delete("/kb/:id", isAdmin, async (req, res) => {
  await KnowledgeBase.findOneAndDelete({ _id: req.params.id, tenantId: tid(req) });
  res.json({ message: "Deleted" });
});

// ════════════════════════════════════════
// REPLY TEMPLATES — CRUD
// ════════════════════════════════════════

// GET all templates
router.get("/templates", isManager, async (req, res) => {
  const config = await getOrCreate(tid(req));
  res.json(config.replyTemplates || []);
});

// POST new template
router.post("/templates", isAdmin, async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });

  const config = await getOrCreate(tid(req));
  config.replyTemplates.push({ title, content, category: category || "General" });
  await config.save();
  res.status(201).json(config.replyTemplates[config.replyTemplates.length - 1]);
});

// PUT update template
router.put("/templates/:id", isAdmin, async (req, res) => {
  const config = await getOrCreate(tid(req));
  const tmpl = config.replyTemplates.id(req.params.id);
  if (!tmpl) return res.status(404).json({ error: "Template not found" });

  const { title, content, category, active } = req.body;
  if (title    !== undefined) tmpl.title    = title;
  if (content  !== undefined) tmpl.content  = content;
  if (category !== undefined) tmpl.category = category;
  if (active   !== undefined) tmpl.active   = active;

  await config.save();
  res.json(tmpl);
});

// DELETE template
router.delete("/templates/:id", isAdmin, async (req, res) => {
  const config = await getOrCreate(tid(req));
  config.replyTemplates.pull({ _id: req.params.id });
  await config.save();
  res.json({ message: "Deleted" });
});

// GET prompt preview — what the bot will actually use
router.get("/prompt-preview", isAdmin, async (req, res) => {
  const config = await HotelConfig.findOne({ tenantId: tid(req) });
  const kb = await KnowledgeBase.find({ tenantId: tid(req), active: true }).sort({ priority: -1 });
  if (!config) return res.json({ prompt: "No configuration yet." });

  const { buildSystemPromptFromConfig } = require("../utils/promptBuilder");
  const prompt = buildSystemPromptFromConfig(config, kb);
  res.json({ prompt, length: prompt.length });
});

module.exports = router;
