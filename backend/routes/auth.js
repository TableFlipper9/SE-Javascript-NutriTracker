const express = require("express");
const jwt = require("jsonwebtoken");
const Database = require("../db/Database");
const db = Database.getInstance();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "demo-secret-key";

// register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [username, email, password]
    );

    res.json({ message: "User registered" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//login 
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query(
    `SELECT id FROM users WHERE email = $1 AND password = $2`,
    [email, password]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const userId = result.rows[0].id;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });

  res.json({ token });
});

/* ME */
router.get("/me", require("../middleware/authMiddleware"), (req, res) => {
  res.json({ userId: req.user.id });
});

module.exports = router;
