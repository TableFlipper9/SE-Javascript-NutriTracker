const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");
const { calculateRecommendedCalories, normalizeGoal } = require("../utils/calorieGoal");

const router = express.Router();

router.use(authMiddleware);

// get
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *, COALESCE(custom_calorie_goal, calculated_calorie_goal, calorie_goal) AS calorie_goal
       FROM profiles
       WHERE user_id = $1`,
      [req.user.id]
    );
    return res.json(result.rows[0] || null);
  } catch (e) {
    // If migrations weren't applied yet, fall back to legacy schema.
    if (
      e &&
      (e.code === "42703" ||
        String(e.message || "").includes("calculated_calorie_goal") ||
        String(e.message || "").includes("custom_calorie_goal") ||
        String(e.message || "").includes("goal"))
    ) {
      const legacy = await db.query(
        `SELECT *, calorie_goal AS calorie_goal
         FROM profiles
         WHERE user_id = $1`,
        [req.user.id]
      );
      return res.json(legacy.rows[0] || null);
    }
    throw e;
  }
});

//create
router.post("/", async (req, res) => {
  const {
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    calorie_goal,
    custom_calorie_goal
  } = req.body;

  const normalizedGoal = normalizeGoal(goal);
  const calculated = calculateRecommendedCalories(
    { age, gender, height_cm, weight_kg, activity_level },
    normalizedGoal
  );
  if (calculated === null) {
    return res.status(400).json({ error: "Missing or invalid profile fields to calculate calorie goal" });
  }

  const customRaw = custom_calorie_goal ?? calorie_goal;
  const custom = customRaw === null || customRaw === undefined || customRaw === "" ? null : Number(customRaw);
  const effective = custom ?? calculated;

  try {
    try {
      await db.query(
        `INSERT INTO profiles
          (user_id, age, gender, height_cm, weight_kg, activity_level,
           goal, calculated_calorie_goal, custom_calorie_goal, calorie_goal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id) DO UPDATE
           SET age=EXCLUDED.age,
               gender=EXCLUDED.gender,
               height_cm=EXCLUDED.height_cm,
               weight_kg=EXCLUDED.weight_kg,
               activity_level=EXCLUDED.activity_level,
               goal=EXCLUDED.goal,
               calculated_calorie_goal=EXCLUDED.calculated_calorie_goal,
               custom_calorie_goal=EXCLUDED.custom_calorie_goal,
               calorie_goal=EXCLUDED.calorie_goal`,
        [
          req.user.id,
          age,
          gender,
          height_cm,
          weight_kg,
          activity_level,
          normalizedGoal,
          calculated,
          custom,
          effective
        ]
      );
    } catch (e) {
      // Legacy schema: no calculated/custom/goal columns.
      if (
        e &&
        (e.code === "42703" ||
          String(e.message || "").includes("calculated_calorie_goal") ||
          String(e.message || "").includes("custom_calorie_goal") ||
          String(e.message || "").includes("goal"))
      ) {
        await db.query(
          `INSERT INTO profiles
            (user_id, age, gender, height_cm, weight_kg, activity_level, calorie_goal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id) DO UPDATE
             SET age=EXCLUDED.age,
                 gender=EXCLUDED.gender,
                 height_cm=EXCLUDED.height_cm,
                 weight_kg=EXCLUDED.weight_kg,
                 activity_level=EXCLUDED.activity_level,
                 calorie_goal=EXCLUDED.calorie_goal`,
          [req.user.id, age, gender, height_cm, weight_kg, activity_level, effective]
        );
      } else {
        throw e;
      }
    }

    res.json({ message: "Profile created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// update profile
router.put("/", async (req, res) => {
  const {
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    calorie_goal,
    custom_calorie_goal
  } = req.body;

  const normalizedGoal = normalizeGoal(goal);
  const calculated = calculateRecommendedCalories(
    { age, gender, height_cm, weight_kg, activity_level },
    normalizedGoal
  );
  if (calculated === null) {
    return res.status(400).json({ error: "Missing or invalid profile fields to calculate calorie goal" });
  }

  const customRaw = custom_calorie_goal ?? calorie_goal;
  const custom = customRaw === null || customRaw === undefined || customRaw === "" ? null : Number(customRaw);
  const effective = custom ?? calculated;

  try {
    await db.query(
      `UPDATE profiles
         SET age=$1,
             gender=$2,
             height_cm=$3,
             weight_kg=$4,
             activity_level=$5,
             goal=$6,
             calculated_calorie_goal=$7,
             custom_calorie_goal=$8,
             calorie_goal=$9
       WHERE user_id=$10`,
      [
        age,
        gender,
        height_cm,
        weight_kg,
        activity_level,
        normalizedGoal,
        calculated,
        custom,
        effective,
        req.user.id
      ]
    );
  } catch (e) {
    if (
      e &&
      (e.code === "42703" ||
        String(e.message || "").includes("calculated_calorie_goal") ||
        String(e.message || "").includes("custom_calorie_goal") ||
        String(e.message || "").includes("goal"))
    ) {
      await db.query(
        `UPDATE profiles
           SET age=$1,
               gender=$2,
               height_cm=$3,
               weight_kg=$4,
               activity_level=$5,
               calorie_goal=$6
         WHERE user_id=$7`,
        [age, gender, height_cm, weight_kg, activity_level, effective, req.user.id]
      );
    } else {
      throw e;
    }
  }

  res.json({ message: "Profile updated" });
});

module.exports = router;
