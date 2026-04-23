const mongoose = require("mongoose");

// Each entry is a Q&A pair that gets injected into the system prompt
const knowledgeBaseSchema = new mongoose.Schema(
  {
    tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    question:  { type: String, required: true },   // "What time is breakfast served?"
    answer:    { type: String, required: true },   // "Breakfast is served from 7 AM to 10:30 AM in The Garden Restaurant."
    category:  { type: String, default: "General" }, // "F&B" | "Rooms" | "Spa" | "General"
    active:    { type: Boolean, default: true },
    priority:  { type: Number, default: 0 },       // higher = appears earlier in prompt
  },
  { timestamps: true }
);

knowledgeBaseSchema.index({ tenantId: 1, active: 1 });

module.exports = mongoose.model("KnowledgeBase", knowledgeBaseSchema);
