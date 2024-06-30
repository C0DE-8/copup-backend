const express = require("express");
const router = express.Router();
const mysqlConnection = require("../dbConnection");
const { authenticateToken, authenticateAdmin } = require("../middleware");
const util = require("util");

// Promisify the mysqlConnection.query method
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

// Get all users
router.get("/users", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const sql = "SELECT id, full_name, username, email, profile FROM users";
    const users = await query(sql);
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
});

// Get user by ID
router.get(
  "/users/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql =
        "SELECT id, full_name, username, email, profile FROM users WHERE id = ?";
      const users = await query(sql, [id]);
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json(users[0]);
    } catch (error) {
      console.error("Error fetching user:", error);
      res
        .status(500)
        .json({ message: "Error fetching user", error: error.message });
    }
  }
);

// Delete user by ID
router.delete(
  "/users/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = "DELETE FROM users WHERE id = ?";
      await query(sql, [id]);
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res
        .status(500)
        .json({ message: "Error deleting user", error: error.message });
    }
  }
);

// Get all auctions
router.get(
  "/auctions",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const sql = "SELECT * FROM auctions";
      const auctions = await query(sql);
      res.status(200).json(auctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res
        .status(500)
        .json({ message: "Error fetching auctions", error: error.message });
    }
  }
);

// Get auction by ID
router.get(
  "/auctions/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = "SELECT * FROM auctions WHERE id = ?";
      const auctions = await query(sql, [id]);
      if (auctions.length === 0) {
        return res.status(404).json({ message: "Auction not found" });
      }
      res.status(200).json(auctions[0]);
    } catch (error) {
      console.error("Error fetching auction:", error);
      res
        .status(500)
        .json({ message: "Error fetching auction", error: error.message });
    }
  }
);

// Delete auction by ID
router.delete(
  "/auctions/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = "DELETE FROM auctions WHERE id = ?";
      await query(sql, [id]);
      res.status(200).json({ message: "Auction deleted successfully" });
    } catch (error) {
      console.error("Error deleting auction:", error);
      res
        .status(500)
        .json({ message: "Error deleting auction", error: error.message });
    }
  }
);

// Get all bids for a specific auction
router.get(
  "/auctions/:id/bids",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = "SELECT * FROM bids WHERE auction_id = ?";
      const bids = await query(sql, [id]);
      res.status(200).json(bids);
    } catch (error) {
      console.error("Error fetching bids:", error);
      res
        .status(500)
        .json({ message: "Error fetching bids", error: error.message });
    }
  }
);

// Get total bid amount by each user
router.get(
  "/bids/total",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const sql = `
        SELECT u.id AS user_id, u.username, COALESCE(SUM(b.bid_amount), 0) AS total_bid_amount
        FROM users u
        LEFT JOIN bids b ON u.id = b.user_id
        GROUP BY u.id, u.username
        ORDER BY total_bid_amount DESC
      `;
      const totalBids = await query(sql);
      res.status(200).json(totalBids);
    } catch (error) {
      console.error("Error fetching total bid amounts:", error);
      res.status(500).json({
        message: "Error fetching total bid amounts",
        error: error.message,
      });
    }
  }
);
// all bids calculated
router.get(
  "/allValue",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const sql = `
        SELECT u.id AS user_id, u.username, COALESCE(u.bid_points, 0) AS total_bid_points
        FROM users u
        ORDER BY total_bid_points DESC
      `;
      const usersBidPoints = await query(sql);

      // Calculate the total value of bid points if needed
      const bidPointValue = 100; // Assuming each bid point is worth 100
      const usersBidPointsWithValue = usersBidPoints.map((user) => ({
        ...user,
        total_bid_value: user.total_bid_points * bidPointValue,
      }));

      res.status(200).json(usersBidPointsWithValue);
    } catch (error) {
      console.error("Error fetching users' bid points:", error);
      res.status(500).json({
        message: "Error fetching users' bid points",
        error: error.message,
      });
    }
  }
);


// Update auction by ID (Admin only)
router.put(
  "/update/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        entry_bid_points,
        end_date,
        image,
        minimum_users,
        category,
        status,
      } = req.body;

      if (!["cash", "product", "coupon"].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      if (!["pending", "active", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const sql = `
        UPDATE auctions
        SET name = ?, description = ?, entry_bid_points = ?, end_date = ?, image = ?, minimum_users = ?, category = ?, status = ?
        WHERE id = ?
      `;
      await query(sql, [
        name,
        description,
        entry_bid_points,
        end_date,
        image,
        minimum_users,
        category,
        status,
        id,
      ]);

      res.status(200).json({ message: "Auction updated successfully" });
    } catch (error) {
      console.error("Error updating auction:", error);
      res
        .status(500)
        .json({ message: "Error updating auction", error: error.message });
    }
  }
);

router.get(
  "/orders",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const sql = `
      SELECT 
        o.id AS order_id,
        o.user_id,
        u.username AS user_name,
        o.address,
        o.account_name,
        o.account_number,
        o.contact_info,
        oi.auction_id,
        a.name AS auction_name,
        a.description AS auction_description,
        a.current_bid_amount AS auction_current_bid_amount,
        a.category AS auction_category,
        o.status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN auctions a ON oi.auction_id = a.id
    `;
      const orders = await query(sql);

      res.status(200).json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res
        .status(500)
        .json({ message: "Error fetching orders", error: error.message });
    }
  }
);

// Route to update order status
router.put(
  "/orders/:id/status",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'approved'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const sql = `
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `;
      await query(sql, [status, id]);

      res.status(200).json({ message: "Order status updated successfully" });
    } catch (error) {
      console.error("Error updating order status:", error);
      res
        .status(500)
        .json({ message: "Error updating order status", error: error.message });
    }
  }
);

// Route to delete approved orders
router.delete(
  "/orders/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if the order is approved
      const checkStatusSql = `
      SELECT status
      FROM orders
      WHERE id = ?
    `;
      const [order] = await query(checkStatusSql, [id]);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.status !== 'approved') {
        return res.status(400).json({ message: "Only approved orders can be deleted" });
      }

      // Delete the order
      const deleteSql = `
      DELETE FROM orders
      WHERE id = ?
    `;
      await query(deleteSql, [id]);

      res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Error deleting order:", error);
      res
        .status(500)
        .json({ message: "Error deleting order", error: error.message });
    }
  }
);


module.exports = router;
