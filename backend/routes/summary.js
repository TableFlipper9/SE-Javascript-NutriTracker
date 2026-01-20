const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

async function assertDayLogOwned(dayLogId, userId) {
  const r = await db.query(`SELECT id FROM day_logs WHERE id=$1 AND user_id=$2`, [dayLogId, userId]);
  return r.rows.length > 0;
}

router.get("/day/:dayLogId", async (req, res) => {
  try {
    const { dayLogId } = req.params;

    const ok = await assertDayLogOwned(dayLogId, req.user.id);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const result = await db.query(`
      SELECT
        m.meal_type,
        SUM(mfi.quantity_grams / 100.0 * fi.calories_per_100g) AS calories,
        SUM(mfi.quantity_grams / 100.0 * fi.protein_per_100g) AS protein,
        SUM(mfi.quantity_grams / 100.0 * fi.carbs_per_100g) AS carbs,
        SUM(mfi.quantity_grams / 100.0 * fi.fat_per_100g) AS fat
      FROM meals m
      LEFT JOIN meal_food_items mfi ON m.id = mfi.meal_id
      LEFT JOIN food_items fi ON fi.id = mfi.food_item_id
      WHERE m.day_log_id = $1
      GROUP BY m.meal_type
    `, [dayLogId]);

    const summary = {
      totalCalories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals: {}
    };

    for (const row of result.rows) {
      const cals = Number(row.calories || 0);
      summary.meals[row.meal_type] = cals;
      summary.totalCalories += cals;
      summary.protein += Number(row.protein || 0);
      summary.carbs += Number(row.carbs || 0);
      summary.fat += Number(row.fat || 0);
    }

    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Week totals by date: /api/summary/week?start=YYYY-MM-DD
router.get("/week", async (req, res) => {
  try {
    const { start } = req.query;
    if (!start) return res.status(400).json({ error: "Missing start=YYYY-MM-DD" });

    // totals per date for the user
    // IMPORTANT: return log_date as a DATE string (YYYY-MM-DD) to avoid timezone shifts
    // when it reaches the browser. If dl.log_date is a timestamp/timestamptz, JSON
    // serialization can shift it to the previous day for some timezones.
    const result = await db.query(`
      SELECT
        to_char(dl.log_date::date, 'YYYY-MM-DD') AS log_date,
        COALESCE(SUM(mfi.quantity_grams / 100.0 * fi.calories_per_100g), 0) AS calories
      FROM day_logs dl
      LEFT JOIN meals m ON m.day_log_id = dl.id
      LEFT JOIN meal_food_items mfi ON mfi.meal_id = m.id
      LEFT JOIN food_items fi ON fi.id = mfi.food_item_id
      WHERE dl.user_id = $1
        AND dl.log_date >= $2::date
        AND dl.log_date < ($2::date + INTERVAL '7 days')
      GROUP BY dl.log_date::date
      ORDER BY dl.log_date::date ASC
    `, [req.user.id, start]);

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
