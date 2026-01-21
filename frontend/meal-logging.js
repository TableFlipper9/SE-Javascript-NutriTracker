(function () {
  if (!requireAuth()) return;

  const mealTypeEl = document.getElementById('mealType');
  const foodQueryEl = document.getElementById('foodQuery');
  const searchFoodBtn = document.getElementById('searchFoodBtn');
  const foodResultsEl = document.getElementById('foodResults');
  const includeExternalEl = document.getElementById('includeExternal');
  const searchStatusEl = document.getElementById('searchStatus');
  const mealItemsEl = document.getElementById('mealItems');
  const mealBuilderSubtitle = document.getElementById('mealBuilderSubtitle');
  const emptyMealHint = document.getElementById('emptyMealHint');
  const clearMealBtn = document.getElementById('clearMealBtn');
  const saveMealBtn = document.getElementById('saveMealBtn');

  // Totals
  const totalCaloriesEl = document.getElementById('totalCalories');
  const proteinEl = document.getElementById('proteinG');
  const carbsEl = document.getElementById('carbsG');
  const fatEl = document.getElementById('fatG');

  // Custom food modal
  const createCustomFoodBtn = document.getElementById('createCustomFoodBtn');
  const customFoodModal = document.getElementById('customFoodModal');
  const closeCustomFoodModal = document.getElementById('closeCustomFoodModal');
  const cancelCustomFood = document.getElementById('cancelCustomFood');
  const customFoodForm = document.getElementById('customFoodForm');

  /**
   * Local "draft" meal state (not persisted until Save)
   *
   * The Search tab controls the *base grams per portion* for a food.
   * The Builder controls the *number of portions* (x1, x2, x3...).
   *
   * items = [{ food, baseGrams, portions }]
   */
  let items = [];

  function openModal(el) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }
  function closeModal(el) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function titleCase(s) {
    const t = String(s || '').toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function fmt(n) {
    const num = Number(n || 0);
    return Math.round(num * 10) / 10;
  }

  function iso(dateObj) {
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getSelectedDate() {
    // Prefer explicit query param (lets other pages deep-link)
    const u = new URL(location.href);
    const qp = u.searchParams.get('date');
    if (qp && /^\d{4}-\d{2}-\d{2}$/.test(qp)) return qp;

    // Fall back to what dashboard last stored
    try {
      const stored = localStorage.getItem('selectedDate');
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
    } catch {
      // ignore
    }

    // Last resort: today
    return iso(new Date());
  }

  const selectedDate = getSelectedDate();

  function computeTotals() {
    const totals = items.reduce(
      (acc, it) => {
        const grams = Math.max(0, Number(it.baseGrams || 0)) * Math.max(0, Number(it.portions || 0));
        const f = it.food || {};
        acc.calories += (grams / 100) * Number(f.calories_per_100g || 0);
        acc.protein += (grams / 100) * Number(f.protein_per_100g || 0);
        acc.carbs += (grams / 100) * Number(f.carbs_per_100g || 0);
        acc.fat += (grams / 100) * Number(f.fat_per_100g || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return totals;
  }

  function renderMeal() {
    const mealType = titleCase(mealTypeEl.value);
    mealBuilderSubtitle.textContent = mealType ? `${mealType} · ${selectedDate}` : selectedDate;

    mealItemsEl.innerHTML = '';
    if (!items.length) {
      emptyMealHint.style.display = '';
    } else {
      emptyMealHint.style.display = 'none';
    }

    items.forEach((it) => {
      const baseGrams = Math.max(1, Math.round(Number(it.baseGrams || 100)));
      const portions = Math.max(1, Math.round(Number(it.portions || 1)));
      const grams = baseGrams * portions;
      const calories = (grams / 100) * Number(it.food.calories_per_100g || 0);

      const row = document.createElement('div');
      row.className = 'meal-builder-row';
      row.innerHTML = `
        <div class="meal-builder-main">
          <div class="meal-builder-name">${it.food.name}</div>
          <div class="muted">${Math.round(calories)} kcal · ${grams}g <span class="muted" style="font-weight:600;">(x${portions} of ${baseGrams}g)</span></div>
        </div>
        <div class="meal-builder-controls">
          <button class="icon-btn" type="button" data-action="decportion" aria-label="Decrease portions">−</button>
          <input class="input input-sm meal-builder-grams" type="number" min="1" step="1" value="${portions}" data-action="setportion" aria-label="Portions" title="Portions" />
          <button class="icon-btn" type="button" data-action="incportion" aria-label="Increase portions">+</button>
          <button class="icon-btn" type="button" data-action="remove" aria-label="Remove">✕</button>
        </div>
      `;

      row.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'incportion') it.portions = Math.min(50, portions + 1);
        if (action === 'decportion') it.portions = Math.max(1, portions - 1);
        if (action === 'remove' || Number(it.portions || 0) <= 0) {
          items = items.filter((x) => x.food.id !== it.food.id);
        }
        render();
      });

      row.querySelector('input[data-action="setportion"]').addEventListener('input', (e) => {
        const v = Math.max(1, Math.round(Number(e.target.value || 1)));
        it.portions = v;
        render();
      });

      mealItemsEl.appendChild(row);
    });

    const totals = computeTotals();
    totalCaloriesEl.textContent = Math.round(totals.calories);
    proteinEl.textContent = fmt(totals.protein);
    carbsEl.textContent = fmt(totals.carbs);
    fatEl.textContent = fmt(totals.fat);

    saveMealBtn.disabled = items.length === 0;
  }

  function render() {
    renderMeal();
  }

  function foodResultCard(food) {
    const card = document.createElement('div');
    card.className = 'food-row';
    const cal = Math.round(Number(food.calories_per_100g || 0));
    const p = fmt(food.protein_per_100g || 0);
    const c = fmt(food.carbs_per_100g || 0);
    const f = fmt(food.fat_per_100g || 0);

    const isCustom = String(food.source || '') === 'custom' && food.user_id;
    const sourceBadge = String(food.source || '') && String(food.source || '') !== 'custom'
      ? `<span class="meta-chip" title="Source" style="margin-left:8px;">${String(food.source).replace(/</g,'&lt;')}</span>`
      : '';

    card.innerHTML = `
      <div>
        <div class="food-name">${food.name}${sourceBadge}</div>
        <div class="muted">${cal} kcal / 100g</div>
      </div>

      <div class="food-row-meta" aria-label="Macros per 100g">
        <div class="meta-chip"><span class="muted">P</span> ${p}g</div>
        <div class="meta-chip"><span class="muted">C</span> ${c}g</div>
        <div class="meta-chip"><span class="muted">F</span> ${f}g</div>
      </div>

      <div class="qty-stepper" aria-label="Quantity in grams">
        <button class="icon-btn" type="button" data-action="qdec" aria-label="Decrease grams">−</button>
        <input class="input input-sm" type="number" min="1" step="1" value="100" data-role="qty" />
        <button class="icon-btn" type="button" data-action="qinc" aria-label="Increase grams">+</button>
      </div>

      <div class="row gap" style="justify-content:flex-end;">
        ${isCustom ? `<button class="icon-btn" type="button" data-action="delete" aria-label="Delete food" title="Delete food">🗑</button>` : ''}
        <button class="icon-btn icon-plus" type="button" data-action="add" aria-label="Add">+</button>
      </div>
    `;

    const qtyInput = card.querySelector('input[data-role="qty"]');

    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const step = 25;
      let qty = Math.max(1, Math.round(Number(qtyInput.value || 100)));
      if (action === 'qinc') qty = Math.min(5000, qty + step);
      if (action === 'qdec') qty = Math.max(1, qty - step);
      qtyInput.value = String(qty);

      if (action === 'delete') {
        if (!confirm(`Remove "${food.name}" from your foods list? (Past logs stay intact)`)) return;
        apiFetch(`/api/foods/${food.id}`, { method: 'DELETE' })
          .then(() => {
            // Remove from current meal if present
            items = items.filter((x) => x.food.id !== food.id);
            card.remove();
            render();
          })
          .catch((err) => alert(err.message));
        return;
      }

      if (action === 'add') {
        // External items may come without a DB id (when we can't cache due to DB constraints).
        // Import them first so we can reference a stable food_item_id in meal logs.
        const doAdd = async () => {
          let actualFood = food;
          if (!actualFood.id) {
            actualFood = await apiFetch('/api/foods/import-external', {
              method: 'POST',
              body: JSON.stringify({
                name: actualFood.name,
                calories_per_100g: actualFood.calories_per_100g,
                protein_per_100g: actualFood.protein_per_100g,
                carbs_per_100g: actualFood.carbs_per_100g,
                fat_per_100g: actualFood.fat_per_100g
              })
            });
          }

          const existing = items.find((x) => x.food.id === actualFood.id);
          if (existing) {
            // If the user adds the same base portion size, treat it as "+1 portion".
            // If they change the base grams in search, update the portion size and reset to x1.
            if (Math.round(Number(existing.baseGrams || 0)) === qty) {
              existing.portions = Math.min(50, Math.max(1, Math.round(Number(existing.portions || 1))) + 1);
            } else {
              existing.baseGrams = qty;
              existing.portions = 1;
            }
          } else {
            items.push({ food: actualFood, baseGrams: qty, portions: 1 });
          }
          render();
        };

        doAdd().catch((err) => alert(err.message));
      }
    });

    return card;
  }

  async function searchFoods() {
    const q = String(foodQueryEl.value || '').trim();
    if (!q) {
      foodResultsEl.innerHTML = '<div class="muted">Type something to search.</div>';
      return;
    }

    foodResultsEl.innerHTML = '';
    if (searchStatusEl) searchStatusEl.textContent = 'Searching…';

    // Local first
    const local = await apiFetch(`/api/foods/search?q=${encodeURIComponent(q)}`);

    // Optional external fan-out
    let external = [];
    const includeExternal = includeExternalEl ? includeExternalEl.checked : true;
    if (includeExternal) {
      try {
        external = await apiFetch(`/api/foods/search-external?q=${encodeURIComponent(q)}`);
      } catch {
        external = [];
      }
    }

    const localArr = Array.isArray(local) ? local : [];
    const extArr = Array.isArray(external) ? external : [];

    const mkSection = (title) => {
      const el = document.createElement('div');
      el.className = 'muted';
      el.style.fontWeight = '800';
      el.style.margin = '10px 0 6px';
      el.textContent = title;
      return el;
    };

    if (localArr.length === 0 && extArr.length === 0) {
      foodResultsEl.innerHTML = '<div class="muted">No results.</div>';
      if (searchStatusEl) searchStatusEl.textContent = '';
      return;
    }

    if (localArr.length) {
      foodResultsEl.appendChild(mkSection('Local foods'));
      localArr.forEach((f) => foodResultsEl.appendChild(foodResultCard(f)));
    }

    // Avoid duplicates (same id can happen if an external item was cached earlier)
    const localIds = new Set(localArr.map((x) => x.id));
    const filteredExt = extArr.filter((x) => !localIds.has(x.id));
    if (filteredExt.length) {
      foodResultsEl.appendChild(mkSection('Online foods'));
      filteredExt.forEach((f) => foodResultsEl.appendChild(foodResultCard(f)));
    }

    if (searchStatusEl) searchStatusEl.textContent = '';
  }

  async function saveMeal() {
    if (!items.length) return;

    saveMealBtn.disabled = true;
    saveMealBtn.textContent = 'Saving…';
    try {
      // Create (or get) today's day log
      const dayLog = await apiFetch(`/api/day-logs/${selectedDate}`);

      // Create meal
      const createdMeal = await apiFetch('/api/meals', {
        method: 'POST',
        body: JSON.stringify({ day_log_id: dayLog.id, meal_type: mealTypeEl.value })
      });

      // Add foods (in order)
      for (const it of items) {
        const qty = Math.max(1, Math.round(Number(it.baseGrams || 0)) * Math.max(1, Math.round(Number(it.portions || 1))));
        await apiFetch('/api/foods/add-to-meal', {
          method: 'POST',
          body: JSON.stringify({ meal_id: createdMeal.id, food_item_id: it.food.id, quantity_grams: qty })
        });
      }

      // Reset local state and go back to dashboard
      items = [];
      render();
      window.location.href = `dashboard.html?date=${encodeURIComponent(selectedDate)}`;
    } finally {
      saveMealBtn.disabled = items.length === 0;
      saveMealBtn.textContent = 'Save Meal';
    }
  }

  // Custom food creation
  createCustomFoodBtn?.addEventListener('click', () => openModal(customFoodModal));
  closeCustomFoodModal?.addEventListener('click', () => closeModal(customFoodModal));
  cancelCustomFood?.addEventListener('click', () => closeModal(customFoodModal));

  customFoodForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cf_name').value;
    const cal = document.getElementById('cf_cal').value;
    const pro = document.getElementById('cf_pro').value;
    const carbs = document.getElementById('cf_carbs').value;
    const fat = document.getElementById('cf_fat').value;

    const created = await apiFetch('/api/foods', {
      method: 'POST',
      body: JSON.stringify({
        name,
        calories_per_100g: Number(cal),
        protein_per_100g: pro === '' ? null : Number(pro),
        carbs_per_100g: carbs === '' ? null : Number(carbs),
        fat_per_100g: fat === '' ? null : Number(fat)
      })
    });

    closeModal(customFoodModal);
    customFoodForm.reset();
    // Convenience: add the newly created food to the meal
    if (created && created.id) {
      const existing = items.find((x) => x.food.id === created.id);
      if (existing) {
        existing.portions = Math.min(50, Math.max(1, Math.round(Number(existing.portions || 1))) + 1);
      } else {
        items.push({ food: created, baseGrams: 100, portions: 1 });
      }
      render();
    }
  });

  // Events
  // Search-as-you-type (debounced)
  let t = null;
  foodQueryEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => searchFoods().catch(() => {}), 220);
  });
  searchFoodBtn.addEventListener('click', () => searchFoods().catch(() => {}));

  mealTypeEl.addEventListener('change', render);
  clearMealBtn.addEventListener('click', () => {
    if (!items.length) return;
    if (!confirm('Clear this meal?')) return;
    items = [];
    render();
  });
  saveMealBtn.addEventListener('click', saveMeal);

  // Initial render
  render();
})();
