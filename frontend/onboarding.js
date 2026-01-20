(async () => {
  if (!requireAuth()) return;

  document.getElementById('logoutBtn').onclick = logout;

  const elAge = document.getElementById('age');
  const elGender = document.getElementById('gender');
  const elHeight = document.getElementById('height');
  const elWeight = document.getElementById('weight');
  const elActivity = document.getElementById('activity');
  const elRecommended = document.getElementById('recommendedGoal');
  const elUseCustom = document.getElementById('useCustomGoal');
  const elCustom = document.getElementById('customGoal');

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Match backend (Mifflin–St Jeor + activity multiplier)
  function estimateDailyCalories({ age, gender, height_cm, weight_kg, activity_level }) {
    if (!age || !gender || !height_cm || !weight_kg || !activity_level) return null;
    const g = String(gender).toLowerCase();
    const a = String(activity_level);

    let s;
    if (g === 'male') s = 5;
    else if (g === 'female') s = -161;
    else s = -78; // neutral-ish for "other"

    const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + s;
    const multMap = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    const mult = multMap[a] ?? 1.2;
    const tdee = bmr * mult;
    return Math.max(1200, Math.round(tdee));
  }

  function updateRecommendedUI() {
    const calc = estimateDailyCalories({
      age: num(elAge.value),
      gender: elGender.value,
      height_cm: num(elHeight.value),
      weight_kg: num(elWeight.value),
      activity_level: elActivity.value
    });

    elRecommended.textContent = calc ? `${calc} kcal/day` : '—';
  }

  // Toggle custom goal
  elUseCustom.addEventListener('change', () => {
    elCustom.disabled = !elUseCustom.checked;
    if (!elUseCustom.checked) elCustom.value = '';
    else elCustom.focus();
  });

  // Live update recommended goal as user types
  [elAge, elGender, elHeight, elWeight, elActivity].forEach((el) => {
    el.addEventListener('input', updateRecommendedUI);
    el.addEventListener('change', updateRecommendedUI);
  });

  // Prefill if profile exists
  try {
    const p = await apiFetch('/api/profile');
    if (p) {
      elAge.value = p.age ?? '';
      elGender.value = p.gender ?? '';
      elHeight.value = p.height_cm ?? '';
      elWeight.value = p.weight_kg ?? '';
      elActivity.value = p.activity_level ?? '';

      // If backend supports the new schema, prefer custom_calorie_goal.
      const custom = p.custom_calorie_goal ?? null;
      if (custom) {
        elUseCustom.checked = true;
        elCustom.disabled = false;
        elCustom.value = custom;
      }
    }
  } catch {}

  updateRecommendedUI();

  document.getElementById('pf').addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
      age: num(elAge.value),
      gender: elGender.value,
      height_cm: num(elHeight.value),
      weight_kg: num(elWeight.value),
      activity_level: elActivity.value,
      custom_calorie_goal: elUseCustom.checked ? num(elCustom.value) : null
    };

    // Create vs update
    let method = 'POST';
    try {
      const existing = await apiFetch('/api/profile');
      if (existing) method = 'PUT';
    } catch {}

    const res = await apiFetch('/api/profile', {
      method,
      body: JSON.stringify(body)
    });

    // Profile saved; go to dashboard.
    window.location.href = 'dashboard.html';
  });
})();
