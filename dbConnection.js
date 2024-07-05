const mysql = require("mysql");

const mysqlConnection = mysql.createConnection({
  host: "bfogcvom7nfugf87kf2y-mysql.services.clever-cloud.com",
  user: "uizijajtczv2vq0c",
  password: "mj91RdY1n5K8SjQF3Zeq",
  database: "bfogcvom7nfugf87kf2y",
});

mysqlConnection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database");
});
module.exports = mysqlConnection;

