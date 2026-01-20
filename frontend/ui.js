// UI controller for app.html
// Depends on: auth.js, api.js, state.js

// ---------- helpers
function fmtDateISO(d) {
  return new Date(d).toISOString().split("T")[0];
}

function openModal(el) {
  el.classList.remove("hidden");
}

function closeModal(el) {
  el.classList.add("hidden");
}

function mealLabel(mealType) {
  const map = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  };
  return map[mealType] || mealType;
}

// ---------- elements
const datePicker = document.getElementById("datePicker");
const todayBtn = document.getElementById("todayBtn");
const profileBtn = document.getElementById("profileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const summaryDateLabel = document.getElementById("summaryDateLabel");
const totalCaloriesEl = document.getElementById("totalCalories");
const caloriesHint = document.getElementById("caloriesHint");
const proteinGEl = document.getElementById("proteinG");
const carbsGEl = document.getElementById("carbsG");
const fatGEl = document.getElementById("fatG");

const mealsGrid = document.getElementById("mealsGrid");
const addMealBtn = document.getElementById("addMealBtn");

// Modals
const mealModal = document.getElementById("mealModal");
const foodModal = document.getElementById("foodModal");
const profileModal = document.getElementById("profileModal");

const mealTypeSelect = document.getElementById("mealType");
const confirmAddMealBtn = document.getElementById("confirmAddMeal");
const cancelAddMealBtn = document.getElementById("cancelAddMeal");
const closeMealModalBtn = document.getElementById("closeMealModal");

const foodQuery = document.getElementById("foodQuery");
const searchFoodBtn = document.getElementById("searchFoodBtn");
const foodResults = document.getElementById("foodResults");
const quantityGrams = document.getElementById("quantityGrams");
const closeFoodModalBtn = document.getElementById("closeFoodModal");

const closeProfileModalBtn = document.getElementById("closeProfileModal");
const cancelProfileBtn = document.getElementById("cancelProfile");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// profile fields
const age = document.getElementById("age");
const gender = document.getElementById("gender");
const height = document.getElementById("height");
const weight = document.getElementById("weight");
const activity = document.getElementById("activity");
const calorieGoal = document.getElementById("calorieGoal");

// ---------- data loaders
async function loadDay(dateISO) {
  // backend expects /api/day-logs/:date, where :date is YYYY-MM-DD
  currentDayLog = await apiFetch(`/api/day-logs/${dateISO}`);
  summaryDateLabel.textContent = dateISO;
  await Promise.all([loadSummary(), loadMeals()]);
}

async function loadToday() {
  const todayISO = fmtDateISO(new Date());
  await loadDay(todayISO);
}

async function loadSummary() {
  if (!currentDayLog?.id) return;
  const summary = await apiFetch(`/api/summary/day/${currentDayLog.id}`);

  totalCaloriesEl.textContent = Math.round(summary.totalCalories || 0);
  proteinGEl.textContent = (summary.protein || 0).toFixed(1);
  carbsGEl.textContent = (summary.carbs || 0).toFixed(1);
  fatGEl.textContent = (summary.fat || 0).toFixed(1);

  caloriesHint.textContent = `${Math.round(summary.totalCalories || 0)} kcal logged`;
}

async function loadMeals() {
  if (!currentDayLog?.id) return;
  const meals = await apiFetch(`/api/meals/${currentDayLog.id}`);
  mealsGrid.innerHTML = "";

  if (!Array.isArray(meals) || meals.length === 0) {
    mealsGrid.innerHTML = `
      <div class="muted" style="padding: 10px 2px;">
        No meals created yet. Click <b>+ Add meal</b> to start logging.
      </div>
    `;
    return;
  }

  meals.forEach((m) => {
    const card = document.createElement("div");
    card.className = "meal-card";
    card.innerHTML = `
      <div class="meal-card-head">
        <div>
          <div class="meal-title">${mealLabel(m.meal_type)}</div>
          <div class="muted">Meal ID: ${m.id}</div>
        </div>
        <div class="meal-actions">
          <span class="chip">Add foods</span>
          <button class="btn btn-outline" type="button" data-action="add-food" data-meal-id="${m.id}">+ Add food</button>
        </div>
      </div>
      <div class="muted">Foods are not listed yet (endpoint not implemented). Summary updates after you add foods.</div>
    `;
    mealsGrid.appendChild(card);
  });
}

// ---------- actions
function showAddMeal() {
  openModal(mealModal);
}

async function addMeal() {
  await apiFetch("/api/meals", {
    method: "POST",
    body: JSON.stringify({
      day_log_id: currentDayLog.id,
      meal_type: mealTypeSelect.value,
    }),
  });
  closeModal(mealModal);
  await loadMeals();
}

function selectMeal(mealId) {
  selectedMealId = mealId;
  foodQuery.value = "";
  foodResults.innerHTML = "";
  quantityGrams.value = 100;
  openModal(foodModal);
}

async function searchFood() {
  const q = (foodQuery.value || "").trim();
  if (!q) return;
  const foods = await apiFetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
  foodResults.innerHTML = "";

  if (!foods.length) {
    foodResults.innerHTML = `<div class="muted">No results.</div>`;
    return;
  }

  foods.forEach((f) => {
    const row = document.createElement("div");
    row.className = "food-result";
    row.innerHTML = `
      <div>
        <div style="font-weight: 800;">${f.name}</div>
        <div class="muted">${Math.round(f.calories_per_100g)} kcal / 100g</div>
      </div>
      <button class="btn btn-outline" type="button">Add</button>
    `;

    row.addEventListener("click", async () => {
      await addFood(f.id);
    });

    foodResults.appendChild(row);
  });
}

async function addFood(foodId) {
  const grams = Math.max(1, Number(quantityGrams.value || 100));
  await apiFetch("/api/foods/add-to-meal", {
    method: "POST",
    body: JSON.stringify({
      meal_id: selectedMealId,
      food_item_id: foodId,
      quantity_grams: grams,
    }),
  });
  closeModal(foodModal);
  await loadSummary();
}

async function showProfile() {
  openModal(profileModal);
  const profile = await apiFetch("/api/profile");
  if (!profile) return;

  age.value = profile.age || "";
  gender.value = profile.gender || "";
  weight.value = profile.weight_kg || "";
  height.value = profile.height_cm || "";
  activity.value = profile.activity_level || "low";
  calorieGoal.value = profile.calorie_goal || "";
}

async function saveProfile() {
  // If profile exists, use PUT, otherwise POST.
  const existing = await apiFetch("/api/profile");
  const method = existing ? "PUT" : "POST";

  await apiFetch("/api/profile", {
    method,
    body: JSON.stringify({
      age: age.value || null,
      gender: gender.value || null,
      height_cm: height.value || null,
      weight_kg: weight.value || null,
      activity_level: activity.value || null,
      calorie_goal: calorieGoal.value || null,
    }),
  });

  closeModal(profileModal);
}

// ---------- wire up
function requireAuthOrRedirect() {
  if (!getToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuthOrRedirect()) return;

  // default date picker to today
  datePicker.value = fmtDateISO(new Date());

  logoutBtn.addEventListener("click", logout);
  todayBtn.addEventListener("click", () => loadToday().catch((e) => alert(e.message)));
  profileBtn.addEventListener("click", () => showProfile().catch((e) => alert(e.message)));
  addMealBtn.addEventListener("click", showAddMeal);

  datePicker.addEventListener("change", () => {
    const d = datePicker.value;
    if (!d) return;
    loadDay(d).catch((e) => alert(e.message));
  });

  // meal modal
  confirmAddMealBtn.addEventListener("click", () => addMeal().catch((e) => alert(e.message)));
  cancelAddMealBtn.addEventListener("click", () => closeModal(mealModal));
  closeMealModalBtn.addEventListener("click", () => closeModal(mealModal));

  // food modal
  searchFoodBtn.addEventListener("click", () => searchFood().catch((e) => alert(e.message)));
  closeFoodModalBtn.addEventListener("click", () => closeModal(foodModal));
  foodQuery.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      searchFood().catch((e) => alert(e.message));
    }
  });

  // profile modal
  closeProfileModalBtn.addEventListener("click", () => closeModal(profileModal));
  cancelProfileBtn.addEventListener("click", () => closeModal(profileModal));
  saveProfileBtn.addEventListener("click", () => saveProfile().catch((e) => alert(e.message)));

  // event delegation: add food buttons per meal
  mealsGrid.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action='add-food']");
    if (!btn) return;
    const mealId = Number(btn.getAttribute("data-meal-id"));
    if (!mealId) return;
    selectMeal(mealId);
  });

  // close modals by clicking backdrop
  [mealModal, foodModal, profileModal].forEach((m) => {
    m.addEventListener("click", (ev) => {
      if (ev.target === m) closeModal(m);
    });
  });

  // initial load
  loadToday().catch((e) => alert(e.message));
});
