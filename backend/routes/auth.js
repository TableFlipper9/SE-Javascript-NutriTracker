const express = require("express");
const jwt = require("jsonwebtoken");
const Database = require("../db/Database");
const db = Database.getInstance();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "demo-secret-key";

// register
router.post("/register", async (req, res) => {
  const {
    username,
    email,
    password,
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    calorie_goal
  } = req.body;

  try {
    // Basic required-field checks (frontend enforces too)
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing username, email, or password" });
    }
    if (
      age === undefined ||
      !gender ||
      height_cm === undefined ||
      weight_kg === undefined ||
      !activity_level ||
      calorie_goal === undefined
    ) {
      return res.status(400).json({ error: "Profile is required to complete registration" });
    }

    // Create user + profile in a transaction
    await db.query("BEGIN");
    const userRes = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [username, email, password]
    );

    const userId = userRes.rows[0].id;

    await db.query(
      `INSERT INTO profiles
       (user_id, age, gender, height_cm, weight_kg, activity_level, calorie_goal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, age, gender, height_cm, weight_kg, activity_level, calorie_goal]
    );

    await db.query("COMMIT");
    res.json({ message: "User registered" });
  } catch (err) {
    try { await db.query("ROLLBACK"); } catch {}
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
