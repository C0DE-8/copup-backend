const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mysqlConnection = require("../dbConnection"); // Your MySQL connection setup

// Promisify the mysqlConnection.query method
const util = require("util");
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

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
    const emailCheck = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Save OTP to the database
    await query("INSERT INTO otps (email, otp) VALUES (?, ?) ON DUPLICATE KEY UPDATE otp = ?", [email, otp, otp]);

    // Send OTP to the user's email
    await sendEmail(email, "Your OTP for registration", `Your OTP is ${otp}`);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

// Register route
router.post("/register", async (req, res) => {
  try {
    const { username, email, profile, full_name, password, otp } = req.body;

    // Check if OTP matches the one sent to the user (validate OTP)
    const otpResult = await query("SELECT * FROM otps WHERE email = ? AND otp = ?", [email, otp]);
    const validOtp = otpResult.length > 0;

    if (!validOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const sql = "INSERT INTO users (username, email, profile, full_name, password, is_verified) VALUES (?, ?, ?, ?, ?, ?)";
    await query(sql, [username, email, profile, full_name, hashedPassword, true]);

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
      return res.status(401).json({ message: "Invalid credentials or email not verified" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.isAdmin },
      "your-secret-key",
      { expiresIn: "1h" }
    );
    res.status(200).json({ token, user: { id: user.id, role: user.isAdmin } });
  } catch (error) {
    res.status(500).json({ message: "Error logging in" });
  }
});

module.exports = router;
