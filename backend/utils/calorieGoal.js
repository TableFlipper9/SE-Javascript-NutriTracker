/**
 * Estimate daily calorie maintenance (TDEE) from profile inputs.
 *
 * Uses Mifflin–St Jeor BMR with a standard activity multiplier.
 * Returns an integer kcal/day (rounded).
 */

function normalizeGender(gender) {
  if (!gender) return "other";
  const g = String(gender).toLowerCase();
  if (g === "m" || g === "male") return "male";
  if (g === "f" || g === "female") return "female";
  return "other";
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

module.exports = { estimateDailyCalories };
