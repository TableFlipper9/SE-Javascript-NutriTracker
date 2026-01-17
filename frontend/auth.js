function setToken(token){localStorage.setItem("token",token)}
function getToken(){return localStorage.getItem("token")}
function logout(){localStorage.removeItem("token");window.location.href="login.html"}
function requireAuth(){if(!getToken()){window.location.href="login.html";return false;}return true;}
