const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "1234ap",
  database: "NutriTracker"
});

module.exports = pool;
