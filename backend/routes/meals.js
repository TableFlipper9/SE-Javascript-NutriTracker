const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

async function assertDayLogOwned(dayLogId, userId) {
  const r = await db.query(
    `SELECT id FROM day_logs WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [dayLogId, userId]
  );
  return r.rows.length > 0;
}

async function assertMealOwned(mealId, userId) {
  const r = await db.query(
    `SELECT m.id
       FROM meals m
       JOIN day_logs d ON d.id = m.day_log_id
      WHERE m.id = $1 AND d.user_id = $2
      LIMIT 1`,
    [mealId, userId]
  );
  return r.rows.length > 0;
}

// CREATE meal
router.post("/", async (req, res) => {
  const { day_log_id, meal_type } = req.body;

  if (!day_log_id || !meal_type) {
    return res.status(400).json({ error: "day_log_id and meal_type are required" });
  }

  const owned = await assertDayLogOwned(day_log_id, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  const result = await db.query(
    `INSERT INTO meals (day_log_id, meal_type)
     VALUES ($1, $2)
     RETURNING *`,
    [day_log_id, meal_type]
  );

  res.status(201).json(result.rows[0]);
});

// GET meals for a day log
router.get("/:dayLogId", async (req, res) => {
  const { dayLogId } = req.params;

  const owned = await assertDayLogOwned(dayLogId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  const meals = await db.query(
    `SELECT * FROM meals WHERE day_log_id = $1 ORDER BY id ASC`,
    [dayLogId]
  );

  res.json(meals.rows);
});

// DELETE meal
router.delete("/:mealId", async (req, res) => {
  const { mealId } = req.params;

  const owned = await assertMealOwned(mealId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  await db.query(`DELETE FROM meals WHERE id = $1`, [mealId]);
  res.json({ message: "Meal deleted" });
});

/**
 * MEAL ITEMS (foods inside a meal)
 */

// GET items for a meal (with computed macros)
router.get("/:mealId/items", async (req, res) => {
  const { mealId } = req.params;
  const owned = await assertMealOwned(mealId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  const items = await db.query(
    `SELECT
        mfi.id,
        mfi.meal_id,
        mfi.food_item_id,
        mfi.quantity_grams,
        fi.name,
        fi.calories_per_100g,
        fi.protein_per_100g,
        fi.carbs_per_100g,
        fi.fat_per_100g,
        (mfi.quantity_grams / 100.0 * fi.calories_per_100g) AS calories,
        (mfi.quantity_grams / 100.0 * COALESCE(fi.protein_per_100g, 0)) AS protein,
        (mfi.quantity_grams / 100.0 * COALESCE(fi.carbs_per_100g, 0)) AS carbs,
        (mfi.quantity_grams / 100.0 * COALESCE(fi.fat_per_100g, 0)) AS fat
     FROM meal_food_items mfi
     JOIN food_items fi ON fi.id = mfi.food_item_id
     WHERE mfi.meal_id = $1
     ORDER BY mfi.id ASC`,
    [mealId]
  );

  const totals = items.rows.reduce(
    (acc, r) => {
      acc.calories += Number(r.calories || 0);
      acc.protein += Number(r.protein || 0);
      acc.carbs += Number(r.carbs || 0);
      acc.fat += Number(r.fat || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  res.json({ items: items.rows, totals });
});

// PATCH quantity for an item in meal (by food_item_id)
router.patch("/:mealId/items/:foodItemId", async (req, res) => {
  const { mealId, foodItemId } = req.params;
  const qty = Math.max(1, Number(req.body.quantity_grams || 0));

  const owned = await assertMealOwned(mealId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  const result = await db.query(
    `UPDATE meal_food_items
        SET quantity_grams = $1
      WHERE meal_id = $2 AND food_item_id = $3
      RETURNING *`,
    [qty, mealId, foodItemId]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
  res.json(result.rows[0]);
});

// DELETE an item from meal
router.delete("/:mealId/items/:foodItemId", async (req, res) => {
  const { mealId, foodItemId } = req.params;

  const owned = await assertMealOwned(mealId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  const result = await db.query(
    `DELETE FROM meal_food_items
      WHERE meal_id = $1 AND food_item_id = $2
      RETURNING id`,
    [mealId, foodItemId]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
  res.json({ message: "Item removed" });
});

// DELETE all items from a meal
router.delete("/:mealId/items", async (req, res) => {
  const { mealId } = req.params;

  const owned = await assertMealOwned(mealId, req.user.id);
  if (!owned) return res.status(403).json({ error: "Not allowed" });

  await db.query(`DELETE FROM meal_food_items WHERE meal_id = $1`, [mealId]);
  res.json({ message: "Meal cleared" });
});

module.exports = router;
