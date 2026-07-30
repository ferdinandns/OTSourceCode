require("dotenv").config();
const mysql = require("mysql2");
const { Pool } = require("pg");
const util = require("util");

/*
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE1,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

const db2 = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE2,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

const db3 = mysql.createConnection({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE3,
  port: process.env.DB_PORT2,
  multipleStatements: true,
});

const db4 = mysql.createConnection({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE4,
  port: process.env.DB_PORT2,
  multipleStatements: true,
});

const dbTest = mysql.createConnection({
  host: process.env.DB_HOST2,         // Same host
  user: process.env.DB_USER2,         // Same user
  password: process.env.DB_PASSWORD2, // Same password
  database: process.env.DB_DATABASE_TEST, // Points to 'test'
  port: process.env.DB_PORT2,
  multipleStatements: true,
});

const post = new Pool({
  host: process.env.DB_HOST3,
  user: process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  database: process.env.DB_DATABASE5,
  port: process.env.DB_PORT3,
  multipleStatements: true,
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

dbTest.connect((err) => {
  if (err) console.error('Error connecting to Test DB:', err);
  else console.log('Connected to Test DB');
});

post.connect()
  .then(() => console.log("Connected to PostgreSQL database using Pool!"))
  .catch((err) => console.error("Connection error", err.stack));
*/

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE1,
  port: process.env.DB_PORT,
  multipleStatements: true,
  connectionLimit: 2,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000,    // Closes idle connections after 1 minute
  enableKeepAlive: false  // Keeps the connection healthy while active
});

// 2. Pool 2
const db2 = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE2,
  port: process.env.DB_PORT,
  multipleStatements: true,
  connectionLimit: 2,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000,
  enableKeepAlive: false
});

// 3. Pool 3 (Converted from Connection)
const db3 = mysql.createPool({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE3,
  port: process.env.DB_PORT2,
  multipleStatements: true,
  connectionLimit: 2,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000,
  enableKeepAlive: false

});

// 4. Pool 4 (Converted from Connection)
const db4 = mysql.createPool({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE4,
  port: process.env.DB_PORT2,
  multipleStatements: true,
  connectionLimit: 2,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000,
  enableKeepAlive: false
});

// 5. Test Pool (Converted from Connection)
const dbTest = mysql.createPool({
  host: process.env.DB_HOST2,
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  database: process.env.DB_DATABASE_TEST,
  port: process.env.DB_PORT2,
  multipleStatements: true,
  connectionLimit: 2,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000,
  enableKeepAlive: false
});

// 6. PostgreSQL (Already a Pool)
const post = new Pool({
  host: process.env.DB_HOST3,
  user: process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  database: process.env.DB_DATABASE5,
  port: process.env.DB_PORT3,
  idleTimeout: 60000,
  enableKeepAlive: true
});

// --- NO MANUAL .connect() CALLS NEEDED FOR POOLS ---

// PostgreSQL Connect Log (Optional, just for logging)
post.connect()
  .then(() => console.log("✅ Connected to PostgreSQL!"))
  .catch((err) => console.error("❌ Postgres Error", err.stack));


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
  dbTest,
  query,
  query2,
  query3,
  query4,
  };
