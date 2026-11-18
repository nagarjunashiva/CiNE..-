const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware, JWT_SECRET } = require("../middleware/auth");
const { sendVerificationOtp, sendWelcomeEmail, sendPasswordResetOtp } = require("../utils/mailer");

const mongoose = require("mongoose");
const router = express.Router();

// Middleware: Verify MongoDB connection before database operations
router.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    // Wait briefly if it's connecting
    for (let i = 0; i < 20; i++) {
      if (mongoose.connection.readyState === 1) break;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Cloud database connecting or unavailable. Please try again in a few seconds."
    });
  }
  next();
});

// Helper: Generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ============================================================
   1. REGISTER (Sends verification OTP via nodemailer)
============================================================ */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });

    // If already verified, reject
    if (existing && existing.isVerified) {
      return res.status(400).json({ success: false, message: "An account with this email already exists. Please sign in." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    let user = existing;
    if (user) {
      // Update unverified user with new credentials and new OTP
      user.name = name.trim();
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // Create new user record
      user = new User({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        isVerified: false,
        otp,
        otpExpires
      });
      await user.save();
    }

    // Send verification email via Nodemailer (with resilient fallback)
    let mailResult = { previewUrl: null };
    try {
      mailResult = await sendVerificationOtp(cleanEmail, user.name, otp);
    } catch (mailErr) {
      console.warn(`[Mailer Error] Could not dispatch email via SMTP: ${mailErr.message}`);
      console.log(`\n========================================`);
      console.log(`[CiNE OTP DISPATCH FALLBACK]`);
      console.log(`TO: ${cleanEmail} (${user.name})`);
      console.log(`OTP CODE: ${otp}`);
      console.log(`NOTE: SMTP Relay returned: ${mailErr.message}`);
      console.log(`========================================\n`);
    }

    return res.status(201).json({
      success: true,
      message: "Verification code sent to " + cleanEmail,
      email: cleanEmail,
      previewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error("[Register Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
});

/* ============================================================
   2. VERIFY OTP (Completes registration & logs in)
============================================================ */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP code are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    if (user.isVerified) {
      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        success: true,
        message: "Account already verified",
        token,
        user: user.toSafeObject()
      });
    }

    if (!user.otp || user.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: "Invalid verification code. Please check and try again." });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new code." });
    }

    // Mark verified
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Send Welcome Email
    sendWelcomeEmail(cleanEmail, user.name).catch(() => {});

    // Issue JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: "Email verified successfully! Welcome to CiNE.",
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error("[Verify OTP Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Verification failed" });
  }
});

/* ============================================================
   3. RESEND OTP
============================================================ */
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    let mailResult = { previewUrl: null };
    try {
      mailResult = await sendVerificationOtp(cleanEmail, user.name, otp);
    } catch (mailErr) {
      console.warn(`[Mailer Error] Resend OTP via SMTP failed: ${mailErr.message}`);
      console.log(`\n========================================`);
      console.log(`[CiNE OTP RESEND FALLBACK]`);
      console.log(`TO: ${cleanEmail}`);
      console.log(`NEW OTP CODE: ${otp}`);
      console.log(`========================================\n`);
    }

    return res.json({
      success: true,
      message: "A new verification code has been sent to " + cleanEmail,
      previewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error("[Resend OTP Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to resend code" });
  }
});

/* ============================================================
   4. LOGIN
============================================================ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    // If user has not verified their email, request OTP
    if (!user.isVerified) {
      const otp = generateOtp();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      const mailResult = await sendVerificationOtp(cleanEmail, user.name, otp);

      return res.status(403).json({
        success: false,
        requireOtp: true,
        email: cleanEmail,
        message: "Please verify your email before signing in. A new verification code was sent to " + cleanEmail,
        previewUrl: mailResult.previewUrl
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error("[Login Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Sign in failed" });
  }
});

/* ============================================================
   5. FORGOT PASSWORD (Sends password reset OTP)
============================================================ */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Don't leak user existence
      return res.json({ success: true, message: "If an account exists with that email, a password reset code was sent." });
    }

    const otp = generateOtp();
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    let mailResult = { previewUrl: null };
    try {
      mailResult = await sendPasswordResetOtp(cleanEmail, user.name, otp);
    } catch (mailErr) {
      console.warn(`[Mailer Error] Reset code via SMTP failed: ${mailErr.message}`);
      console.log(`\n========================================`);
      console.log(`[CiNE PASSWORD RESET FALLBACK]`);
      console.log(`TO: ${cleanEmail}`);
      console.log(`RESET CODE: ${otp}`);
      console.log(`========================================\n`);
    }

    return res.json({
      success: true,
      message: "Password reset code sent to " + cleanEmail,
      email: cleanEmail,
      previewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error("[Forgot Password Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to send reset code" });
  }
});

/* ============================================================
   6. RESET PASSWORD
============================================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, code and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.resetOtp || user.resetOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: "Invalid or expired password reset code." });
    }

    if (new Date() > new Date(user.resetOtpExpires)) {
      return res.status(400).json({ success: false, message: "Reset code has expired. Please request a new one." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.isVerified = true; // Auto-verify if they reset password successfully
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password."
    });
  } catch (err) {
    console.error("[Reset Password Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Password reset failed" });
  }
});

/* ============================================================
   7. GET CURRENT USER PROFILE (Authenticated)
============================================================ */
router.get("/me", authMiddleware, async (req, res) => {
  return res.json({
    success: true,
    user: req.user.toSafeObject()
  });
});

/* ============================================================
   8. WATCHLIST SYNC (MongoDB Persisted Watchlist)
============================================================ */
router.get("/watchlist", authMiddleware, async (req, res) => {
  return res.json({
    success: true,
    watchlist: req.user.watchlist || []
  });
});

router.post("/watchlist/toggle", authMiddleware, async (req, res) => {
  try {
    const movie = req.body;
    if (!movie || !movie.id) {
      return res.status(400).json({ success: false, message: "Movie data with ID required" });
    }

    const user = req.user;
    const idx = (user.watchlist || []).findIndex(item => item.id === movie.id);

    let action = "added";
    if (idx >= 0) {
      user.watchlist.splice(idx, 1);
      action = "removed";
    } else {
      user.watchlist.unshift({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        poster: movie.poster,
        backdrop: movie.backdrop
      });
      action = "added";
    }

    await user.save();

    return res.json({
      success: true,
      action,
      watchlist: user.watchlist,
      count: user.watchlist.length
    });
  } catch (err) {
    console.error("[Watchlist Toggle Error]", err);
    return res.status(500).json({ success: false, message: "Failed to update watchlist" });
  }
});

/* ============================================================
   9. SOCIAL LOGIN (Google / Gmail, Facebook, Twitter)
============================================================ */
router.post("/social-login", async (req, res) => {
  try {
    const { provider, email, name, avatar, providerId } = req.body;

    if (!provider || !["google", "facebook", "twitter"].includes(provider)) {
      return res.status(400).json({ success: false, message: "Valid provider (google, facebook, twitter) required" });
    }

    if (!email && !providerId && !name) {
      return res.status(400).json({ success: false, message: "User identity information required" });
    }

    const cleanEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : `${(name || provider).toLowerCase().replace(/[^a-z0-9]/g, "")}_${(providerId || Date.now()).toString().slice(-6)}@${provider}.oauth`;

    let user = await User.findOne({
      $or: [
        { email: cleanEmail },
        ...(providerId ? [{ provider, providerId }] : [])
      ]
    });

    if (user) {
      user.provider = provider;
      if (providerId) user.providerId = providerId;
      if (avatar && !user.avatar) user.avatar = avatar;
      user.isVerified = true;
      await user.save();
    } else {
      const crypto = require("crypto");
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        name: name || (provider === "google" ? "Google User" : provider === "facebook" ? "Facebook User" : "Twitter User"),
        email: cleanEmail,
        password: hashedPassword,
        provider,
        providerId: providerId || `${provider}_${Date.now()}`,
        avatar: avatar || null,
        isVerified: true
      });

      await user.save();

      // Send a welcome email via Gmail SMTP if it's a real email address
      if (cleanEmail.includes("@") && !cleanEmail.endsWith(".oauth")) {
        try {
          await sendWelcomeEmail(user.email, user.name);
        } catch (mailErr) {
          console.warn("[Mailer] Social welcome email:", mailErr.message);
        }
      }
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: `Successfully connected with ${provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "Twitter"}!`,
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error("[Social Login Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Social login failed" });
  }
});

module.exports = router;
