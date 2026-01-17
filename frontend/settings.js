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
      calorieGoal.value = p.calorie_goal ?? '';
    }
  } catch {
    // ignore
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
      age: age.value === '' ? null : Number(age.value),
      gender: gender.value === '' ? null : gender.value,
      height_cm: height.value === '' ? null : Number(height.value),
      weight_kg: weight.value === '' ? null : Number(weight.value),
      activity_level: activity.value === '' ? null : activity.value,
      calorie_goal: calorieGoal.value === '' ? null : Number(calorieGoal.value)
    };

    const method = hasProfile ? 'PUT' : 'POST';
    await apiFetch('/api/profile', { method, body: JSON.stringify(body) });
    alert('Saved');
    window.location.href = 'dashboard.html';
  });
})();
