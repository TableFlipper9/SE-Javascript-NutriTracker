async function apiFetch(url, options = {}) {
  const token = getToken();

  const res = await fetch(`http://localhost:3000${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    }
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
