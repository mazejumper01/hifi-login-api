const res = await fetch(`https://hifi-login-api.onrender.com/api/profile?email=${encodeURIComponent(email)}`);
const profile = await res.json();