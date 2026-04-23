const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from:      { type: String, enum: ["guest", "ai", "human"], required: true },
    text:      { type: String, required: true },
    time:      { type: String },      // formatted display time "02:45 PM"
    staffId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // if from:"human"
    mediaUrl:  { type: String },      // image/voice note URL if applicable
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },

    // ── WhatsApp identity
    chatId:  { type: String, required: true },   // "923001234567@c.us"
    phone:   { type: String, default: "" },      // extracted phone number

    // ── Guest info
    guestName:   { type: String, default: "" },  // filled when guest provides name
    guestLabel:  { type: String, default: "" },  // "Guest ···4567" fallback
    roomNumber:  { type: String, default: "" },  // filled when provided

    // ── Status
    status: {
      type: String,
      enum: ["Active", "Waiting", "Escalated", "Completed"],
      default: "Active",
    },

    // ── Conversation engine state
    isNew:         { type: Boolean, default: true },   // first ever contact
    awaitingReply: { type: Boolean, default: false },  // bot asked a question
    pendingService: {                                   // waiting for room number
      dept:   { type: String, default: null },
      type:   { type: String, default: null },
      reqId:  { type: String, default: null },
    },

    // ── Human takeover
    assignedTo:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    humanMode:     { type: Boolean, default: false },  // true = bypass AI, human replies from dashboard

    // ── Messages
    messages: [messageSchema],

    lastMessage: { type: String, default: "" },
    updatedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

// Compound index — one conversation per chatId per tenant
conversationSchema.index({ tenantId: 1, chatId: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", conversationSchema);
