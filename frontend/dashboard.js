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
  const remainingEl = document.getElementById('remainingCalories');
  const progressEl = document.getElementById('goalProgress');
  const weeklyMetaEl = document.getElementById('weeklyMeta');
  const chartCanvas = document.getElementById('weeklyChart');

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
    const width = chartCanvas.width = chartCanvas.clientWidth * (window.devicePixelRatio || 1);
    const height = chartCanvas.height = chartCanvas.height = 180 * (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const padding = 18 * (window.devicePixelRatio || 1);
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

    points.forEach((p, i) => {
      const x = padding + i * (barW + gap);
      const barH = Math.max(0, (p.calories / maxVal) * innerH);
      const y = padding + (innerH - barH);

      // bar
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, barW, barH);

      // goal marker
      if (goal) {
        const gy = padding + (innerH - (goal / maxVal) * innerH);
        ctx.globalAlpha = 0.22;
        ctx.fillRect(x, gy, barW, 2 * (window.devicePixelRatio || 1));
      }
      ctx.globalAlpha = 1;
    });

    // labels (very small)
    ctx.globalAlpha = 0.65;
    ctx.font = `${12 * (window.devicePixelRatio || 1)}px system-ui`;
    ctx.textAlign = 'center';
    points.forEach((p, i) => {
      const x = padding + i * (barW + gap) + barW / 2;
      const d = new Date(p.log_date + 'T00:00:00');
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      ctx.fillText(label, x, height - padding + 14 * (window.devicePixelRatio || 1));
    });
    ctx.globalAlpha = 1;
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

    if (goal) {
      const total = Number(summary.totalCalories || 0);
      const remaining = Math.max(0, Math.round(goal - total));
      const pct = Math.max(0, Math.min(100, (total / goal) * 100));
      goalHintEl.textContent = `Goal: ${goal} kcal`;
      remainingEl.textContent = remaining;
      progressEl.style.width = `${pct}%`;
    } else {
      goalHintEl.textContent = 'Goal: set it in Settings';
      remainingEl.textContent = '—';
      progressEl.style.width = '0%';
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
  }

  wire();
  load().catch(() => alert('Failed to load dashboard'));
})();