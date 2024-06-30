const express = require("express");
const router = express.Router();
const mysqlConnection = require("../dbConnection");
const cron = require("node-cron");
const { authenticateToken, authenticateAdmin } = require("../middleware");
const util = require("util");
const WebSocket = require("ws");
const nodemailer = require("nodemailer");

const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

// Mutex to prevent overlapping tasks
let isUpdating = false;

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

const clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("close", () => {
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

const notifyAllClients = (message) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// Create a transporter for nodemailer
const transporter = nodemailer.createTransport({
  host: "mail.copupbid.top",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: "info@copupbid.top",
    pass: "@12345678",
  },
});

// Send email notification
const sendEmailNotification = async (email, subject, text) => {
  const mailOptions = {
    from: "info@copupbid.top",
    to: email,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Create a new auction (Admin only)
router.post(
  "/create",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const {
        name,
        description,
        entry_bid_points,
        image,
        minimum_users,
        category,
      } = req.body;

      if (!["cash", "product", "coupon"].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      const sql = `
      INSERT INTO auctions (name, description, image, entry_bid_points, minimum_users, category, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;
      await query(sql, [
        name,
        description,
        image,
        entry_bid_points,
        minimum_users,
        category,
      ]);

      res.status(201).json({ message: "Auction created successfully" });
    } catch (error) {
      console.error("Error creating auction:", error);
      res
        .status(500)
        .json({ message: "Error creating auction", error: error.message });
    }
  }
);

// Get all auctions or filter by category
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    let sql =
      "SELECT * FROM auctions WHERE status = 'pending' OR status = 'active'";
    const params = [];

    if (category) {
      sql =
        "SELECT * FROM auctions WHERE category = ? AND (status = 'pending' OR status = 'active')";
      params.push(category);
    }

    const auctions = await query(sql, params);
    res.status(200).json(auctions);
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
});

// Function to check and update auction status
async function checkAndUpdateAuctionStatus() {
  try {
    const pendingAuctionsSql =
      "SELECT * FROM auctions WHERE status = 'pending'";
    const activeAuctionsSql = "SELECT * FROM auctions WHERE status = 'active'";

    const pendingAuctions = await query(pendingAuctionsSql);
    const activeAuctions = await query(activeAuctionsSql);

    // Start pending auctions if they have enough participants
    for (const auction of pendingAuctions) {
      const participantCountSql =
        "SELECT COUNT(*) AS participant_count FROM auction_participants WHERE auction_id = ?";
      const participantCountResults = await query(participantCountSql, [
        auction.id,
      ]);
      const participantCount = participantCountResults[0].participant_count;

      if (participantCount >= auction.minimum_users) {
        const startAuctionsSql =
          "UPDATE auctions SET status = 'active', end_date = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?";
        await query(startAuctionsSql, [auction.id]);
        console.log(`Auction ${auction.id} is now active`);

        // Notify all clients
        notifyAllClients({ type: "auction_active", auctionId: auction.id });

        // Fetch all users who have joined the auction
        const participantsSql =
          "SELECT users.email FROM auction_participants JOIN users ON auction_participants.user_id = users.id WHERE auction_participants.auction_id = ?";
        const participants = await query(participantsSql, [auction.id]);

        // Send email notifications to all participants
        participants.forEach((participant) => {
          sendEmailNotification(
            participant.email,
            "Auction Active",
            `Auction ${auction.name} is now active!`
          );
        });
      }
    }

    // End active auctions if their end_date has passed
    for (const auction of activeAuctions) {
      await endAuction(auction.id);
    }
  } catch (error) {
    console.error("Error updating auction statuses:", error);
  }
}

// Function to end an auction
async function endAuction(auctionId) {
  try {
    const auctionSql = "SELECT * FROM auctions WHERE id = ?";
    const auctionResults = await query(auctionSql, [auctionId]);
    const auction = auctionResults[0];

    if (!auction) {
      console.error(`Auction ${auctionId} not found`);
      return;
    }

    if (new Date(auction.end_date) <= new Date()) {
      const updateAuctionSql =
        "UPDATE auctions SET status = 'completed', winner_id = current_bidder WHERE id = ?";
      await query(updateAuctionSql, [auctionId]);

      if (auction.current_bidder) {
        const cartSql = "INSERT INTO cart (user_id, auction_id) VALUES (?, ?)";
        await query(cartSql, [auction.current_bidder, auctionId]);
      }

      console.log(`Auction ${auctionId} ended.`);
    }
  } catch (error) {
    console.error("Error ending auction:", error);
  }
}

// Schedule the auction status check to run every minute
cron.schedule("* * * * *", checkAndUpdateAuctionStatus);

// Pay entry fee for auction
router.post("/pay-entry/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // Auction ID
    const userId = req.user.id;

    const auctionSql = "SELECT * FROM auctions WHERE id = ?";
    const auctionResults = await query(auctionSql, [id]);
    const auction = auctionResults[0];

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    const participantSql =
      "SELECT * FROM auction_participants WHERE auction_id = ? AND user_id = ?";
    const participantResults = await query(participantSql, [id, userId]);
    const participant = participantResults[0];

    if (participant) {
      return res.status(400).json({ message: "Entry fee already paid" });
    }

    const userSql = "SELECT * FROM users WHERE id = ?";
    const userResults = await query(userSql, [userId]);
    const user = userResults[0];

    if (user.bid_points < auction.entry_bid_points) {
      return res.status(400).json({ message: "Insufficient bid points" });
    }

    const updateUserSql =
      "UPDATE users SET bid_points = bid_points - ? WHERE id = ?";
    await query(updateUserSql, [auction.entry_bid_points, userId]);

    const insertParticipantSql =
      "INSERT INTO auction_participants (auction_id, user_id) VALUES (?, ?)";
    await query(insertParticipantSql, [id, userId]);

    res.status(201).json({ message: "Entry fee paid successfully" });
  } catch (error) {
    console.error("Error paying entry fee:", error);
    res
      .status(500)
      .json({ message: "Error paying entry fee", error: error.message });
  }
});

// Place a bid
router.post("/bid/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // Auction ID
    const userId = req.user.id;
    const bidAmount = 1; // Fixed bid amount

    const auctionSql = "SELECT * FROM auctions WHERE id = ?";
    const auctionResults = await query(auctionSql, [id]);
    const auction = auctionResults[0];

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "active") {
      return res.status(400).json({ message: "Auction is not active" });
    }

    const userSql = "SELECT * FROM users WHERE id = ?";
    const userResults = await query(userSql, [userId]);
    const user = userResults[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const participantSql =
      "SELECT * FROM auction_participants WHERE auction_id = ? AND user_id = ?";
    const participantResults = await query(participantSql, [id, userId]);
    const participant = participantResults[0];

    if (!participant) {
      return res.status(400).json({ message: "User has not paid entry fee" });
    }

    if (userId === auction.current_bidder) {
      return res
        .status(400)
        .json({ message: "You are already the highest bidder" });
    }

    if (user.bid_points < bidAmount) {
      return res.status(400).json({ message: "Insufficient bid points" });
    }

    const updateUserSql =
      "UPDATE users SET bid_points = bid_points - ? WHERE id = ?";
    await query(updateUserSql, [bidAmount, userId]);

    const insertBidSql =
      "INSERT INTO bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)";
    await query(insertBidSql, [id, userId, bidAmount]);

    const updateAuctionSql = `
      UPDATE auctions
      SET current_bidder = ?, current_bid_amount = ?, end_date = DATE_ADD(NOW(), INTERVAL 30 SECOND)
      WHERE id = ? AND status = 'active'
    `;
    await query(updateAuctionSql, [userId, bidAmount, id]);

    // Fetch the email of the current highest bidder
    const currentBidderSql = "SELECT email FROM users WHERE id = ?";
    const currentBidderResults = await query(currentBidderSql, [userId]);
    const currentBidderEmail = currentBidderResults[0].email;

    // Notify all clients
    notifyAllClients({ type: "bid_placed", auctionId: id, userId });

    // Send email notification to the previous highest bidder
    sendEmailNotification(
      currentBidderEmail,
      "Outbid Notification",
      `You have been outbid in auction ${auction.name}. Place a new bid to regain the highest bidder position!`
    );

    res.status(201).json({ message: "Bid placed successfully" });
  } catch (error) {
    console.error("Error placing bid:", error);
    res
      .status(500)
      .json({ message: "Error placing bid", error: error.message });
  }
});

// Get auction details by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sql = "SELECT * FROM auctions WHERE id = ?";
    const auctionResults = await query(sql, [id]);
    const auction = auctionResults[0];

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.status(200).json(auction);
  } catch (error) {
    console.error("Error fetching auction details:", error);
    res.status(500).json({
      message: "Error fetching auction details",
      error: error.message,
    });
  }
});

// Get remaining time for an auction by ID
router.get("/remaining-time/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Query to get auction details
    const auctionQuery = `
      SELECT 
        end_date,
        current_bidder,
        (SELECT username FROM users WHERE id = current_bidder) as current_bidder_username
      FROM auctions 
      WHERE id = ?;
    `;
    const auctionResult = await query(auctionQuery, [id]);
    const auction = auctionResult[0];

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    const currentTime = new Date();
    const endTime = new Date(auction.end_date);
    const remainingTime = Math.max(0, (endTime - currentTime) / 1000); // in seconds

    res.status(200).json({
      remainingTime,
      currentBidder: auction.current_bidder_username,
      serverTime: currentTime,
      endTime: endTime,
    });
  } catch (error) {
    console.error("Error fetching auction remaining time:", error);
    res.status(500).json({
      message: "Error fetching auction remaining time",
      error: error.message,
    });
  }
});

module.exports = router;
