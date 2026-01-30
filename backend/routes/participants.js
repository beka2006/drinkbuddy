const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// ------------------------------------
// GET participants (public)
// ------------------------------------
router.get("/meetups/:id/participants", async (req, res) => {
  const meetupId = Number(req.params.id);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetup id" });
  }

  try {
    const r = await pool.query(
      `
      SELECT mp.user_id, u.username, mp.joined_at
      FROM meetup_participants mp
      JOIN users u ON u.id = mp.user_id
      WHERE mp.meetup_id = $1
      ORDER BY mp.joined_at ASC
      `,
      [meetupId]
    );

    res.json({ ok: true, participants: r.rows });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: "failed to load participants",
      error: e.message,
    });
  }
});

// ------------------------------------
// JOIN meetup (auth)
// ------------------------------------
router.post("/meetups/:id/join", auth, async (req, res) => {
  const meetupId = Number(req.params.id);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetup id" });
  }

  try {
    // ✅ get meetup info (host + capacity + status)
    const m = await pool.query(
      "SELECT user_id, people, status FROM meetups WHERE id = $1",
      [meetupId]
    );

    if (!m.rows.length) {
      return res.status(404).json({ ok: false, message: "Meetup not found" });
    }

    // ✅ block join if closed/canceled
    if (m.rows[0].status && m.rows[0].status !== "open") {
      return res.status(400).json({
        ok: false,
        message: `Meetup is ${m.rows[0].status}`,
      });
    }

    // 🚫 HOST CANNOT JOIN OWN MEETUP
    if (m.rows[0].user_id === req.user.id) {
      return res.status(403).json({
        ok: false,
        message: "Host cannot join their own meetup",
      });
    }

    const capacity = Number(m.rows[0].people) || 1;

    // count participants
    const c = await pool.query(
      "SELECT COUNT(*)::int AS count FROM meetup_participants WHERE meetup_id = $1",
      [meetupId]
    );

    if (c.rows[0].count >= capacity) {
      return res.status(409).json({ ok: false, message: "Meetup is full" });
    }

    // insert participant (unique constraint protects duplicates)
    await pool.query(
      "INSERT INTO meetup_participants (meetup_id, user_id) VALUES ($1, $2)",
      [meetupId, req.user.id]
    );

    // return joinedCount (optional, but useful)
    const after = await pool.query(
      "SELECT COUNT(*)::int AS joinedCount FROM meetup_participants WHERE meetup_id = $1",
      [meetupId]
    );

    res.status(201).json({ ok: true, joinedCount: after.rows[0].joinedcount });
  } catch (e) {
    if (String(e.message).toLowerCase().includes("duplicate")) {
      return res.status(409).json({ ok: false, message: "Already joined" });
    }

    res.status(500).json({
      ok: false,
      message: "failed to join",
      error: e.message,
    });
  }
});

// ------------------------------------
// LEAVE meetup (auth)
// ------------------------------------
router.post("/meetups/:id/leave", auth, async (req, res) => {
  const meetupId = Number(req.params.id);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetup id" });
  }

  try {
    // (Optional) prevent leaving canceled meetups (you can remove this block)
    const m = await pool.query("SELECT status FROM meetups WHERE id = $1", [meetupId]);
    if (!m.rows.length) {
      return res.status(404).json({ ok: false, message: "Meetup not found" });
    }
    if (m.rows[0].status === "canceled") {
      return res.status(400).json({ ok: false, message: "Meetup is canceled" });
    }

    await pool.query(
      "DELETE FROM meetup_participants WHERE meetup_id = $1 AND user_id = $2",
      [meetupId, req.user.id]
    );

    const after = await pool.query(
      "SELECT COUNT(*)::int AS joinedCount FROM meetup_participants WHERE meetup_id = $1",
      [meetupId]
    );

    res.json({ ok: true, joinedCount: after.rows[0].joinedcount });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: "failed to leave",
      error: e.message,
    });
  }
});

module.exports = router;
