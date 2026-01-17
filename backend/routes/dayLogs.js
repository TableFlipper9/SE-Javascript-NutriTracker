const express = require("express");
const auth = require("../middleware/authMiddleware");
const Database = require("../db/Database");

const router = express.Router();
router.use(auth);

const db = Database.getInstance();

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

router.get("/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const dayLog = await getOrCreateDayLog(req.user.id, date);
    res.json(dayLog);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

// /api/day-logs/week?start=YYYY-MM-DD  -> 7 days
router.get("/week/list", async (req, res) => {
  try {
    const { start } = req.query;
    if (!start) return res.status(400).json({ error: "Missing start=YYYY-MM-DD" });

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      days.push(await getOrCreateDayLog(req.user.id, iso));
    }

    res.json(days);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
