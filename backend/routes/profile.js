const express = require("express");
const Database = require("../db/Database");
const db = Database.getInstance();
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

// get
router.get("/", async (req, res) => {
  const result = await db.query(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [req.user.id]
  );

  res.json(result.rows[0] || null);
});

//create
router.post("/", async (req, res) => {
  const { age, gender, height_cm, weight_kg, activity_level, calorie_goal } = req.body;

  try {
    await db.query(
      `INSERT INTO profiles
       (user_id, age, gender, height_cm, weight_kg, activity_level, calorie_goal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.id, age, gender, height_cm, weight_kg, activity_level, calorie_goal]
    );

    res.json({ message: "Profile created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// update profile
router.put("/", async (req, res) => {
  const { age, gender, height_cm, weight_kg, activity_level, calorie_goal } = req.body;

  await db.query(
    `UPDATE profiles
     SET age=$1, gender=$2, height_cm=$3, weight_kg=$4,
         activity_level=$5, calorie_goal=$6
     WHERE user_id=$7`,
    [age, gender, height_cm, weight_kg, activity_level, calorie_goal, req.user.id]
  );

  res.json({ message: "Profile updated" });
});

module.exports = router;
