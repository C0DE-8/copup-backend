const express = require("express");
const router = express.Router();
const { authenticateToken, authenticateAdmin } = require("../middleware");
const mysqlConnection = require("../dbConnection");
const util = require("util");
const multer = require("multer");
const path = require("path");

const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post(
  "/create",
  authenticateToken,
  authenticateAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { bid_points, price } = req.body;
      const image = req.file ? req.file.path : null;
      const userId = req.user.id; // Assuming user ID is available through middleware

      if (!bid_points || !price || !image) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Insert into database
      const result = await mysqlConnection.query(
        "INSERT INTO bidshop (bid_points, price, image, user_id) VALUES (?, ?, ?, ?)",
        [bid_points, price, image, userId]
      );

      res.status(201).json({ message: "Bid product created successfully" });
    } catch (error) {
      console.error("Error creating bid product:", error);
      res.status(500).json({ message: "Error creating bid product" });
    }
  }
);

router.get("/single/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM bidshop WHERE id = ?";
    const results = await query(sql, [id]);

    if (results.length === 0) {
      return res.status(404).json({ message: "Bid product not found" });
    }

    res.status(200).json(results[0]);
  } catch (error) {
    console.error("Error fetching bid product:", error);
    res
      .status(500)
      .json({ message: "Error fetching bid product", error: error.message });
  }
});

router.get("/all", authenticateToken, async (req, res) => {
  try {
    const sql = "SELECT * FROM bidshop";
    const results = await query(sql);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching bid products:", error);
    res
      .status(500)
      .json({ message: "Error fetching bid products", error: error.message });
  }
});

router.put(
  "/update/:id",
  authenticateToken,
  authenticateAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { bid_points, price } = req.body;
      const image = req.file ? `/uploads/${req.file.filename}` : null;

      const sql = `
        UPDATE bidshop SET 
        bid_points = ?, 
        price = ?, 
        image = COALESCE(?, image)
        WHERE id = ?
      `;
      await query(sql, [bid_points, price, image, id]);

      const updatedProduct = await query('SELECT * FROM bidshop WHERE id = ?', [id]);

      if (updatedProduct.length === 0) {
        return res.status(404).json({ message: "Bid product not found" });
      }

      res.status(200).json({ message: "Bid product updated successfully", product: updatedProduct[0] });
    } catch (error) {
      console.error("Error updating bid product:", error);
      res.status(500).json({ message: "Error updating bid product", error: error.message });
    }
  }
);

router.delete(
  "/remove/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const sql = "DELETE FROM bidshop WHERE id = ?";
      const result = await query(sql, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Bid product not found" });
      }

      res.status(200).json({ message: "Bid product deleted successfully" });
    } catch (error) {
      console.error("Error deleting bid product:", error);
      res
        .status(500)
        .json({ message: "Error deleting bid product", error: error.message });
    }
  }
);

module.exports = router;
