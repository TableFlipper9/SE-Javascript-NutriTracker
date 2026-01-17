(async()=>{
if(!requireAuth())return;document.getElementById("logoutBtn").onclick=logout;
try{const p=await apiFetch("/api/profile");if(p){age.value=p.age||"";gender.value=p.gender||"";height.value=p.height_cm||"";weight.value=p.weight_kg||"";activity.value=p.activity_level||"";calorieGoal.value=p.calorie_goal||"";}}catch{}
document.getElementById("pf").addEventListener("submit",async(e)=>{e.preventDefault();
const body={age:age.value||null,gender:gender.value||null,height_cm:height.value||null,weight_kg:weight.value||null,activity_level:activity.value||null,calorie_goal:calorieGoal.value||null};
let method="POST";try{await apiFetch("/api/profile");method="PUT";}catch{}
await apiFetch("/api/profile",{method,body:JSON.stringify(body)});window.location.href="dashboard.html";});})();
