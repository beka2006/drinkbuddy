const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./db");
const auth = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1, service: "drinkbuddy-backend" });
  } catch (e) {
    res.status(500).json({ ok: false, message: "DB not reachable", error: e.message });
  }
});

// ---------------- AUTH ----------------
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "username and password required" });
  }

  const uname = String(username).trim();

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(username)=LOWER($1)",
      [uname]
    );
    if (existing.rows.length) {
      return res.status(409).json({ ok: false, message: "username already exists" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [uname, passwordHash]
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: "register failed", error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "username and password required" });
  }

  const uname = String(username).trim();

  try {
    const r = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE LOWER(username)=LOWER($1)",
      [uname]
    );

    if (!r.rows.length) {
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const user = r.rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || "dev_secret_change_later",
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token, user: { id: user.id, username: user.username } });
  } catch (e) {
    res.status(500).json({ ok: false, message: "login failed", error: e.message });
  }
});

// ---------------- MEETUPS LIST ----------------
app.get("/api/meetups", async (req, res) => {
  // optional auth (do NOT require login)
  let userId = null;
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_later");
      userId = decoded.id;
    } catch {
      userId = null;
    }
  }

  try {
    const r = await pool.query(
      `
      SELECT
        m.id,
        u.username AS author,
        m.city,
        m.drink,
        m.time_label AS "timeLabel",
        m.people,
        m.text,
        m.created_at,
        m.status,

        -- joined count
        (
          SELECT COUNT(*)::int
          FROM meetup_participants mp
          WHERE mp.meetup_id = m.id
        ) AS "joinedCount",

        -- isJoined (for current user)
        (
          SELECT EXISTS (
            SELECT 1
            FROM meetup_participants mp
            WHERE mp.meetup_id = m.id
              AND mp.user_id = $1
          )
        ) AS "isJoined"

      FROM meetups m
      JOIN users u ON u.id = m.user_id
      ORDER BY m.id DESC
      `,
      [userId]
    );

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ ok: false, message: "failed to load meetups", error: e.message });
  }
});

app.post("/api/meetups", auth, async (req, res) => {
  const { city, drink, timeLabel, people, text } = req.body || {};

  if (!city || !drink || !timeLabel || !text) {
    return res.status(400).json({
      ok: false,
      message: "Missing required fields",
    });
  }

  try {
    const r = await pool.query(
      `
      INSERT INTO meetups (user_id, city, drink, time_label, people, text)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        req.user.id,
        String(city),
        String(drink),
        String(timeLabel),
        Number.isFinite(Number(people)) ? Number(people) : 1,
        String(text),
      ]
    );

    res.status(201).json({ ok: true, meetupId: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ ok: false, message: "failed to create meetup", error: e.message });
  }
});

// ---------------- ROUTES ----------------
app.use("/api/comments", require("./routes/comments"));
app.use("/api", require("./routes/participants"));
app.use("/api/meetups", require("./routes/meetups"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend running: http://localhost:${PORT}`));
