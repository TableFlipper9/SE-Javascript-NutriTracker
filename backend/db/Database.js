const { Pool } = require("pg");

class Database {
  static instance = null;

  constructor() {
    if (Database.instance) {
      throw new Error("Use Database.getInstance()");
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "1234ap",
      database: process.env.DB_NAME || "NutriTracker"
    });
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  query(text, params) {
    return this.pool.query(text, params);
  }
}

module.exports = Database;
