const express = require("express");
const jwt = require("jsonwebtoken");
const Database = require("../db/Database");
const db = Database.getInstance();
// Profile calories are calculated in /api/profile.

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "demo-secret-key";

// register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Basic required-field checks
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing username, email, or password" });
    }

    await db.query("BEGIN");
    const userRes = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [username, email, password]
    );

    const userId = userRes.rows[0].id;
    await db.query("COMMIT");

    // Return a token so the UI can immediately route to onboarding.
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    try { await db.query("ROLLBACK"); } catch {}
    // Friendlier errors for common DB constraint failures
    if (err && err.code === "23505") {
      // unique_violation (likely username or email)
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (err && err.code === "23514") {
      // check_violation
      return res.status(400).json({ error: "Invalid profile values" });
    }

    // Log full error on server for debugging
    console.error("/api/auth/register error:", err);
    res.status(400).json({ error: err.message || "Registration failed" });
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
