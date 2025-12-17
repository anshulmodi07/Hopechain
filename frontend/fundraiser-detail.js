// ------- Get fundraiser ID from URL -------
const urlParams = new URLSearchParams(window.location.search);
const fundraiserId = urlParams.get("id");

const API_URL = "http://localhost:5000";

// ------- Convert to readable ETH -------
function formatEth(value) {
  if (!value || isNaN(value)) return "0.0000";
  return parseFloat(value).toFixed(4);
}

// ------- Load Fundraiser Full Details -------
async function loadFundraiser() {
  try {
    const res = await fetch(`${API_URL}/api/fundraiser/${fundraiserId}`);
    const data = await res.json();

    document.getElementById("title").innerText = data.title;
    document.getElementById("description").innerText = data.description;
    document.getElementById("category").innerText = data.category;
    document.getElementById("people").innerText = data.peopleAffected;

    const raisedAmount = await loadRaisedAmount();

    document.getElementById("raised").innerText = formatEth(raisedAmount);
    document.getElementById("goal").innerText = formatEth(data.goal);

    const percentage = data.goal > 0 ? (raisedAmount / data.goal) * 100 : 0;
    document.getElementById("progressFill").style.width = percentage + "%";

  } catch (err) {
    console.error("Error loading fundraiser:", err);
  }
}

// ------- Load total raised amount from SQL -------
async function loadRaisedAmount() {
  try {
    const res = await fetch(`${API_URL}/api/raised/${fundraiserId}`);
    const result = await res.json();
    return result.totalRaised || 0;
  } catch (error) {
    console.error("Error fetching raised:", error);
    return 0;
  }
}

async function loadComments() {
  const fundraiserId = new URLSearchParams(window.location.search).get("id");

  const res = await fetch(`http://localhost:5000/api/comments/${fundraiserId}`);
  const comments = await res.json();

  const commentsList = document.getElementById("commentsList");
  commentsList.innerHTML = "";

  comments.forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${c.name}</strong>: ${c.comment_text} <br>
    <small>${new Date(c.created_at).toLocaleString()}</small>
    <hr>`;
    commentsList.appendChild(div);
  });
}

loadComments();

document.getElementById("postCommentBtn").addEventListener("click", async () => {
  const commentText = document.getElementById("commentInput").value.trim();
  const fundraiserId = new URLSearchParams(window.location.search).get("id");
  const token = localStorage.getItem("token");

  await fetch("http://localhost:5000/api/comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      fundraiser_id: fundraiserId,
      comment_text: commentText
    })
  });

  document.getElementById("commentInput").value = "";
  loadComments();
});


loadFundraiser();   // initial load

// ===================== BLOCKCHAIN PART =====================

let web3;
let contract;
let userAccount;

// ------- Connect MetaMask -------
async function connectMetaMask() {
  if (!window.ethereum) {
    return alert("MetaMask not detected! Install MetaMask extension.");
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.getAccounts();
    userAccount = accounts[0];

    document.getElementById("walletStatus").innerText =
      "Connected: " + userAccount.slice(0, 6) + "..." + userAccount.slice(-4);

    // Contract present globally from contractConfig.js
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  } catch (error) {
    console.error("MetaMask connection failed:", error);
    alert("Failed to connect MetaMask.");
  }
}

// ------- Donate using ETH + Save in SQL -------
async function donateEth() {
  const amount = document.getElementById("ethAmount").value;

  if (!userAccount) return alert("Please connect MetaMask first!");
  if (!amount || amount <= 0) return alert("Enter valid ETH amount");

  const token = localStorage.getItem("token");
  if (!token) {
    return alert("Please login to record your donation.");
  }

  try {
    // Send ETH transaction
    const tx = await contract.methods.donate(fundraiserId).send({
      from: userAccount,
      value: web3.utils.toWei(amount.toString(), "ether")
    });

    // Save into SQL
    await fetch(`${API_URL}/api/donate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({
        fundraiser_id: fundraiserId,
        amount: amount,
        tx_hash: tx.transactionHash,
        payment_method: "crypto",
        payment_reference: null
      })
    });

    document.getElementById("ethMsg").innerHTML = `
      Donation successful! 🚀 <br>
      <a href="https://sepolia.etherscan.io/tx/${tx.transactionHash}" target="_blank">
        View on Etherscan
      </a>
    `;

    loadFundraiser();  // update raised

  } catch (err) {
    console.error("Donation error:", err);
    alert("Transaction failed or rejected.");
  }
}
