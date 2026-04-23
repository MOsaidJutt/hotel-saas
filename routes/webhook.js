const router   = require("express").Router();
const axios    = require("axios");
const OpenAI   = require("openai");
const Tenant   = require("../models/Tenant");
const Department     = require("../models/Department");
const Conversation   = require("../models/Conversation");
const ServiceRequest = require("../models/ServiceRequest");
const HotelConfig    = require("../models/HotelConfig");
const KnowledgeBase  = require("../models/KnowledgeBase");
const { buildSystemPromptFromConfig } = require("../utils/promptBuilder");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── In-memory response time store (lightweight — not persisted)
const responseTimes = {}; // tenantSlug → []

// ─── Green API send
async function sendMessage(idInstance, apiTokenInstance, chatId, message) {
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
  await axios.post(url, { chatId, message }, { timeout: 10000 });
}

// ─── Build system prompt from DB config (per tenant)
async function buildSystemPrompt(tenant) {
  const [config, kb] = await Promise.all([
    HotelConfig.findOne({ tenantId: tenant._id }),
    KnowledgeBase.find({ tenantId: tenant._id, active: true }).sort({ priority: -1 }),
  ]);

  // Fall back to tenant persona if no full config yet
  if (!config || !config.setupCompleted) {
    const persona   = tenant.botPersona || {};
    const botName   = persona.name      || "Alex";
    const botRole   = persona.role      || "Senior Front Desk Executive";
    const hotelName = persona.hotelName || tenant.name;
    const minimal   = { botName, botRole, hotelName, botVoice: "Calm, warm, confident" };
    if (config) Object.assign(minimal, config.toObject());
    return buildSystemPromptFromConfig(minimal, kb);
  }

  return buildSystemPromptFromConfig(config, kb);
}

// ─── Build GPT message history from conversation
function buildGptHistory(conv, maxMessages = 24) {
  return conv.messages.slice(-maxMessages).map(m => ({
    role: m.from === "guest" ? "user" : "assistant",
    content: m.text,
  }));
}

// ─── Ask AI
async function askAI(conv, systemPrompt, slug) {
  const history = buildGptHistory(conv);
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...history],
  });

  const elapsed = parseFloat(((Date.now() - start) / 1000).toFixed(2));
  if (!responseTimes[slug]) responseTimes[slug] = [];
  responseTimes[slug].push(elapsed);
  if (responseTimes[slug].length > 200) responseTimes[slug].shift();

  const reply = response.choices[0].message.content;
  conv.awaitingReply = reply.includes("?");
  return reply;
}

// ─── Main menu builder
function mainMenu(tenant) {
  const hotelName = tenant.botPersona?.hotelName || tenant.name;
  return (
    `🏨 *${hotelName.toUpperCase()}*\n` +
    `_Your Smart Business Hotel · 24/7 Service_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛎 *Quick Services*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣  Reception Help\n` +
    `2️⃣  Room Service Order\n` +
    `3️⃣  Housekeeping Request\n` +
    `4️⃣  Taxi / Concierge\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📖 *Hotel Information*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `5️⃣   Hotel Overview\n` +
    `6️⃣   Check-in & Check-out\n` +
    `7️⃣   Room Types\n` +
    `8️⃣   Room Facilities\n` +
    `9️⃣   Hotel Facilities\n` +
    `🔟  Room Service Menu\n` +
    `1️⃣1️⃣  Housekeeping Services\n` +
    `1️⃣2️⃣  Concierge Services\n` +
    `1️⃣3️⃣  Spa & Wellness\n` +
    `1️⃣4️⃣  Fitness Center\n` +
    `1️⃣5️⃣  Additional Services\n` +
    `1️⃣6️⃣  Hotel Policies\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💬 _Type a number or just ask me anything_ 😊`
  );
}

// ─── Static replies (shared across all tenants — hotel info is persona-neutral)
const STATIC_REPLIES = {
  "1":  "Of course! How can I assist you today? Feel free to ask me anything about your stay, the hotel, or any services you need. 😊",
  "2":  "I'd be happy to take your order! 🍽\n\nWe have Chicken Biryani, Beef Steak, Pasta Alfredo, Margherita Pizza, Club Sandwich, Grilled Fish, Burger & Fries, and more — plus desserts and a full drinks menu.\n\nWhat would you like, and may I have your room number?",
  "3":  "Of course! What can I arrange for you? Whether it's extra towels, fresh pillows, a bedsheet change, or a full room clean — just let me know. And may I have your room number? 🧹",
  "4":  "Happy to help with that! 🚕 Could you share your pickup time and destination, and I'll get that arranged for you straight away?",
  "5":  "We're a modern smart business hotel designed for comfort and convenience. Our team is available 24/7 and we pride ourselves on personalised service. Is there anything specific you'd like to know?",
  "6":  "🕒 Check-in is from *2:00 PM* and check-out is by *12:00 PM*.\n\nEarly check-in and late check-out are available subject to room availability — just let me know!",
  "7":  "🛏 We have four room categories:\n\n• *Standard Room* — comfortable and well-equipped\n• *Deluxe Room* — extra space and premium touches\n• *Executive Suite* — ideal for business travellers\n• *Family Suite* — perfect for families\n\nWould you like more details?",
  "8":  "🛋 Every room comes with: Free High-Speed WiFi, Smart TV, Air Conditioning, Mini Bar, Electric Kettle, Safe Locker, Work Desk, Hair Dryer, and Complimentary Toiletries — plus 24/7 Room Service. Anything specific?",
  "9":  "🏢 On-site facilities:\n\n• Restaurant (7 AM – 11 PM)\n• Coffee Lounge (24/7)\n• Spa & Wellness (10 AM – 8 PM)\n• Gym (24/7)\n• Swimming Pool (6 AM – 10 PM)\n• Laundry (8 AM – 8 PM)\n• Business Center (24/7)\n• Conference Rooms\n• Valet Parking & Airport Shuttle\n\nAnything you'd like to book?",
  "10": "🍽 Room Service Menu:\n\n*Food:* Chicken Biryani, Beef Steak, Pasta Alfredo, Margherita Pizza, Club Sandwich, Caesar Salad, Grilled Fish, Fried Rice, Burger & Fries, Vegetable Curry\n\n*Desserts:* Chocolate Cake, Ice Cream, Fruit Bowl\n\n*Drinks:* Tea, Coffee, Soft Drinks, Fresh Juices, Milkshakes, Mineral Water\n\nWhat can I get for you? 😊",
  "11": "Our housekeeping team can help with:\n\n🧹 Room Cleaning • Extra Towels • Extra Pillows • Bedsheet Change • Toiletries Refill\n\nWhat do you need, and may I have your room number?",
  "12": "🚕 Concierge can arrange:\n\n• Taxi Booking\n• Airport Pickup & Drop\n• Tour Guide\n• Car Rental\n• Restaurant Reservations\n• Event Bookings\n\nWhat would you like?",
  "13": "💆 Spa & Wellness: Full Body Massages, Aromatherapy, Facial Treatments, and Steam Bath.\n\nOpen *10 AM – 8 PM*. Would you like to book a session?",
  "14": "🏋️ Fitness Center is open *24/7* — Treadmills, Free Weights, Yoga Mats, Personal Trainer on request.\n\nAnything else I can help with?",
  "15": "Additional services:\n\n📞 Wake-up Call • Doctor on Call • Babysitting • Currency Exchange • Printing & Photocopy\n\nWhich do you need?",
  "16": "📜 Hotel Policies:\n\n• No smoking in rooms\n• Pets not permitted\n• Visitors must register at reception\n• Quiet hours after 10 PM\n• Lost & Found at reception\n\nAny questions?",
};

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── POST /webhook/:slug
router.post("/:slug", async (req, res) => {
  res.sendStatus(200); // respond immediately

  const { slug } = req.params;
  const body = req.body;

  if (body?.typeWebhook !== "incomingMessageReceived") return;

  let chatId  = body?.senderData?.chatId;
  const textRaw = body?.messageData?.textMessageData?.textMessage;
  if (!chatId || !textRaw) return;

  chatId = chatId.replace("@s.whatsapp.net", "@c.us");
  const text = textRaw.trim().toLowerCase();
  const ts = nowTime();

  // ── Load tenant
  const tenant = await Tenant.findOne({ slug, status: { $in: ["active", "trial"] } });
  if (!tenant) return console.warn(`⚠️  Webhook for unknown/inactive tenant: ${slug}`);

  const { idInstance, apiTokenInstance } = tenant.greenApi;
  if (!idInstance || !apiTokenInstance) return;

  console.log(`📩 [${slug}][${ts}] ${chatId}: ${text}`);

  // ── Update tenant request counter
  await Tenant.findByIdAndUpdate(tenant._id, { $inc: { "stats.totalRequests": 1 } });

  // ── Load departments for this tenant (for dynamic keyword routing)
  const departments = await Department.find({ tenantId: tenant._id, active: true }).sort({ menuOrder: 1 });

  // ── Upsert conversation
  let conv = await Conversation.findOne({ tenantId: tenant._id, chatId });
  if (!conv) {
    conv = await Conversation.create({
      tenantId: tenant._id,
      chatId,
      phone: chatId.replace("@c.us", ""),
      guestLabel: `Guest ···${chatId.replace("@c.us", "").slice(-4)}`,
      isNew: true,
      awaitingReply: false,
    });
    await Tenant.findByIdAndUpdate(tenant._id, { $inc: { "stats.totalConversations": 1 } });
  }

  // If human has taken over → skip all bot logic
  if (conv.humanMode) {
    conv.messages.push({ from: "guest", text: textRaw, time: ts });
    conv.lastMessage = textRaw;
    conv.updatedAt = new Date();
    await conv.save();
    // Socket.io update emitted from server.js via global io instance
    if (global.io) global.io.to(`tenant:${tenant._id}`).emit("liveUpdate", { type: "message", chatId });
    return;
  }

  // Push guest message
  conv.messages.push({ from: "guest", text: textRaw, time: ts });
  conv.lastMessage = textRaw;
  conv.status = "Active";
  conv.updatedAt = new Date();

  const systemPrompt = await buildSystemPrompt(tenant);

  async function reply(text, countAI = true) {
    await sendMessage(idInstance, apiTokenInstance, chatId, text);
    conv.messages.push({ from: "ai", text, time: ts });
    conv.lastMessage = `[Bot] ${text.slice(0, 60)}`;
    if (countAI) await Tenant.findByIdAndUpdate(tenant._id, { $inc: { "stats.aiResponses": 1 } });
    await conv.save();
    if (global.io) global.io.to(`tenant:${tenant._id}`).emit("liveUpdate", await buildTenantSnapshot(tenant._id));
  }

  // ── 1. Explicit menu
  if (text === "menu") {
    conv.awaitingReply = false;
    await reply(mainMenu(tenant));
    return;
  }

  // ── 2. Awaiting reply → full GPT
  if (conv.awaitingReply) {
    try {
      const aiReply = await askAI(conv, systemPrompt, slug);
      await reply(aiReply, false);
      await Tenant.findByIdAndUpdate(tenant._id, { $inc: { "stats.aiResponses": 1 } });

      // Room number provided → update pending service request
      if (conv.pendingService?.reqId) {
        const roomMatch = textRaw.match(/\b(\d{1,4})\b/);
        if (roomMatch) {
          await ServiceRequest.findOneAndUpdate(
            { tenantId: tenant._id, reqId: conv.pendingService.reqId },
            { roomNumber: roomMatch[1], status: "In Progress" }
          );
          conv.pendingService = { dept: null, type: null, reqId: null };
          conv.roomNumber = roomMatch[1]; // store on conversation too
          await conv.save();
          // Re-emit snapshot now that roomNumber is saved
          if (global.io) global.io.to(`tenant:${tenant._id}`).emit("liveUpdate", await buildTenantSnapshot(tenant._id));
        }
      }
    } catch (err) {
      console.error("❌ AI error:", err.message);
      await sendMessage(idInstance, apiTokenInstance, chatId,
        "I'm so sorry — I seem to be having a brief technical hiccup. Please give me just a moment and try again.");
    }
    return;
  }

  // ── 3. Greeting
  if (["hi", "hello", "hey", "start", "hii", "helo"].includes(text)) {
    const msg = conv.isNew
      ? (conv.isNew = false, mainMenu(tenant))
      : "Welcome back! 😊 Great to hear from you again. How can I assist you today? Type *menu* anytime to see all options.";
    conv.awaitingReply = false;
    await reply(msg);
    return;
  }

  // ── 4. Static menu shortcuts
  if (STATIC_REPLIES[text]) {
    conv.awaitingReply = ["2", "3", "4"].includes(text);
    await reply(STATIC_REPLIES[text]);
    return;
  }

  // ── 5. Dynamic department keyword detection
  const matchedDept = departments.find(dept =>
    dept.keywords.some(k => text.includes(k.toLowerCase()))
  );

  if (matchedDept) {
    // Generate request ID
    const reqCount = await ServiceRequest.countDocuments({ tenantId: tenant._id });
    const reqId = `REQ-${String(reqCount + 1).padStart(4, "0")}`;

    await ServiceRequest.create({
      tenantId: tenant._id,
      departmentId: matchedDept._id,
      departmentName: matchedDept.name,
      reqId,
      chatId,
      guestLabel: conv.guestLabel,
      type: textRaw.slice(0, 80),
      status: "New",
      time: ts,
    });

    conv.pendingService = { dept: matchedDept.name, type: textRaw, reqId };
    conv.awaitingReply = true;

    await reply(`Of course! I'll get that arranged for you right away. 😊\n\nCould I have your *room number* please?`);
    return;
  }

  // ── 6. Free-form → GPT
  try {
    const aiReply = await askAI(conv, systemPrompt, slug);
    await reply(aiReply, false);
    await Tenant.findByIdAndUpdate(tenant._id, { $inc: { "stats.aiResponses": 1 } });
  } catch (err) {
    console.error("❌ AI error:", err.message);
    await sendMessage(idInstance, apiTokenInstance, chatId,
      "I'm so sorry about that — I seem to be having a brief technical hiccup. Please give me just a moment and try again.");
  }
});

// ─── Build snapshot for Socket.io live update
async function buildTenantSnapshot(tenantId) {
  const [tenant, convs, requests] = await Promise.all([
    Tenant.findById(tenantId).lean(),
    Conversation.find({ tenantId }).sort({ updatedAt: -1 }).limit(30).select("-messages").lean(),
    ServiceRequest.find({ tenantId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const activeConvs  = convs.filter(c => c.status !== "Completed").length;
  const completedReqs = requests.filter(r => r.status === "Completed").length;

  return {
    stats: {
      totalRequests: tenant?.stats?.totalRequests || 0,
      activeConversations: activeConvs,
      aiResponses: tenant?.stats?.aiResponses || 0,
      completedRequests: completedReqs,
    },
    conversations: convs,
    requests,
  };
}

module.exports = router;
module.exports.buildTenantSnapshot = buildTenantSnapshot;
