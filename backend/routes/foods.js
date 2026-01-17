const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

function toNumOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * FOOD ITEMS
 * - user_id IS NULL => globally available item (seeded or external API)
 * - user_id = <id>  => user's custom item
 *
 * This route intentionally keeps a simple contract so we can later “fan out”
 * to an external foods API while still returning local DB items.
 */

/* LIST foods (defaults to user's custom + global) */
router.get("/", async (req, res) => {
  const includeGlobal = String(req.query.includeGlobal ?? "true").toLowerCase() !== "false";

  const result = await db.query(
    `SELECT *
     FROM food_items
     WHERE (user_id = $1) OR ($2::boolean AND user_id IS NULL)
     ORDER BY name ASC
     LIMIT 200`,
    [req.user.id, includeGlobal]
  );

  res.json(result.rows);
});

/* SEARCH foods (local db now; later can fan out to external API) */
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const includeGlobal = String(req.query.includeGlobal ?? "true").toLowerCase() !== "false";

  if (!q) return res.json([]);

  const result = await db.query(
    `SELECT *
     FROM food_items
     WHERE name ILIKE $1
       AND ((user_id = $2) OR ($3::boolean AND user_id IS NULL))
     ORDER BY
       CASE WHEN name ILIKE $4 THEN 0 ELSE 1 END,
       name ASC
     LIMIT 30`,
    [`%${q}%`, req.user.id, includeGlobal, `${q}%`]
  );

  res.json(result.rows);
});

/* GET food item */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT *
     FROM food_items
     WHERE id = $1
       AND (user_id = $2 OR user_id IS NULL)
     LIMIT 1`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Food not found" });
  res.json(result.rows[0]);
});

/* CREATE custom food item */
router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const calories = toNumOrNull(req.body.calories_per_100g);
  const protein = toNumOrNull(req.body.protein_per_100g);
  const carbs = toNumOrNull(req.body.carbs_per_100g);
  const fat = toNumOrNull(req.body.fat_per_100g);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (calories === null) return res.status(400).json({ error: "calories_per_100g is required" });

  const result = await db.query(
    `INSERT INTO food_items
      (user_id, source, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
     VALUES ($1, 'custom', $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.user.id, name, calories, protein, carbs, fat]
  );

  res.status(201).json(result.rows[0]);
});

/* UPDATE custom food item (owner only) */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const name = String(req.body.name || "").trim();
  const calories = toNumOrNull(req.body.calories_per_100g);
  const protein = toNumOrNull(req.body.protein_per_100g);
  const carbs = toNumOrNull(req.body.carbs_per_100g);
  const fat = toNumOrNull(req.body.fat_per_100g);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (calories === null) return res.status(400).json({ error: "calories_per_100g is required" });

  const result = await db.query(
    `UPDATE food_items
       SET name = $1,
           calories_per_100g = $2,
           protein_per_100g = $3,
           carbs_per_100g = $4,
           fat_per_100g = $5
     WHERE id = $6 AND user_id = $7 AND source = 'custom'
     RETURNING *`,
    [name, calories, protein, carbs, fat, id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Food not found (or not editable)" });
  }
  res.json(result.rows[0]);
});

/* DELETE custom food item (owner only) */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `DELETE FROM food_items
     WHERE id = $1 AND user_id = $2 AND source = 'custom'
     RETURNING id`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Food not found (or not deletable)" });
  }
  res.json({ message: "Food deleted" });
});

/* ADD/UPDATE food in meal (ownership checked) */
router.post("/add-to-meal", async (req, res) => {
  const { meal_id, food_item_id } = req.body;
  const quantity_grams = Math.max(1, Number(req.body.quantity_grams || 0));

  if (!meal_id || !food_item_id) {
    return res.status(400).json({ error: "meal_id and food_item_id are required" });
  }

  // verify meal belongs to current user
  const mealOwn = await db.query(
    `SELECT m.id
       FROM meals m
       JOIN day_logs d ON d.id = m.day_log_id
      WHERE m.id = $1 AND d.user_id = $2
      LIMIT 1`,
    [meal_id, req.user.id]
  );
  if (mealOwn.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  // verify food is accessible (global or owned)
  const foodOk = await db.query(
    `SELECT id FROM food_items WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) LIMIT 1`,
    [food_item_id, req.user.id]
  );
  if (foodOk.rows.length === 0) return res.status(404).json({ error: "Food not found" });

  await db.query(
    `INSERT INTO meal_food_items
      (meal_id, food_item_id, quantity_grams)
     VALUES ($1, $2, $3)
     ON CONFLICT (meal_id, food_item_id)
     DO UPDATE SET quantity_grams = EXCLUDED.quantity_grams`,
    [meal_id, food_item_id, quantity_grams]
  );

  res.json({ message: "Food added to meal" });
});

module.exports = router;
