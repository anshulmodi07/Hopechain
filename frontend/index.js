// index.js
//Ensures Dashboard button works correctly after back navigation
window.onpageshow = function (event) {
  //➡️ The page was NOT reloaded from server.
// ➡️ It was restored from browser’s cache.
  if (event.persisted) {
    window.location.reload();
  }
};


window.onload = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  const loginLink = document.getElementById("loginLink");
  const signupLink = document.getElementById("signupLink");
  const dashboardLink = document.getElementById("dashboardLink");
  const logoutBtn = document.getElementById("logoutBtn");

  if (token && role) {
    // Hide login & signup
    if (loginLink) loginLink.style.display = "none";
    if (signupLink) signupLink.style.display = "none";

    // Show dashboard + logout
    if (dashboardLink) {
      dashboardLink.style.display = "inline";
      dashboardLink.href = role === "ngo" ? "ngo-dashboard.html" : "donor-dashboard.html";
    }
    if (logoutBtn) {
      logoutBtn.style.display = "inline";
    }
  } else {
    // User not logged in - show login/signup
    if (loginLink) loginLink.style.display = "inline";
    if (signupLink) signupLink.style.display = "inline";
    if (dashboardLink) dashboardLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
};

// Logout functionality
const logoutButton = document.getElementById("logoutBtn");
if (logoutButton) {
  logoutButton.onclick = (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = "index.html";
  };
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});