async function loadFundraisers() {
  const grid = document.getElementById("fundraisersGrid");

  try {
    const res = await fetch("http://localhost:5000/api/fundraisers");
    const fundraisers = await res.json();

    grid.innerHTML = "";

    fundraisers.forEach(f => {
      const role = localStorage.getItem("role");
      const userWallet = localStorage.getItem("wallet");

      // FIXED: backend returns ownerWallet (camelCase)
      const ownerWallet = f.ownerWallet;

      const shortDesc = f.description.length > 100
        ? f.description.substring(0, 100) + "..."
        : f.description;

      const raised = f.raised || 0;
      const goal = f.goal;

      const progressPercent = Math.min((raised / goal) * 100, 100);

      const donateButton =
        (role === "ngo" && userWallet === ownerWallet)
          ? "" // NGO cannot donate to own fundraiser
          : `<button class="donate-btn" onclick="handleDonate(${f.fundraiserId})">Donate</button>`;

      const card = `
        <div class="card">
          <h3>${f.title}</h3>
          <p>${shortDesc}</p>

          <p><strong>Category:</strong> ${f.category}</p>
          <p><strong>People Affected:</strong> ${f.peopleAffected}</p>

          <p><strong>Raised:</strong> ₹${raised} / ₹${goal}</p>

          <div class="progress-bar">
            <div class="progress-fill" style="width:${progressPercent}%"></div>
          </div>

          <div class="buttons">
            <button class="details-btn"
              onclick="window.location.href='fundraiser-detail.html?id=${f.fundraiserId}'">
              View Details
            </button>
            ${donateButton}
          </div>
        </div>
      `;

      grid.innerHTML += card;
    });

  } catch (err) {
    console.log(err);
    grid.innerHTML = "<p>Failed to load fundraisers.</p>";
  }
}

window.onload = loadFundraisers;
