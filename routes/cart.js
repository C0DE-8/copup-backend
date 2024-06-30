const express = require("express");
const router = express.Router();
const mysqlConnection = require("../dbConnection");
const { authenticateToken } = require("../middleware");
const util = require("util");

// Promisify the mysqlConnection.query method
const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

// Get all items in the user's cart
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT c.id, a.name, a.description, a.current_bid_amount, a.category, a.image
      FROM cart c
      JOIN auctions a ON c.auction_id = a.id
      WHERE c.user_id = ?
    `;
    const cartItems = await query(sql, [userId]);

    // Adjust image URL for client use
    const adjustedCartItems = cartItems.map((item) => {
      if (item.image) {
        item.image = `${req.protocol}://${req.get("host")}${item.image}`;
      }
      return item;
    });

    res.status(200).json(adjustedCartItems);
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({
      message: "Error fetching cart items",
      error: error.message,
    });
  }
});

// Checkout and create an order
router.post("/checkout", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { address, accountName, accountNumber, contactInfo } = req.body; // Gathered info from the request body

    const cartSql = `
      SELECT c.auction_id, a.category
      FROM cart c
      JOIN auctions a ON c.auction_id = a.id
      WHERE c.user_id = ?
    `;
    const cartItems = await query(cartSql, [userId]);

    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Check if all necessary information is provided based on auction categories
    for (const item of cartItems) {
      if (item.category === "cash" && (!accountName || !accountNumber)) {
        return res.status(400).json({
          message: "Account name and number are required for cash auctions",
        });
      }
      if (item.category === "product" && !address) {
        return res
          .status(400)
          .json({ message: "Address is required for product auctions" });
      }
      if (item.category === "coupon" && !contactInfo) {
        return res.status(400).json({
          message: "Contact information is required for coupon auctions",
        });
      }
    }

    // Create the order
    const orderSql =
      "INSERT INTO orders (user_id, address, account_name, account_number, contact_info) VALUES (?, ?, ?, ?, ?)";
    const orderResult = await query(orderSql, [
      userId,
      address,
      accountName,
      accountNumber,
      contactInfo,
    ]);

    const orderId = orderResult.insertId;

    // Create order items
    const orderItemsSql =
      "INSERT INTO order_items (order_id, auction_id) VALUES ?";
    const orderItemsValues = cartItems.map((item) => [
      orderId,
      item.auction_id,
    ]);

    await query(orderItemsSql, [orderItemsValues]);

    // Clear the user's cart
    const deleteCartSql = "DELETE FROM cart WHERE user_id = ?";
    await query(deleteCartSql, [userId]);

    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (error) {
    console.error("Error during checkout:", error);
    res
      .status(500)
      .json({ message: "Error during checkout", error: error.message });
  }
});

module.exports = router;
