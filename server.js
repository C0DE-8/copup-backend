const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const authRouter = require("./routes/auth");
const auctionRouter = require("./routes/auction");
const bidShopRouter = require("./routes/bidShop");
const cartRouter = require("./routes/cart");
const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");
const manualPaymentRouter = require("./routes/manualPayment");
const path = require("path");
const dotenv = require("dotenv");

const app = express();
dotenv.config();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// routes;
app.use("/api/auth", authRouter);
app.use("/api/auction", auctionRouter);
app.use("/api/bidShop", bidShopRouter);
app.use("/api/cart", cartRouter);
app.use("/api/user", userRouter);
app.use("/api/manualPayment", manualPaymentRouter);
app.use("/api/admin", adminRouter);

// environment
if (process.env.NODE_ENV === "production") {
  console.log("running production");
} else {
  console.log("running in dev mode");
}
// Error handling middleware
const errorHandlingMiddleware = (err, req, res, next) => {
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }
  return res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
};

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

app.use(errorHandlingMiddleware);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
