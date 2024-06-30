const express = require("express");
const { authenticateToken, authenticateAdmin } = require("../middleware");
const db = require("../dbConnection");
const nodemailer = require('nodemailer');
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: 'mail.copupbid.top',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'info@copupbid.top',
    pass: '@12345678',
  },
});


router.post("/manual-payment", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { price, bid_points, sender_account_name } = req.body;

  if (!price || !bid_points || !sender_account_name) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const result = await savePaymentDetails(userId, price, bid_points, sender_account_name);

    // Send email notification
    const mailOptions = {
      from: 'info@copupbid.top',
      to: 'payment@copupbid.top',
      subject: 'Manual Payment Initiated',
      text: `A user has initiated a manual payment and requires admin verification. Details:
      - User ID: ${userId}
      - Price: ${price}
      - Bid Points: ${bid_points}
      - Sender Account Name: ${sender_account_name}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ message: 'Error initiating payment. Please try again later.' });
      } else {
        console.log('Email sent:', info.response);
        res.json({
          message: "Payment initiated successfully! Admin verification pending.",
          paymentId: result.insertId,
        });
      }
    });
  } catch (error) {
    console.error("Error saving payment details:", error);
    res.status(500).json({ message: "Error initiating payment. Please try again later." });
  }
});


// Endpoint to get all payment requests (for admin)
router.get(
  "/payments",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const payments = await getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res
        .status(500)
        .json({ message: "Error fetching payments. Please try again later." });
    }
  }
);
// Endpoint to delete a payment history entry
router.delete("/payment-history/:id", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    await deletePaymentHistory(userId, id);
    res.json({ message: "Payment history entry deleted successfully." });
  } catch (error) {
    console.error("Error deleting payment history:", error);
    res.status(500).json({
      message: "Error deleting payment history. Please try again later.",
    });
  }
});

async function getPaymentHistory(userId) {
  const sql =
    "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5";
  const values = [userId];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

async function deletePaymentHistory(userId, id) {
  const sql = "DELETE FROM payments WHERE user_id = ? AND id = ?";
  const values = [userId, id];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// Endpoint for admin verification of payments
router.put(
  "/admin-verify-payment/:paymentId",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    const { paymentId } = req.params;
    const { isVerified, bid_points } = req.body; // Removed userId from request body

    try {
      // Fetch the user ID associated with the payment
      const payment = await getPaymentDetails(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const userId = payment.user_id;

      // Update payment status in database based on admin verification
      await markPaymentAsVerified(paymentId, isVerified);

      if (isVerified) {
        // Update user's bid points if payment is verified
        await updateUserBidPoints(userId, bid_points); // Updated function call
      }

      res.json({
        message: "Payment verification status updated successfully.",
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res
        .status(500)
        .json({ message: "Error verifying payment. Please try again later." });
    }
  }
);

// Function to save payment details  in database
async function savePaymentDetails(
  userId,
  price,
  bid_points,
  sender_account_name
) {
  const sql =
    "INSERT INTO payments (user_id, amount, bid_points, sender_account_name, status) VALUES (?, ?, ?, ?, ?)";
  const status = "Pending";
  const values = [userId, price, bid_points, sender_account_name, status];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// Function to mark payment as verified or rejected in database
async function markPaymentAsVerified(paymentId, isVerified) {
  const status = isVerified ? "Verified" : "Rejected";
  const sql = "UPDATE payments SET status = ? WHERE id = ?";
  const values = [status, paymentId];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// Function to update user's bid points in database
async function updateUserBidPoints(userId, bid_points) {
  const sql = "UPDATE users SET bid_points = bid_points + ? WHERE id = ?";
  const values = [bid_points, userId];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// Function to get all payment requests from database
async function getAllPayments() {
  const sql = "SELECT * FROM payments";
  return new Promise((resolve, reject) => {
    db.query(sql, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// Function to get payment details including user_id from database
async function getPaymentDetails(paymentId) {
  const sql = "SELECT * FROM payments WHERE id = ?";
  const values = [paymentId];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results[0]);
      }
    });
  });
}

// Endpoint to get payment history for the logged-in user
router.get("/payment-history", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const payments = await getPaymentHistory(userId);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      message: "Error fetching payment history. Please try again later.",
    });
  }
});

async function getPaymentHistory(userId) {
  const sql = "SELECT * FROM payments WHERE user_id = ?";
  const values = [userId];
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

module.exports = router;
