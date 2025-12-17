async function signupUser() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value.trim();
  const wallet = document.getElementById("wallet").value.trim();
  const msg = document.getElementById("msg");

  if (!name || !email || !password || !role) {
    msg.textContent = "All required fields must be filled.";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        wallet_address: wallet || null
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || "Signup failed";
      return;
    }

    // Signup success
    msg.style.color = "green";
    msg.textContent = "Signup successful! Redirecting...";
    
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);

  } catch (error) {
    console.log(error);
    msg.textContent = "Server error";
  }
}
