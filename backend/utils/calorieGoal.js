/**
 * Calorie goal utilities.
 *
 * - estimateDailyCalories(): estimates maintenance calories (TDEE)
 * - applyGoalAdjustment(): adjusts maintenance calories based on goal
 * - calculateRecommendedCalories(): maintenance calories adjusted by goal
 *
 * Uses Mifflin–St Jeor BMR with a standard activity multiplier.
 */

const GOALS = ["lose", "maintain", "gain"];

// Canonical activity options used across the app.
const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" }
];

function normalizeGender(gender) {
  if (!gender) return "other";
  const g = String(gender).toLowerCase();
  if (g === "m" || g === "male") return "male";
  if (g === "f" || g === "female") return "female";
  return "other";
}

function normalizeGoal(goal) {
  const g = String(goal || "maintain").toLowerCase();
  return GOALS.includes(g) ? g : "maintain";
}

function activityMultiplier(activityLevel) {
  const a = String(activityLevel || "").toLowerCase();

  // Register uses: sedentary | light | moderate | active | very_active
  // Settings/onboarding historically used: low | moderate | high
  switch (a) {
    case "sedentary":
    case "low":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "active":
    case "high":
      return 1.725;
    case "very_active":
      return 1.9;
    default:
      return 1.2;
  }
}

/**
 * Maintenance calories (TDEE).
 * Returns an integer kcal/day (rounded) or null if required fields are missing/invalid.
 */
function estimateDailyCalories({ age, gender, height_cm, weight_kg, activity_level }) {
  const a = Number(age);
  const h = Number(height_cm);
  const w = Number(weight_kg);

  if (!Number.isFinite(a) || !Number.isFinite(h) || !Number.isFinite(w)) {
    return null;
  }

  const g = normalizeGender(gender);

  // Mifflin–St Jeor
  // male:   BMR = 10w + 6.25h - 5a + 5
  // female: BMR = 10w + 6.25h - 5a - 161
  // other/unknown: midpoint of constants
  const base = 10 * w + 6.25 * h - 5 * a;
  let bmr;
  if (g === "male") bmr = base + 5;
  else if (g === "female") bmr = base - 161;
  else bmr = base + (5 - 161) / 2;

  const tdee = bmr * activityMultiplier(activity_level);
  return Math.max(800, Math.round(tdee));
}

/**
 * Adjust maintenance calories by a percentage.
 *
 * Defaults:
 * - lose:     -15%
 * - maintain:  0%
 * - gain:     +15%
 */
function applyGoalAdjustment(maintenanceCalories, goal, opts = {}) {
  const base = Number(maintenanceCalories);
  if (!Number.isFinite(base)) return null;

  const g = normalizeGoal(goal);
  const pct = {
    lose: Number.isFinite(opts.losePct) ? opts.losePct : 0.15,
    gain: Number.isFinite(opts.gainPct) ? opts.gainPct : 0.15
  };

  let multiplier = 1;
  if (g === "lose") multiplier = 1 - pct.lose;
  else if (g === "gain") multiplier = 1 + pct.gain;

  return Math.max(800, Math.round(base * multiplier));
}

/**
 * Recommended calories based on full profile + goal.
 */
function calculateRecommendedCalories(profile, goal, opts = {}) {
  const maintenance = estimateDailyCalories(profile);
  if (maintenance === null) return null;
  return applyGoalAdjustment(maintenance, goal, opts);
}

module.exports = {
  GOALS,
  ACTIVITY_LEVELS,
  activityMultiplier,
  estimateDailyCalories,
  applyGoalAdjustment,
  calculateRecommendedCalories,
  normalizeGoal
};
