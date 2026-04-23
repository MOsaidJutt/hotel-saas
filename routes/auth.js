const router = require("express").Router();
const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const { authenticate } = require("../middleware/auth");

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !user.active) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  res.json({
    token,
    user: {
      id:       user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId,
    },
  });
});

// GET /api/auth/me  — verify token and return current user
router.get("/me", authenticate, async (req, res) => {
  // Optionally populate tenant info
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("tenantId", "name slug plan status botPersona primaryColor greenApi.instanceState greenApi.phoneNumber")
    .lean();
  res.json(user);
});

// POST /api/auth/logout  — client-side token deletion, server just confirms
router.post("/logout", authenticate, (req, res) => {
  res.json({ message: "Logged out" });
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await User.findById(req.user._id).select("+password");
  const valid = await user.comparePassword(currentPassword);
  if (!valid) return res.status(400).json({ error: "Current password incorrect" });

  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated" });
});

module.exports = router;
