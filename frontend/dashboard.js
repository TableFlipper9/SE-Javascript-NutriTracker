(function () {
  if (!requireAuth()) return;

  const datePicker = document.getElementById('datePicker');
  const prevBtn = document.getElementById('prevDayBtn');
  const nextBtn = document.getElementById('nextDayBtn');

  const summaryDateLabel = document.getElementById('summaryDateLabel');
  const totalCaloriesEl = document.getElementById('totalCalories');
  const proteinEl = document.getElementById('proteinG');
  const carbsEl = document.getElementById('carbsG');
  const fatEl = document.getElementById('fatG');
  const mealCountEl = document.getElementById('mealCount');
  const goalHintEl = document.getElementById('goalHint');
  const remainingLabelEl = document.getElementById('remainingLabel');
  const remainingEl = document.getElementById('remainingCalories');
  const progressEl = document.getElementById('goalProgress');
  const weeklyMetaEl = document.getElementById('weeklyMeta');
  const chartCanvas = document.getElementById('weeklyChart');

  // Weekly chart hover tooltip
  let weeklyHitboxes = [];
  let weeklyTooltip = null;

  // Today's goal meal-type indicators
  const hasBreakfastEl = document.getElementById('hasBreakfast');
  const hasLunchEl = document.getElementById('hasLunch');
  const hasDinnerEl = document.getElementById('hasDinner');
  const hasSnackEl = document.getElementById('hasSnack');

  // Today's meals panels (tabs)
  const mealsPanel = document.getElementById('todayMealsPanel');
  const foodsPanel = document.getElementById('todayFoodsPanel');
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn[data-tab]'));

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

  async function getProfile() {
    try {
      return await apiFetch('/api/profile');
    } catch {
      return null;
    }
  }

  function drawWeeklyChart(points, goal) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    const dpr = (window.devicePixelRatio || 1);
    const width = (chartCanvas.width = chartCanvas.clientWidth * dpr);
    const height = (chartCanvas.height = 180 * dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = 18 * dpr;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const maxVal = Math.max(goal || 0, ...points.map(p => p.calories), 500);

    // axes
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const barCount = points.length || 7;
    const gap = innerW * 0.04;
    const barW = (innerW - gap * (barCount - 1)) / barCount;

    function barFillStyle(cal) {
      if (!goal) return 'rgba(255,255,255,0.85)';
      const diff = Math.abs(Number(cal || 0) - Number(goal || 0));
      if (diff < 100) return 'hsl(140 65% 45%)'; // green
      if (diff > 1000) return 'hsl(5 75% 55%)'; // red
      // Between: shades of yellow/orange
      const t = Math.max(0, Math.min(1, (diff - 100) / 900));
      // hue 60 (yellow) -> 35 (orange)
      const hue = 60 - t * 25;
      const light = 52 - t * 6;
      return `hsl(${hue} 85% ${light}%)`;
    }

    weeklyHitboxes = [];
    points.forEach((p, i) => {
      const x = padding + i * (barW + gap);
      const barH = Math.max(0, (p.calories / maxVal) * innerH);
      const y = padding + (innerH - barH);

      // bar
      ctx.fillStyle = barFillStyle(p.calories);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, barW, barH);

      // hitbox for tooltip (in device pixels)
      const d = new Date(p.log_date + 'T00:00:00');
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
      weeklyHitboxes.push({
        x,
        y,
        w: barW,
        h: barH,
        label: `${weekday} • ${Math.round(Number(p.calories || 0))} kcal`
      });

      ctx.globalAlpha = 1;
    });

    // goal limit line (always black)
    if (goal) {
      const gy = padding + (innerH - (goal / maxVal) * innerH);
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1 * dpr;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(padding, gy);
      ctx.lineTo(width - padding, gy);
      ctx.stroke();
      ctx.restore();
    }

    // labels (very small)
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.font = `${12 * dpr}px system-ui`;
    ctx.textAlign = 'center';
    points.forEach((p, i) => {
      const x = padding + i * (barW + gap) + barW / 2;
      const d = new Date(p.log_date + 'T00:00:00');
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      ctx.fillText(label, x, height - padding + 14 * dpr);
    });

    // Wire tooltip listeners once
    if (!chartCanvas.__weeklyTooltipWired) {
      chartCanvas.__weeklyTooltipWired = true;

      chartCanvas.addEventListener('mousemove', (e) => {
        if (!weeklyHitboxes || weeklyHitboxes.length === 0) return;
        const cx = (e.offsetX || 0) * dpr;
        const cy = (e.offsetY || 0) * dpr;

        const hit = weeklyHitboxes.find((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
        if (!hit) {
          if (weeklyTooltip) weeklyTooltip.classList.remove('show');
          return;
        }

        if (!weeklyTooltip) {
          weeklyTooltip = document.createElement('div');
          weeklyTooltip.className = 'chart-tooltip';
          document.body.appendChild(weeklyTooltip);
        }

        weeklyTooltip.textContent = hit.label;
        weeklyTooltip.style.left = `${e.clientX + 12}px`;
        weeklyTooltip.style.top = `${e.clientY - 10}px`;
        weeklyTooltip.classList.add('show');
      });

      chartCanvas.addEventListener('mouseleave', () => {
        if (weeklyTooltip) weeklyTooltip.classList.remove('show');
      });
    }
  }

  function mealLabel(m) {
    const t = String(m.meal_type || '').toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Meal';
  }

  async function renderTodaysMeals(meals) {
    if (!mealsPanel || !foodsPanel) return;

    mealsPanel.innerHTML = '';
    foodsPanel.innerHTML = '';

    if (!Array.isArray(meals) || meals.length === 0) {
      mealsPanel.innerHTML = '<div class="muted">No meals logged yet.</div>';
      foodsPanel.innerHTML = '<div class="muted">No foods logged yet.</div>';
      return;
    }

    // Fetch items for each meal
    const itemsByMeal = new Map();
    await Promise.all(
      meals.map(async (m) => {
        const r = await apiFetch(`/api/meals/${m.id}/items`);
        itemsByMeal.set(m.id, r);
      })
    );

    // Meals tab: expandable meals
    meals.forEach((m) => {
      const r = itemsByMeal.get(m.id) || { items: [], totals: {} };
      const details = document.createElement('details');
      details.className = 'meal-details';
      const cal = Math.round(Number(r.totals?.calories || 0));
      details.innerHTML = `
        <summary class="meal-details-summary">
          <div>
            <div style="font-weight:800;">${mealLabel(m)}</div>
            <div class="muted">${r.items.length} foods</div>
          </div>
          <div style="font-weight:800;">${cal} kcal</div>
        </summary>
        <div class="meal-details-body"></div>
      `;

      const body = details.querySelector('.meal-details-body');
      if (!r.items.length) {
        body.innerHTML = '<div class="muted">No foods in this meal.</div>';
      } else {
        const list = document.createElement('div');
        list.className = 'stack';
        r.items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'meal-food-row';
          row.innerHTML = `
            <div>
              <div style="font-weight:700;">${it.name}</div>
              <div class="muted">${Math.round(Number(it.quantity_grams || 0))}g</div>
            </div>
            <div style="font-weight:700;">${Math.round(Number(it.calories || 0))} kcal</div>
          `;
          list.appendChild(row);
        });
        body.appendChild(list);
      }

      mealsPanel.appendChild(details);
    });

    // Foods tab: flattened list
    const flat = [];
    meals.forEach((m) => {
      const r = itemsByMeal.get(m.id) || { items: [] };
      r.items.forEach((it) => flat.push({ ...it, _meal: mealLabel(m) }));
    });

    if (!flat.length) {
      foodsPanel.innerHTML = '<div class="muted">No foods logged yet.</div>';
      return;
    }

    flat.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'meal-food-row';
      row.innerHTML = `
        <div>
          <div style="font-weight:700;">${it.name}</div>
          <div class="muted">${it._meal} · ${Math.round(Number(it.quantity_grams || 0))}g</div>
        </div>
        <div style="font-weight:700;">${Math.round(Number(it.calories || 0))} kcal</div>
      `;
      foodsPanel.appendChild(row);
    });
  }

  async function load() {
    const selected = getSelectedDate();
    setSelectedDate(selected);

    const profile = await getProfile();
    const goal = profile && profile.calorie_goal ? Number(profile.calorie_goal) : null;

    // day log + meals + summary
    const dayLog = await apiFetch(`/api/day-logs/${selected}`);
    const [summary, meals] = await Promise.all([
      apiFetch(`/api/summary/day/${dayLog.id}`),
      apiFetch(`/api/meals/${dayLog.id}`)
    ]);

    summaryDateLabel.textContent = selected;
    totalCaloriesEl.textContent = Math.round(Number(summary.totalCalories || 0));
    proteinEl.textContent = Math.round(Number(summary.protein || 0));
    carbsEl.textContent = Math.round(Number(summary.carbs || 0));
    fatEl.textContent = Math.round(Number(summary.fat || 0));
    mealCountEl.textContent = Array.isArray(meals) ? meals.length : 0;

    // Meal-type pills (Breakfast/Lunch/Dinner/Snack)
    const present = new Set(
      (Array.isArray(meals) ? meals : []).map(m => String(m.meal_type || '').toLowerCase())
    );
    const pairs = [
      ['breakfast', hasBreakfastEl],
      ['lunch', hasLunchEl],
      ['dinner', hasDinnerEl],
      ['snack', hasSnackEl]
    ];
    pairs.forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('active', present.has(key));
    });

    await renderTodaysMeals(Array.isArray(meals) ? meals : []);

    if (goal) {
      const total = Number(summary.totalCalories || 0);
      const diff = Math.round(goal - total);
      const over = diff < 0;
      const remaining = Math.max(0, diff);
      const pct = Math.max(0, Math.min(100, (total / goal) * 100));
      goalHintEl.textContent = `Goal: ${goal} kcal`;

      // Remaining/Over label + value
      if (remainingLabelEl) remainingLabelEl.textContent = over ? 'Over' : 'Remaining';
      remainingEl.textContent = over ? Math.abs(diff) : remaining;

      // Progress bar
      progressEl.style.width = `${pct}%`;
      progressEl.classList.toggle('over', over);
      progressEl.setAttribute('aria-valuemin', '0');
      progressEl.setAttribute('aria-valuemax', String(goal));
      progressEl.setAttribute('aria-valuenow', String(Math.round(total)));
      progressEl.title = over
        ? `${Math.round(total)} / ${goal} kcal (over by ${Math.abs(diff)} kcal)`
        : `${Math.round(total)} / ${goal} kcal (${Math.round(pct)}%)`;
    } else {
      goalHintEl.textContent = 'Goal: set it in Settings';
      if (remainingLabelEl) remainingLabelEl.textContent = 'Remaining';
      remainingEl.textContent = '—';
      progressEl.style.width = '0%';
      progressEl.classList.remove('over');
      progressEl.removeAttribute('title');
      progressEl.removeAttribute('aria-valuemin');
      progressEl.removeAttribute('aria-valuemax');
      progressEl.removeAttribute('aria-valuenow');
    }

    // weekly chart: last 7 days ending selected
    const weekStart = addDays(selected, -6);
    const rows = await apiFetch(`/api/summary/week?start=${weekStart}`);
    const map = new Map(rows.map(r => [String(r.log_date).slice(0, 10), Number(r.calories || 0)]));
    const points = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { log_date: d, calories: map.get(d) || 0 };
    });

    const avg = points.reduce((a, p) => a + p.calories, 0) / 7;
    weeklyMetaEl.textContent = `Week of ${weekStart} • Avg ${Math.round(avg)} kcal/day`;
    drawWeeklyChart(points, goal);
  }

  function wire() {
    const selected = getSelectedDate();
    datePicker.value = selected;
    datePicker.addEventListener('change', () => {
      const v = datePicker.value;
      if (!v) return;
      setSelectedDate(v);
      load().catch(() => alert('Failed to load dashboard'));
    });

    prevBtn.addEventListener('click', () => {
      const v = datePicker.value || getSelectedDate();
      const d = addDays(v, -1);
      setSelectedDate(d);
      load().catch(() => alert('Failed to load dashboard'));
    });
    nextBtn.addEventListener('click', () => {
      const v = datePicker.value || getSelectedDate();
      const d = addDays(v, 1);
      setSelectedDate(d);
      load().catch(() => alert('Failed to load dashboard'));
    });

    window.addEventListener('resize', () => {
      // redraw without refetch
      load().catch(() => {});
    });

    // Tabs
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabButtons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('[data-tabpanel]').forEach((p) => {
          const el = p;
          el.style.display = el.getAttribute('data-tabpanel') === tab ? '' : 'none';
        });
      });
    });
  }

  wire();
  load().catch(() => alert('Failed to load dashboard'));
})();