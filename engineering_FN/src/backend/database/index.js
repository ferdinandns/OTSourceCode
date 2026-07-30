require("dotenv").config();
const mysql = require("mysql2");
const { Pool } = require("pg");
const util = require("util");
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE1,
  port: process.env.DB_PORT,
});

const db2 = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE2,
  port: process.env.DB_PORT,
});

const db3 = mysql.createConnection({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE3,
  port: process.env.DB_PORT2,
});

const db4 = mysql.createConnection({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE4,
  port: process.env.DB_PORT2,
});

const post = new Pool({
  host: process.env.DB_HOST3,
  user: process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  database: process.env.DB_DATABASE5,
  port: process.env.DB_PORT3,
});

db.connect((err) => {
  if (err) {
    return console.log(`error : ${err.message}`);
  }
  console.log("connect to mysql");
});

db2.connect((err) => {
  if (err) {
    return console.log(`error : ${err.message}`);
  }
  console.log("connect to mysql2");
});

db3.connect((err) => {
  if (err) {
    return console.log(`error : ${err.message}`);
  }
  console.log("connect to mysql3");
});

db4.connect((err) => {
  if (err) {
    return console.log(`error : ${err.message}`);
  }
  console.log("connect to mysql4");
});

post.connect()
  .then(() => console.log("Connected to PostgreSQL database using Pool!"))
  .catch((err) => console.error("Connection error", err.stack));

const query = util.promisify(db.query).bind(db);
const query2 = util.promisify(db2.query).bind(db2);
const query3 = util.promisify(db3.query).bind(db3);
const query4 = util.promisify(db4.query).bind(db4);
// const query5 = util.promisify(d.query).bind(db5);

module.exports = {
  post,
  db4,
  db3,
  db2,
  db,
  query,
  query2,
  query3,
  query4,
  };
