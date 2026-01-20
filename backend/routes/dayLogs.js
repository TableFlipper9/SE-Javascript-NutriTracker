const express = require("express");
const auth = require("../middleware/authMiddleware");
const Database = require("../db/Database");

const router = express.Router();
router.use(auth);

const db = Database.getInstance();

function isIsoDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
}

async function getOrCreateDayLog(userId, date) {
  const existing = await db.query(
    `SELECT * FROM day_logs WHERE user_id = $1 AND log_date = $2`,
    [userId, date]
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await db.query(
    `INSERT INTO day_logs (user_id, log_date) VALUES ($1, $2) RETURNING *`,
    [userId, date]
  );
  return created.rows[0];
}

router.get("/by-id/:dayLogId", async (req, res) => {
  try {
    const { dayLogId } = req.params;
    const result = await db.query(
      `SELECT * FROM day_logs WHERE id = $1 AND user_id = $2`,
      [dayLogId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Day log not found" });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/day-logs/week/list?start=YYYY-MM-DD  -> 7 days
router.get("/week/list", async (req, res) => {
  try {
    const { start } = req.query;
    if (!start) return res.status(400).json({ error: "Missing start=YYYY-MM-DD" });
    if (!isIsoDate(start)) return res.status(400).json({ error: "Invalid start date format (expected YYYY-MM-DD)" });

    const days = [];
    const base = new Date(`${start}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push(await getOrCreateDayLog(req.user.id, iso));
    }

    res.json(days);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET (or create) day log by date.
// IMPORTANT: the router/path-to-regexp version used in this project does not
// support inline regexp constraints like "/:date(\\d{4}-...)".
// Instead, we keep the route simple and validate the param at runtime.
router.get("/:date", async (req, res) => {
  try {
    const { date } = req.params;
    if (!isIsoDate(date)) {
      return res.status(400).json({ error: "Invalid date format (expected YYYY-MM-DD)" });
    }
    const dayLog = await getOrCreateDayLog(req.user.id, date);
    res.json(dayLog);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
