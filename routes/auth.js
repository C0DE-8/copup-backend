const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mysqlConnection = require("../dbConnection"); // Your MySQL connection setup

// Promisify the mysqlConnection.query method
const util = require("util");
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8);
};

// Email setup
const transporter = nodemailer.createTransport({
  host: "mail.copupbid.top",
  port: 465,
  secure: true,
  auth: {
    user: "info@copupbid.top",
    pass: "@12345678",
  },
});

const sendEmail = (to, subject, text) => {
  const mailOptions = {
    from: "info@copupbid.top",
    to,
    subject,
    text,
  };
  return transporter.sendMail(mailOptions);
};

// Send OTP route
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists in users table
    const emailCheck = await query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Set expiration time to 10 minutes from now

    // Save OTP to the database with expiration time
    await query(
      "INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?",
      [email, otp, expiresAt, otp, expiresAt]
    );

    // Send OTP to the user's email
    await sendEmail(email, "Your OTP for registration", `Your OTP is ${otp}`);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

// Register route
// Register route
router.post("/register", async (req, res) => {
  try {
    const { username, email, profile, full_name, password, otp, referralCode } =
      req.body;

    // Check if the email already exists
    const emailCheck = await query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Check if the username already exists
    const usernameCheck = await query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (usernameCheck.length > 0) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Check if the full name already exists
    const fullNameCheck = await query(
      "SELECT * FROM users WHERE full_name = ?",
      [full_name]
    );
    if (fullNameCheck.length > 0) {
      return res.status(400).json({ message: "Full name already exists" });
    }

    // Check if OTP matches the one sent to the user and is not expired
    const otpResult = await query(
      "SELECT * FROM otps WHERE email = ? AND otp = ?",
      [email, otp]
    );
    if (otpResult.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const otpRecord = otpResult[0];
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a unique referral code for the new user
    const userReferralCode = generateReferralCode();

    // Insert user into the database
    const sql =
      "INSERT INTO users (username, email, profile, full_name, password, referral_code, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const result = await query(sql, [
      username,
      email,
      profile,
      full_name,
      hashedPassword,
      userReferralCode,
      true,
    ]);

    // If a referral code was used, record the referral
    if (referralCode) {
      const referrerSql = "SELECT id FROM users WHERE referral_code = ?";
      const referrerResult = await query(referrerSql, [referralCode]);

      if (referrerResult.length > 0) {
        const referrerId = referrerResult[0].id;
        const referredId = result.insertId;

        const referralSql =
          "INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)";
        await query(referralSql, [referrerId, referredId]);
      }
    }

    // Delete the OTP entry from the database after successful registration
    await query("DELETE FROM otps WHERE email = ?", [email]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    const results = await query(sql, [email]);
    const user = results[0];

    if (!user || !user.is_verified) {
      return res
        .status(401)
        .json({ message: "Invalid credentials or email not verified" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.isAdmin },
      "your-secret-key"
    );
    res.status(200).json({ token, user: { id: user.id, role: user.isAdmin } });
  } catch (error) {
    res.status(500).json({ message: "Error logging in" });
  }
});

// Forget password route with OTP
router.post("/forget-password", async (req, res) => {
  try {
    const { email } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";
    const results = await query(sql, [email]);
    const user = results[0];

    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Save OTP to the database
    await query(
      "INSERT INTO otps (email, otp) VALUES (?, ?) ON DUPLICATE KEY UPDATE otp = ?",
      [email, otp, otp]
    );

    // Send OTP to the user's email
    await sendEmail(email, "Your OTP for password reset", `Your OTP is ${otp}`);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

// Reset password route
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Check if OTP matches the one sent to the user (validate OTP)
    const otpResult = await query(
      "SELECT * FROM otps WHERE email = ? AND otp = ?",
      [email, otp]
    );
    const validOtp = otpResult.length > 0;

    if (!validOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    await query("UPDATE users SET password = ? WHERE email = ?", [
      hashedPassword,
      email,
    ]);

    // Delete the OTP entry from the database after successful password reset
    await query("DELETE FROM otps WHERE email = ?", [email]);

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

module.exports = router;
