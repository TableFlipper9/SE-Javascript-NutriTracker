(function () {
  if (!requireAuth()) return;

  const datePicker = document.getElementById('datePicker');
  const prevBtn = document.getElementById('prevDayBtn');
  const nextBtn = document.getElementById('nextDayBtn');

  // Summary elements
  const summaryDateLabel = document.getElementById('summaryDateLabel');
  const totalCaloriesEl = document.getElementById('totalCalories');
  const proteinEl = document.getElementById('proteinG');
  const carbsEl = document.getElementById('carbsG');
  const fatEl = document.getElementById('fatG');
  const caloriesHintEl = document.getElementById('caloriesHint');

  // Meals
  const mealsGrid = document.getElementById('mealsGrid');
  const addMealBtn = document.getElementById('addMealBtn');

  // Food search
  const foodQuery = document.getElementById('foodQuery');
  const searchFoodBtn = document.getElementById('searchFoodBtn');
  const quantityGrams = document.getElementById('quantityGrams');
  const foodResults = document.getElementById('foodResults');
  const selectedMealLabel = document.getElementById('selectedMealLabel');
  const createCustomFoodBtn = document.getElementById('createCustomFoodBtn');

  // Modals
  const mealModal = document.getElementById('mealModal');
  const closeMealModal = document.getElementById('closeMealModal');
  const cancelAddMeal = document.getElementById('cancelAddMeal');
  const confirmAddMeal = document.getElementById('confirmAddMeal');
  const mealType = document.getElementById('mealType');

  const customFoodModal = document.getElementById('customFoodModal');
  const closeCustomFoodModal = document.getElementById('closeCustomFoodModal');
  const cancelCustomFood = document.getElementById('cancelCustomFood');
  const customFoodForm = document.getElementById('customFoodForm');

  let dayLogId = null;
  let meals = [];
  let selectedMealId = null;

  function iso(dateObj) {
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    return iso(d);
  }

  function getSelectedDate() {
    const u = new URL(location.href);
    const qp = u.searchParams.get('date');
    return qp && /^\d{4}-\d{2}-\d{2}$/.test(qp) ? qp : iso(new Date());
  }

  function setSelectedDate(dateStr) {
    const u = new URL(location.href);
    u.searchParams.set('date', dateStr);
    history.replaceState({}, '', u.toString());
    datePicker.value = dateStr;
  }

  function openModal(el) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeModal(el) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function fmt(n) {
    const num = Number(n || 0);
    return Math.round(num * 10) / 10;
  }

  async function loadSummary() {
    const summary = await apiFetch(`/api/summary/day/${dayLogId}`);
    summaryDateLabel.textContent = datePicker.value;
    totalCaloriesEl.textContent = Math.round(Number(summary.totalCalories || 0));
    proteinEl.textContent = fmt(summary.protein);
    carbsEl.textContent = fmt(summary.carbs);
    fatEl.textContent = fmt(summary.fat);
    caloriesHintEl.textContent = `${Math.round(Number(summary.totalCalories || 0))} kcal logged`;
  }

  function mealLabel(m) {
    const t = String(m.meal_type || '').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  async function loadMeals() {
    meals = await apiFetch(`/api/meals/${dayLogId}`);
    if (!Array.isArray(meals)) meals = [];

    if (!selectedMealId && meals.length) {
      selectedMealId = meals[0].id;
    }

    const itemsByMeal = new Map();
    await Promise.all(
      meals.map(async (m) => {
        const r = await apiFetch(`/api/meals/${m.id}/items`);
        itemsByMeal.set(m.id, r);
      })
    );

    mealsGrid.innerHTML = '';
    meals.forEach((m) => {
      const r = itemsByMeal.get(m.id) || { items: [], totals: {} };
      const isActive = selectedMealId === m.id;

      const card = document.createElement('div');
      card.className = `meal-card ${isActive ? 'active' : ''}`;
      card.tabIndex = 0;

      const head = document.createElement('div');
      head.className = 'meal-card-header';
      head.innerHTML = `
        <div>
          <div class="meal-title">${mealLabel(m)}</div>
          <div class="muted">${Math.round(Number(r.totals.calories || 0))} kcal</div>
        </div>
        <div class="meal-actions">
          <button class="btn btn-outline btn-xs" type="button" data-action="select">Select</button>
          <button class="icon-btn" type="button" data-action="delete" aria-label="Delete meal">🗑</button>
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'meal-card-body';

      if (!r.items.length) {
        body.innerHTML = `<div class="muted">No foods yet. Select this meal and add foods from search.</div>`;
      } else {
        const list = document.createElement('div');
        list.className = 'meal-items';

        r.items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'meal-item';
          row.innerHTML = `
            <div class="meal-item-main">
              <div class="meal-item-name">${it.name}</div>
              <div class="muted">${Math.round(Number(it.calories || 0))} kcal</div>
            </div>
            <div class="meal-item-controls">
              <input class="input input-xs" type="number" min="1" value="${Math.round(Number(it.quantity_grams || 0))}" data-foodid="${it.food_item_id}" aria-label="Quantity in grams" />
              <span class="muted">g</span>
              <button class="icon-btn" type="button" data-action="remove" data-foodid="${it.food_item_id}" aria-label="Remove">✕</button>
            </div>
          `;
          list.appendChild(row);
        });

        body.appendChild(list);
      }

      const footer = document.createElement('div');
      footer.className = 'meal-card-footer';
      footer.innerHTML = `
        <div class="muted">P ${fmt(r.totals.protein)}g · C ${fmt(r.totals.carbs)}g · F ${fmt(r.totals.fat)}g</div>
      `;

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);

      // Click handlers
      card.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) {
          setSelectedMeal(m.id);
          return;
        }
        const action = btn.dataset.action;
        if (action === 'select') setSelectedMeal(m.id);
        if (action === 'delete') deleteMeal(m.id);
        if (action === 'remove') {
          const foodId = btn.dataset.foodid;
          removeItem(m.id, foodId);
        }
      });

      // Quantity updates
      card.addEventListener('change', (e) => {
        const input = e.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (!input.dataset.foodid) return;
        const foodId = input.dataset.foodid;
        const qty = Math.max(1, Number(input.value || 0));
        updateQuantity(m.id, foodId, qty);
      });

      mealsGrid.appendChild(card);
    });

    updateSelectedMealLabel();
  }

  function setSelectedMeal(mealId) {
    selectedMealId = mealId;
    updateSelectedMealLabel();
    // rerender active state only
    document.querySelectorAll('.meal-card').forEach((c) => c.classList.remove('active'));
    const index = meals.findIndex((m) => m.id === mealId);
    if (index >= 0) mealsGrid.children[index]?.classList.add('active');
  }

  function updateSelectedMealLabel() {
    const m = meals.find((x) => x.id === selectedMealId);
    selectedMealLabel.textContent = m ? mealLabel(m) : '—';
  }

  async function deleteMeal(mealId) {
    if (!confirm('Delete this meal?')) return;
    await apiFetch(`/api/meals/${mealId}`, { method: 'DELETE' });
    if (selectedMealId === mealId) selectedMealId = null;
    await loadMeals();
    await loadSummary();
  }

  async function updateQuantity(mealId, foodId, qty) {
    await apiFetch(`/api/meals/${mealId}/items/${foodId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity_grams: qty })
    });
    await loadMeals();
    await loadSummary();
  }

  async function removeItem(mealId, foodId) {
    await apiFetch(`/api/meals/${mealId}/items/${foodId}`, { method: 'DELETE' });
    await loadMeals();
    await loadSummary();
  }

  async function createMeal() {
    const type = mealType.value;
    const created = await apiFetch('/api/meals', {
      method: 'POST',
      body: JSON.stringify({ day_log_id: dayLogId, meal_type: type })
    });
    selectedMealId = created.id;
    closeModal(mealModal);
    await loadMeals();
    await loadSummary();
  }

  async function searchFoods() {
    const q = String(foodQuery.value || '').trim();
    if (!q) {
      foodResults.innerHTML = '<div class="muted">Type a food name to search.</div>';
      return;
    }
    const results = await apiFetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
    if (!Array.isArray(results) || results.length === 0) {
      foodResults.innerHTML = '<div class="muted">No results.</div>';
      return;
    }

    foodResults.innerHTML = '';
    results.forEach((f) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'food-result';
      row.innerHTML = `
        <div>
          <div class="food-name">${f.name}</div>
          <div class="muted">${Math.round(Number(f.calories_per_100g || 0))} kcal / 100g</div>
        </div>
        <div class="pill pill-secondary">Add</div>
      `;

      row.addEventListener('click', async () => {
        if (!selectedMealId) {
          alert('Create or select a meal first.');
          return;
        }
        const qty = Math.max(1, Number(quantityGrams.value || 100));
        await apiFetch('/api/foods/add-to-meal', {
          method: 'POST',
          body: JSON.stringify({ meal_id: selectedMealId, food_item_id: f.id, quantity_grams: qty })
        });
        await loadMeals();
        await loadSummary();
      });

      foodResults.appendChild(row);
    });
  }

  async function createCustomFood(e) {
    e.preventDefault();
    const name = document.getElementById('cf_name').value.trim();
    const calories = Number(document.getElementById('cf_cal').value);
    const protein = Number(document.getElementById('cf_pro').value || 0);
    const carbs = Number(document.getElementById('cf_carbs').value || 0);
    const fat = Number(document.getElementById('cf_fat').value || 0);

    const created = await apiFetch('/api/foods', {
      method: 'POST',
      body: JSON.stringify({
        name,
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat
      })
    });

    closeModal(customFoodModal);
    foodQuery.value = created.name;
    await searchFoods();
  }

  async function initDay(dateStr) {
    setSelectedDate(dateStr);
    const dayLog = await apiFetch(`/api/day-logs/${dateStr}`);
    dayLogId = dayLog.id;
    await loadMeals();
    await loadSummary();
  }

  function wire() {
    const initial = getSelectedDate();
    datePicker.value = initial;

    datePicker.addEventListener('change', () => {
      const v = datePicker.value;
      if (!v) return;
      initDay(v).catch(() => alert('Failed to load day'));
    });

    prevBtn.addEventListener('click', () => initDay(addDays(datePicker.value || getSelectedDate(), -1)).catch(() => alert('Failed to load day')));
    nextBtn.addEventListener('click', () => initDay(addDays(datePicker.value || getSelectedDate(), 1)).catch(() => alert('Failed to load day')));

    addMealBtn.addEventListener('click', () => openModal(mealModal));
    closeMealModal.addEventListener('click', () => closeModal(mealModal));
    cancelAddMeal.addEventListener('click', () => closeModal(mealModal));
    confirmAddMeal.addEventListener('click', () => createMeal().catch(() => alert('Failed to create meal')));

    searchFoodBtn.addEventListener('click', () => searchFoods().catch(() => alert('Search failed')));
    foodQuery.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchFoods().catch(() => alert('Search failed'));
      }
    });

    createCustomFoodBtn.addEventListener('click', () => openModal(customFoodModal));
    closeCustomFoodModal.addEventListener('click', () => closeModal(customFoodModal));
    cancelCustomFood.addEventListener('click', () => closeModal(customFoodModal));
    customFoodForm.addEventListener('submit', (e) => createCustomFood(e).catch(() => alert('Failed to create custom food')));

    // click outside modal to close
    document.addEventListener('click', (e) => {
      if (e.target === mealModal) closeModal(mealModal);
      if (e.target === customFoodModal) closeModal(customFoodModal);
    });
  }

  wire();
  initDay(getSelectedDate()).catch(() => alert('Failed to load day'));
})();
