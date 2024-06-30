const express = require("express");
const router = express.Router();
const mysqlConnection = require("../dbConnection");
const { authenticateToken } = require("../middleware");
const bcrypt = require("bcryptjs");
const util = require("util");

// Promisify the mysqlConnection.query method
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

router.get("/bids-total", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT SUM(bid_amount) AS total_bids
      FROM bids
      WHERE user_id = ?
    `;
    const results = await query(sql, [userId]);
    const totalBids = results[0].total_bids || 0;
    res.status(200).json({ total_bids: totalBids });
  } catch (error) {
    console.error("Error fetching total bids:", error);
    res
      .status(500)
      .json({ message: "Error fetching total bids", error: error.message });
  }
});

// Get user cart items
router.get("/cart", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT c.id, a.name, a.description, a.current_bid_amount
      FROM cart c
      JOIN auctions a ON c.auction_id = a.id
      WHERE c.user_id = ?
    `;
    const cartItems = await query(sql, [userId]);
    res.status(200).json(cartItems);
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res
      .status(500)
      .json({ message: "Error fetching cart items", error: error.message });
  }
});

// Get all bids placed by the user
router.get("/bids", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT b.id, b.auction_id, b.bid_amount, b.bid_time, a.name AS auction_name
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.user_id = ?
      ORDER BY b.bid_time DESC
    `;
    const bids = await query(sql, [userId]);
    res.status(200).json(bids);
  } catch (error) {
    console.error("Error fetching user bids:", error);
    res
      .status(500)
      .json({ message: "Error fetching user bids", error: error.message });
  }
});

// Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql =
      "SELECT id, full_name, username, email, profile, bid_points, created_at FROM users WHERE id = ?";
    const userProfile = await query(sql, [userId]);
    res.status(200).json(userProfile[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res
      .status(500)
      .json({ message: "Error fetching user profile", error: error.message });
  }
});

// Update user profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, username, email, profile } = req.body;

    // Validate input
    if (!full_name || !username || !email) {
      return res
        .status(400)
        .json({ message: "Full name, username, and email are required" });
    }

    const sql =
      "UPDATE users SET full_name = ?, username = ?, email = ?, profile = ? WHERE id = ?";
    await query(sql, [full_name, username, email, profile, userId]);

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res
      .status(500)
      .json({ message: "Error updating user profile", error: error.message });
  }
});

// Delete a user
router.delete("/delete", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Get the user's current hashed password
    const userSql = "SELECT password FROM users WHERE id = ?";
    const userResults = await query(userSql, [userId]);
    const user = userResults[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare the provided password with the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Delete the user
    const deleteSql = "DELETE FROM users WHERE id = ?";
    await query(deleteSql, [userId]);

    res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error("Error deleting user account:", error);
    res
      .status(500)
      .json({ message: "Error deleting user account", error: error.message });
  }
});

module.exports = router;
