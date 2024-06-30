// server.js

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

const app = express();

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong", error: err.message });
});
const errorHandlingMiddleware = (err, req, res, next) => {
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }
  return res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
};

app.use(errorHandlingMiddleware);
// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
