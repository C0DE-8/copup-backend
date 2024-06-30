const jwt = require("jsonwebtoken");
const mysqlConnection = require("./dbConnection");
const util = require("util");

const query = util.promisify(mysqlConnection.query).bind(mysqlConnection);

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "your-secret-key");
    const sql = "SELECT * FROM users WHERE id = ?";
    const results = await query(sql, [decoded.userId]);
    const user = results[0];

    if (!user) return res.sendStatus(403);

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.sendStatus(403);
  }
};

const authenticateAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.sendStatus(403);
  }
};

const errorHandlingMiddleware = (err, req, res, next) => {
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }
  return res.status(500).json({ message: "Internal Server Error", error: err.message });
};


module.exports = { authenticateToken, authenticateAdmin, errorHandlingMiddleware };
