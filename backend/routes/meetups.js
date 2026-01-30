const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const { assertHost } = require("../src/utils/meetupAuth");

// ------------------------------------
// HOST: kick participant
// DELETE /api/meetups/:id/participants/:userId
// ------------------------------------
router.delete("/:id/participants/:userId", auth, async (req, res) => {
  const meetupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);

  if (!Number.isFinite(meetupId) || !Number.isFinite(targetUserId)) {
    return res.status(400).json({ ok: false, message: "Invalid id" });
  }

  try {
    await assertHost(pool, meetupId, req.user.id);

    // prevent host kicking self
    const hostRow = await pool.query("SELECT user_id FROM meetups WHERE id = $1", [meetupId]);
    if (hostRow.rows[0]?.user_id === targetUserId) {
      return res.status(400).json({ ok: false, message: "Host cannot be removed" });
    }

    const del = await pool.query(
      `
      DELETE FROM meetup_participants
      WHERE meetup_id = $1 AND user_id = $2
      RETURNING user_id
      `,
      [meetupId, targetUserId]
    );

    if (del.rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Participant not found" });
    }

    const count = await pool.query(
      "SELECT COUNT(*)::int AS joinedCount FROM meetup_participants WHERE meetup_id = $1",
      [meetupId]
    );

    res.json({ ok: true, kickedUserId: targetUserId, joinedCount: count.rows[0].joinedcount });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || "Failed to kick" });
  }
});

// ------------------------------------
// HOST: close meetup
// POST /api/meetups/:id/close
// ------------------------------------
router.post("/:id/close", auth, async (req, res) => {
  const meetupId = Number(req.params.id);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetup id" });
  }

  try {
    await assertHost(pool, meetupId, req.user.id);

    const r = await pool.query(
      `
      UPDATE meetups
      SET status = 'closed', closed_at = NOW()
      WHERE id = $1 AND status = 'open'
      RETURNING id, status, closed_at, canceled_at
      `,
      [meetupId]
    );

    if (!r.rows.length) {
      return res.status(400).json({ ok: false, message: "Meetup is not open" });
    }

    res.json({ ok: true, meetup: r.rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || "Failed to close" });
  }
});

// ------------------------------------
// HOST: cancel meetup
// POST /api/meetups/:id/cancel
// ------------------------------------
router.post("/:id/cancel", auth, async (req, res) => {
  const meetupId = Number(req.params.id);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetup id" });
  }

  try {
    await assertHost(pool, meetupId, req.user.id);

    const r = await pool.query(
      `
      UPDATE meetups
      SET status = 'canceled', canceled_at = NOW()
      WHERE id = $1 AND status = 'open'
      RETURNING id, status, closed_at, canceled_at
      `,
      [meetupId]
    );

    if (!r.rows.length) {
      return res.status(400).json({ ok: false, message: "Meetup is not open" });
    }

    res.json({ ok: true, meetup: r.rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || "Failed to cancel" });
  }
});

module.exports = router;
