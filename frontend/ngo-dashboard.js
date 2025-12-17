// Protect dashboard: only NGOs allowed
window.onload = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "ngo") {
    alert("Access Denied! Please login as NGO.");
    window.location.href = "login.html";
    return;
  }
};

// LOGOUT
document.getElementById("logoutBtn").onclick = () => {
  localStorage.clear();
  window.location.href = "index.html";
};

// Load My Fundraisers
async function loadMyFundraisers() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("fundraisersList");

  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch("http://localhost:5000/api/my-fundraisers", {
      headers: { "Authorization": token }
    });

    const fundraisers = await res.json();

    if (fundraisers.length === 0) {
      container.innerHTML = "<p>You have not created any fundraisers yet.</p>";
      return;
    }

    container.innerHTML = "";

    fundraisers.forEach(f => {
      const raised = f.raised || 0;
      const goal = f.goal;
      const percent = Math.min((raised / goal) * 100, 100);

      const card = `
        <div class="card">
          <h3>${f.title}</h3>
          <p>${f.description.substring(0, 120)}...</p>

          <p><strong>Category:</strong> ${f.category}</p>
          <p><strong>People Affected:</strong> ${f.peopleAffected}</p>

          <p><strong>Raised:</strong> ₹${raised} / ₹${goal}</p>

          <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>

          <button class="btn" onclick="window.location.href='fundraiser-detail.html?id=${f.fundraiserId}'">
            View
          </button>
        </div>
      `;

      container.innerHTML += card;
    });

  } catch (err) {
    console.log(err);
    container.innerHTML = "<p>Error loading fundraisers.</p>";
  }
}

// Connect MetaMask
async function connectMetaMask() {
  const status = document.getElementById("walletStatus");

  if (!window.ethereum) {
    status.textContent = "MetaMask not installed!";
    return;
  }

  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const wallet = accounts[0];
    status.textContent = "Connected Wallet: " + wallet;

    localStorage.setItem("wallet", wallet);
  } catch (err) {
    status.textContent = "Failed to connect MetaMask.";
  }
}
