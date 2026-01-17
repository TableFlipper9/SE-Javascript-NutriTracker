(async()=>{
if(!requireAuth())return;document.getElementById("logoutBtn").onclick=logout;
const p=new URLSearchParams(location.search);const q=p.get("q")||"";document.getElementById("fdName").textContent=q||"Food";
const out=document.getElementById("fdOut");if(!q){out.textContent="Use ?q=...";return;}
const r=await apiFetch(`/api/foods/search?q=${encodeURIComponent(q)}`);const f=r&&r[0];if(!f){out.textContent="Not found.";return;}
out.innerHTML=`<div class=stack><div><b>${f.name}</b></div><div class=muted>${Math.round(f.calories_per_100g)} kcal / 100g</div></div>`;
})().catch(e=>alert(e.message));
