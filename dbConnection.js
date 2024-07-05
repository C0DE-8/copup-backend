const mysql = require("mysql");

const mysqlConnection = mysql.createConnection({
  host: "mysql.gb.stackcp.com",
  port: 63047,
  user: "nodejs-user",
  password: "@12345678",
  database: "nodejs-db-353035312052",
});

mysqlConnection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database");
});

module.exports = mysqlConnection;
