(async function () {
  if (!requireAuth()) return;

  const out = document.getElementById('reportsOut');
  const today = new Date();

  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    try {
      const day = await apiFetch(`/api/day-logs/${iso}`);
      const s = await apiFetch(`/api/summary/day/${day.id}`);
      rows.push([iso, Math.round(Number(s.totalCalories || 0))]);
    } catch {
      rows.push([iso, 0]);
    }
  }

  out.innerHTML = rows
    .map(
      (r) =>
        `<div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--border)"><span>${r[0]}</span><b>${r[1]} kcal</b></div>`
    )
    .join('');
})().catch((e) => alert(e.message));
