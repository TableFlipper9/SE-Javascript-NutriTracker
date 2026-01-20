(async function () {
  if (!requireAuth()) return;

  // Account deletion
  document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
    const ok = confirm('Delete your account and all your data? This cannot be undone.');
    if (!ok) return;
    await apiFetch('/api/account', { method: 'DELETE' });
    logout();
  });

  const form = document.getElementById('profileForm');
  const age = document.getElementById('age');
  const gender = document.getElementById('gender');
  const height = document.getElementById('height');
  const weight = document.getElementById('weight');
  const activity = document.getElementById('activity');
  const calorieGoal = document.getElementById('calorieGoal');
  const useCustomGoal = document.getElementById('useCustomGoal');
  const recommendedEl = document.getElementById('recommendedGoal');

  let hasProfile = false;

  try {
    const p = await apiFetch('/api/profile');
    if (p) {
      hasProfile = true;
      age.value = p.age ?? '';
      gender.value = p.gender ?? '';
      height.value = p.height_cm ?? '';
      weight.value = p.weight_kg ?? '';
      activity.value = p.activity_level ?? 'low';
      // Recommended (calculated) goal is stored server-side
      const calc = p.calculated_calorie_goal ?? null;
      recommendedEl.textContent = calc ? `Recommended: ${calc} kcal/day` : 'Recommended: —';

      const custom = p.custom_calorie_goal ?? null;
      useCustomGoal.checked = custom !== null && custom !== undefined;
      calorieGoal.disabled = !useCustomGoal.checked;
      calorieGoal.value = useCustomGoal.checked ? String(custom) : '';
    }
  } catch {
    // ignore
  }

  // Local preview when editing fields (matches backend approach)
  function activityMultiplier(a) {
    switch (String(a || '').toLowerCase()) {
      case 'sedentary':
      case 'low': return 1.2;
      case 'light': return 1.375;
      case 'moderate': return 1.55;
      case 'active':
      case 'high': return 1.725;
      case 'very_active': return 1.9;
      default: return 1.2;
    }
  }

  function estimateGoal() {
    const a = Number(age.value);
    const h = Number(height.value);
    const w = Number(weight.value);
    const g = String(gender.value || '').toLowerCase();
    const act = activity.value;
    if (!Number.isFinite(a) || !Number.isFinite(h) || !Number.isFinite(w) || !g || !act) return null;

    const base = 10 * w + 6.25 * h - 5 * a;
    let bmr;
    if (g === 'male') bmr = base + 5;
    else if (g === 'female') bmr = base - 161;
    else bmr = base + (5 - 161) / 2;

    return Math.max(800, Math.round(bmr * activityMultiplier(act)));
  }

  function refreshRecommended() {
    const est = estimateGoal();
    if (est) recommendedEl.textContent = `Recommended: ${est} kcal/day`;
  }

  useCustomGoal.addEventListener('change', () => {
    calorieGoal.disabled = !useCustomGoal.checked;
    if (!useCustomGoal.checked) calorieGoal.value = '';
  });

  ['input', 'change'].forEach(evt => {
    age.addEventListener(evt, refreshRecommended);
    gender.addEventListener(evt, refreshRecommended);
    height.addEventListener(evt, refreshRecommended);
    weight.addEventListener(evt, refreshRecommended);
    activity.addEventListener(evt, refreshRecommended);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
      age: age.value === '' ? null : Number(age.value),
      gender: gender.value === '' ? null : gender.value,
      height_cm: height.value === '' ? null : Number(height.value),
      weight_kg: weight.value === '' ? null : Number(weight.value),
      activity_level: activity.value === '' ? null : activity.value,
      // Custom goal takes priority if provided. If unchecked, backend uses calculated.
      calorie_goal: useCustomGoal.checked && calorieGoal.value !== '' ? Number(calorieGoal.value) : null
    };

    const method = hasProfile ? 'PUT' : 'POST';
    await apiFetch('/api/profile', { method, body: JSON.stringify(body) });
    alert('Saved');
    window.location.href = 'dashboard.html';
  });
})();
