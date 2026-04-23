const mongoose = require("mongoose");

// ── Room type schema
const roomTypeSchema = new mongoose.Schema({
  name:         { type: String, required: true },   // "Deluxe Room"
  description:  { type: String, default: "" },
  maxGuests:    { type: Number, default: 2 },
  priceFrom:    { type: Number, default: 0 },
  amenities:    [String],                           // ["WiFi", "Mini Bar", "Sea View"]
  active:       { type: Boolean, default: true },
}, { _id: true });

// ── Menu item schema
const menuItemSchema = new mongoose.Schema({
  name:     { type: String, required: true },       // "Chicken Biryani"
  category: { type: String, default: "Food" },      // "Food" | "Desserts" | "Drinks"
  price:    { type: Number, default: 0 },
  description: { type: String, default: "" },
  available: { type: Boolean, default: true },
}, { _id: true });

// ── Facility schema
const facilitySchema = new mongoose.Schema({
  name:     { type: String, required: true },       // "Swimming Pool"
  hours:    { type: String, default: "" },          // "6 AM – 10 PM"
  description: { type: String, default: "" },
  active:   { type: Boolean, default: true },
}, { _id: true });

// ── Policy schema
const policySchema = new mongoose.Schema({
  title:   { type: String, required: true },        // "Smoking Policy"
  details: { type: String, required: true },        // "No smoking in rooms or public areas"
}, { _id: true });

// ── Reply template schema
const replyTemplateSchema = new mongoose.Schema({
  title:    { type: String, required: true },   // "Welcome Message"
  content:  { type: String, required: true },   // "Hello! Welcome to {hotel}."
  category: { type: String, default: "General" },
  active:   { type: Boolean, default: true },
}, { _id: true });

// ── Additional service schema
const additionalServiceSchema = new mongoose.Schema({
  name:        { type: String, required: true },    // "Wake-up Call"
  description: { type: String, default: "" },
  available:   { type: Boolean, default: true },
}, { _id: true });

// ── Pillow/towel limits per room type
const itemLimitSchema = new mongoose.Schema({
  roomType:    { type: String, required: true },    // "Standard Room"
  pillows:     { type: Number, default: 2 },
  towels:      { type: Number, default: 2 },
  toiletries:  { type: Number, default: 1 },        // sets
  bedsheets:   { type: Number, default: 1 },        // changes
}, { _id: true });

const hotelConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    // ── Step 1: Basic Info
    hotelName:    { type: String, default: "" },
    hotelType:    { type: String, default: "Smart Business Hotel" },
    address:      { type: String, default: "" },
    city:         { type: String, default: "" },
    country:      { type: String, default: "" },
    phone:        { type: String, default: "" },
    email:        { type: String, default: "" },
    website:      { type: String, default: "" },
    description:  { type: String, default: "" },    // shown when guest asks about hotel

    // ── Step 2: Check-in / Check-out
    checkInTime:   { type: String, default: "2:00 PM" },
    checkOutTime:  { type: String, default: "12:00 PM" },
    earlyCheckIn:  { type: String, default: "Subject to availability" },
    lateCheckOut:  { type: String, default: "Subject to availability, may incur extra charges" },
    receptionHours:{ type: String, default: "24/7" },

    // ── Step 3: Room Types
    roomTypes: [roomTypeSchema],

    // ── Step 4: Facilities
    facilities: [facilitySchema],

    // ── Step 5: Room Service Menu
    menuItems: [menuItemSchema],

    // ── Step 6: Policies
    policies: [policySchema],

    // ── Step 7: Additional Services
    additionalServices: [additionalServiceSchema],

    // ── Step 8: Housekeeping Limits
    itemLimits: [itemLimitSchema],

    // ── Step 9: Bot Persona
    botName:          { type: String, default: "Alex" },
    botRole:          { type: String, default: "Senior Front Desk Executive" },
    botVoice:         { type: String, default: "Calm, warm, confident, occasionally light-hearted" },
    botLanguage:      { type: String, default: "English" },
    customGreeting:   { type: String, default: "" },   // custom first message
    customInstructions: { type: String, default: "" }, // extra rules appended to prompt

    // ── Reply templates (for human takeover)
    replyTemplates: [replyTemplateSchema],

    // ── Setup completion tracking
    setupCompleted: { type: Boolean, default: false },
    setupStep:      { type: Number, default: 0 },      // which step they last completed
  },
  { timestamps: true }
);

module.exports = mongoose.model("HotelConfig", hotelConfigSchema);
