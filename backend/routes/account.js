const express = require("express");
const Database = require("../db/Database");
const authMiddleware = require("../middleware/authMiddleware");

const db = Database.getInstance();
const router = express.Router();
router.use(authMiddleware);

// Permanently delete the current user's account and all related data.
router.delete("/", async (req, res) => {
  const userId = req.user.id;

  // Best-effort transactional delete. If your DB has ON DELETE CASCADE,
  // the individual deletes below are still safe.
  // NOTE: transactions must run on a single DB client connection.
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // meal_food_items -> meals -> day_logs
    await client.query(
      `DELETE FROM meal_food_items
        WHERE meal_id IN (
          SELECT m.id
            FROM meals m
            JOIN day_logs d ON d.id = m.day_log_id
           WHERE d.user_id = $1
        )`,
      [userId]
    );

    await client.query(
      `DELETE FROM meals
        WHERE day_log_id IN (SELECT id FROM day_logs WHERE user_id = $1)`,
      [userId]
    );

    await client.query(`DELETE FROM day_logs WHERE user_id = $1`, [userId]);

    // User-owned custom foods
    await client.query(`DELETE FROM food_items WHERE user_id = $1`, [userId]);

    // Profile
    await client.query(`DELETE FROM profiles WHERE user_id = $1`, [userId]);

    // Finally, the user row
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
    res.json({ message: "Account deleted" });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
