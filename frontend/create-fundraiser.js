// Blockchain global vars
let web3;
let contract;
let userAccount;

async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask!");

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.getAccounts();
    userAccount = accounts[0];

    document.getElementById("connectWalletBtn").innerText =
      "Connected: " + userAccount.slice(0, 6) + "..." + userAccount.slice(-4);

    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  } catch (error) {
    console.error("Wallet connection failed:", error);
    alert("MetaMask connection failed.");
  }
}

document.getElementById("connectWalletBtn").onclick = connectWallet;

// Protect Route
window.onload = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== "ngo") {
    alert("Access denied! Login as NGO.");
    window.location.href = "login.html";
  }
};

// Logout
document.getElementById("logoutBtn").onclick = () => {
  localStorage.clear();
  window.location.href = "index.html";
};

document.getElementById("fundraiserForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await createFundraiser();
});

async function createFundraiser() {
  const msg = document.getElementById("msg");
  const bcMsg = document.getElementById("bcMsg");
  const submitBtn = document.getElementById("submitBtn");

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const goal = document.getElementById("goal").value.trim();
  const category = document.getElementById("category").value.trim();
  const people = document.getElementById("people").value.trim();
  const type = document.getElementById("type").value;

  if (!title || !description || !goal || !category || !people)
    return showMessage("Fill all fields.", "error");

  if (!userAccount) return alert("Connect MetaMask to continue.");

  const token = localStorage.getItem("token");

  showMessage("Creating fundraiser on blockchain...", "info");
  submitBtn.disabled = true;

  try {
    // 1. Blockchain
    const tx = await contract.methods.createFundraiser(title, description, type, category, people)
      .send({ from: userAccount });

    bcMsg.innerHTML = `
      Blockchain Tx Success: <br>
      <a href="https://sepolia.etherscan.io/tx/${tx.transactionHash}" target="_blank">View on Etherscan</a>
    `;

    // 2. SQL
    const res = await fetch("http://localhost:5000/api/fundraiser/create", {
      method: "POST",
      headers: { "Content-Type": "application/json","Authorization": "Bearer " + token
 },
      body: JSON.stringify({
        title, description, goal: parseFloat(goal), category,
        people_affected: parseInt(people), fundraiser_type: type
      })
    });

    const data = await res.json();
    if (!res.ok) return showMessage(data.error, "error");

    showMessage("Success! Redirecting...", "success");

    setTimeout(() => {
      window.location.href = "ngo-dashboard.html";
    }, 1500);

  } catch (err) {
    console.error(err);
    showMessage("Transaction failed.", "error");
    submitBtn.disabled = false;
  }
}

function showMessage(text, type) {
  const msg = document.getElementById("msg");
  msg.innerText = text;
  msg.className = `msg show ${type}`;
}
