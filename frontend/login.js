// Get email + password
// Send to backend
// If wrong → show error
// If correct → save token
// Redirect based on role

// Redirect already-logged-in user away from login page
const token = localStorage.getItem("token");
if (token) {
  window.location.href = "index.html";
}


async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("msg");

  if (!email || !password) {
    msg.textContent = "Please enter all fields";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || "Login failed";
      return;
    }

    // Save token + role + wallet
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("wallet", data.wallet);

    // Redirect based on role
    if (data.role === "donor") {
      window.location.replace("donor-dashboard.html");
    } else if (data.role === "ngo") {
      window.location.replace("ngo-dashboard.html");
    }

  } catch (err) {
    console.log(err);
    msg.textContent = "Server error";
  }
}
