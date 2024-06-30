const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysqlConnection = require("../dbConnection"); // Your MySQL connection setup

// Promisify the mysqlConnection.query method
const util = require("util");
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

// Routes
router.post("/register", async (req, res) => {
  try {
    const { username, email, profile, full_name, password } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const sql =
      "INSERT INTO users (username, email, profile, full_name, password) VALUES (?, ?, ?, ?, ?)";
    await query(sql, [username, email, profile, full_name, hashedPassword]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: "Error registering user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    const results = await query(sql, [email]);
    const user = results[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.isAdmin },
      "your-secret-key",
      { expiresIn: "10s" }
    );
    res.status(200).json({ token, user: { id: user.id, role: user.isAdmin } });
  } catch (error) {
    res.status(500).json({ message: "Error logging in" });
  }
});

module.exports = router;
