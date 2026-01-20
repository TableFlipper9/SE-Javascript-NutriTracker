const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");

// External nutrition lookup (CalorieNinjas)
// We call it from the backend (not the browser) so we avoid CORS + keep the API key off the client.
// Docs: https://calorieninjas.com/api
const https = require("https");

const router = express.Router();
router.use(authMiddleware);

function toNumOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          ...headers
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`External API error (${res.statusCode}): ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`External API returned non-JSON: ${data?.slice?.(0, 200) || data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function normalizePer100g(item) {
  const serving = Number(item.serving_size_g || 100);
  const denom = serving > 0 ? serving : 100;
  const scale = 100 / denom;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    name: String(item.name || "").trim(),
    calories_per_100g: num(item.calories) * scale,
    protein_per_100g: num(item.protein_g) * scale,
    carbs_per_100g: num(item.carbohydrates_total_g) * scale,
    fat_per_100g: num(item.fat_total_g) * scale
  };
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
     WHERE is_visible = TRUE
       AND ((user_id = $1) OR ($2::boolean AND user_id IS NULL))
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
     WHERE is_visible = TRUE
       AND name ILIKE $1
       AND ((user_id = $2) OR ($3::boolean AND user_id IS NULL))
     ORDER BY
       CASE WHEN name ILIKE $4 THEN 0 ELSE 1 END,
       name ASC
     LIMIT 30`,
    [`%${q}%`, req.user.id, includeGlobal, `${q}%`]
  );

  res.json(result.rows);
});

/**
 * SEARCH foods via external API (CalorieNinjas text API).
 *
 * Important:
 * - We do NOT persist/cached these results in the normal `food_items` table.
 * - We fetch from CalorieNinjas every time.
 *
 * The frontend can still "Add" an external item to a meal by calling POST /import-external,
 * which creates a hidden (is_visible=false) food_items row to preserve historic meal logs.
 *
 * Env:
 * - CALORIE_NINJAS_API_KEY
 */
router.get("/search-external", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  const apiKey = process.env.CALORIE_NINJAS_API_KEY;
  if (!apiKey) {
    // Not configured; return empty list so the UI can still work normally.
    return res.json([]);
  }

  try {
    const url = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(q)}`;
    const payload = await httpsGetJson(url, { "X-Api-Key": apiKey });
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const out = items.slice(0, 15)
      .map((raw) => normalizePer100g(raw))
      .filter((norm) => norm && norm.name)
      .map((norm) => ({
        id: null,
        user_id: null,
        source: "calorieninjas",
        name: norm.name,
        calories_per_100g: norm.calories_per_100g,
        protein_per_100g: norm.protein_per_100g,
        carbs_per_100g: norm.carbs_per_100g,
        fat_per_100g: norm.fat_per_100g,
        external: true
      }));

    res.json(out);
  } catch (e) {
    // Fail "soft" so local DB search still works even if the external API is down.
    console.error(e);
    res.json([]);
  }
});

// Import an external item into the DB so it can be added to meals.
// We intentionally do NOT add external foods to the visible foods list.
// Instead, we create a hidden row (is_visible=false) owned by the user.
router.post("/import-external", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const calories = toNumOrNull(req.body.calories_per_100g);
  const protein = toNumOrNull(req.body.protein_per_100g);
  const carbs = toNumOrNull(req.body.carbs_per_100g);
  const fat = toNumOrNull(req.body.fat_per_100g);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (calories === null) return res.status(400).json({ error: "calories_per_100g is required" });

  try {
    // Reuse an existing hidden imported row if present.
    const existing = await db.query(
      `SELECT *
         FROM food_items
        WHERE user_id = $1
          AND source = 'custom'
          AND is_visible = FALSE
          AND lower(name) = lower($2)
        LIMIT 1`,
      [req.user.id, name]
    );
    if (existing.rows.length) return res.json(existing.rows[0]);

    const inserted = await db.query(
      `INSERT INTO food_items
        (user_id, source, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_visible)
       VALUES ($1, 'custom', $2, $3, $4, $5, $6, FALSE)
       RETURNING *`,
      [req.user.id, name, calories, protein, carbs, fat]
    );
    return res.status(201).json(inserted.rows[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* GET food item */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT *
     FROM food_items
     WHERE id = $1
       AND is_visible = TRUE
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
    `UPDATE food_items
        SET is_visible = FALSE
      WHERE id = $1 AND user_id = $2 AND source = 'custom'
      RETURNING id`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Food not found (or not deletable)" });
  }
  res.json({ message: "Food hidden" });
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
  // Food must be accessible to the user.
  // - Visible foods: global (user_id NULL) or owned.
  // - Hidden foods (is_visible=FALSE): only if owned (keeps history intact + allows external imports).
  const foodOk = await db.query(
    `SELECT id
       FROM food_items
      WHERE id = $1
        AND (
          (is_visible = TRUE AND (user_id = $2 OR user_id IS NULL))
          OR
          (is_visible = FALSE AND user_id = $2)
        )
      LIMIT 1`,
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
