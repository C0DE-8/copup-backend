const mysql = require("mysql");

const mysqlConnection = mysql.createConnection({
  host: "mysql.gb.stackcp.com:61159",
  user: "copup-u",
  password: "cq2hfmw4b3",
  database: "copup-data-313031d088",
});

mysqlConnection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database");
});
module.exports = mysqlConnection;
