// server.js
// Basic Express server with MySQL + JWT auth.
// Run: node server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2";
import bcrypt from "bcrypt";//for hashing
import jwt from "jsonwebtoken";//for tokens
import path from "path";
import { fileURLToPath } from "url";

//) App setup & middleware
const app = express();
app.use(cors());
app.use(express.json());

// Required to use __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend folder
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/index.html"));
});


dotenv.config();//It loads all the variables from your .env file into process.env.




// --------- CONFIG ---------
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key"; // change in production
const PORT = process.env.PORT || 5000;

// --------- MySQL connection ---------
// update these credentials to match your local MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "hopechain"
});

// quick DB test route
app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) return res.status(500).send("DB connection error: " + err.message);
    res.send("DB OK");
  });
});

// --------- JWT middleware ---------
//This creates a middleware function used to protect routes.
// Its job = check if the user is logged in.
function verifyToken(req, res, next) {
  // token expected in Authorization header
  let token = req.headers["authorization"];//This reads the JWT token from the request header.
  if (!token) return res.status(401).json({ error: "No token provided" });
  if (token.startsWith("Bearer ")) {
  token = token.slice(7, token.length); // remove "Bearer "
}
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    //     If token is valid:
    // decoded contains user info stored at login:
    // { id, role, wallet }
    // We save this into req.user so other routes can use it.
    req.user = decoded;
    next();
  });
}

// role gate helper: requireRole('ngo') or requireRole('donor')
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: wrong role" });
    }
    next();
  };
}

// --------- SIGNUP route ---------
// Expects: { name, email, password, role, wallet_address }
app.post("/signup", async (req, res) => {
  console.log("====== SIGNUP REQUEST RECEIVED ======");

  const { name, email, password, role, wallet_address } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO users (name, email, password_hash, role, wallet_address)
                 VALUES (?, ?, ?, ?, ?)`;

    db.query(sql, [name, email, password_hash, role, wallet_address], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ error: "Email already exists" });
        console.error("Signup error:", err);
        return res.status(500).json({ error: "DB error" });
      }

      const userId = result.insertId;

      // Insert into correct detail table
      if (role === "donor") {
        console.log("⚡ Creating donor_details row for ID:", userId);
        db.query(`INSERT INTO donor_details (donor_id) VALUES (?)`, [userId], (err2) => {
          if (err2) console.error("❌ Donor details insert error:", err2);
          else console.log("✅ Donor details inserted");
        });
      } else if (role === "ngo") {
        console.log("⚡ Creating ngo_details row for ID:", userId);
        db.query(`INSERT INTO ngo_details (ngo_id) VALUES (?)`, [userId], (err3) => {
          if (err3) console.error("❌ NGO details insert error:", err3);
          else console.log("✅ NGO details inserted");
        });
      }


      res.json({ message: "Signup successful", id: userId });
    });

  } catch (err) {
    console.error("Hash error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// --------- LOGIN route ---------
// Expects: { email, password }
// Returns: { token, role, wallet }
//Find user → check password → create token → send it to frontend.
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  const sql = "SELECT * FROM users WHERE email = ?";//2. Check if email exists in SQL
  db.query(sql, [email], async (err, rows) => {
    if (err) {
      console.error("Login DB error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (rows.length === 0) return res.status(400).json({ error: "User not found" });//rows.length === 0 means no user with that email

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Incorrect password" });

    //  Create JWT token (login success)
    const payload = { id: user.id, role: user.role, wallet: user.wallet_address };//Payload = information to store inside token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

    res.json({ message: "Login successful", token, role: user.role, wallet: user.wallet_address });//backend returns a JSON response which the browser (your site) reads and uses.
  });
});

// --------- PUBLIC: get fundraisers (from SQL) ---------
//Anyone can access this route — no login needed.
app.get("/api/fundraisers", (req, res) => {
  const sql = `
    SELECT 
      f.fundraiser_id AS fundraiserId,
      f.title,
      f.description,
      f.goal,
      f.owner_wallet AS ownerWallet,
      f.fundraiser_type AS fundraiserType,
      f.category,
      f.people_affected AS peopleAffected,
      IFNULL(SUM(d.amount), 0) AS raised
    FROM fundraisers f
    LEFT JOIN donations d 
      ON f.fundraiser_id = d.fundraiser_id
    GROUP BY f.fundraiser_id
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("get fundraisers error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});


// --------- my donations(PROTECTED, donor only)  ---------
app.get("/api/my-donations", verifyToken, (req, res) => {
  const donorWallet = req.user.wallet;
  const sql = `
    SELECT d.donation_id, d.fundraiser_id, f.title, d.amount, d.tx_hash, d.donated_at
    FROM donations d
    JOIN fundraisers f ON d.fundraiser_id = f.fundraiser_id
    WHERE d.donor_address = ?
    ORDER BY d.donated_at DESC
  `;
  db.query(sql, [donorWallet], (err, rows) => {
    if (err) {
      console.error("my donations error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});

// --------- CREATE FUNDRAISER (NGO only) ---------
//It contains everything the client sends to the server.->req
//This is what your server sends back to the client.->res
app.post("/api/fundraiser/create", verifyToken, requireRole("ngo"), (req, res) => {
  console.log("➡️ FUNDRAISER CREATE REQUEST BODY:", req.body);
  console.log("➡️ AUTH USER:", req.user);
  const { title, description, goal, fundraiser_type, category, people_affected } = req.body;

  // 1. Validate fields
  if (!title || !description ||  !fundraiser_type || !category || !people_affected) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // 2. Get NGO wallet from token (set during login)
  const owner_wallet = req.user.wallet;

  // 3. SQL Insert
  const sql = `
    INSERT INTO fundraisers 
    (title, description, goal, owner_wallet, fundraiser_type, category, people_affected)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [title, description, goal, owner_wallet, fundraiser_type, category, people_affected],
    (err, result) => {
      if (err) {
        console.error("Create fundraiser error:", err);
        return res.status(500).json({ error: "DB error" });
      }

      res.json({
        message: "Fundraiser created",
        fundraiserId: result.insertId
      });
    }
  );
});

// --------- GET MY FUNDRAISERS (NGO only) ---------
app.get("/api/my-fundraisers", verifyToken, requireRole("ngo"), (req, res) => {
  const ownerWallet = req.user.wallet; // wallet stored inside JWT

  const sql = `
    SELECT fundraiser_id AS fundraiserId, title, description, goal, fundraiser_type AS fundraiserType,
           category, people_affected AS peopleAffected
    FROM fundraisers
    WHERE owner_wallet = ?
  `;

  db.query(sql, [ownerWallet], (err, rows) => {
    if (err) {
      console.error("my fundraisers error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    res.json(rows); // list of all fundraisers created by this NGO
  });
});
// --------- DONATE (Donor only, save blockchain TX into SQL) ---------
// --------- DONATE (Donor only, save blockchain TX into SQL) ---------
app.post("/api/donate", verifyToken, requireRole("donor"), (req, res) => {
  console.log("==== NEW DONATE REQUEST ====");
  console.log("RAW REQUEST BODY:", req.body);
  console.log("USER FROM TOKEN:", req.user);

  let { fundraiser_id, amount, payment_method, payment_reference, tx_hash } = req.body;

  // Validation: fields must exist
  if (fundraiser_id === undefined || amount === undefined) {
    console.log("❌ Missing fields:", { fundraiser_id, amount });
    return res.status(400).json({ error: "Missing fundraiser_id or amount" });
  }

  // Convert numeric values
  fundraiser_id = parseInt(fundraiser_id);
  amount = parseFloat(amount);

  // Number validation
  if (isNaN(fundraiser_id) || isNaN(amount) || amount <= 0) {
    console.log("❌ Invalid numeric values:", fundraiser_id, amount);
    return res.status(400).json({ error: "Invalid numeric fundraiser_id or amount" });
  }

  const donorWallet = req.user.wallet;
  if (!donorWallet) {
    console.log("❌ ERROR: No wallet in user token:", req.user);
    return res.status(400).json({ error: "Wallet address missing in user profile" });
  }

  const finalTxHash = tx_hash || "sql_" + Date.now();
  const finalPaymentMethod = payment_method || "crypto";
  const finalPaymentRef = payment_reference || null;

  console.log("📌 Preparing SQL insert with values:");
  console.log({ fundraiser_id, donorWallet, amount, finalTxHash });

  const sql = `
    INSERT INTO donations 
      (fundraiser_id, donor_address, amount, tx_hash, payment_method, payment_reference, donated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    sql,
    [fundraiser_id, donorWallet, amount, finalTxHash, finalPaymentMethod, finalPaymentRef],
    (err, result) => {
      if (err) {
        console.log("❌ SQL INSERT ERROR:", err);
        return res.status(500).json({ error: "SQL Insert Failed", details: err.message });
      }

      console.log("🎉 DONATION INSERTED SUCCESSFULLY, ID:", result.insertId);

      res.json({
        message: "Donation saved to SQL",
        donationId: result.insertId,
        txHash: finalTxHash
      });
    }
  );
});



// --------- GET TOTAL RAISED ----------
app.get("/api/raised/:id", (req, res) => {
  const fundraiserId = req.params.id;

  const sql = `
    SELECT COALESCE(SUM(amount), 0) AS totalRaised
    FROM donations
    WHERE fundraiser_id = ?
  `;

  db.query(sql, [fundraiserId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ totalRaised: rows[0]?.totalRaised || 0 });
  });
});





// --------- GET SINGLE FUNDRAISER DETAILS ---------
app.get("/api/fundraiser/:id", (req, res) => {
  const fundraiserId = req.params.id;

  const sql = `
    SELECT 
      f.fundraiser_id AS fundraiserId,
      f.title,
      f.description,
      f.goal,
      f.owner_wallet AS ownerWallet,
      f.fundraiser_type AS fundraiserType,
      f.category,
      f.people_affected AS peopleAffected,
      IFNULL(SUM(d.amount), 0) AS raised
    FROM fundraisers f
    LEFT JOIN donations d 
      ON f.fundraiser_id = d.fundraiser_id
    WHERE f.fundraiser_id = ?
    GROUP BY f.fundraiser_id
  `;

  db.query(sql, [fundraiserId], (err, rows) => {
    if (err) {
      console.error("get fundraiser detail error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: "Fundraiser not found" });
    }

    res.json(rows[0]);
  });
});

// --------- POST COMMENT (any logged-in user) ---------
app.post("/api/comment", verifyToken, (req, res) => {
  const { fundraiser_id, comment_text } = req.body;

  if (!fundraiser_id || !comment_text) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const userId = req.user.id; // from JWT

  const sql = `
    INSERT INTO comments (fundraiser_id, user_id, comment_text)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [fundraiser_id, userId, comment_text], (err, result) => {
    if (err) {
      console.error("comment insert error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    res.json({
      message: "Comment added",
      commentId: result.insertId
    });
  });
});

// --------- GET COMMENTS for a fundraiser ---------
//Fetch all comments for that fundraiser (read)
app.get("/api/comments/:id", (req, res) => {
  const fundraiserId = req.params.id;

  const sql = `
    SELECT c.comment_id, c.comment_text, c.commented_at AS created_at,
           u.name AS userName, u.role AS userRole
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.fundraiser_id = ?
    ORDER BY c.commented_at DESC
  `;

  db.query(sql, [fundraiserId], (err, rows) => {
    if (err) {
      console.error("get comments error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    res.json(rows);
  });
});

app.post("/api/comment", verifyToken, (req, res) => {
  const { fundraiser_id, comment_text } = req.body;
  const user_id = req.user.id;

  const sql = `INSERT INTO comments (fundraiser_id, user_id, comment_text, created_at)
               VALUES (?, ?, ?, NOW())`;

  db.query(sql, [fundraiser_id, user_id, comment_text], (err) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ message: "Comment added" });
  });
});
app.get("/api/comments/:id", (req, res) => {
  const fundraiserId = req.params.id;

  const sql = `SELECT users.name, comments.comment_text, comments.created_at 
               FROM comments JOIN users 
               ON comments.user_id = users.id
               WHERE fundraiser_id = ?
               ORDER BY created_at DESC`;

  db.query(sql, [fundraiserId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(result);
  });
});









// --------- start server ---------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
