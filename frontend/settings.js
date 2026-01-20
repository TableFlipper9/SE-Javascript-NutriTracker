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
  const goal = document.getElementById('goal');
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
      // Backward compatible mapping (older profiles used: low|moderate|high)
      const actRaw = p.activity_level ?? 'sedentary';
      const actMap = { low: 'sedentary', high: 'active' };
      activity.value = actMap[String(actRaw).toLowerCase()] || actRaw;
      goal.value = p.goal ?? 'maintain';
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

  function refreshRecommended() {
    const est = window.CalorieGoalUtil.calculateRecommendedCalories(
      {
        age: Number(age.value),
        gender: gender.value,
        height_cm: Number(height.value),
        weight_kg: Number(weight.value),
        activity_level: activity.value
      },
      goal.value
    );
    recommendedEl.textContent = est ? `Recommended: ${est} kcal/day` : 'Recommended: —';
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
    goal.addEventListener(evt, refreshRecommended);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
      age: age.value === '' ? null : Number(age.value),
      gender: gender.value === '' ? null : gender.value,
      height_cm: height.value === '' ? null : Number(height.value),
      weight_kg: weight.value === '' ? null : Number(weight.value),
      activity_level: activity.value === '' ? null : activity.value,
      goal: goal.value === '' ? null : goal.value,
      // Custom goal takes priority if provided. If unchecked, backend uses calculated.
      custom_calorie_goal: useCustomGoal.checked && calorieGoal.value !== '' ? Number(calorieGoal.value) : null
    };

    const method = hasProfile ? 'PUT' : 'POST';
    await apiFetch('/api/profile', { method, body: JSON.stringify(body) });
    alert('Saved');
    window.location.href = 'dashboard.html';
  });
})();
