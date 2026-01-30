console.log("✅ LOADED routes/comments.js v2 (has DELETE/PATCH)");

const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/comments/meetup/:meetupId  -> list comments for meetup
router.get("/meetup/:meetupId", async (req, res) => {
  const meetupId = Number(req.params.meetupId);
  if (!Number.isFinite(meetupId)) {
    return res.status(400).json({ ok: false, message: "Invalid meetupId" });
  }

  try {
    const r = await pool.query(
      `
      SELECT c.id, c.meetup_id, c.user_id, u.username,
             c.content, c.created_at
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.meetup_id = $1
      ORDER BY c.created_at ASC
      `,
      [meetupId]
    );

    res.json({ ok: true, comments: r.rows });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, message: "failed to load comments", error: e.message });
  }
});

// POST /api/comments  -> create comment (auth required)
router.post("/", auth, async (req, res) => {
  const { meetupId, content } = req.body || {};
  const mid = Number(meetupId);

  if (!Number.isFinite(mid)) {
    return res.status(400).json({ ok: false, message: "meetupId must be a number" });
  }
  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ ok: false, message: "content is required" });
  }

  try {
    const r = await pool.query(
      `
      INSERT INTO comments (meetup_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, meetup_id, user_id, content, created_at
      `,
      [mid, req.user.id, String(content).trim()]
    );

    res.status(201).json({ ok: true, comment: r.rows[0] });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, message: "failed to create comment", error: e.message });
  }
});

// PATCH /api/comments/:commentId  -> edit comment (auth required, owner only)
router.patch("/:commentId", auth, async (req, res) => {
  const commentId = Number(req.params.commentId);
  const { content } = req.body || {};

  if (!Number.isFinite(commentId)) {
    return res.status(400).json({ ok: false, message: "Invalid commentId" });
  }
  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ ok: false, message: "content is required" });
  }

  try {
    // Owner-only update (fast + clean)
    const r = await pool.query(
      `
      UPDATE comments
      SET content = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, meetup_id, user_id, content, created_at
      `,
      [String(content).trim(), commentId, req.user.id]
    );

    if (r.rows.length === 0) {
      // Either doesn't exist OR not yours
      const exists = await pool.query(`SELECT id FROM comments WHERE id = $1`, [commentId]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "Comment not found" });
      }
      return res.status(403).json({ ok: false, message: "Not allowed to edit this comment" });
    }

    res.json({ ok: true, comment: r.rows[0] });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, message: "failed to edit comment", error: e.message });
  }
});

// DELETE /api/comments/:commentId  -> delete comment (auth required, owner only)
router.delete("/:commentId", auth, async (req, res) => {
  const commentId = Number(req.params.commentId);

  if (!Number.isFinite(commentId)) {
    return res.status(400).json({ ok: false, message: "Invalid commentId" });
  }

  try {
    const r = await pool.query(
      `
      DELETE FROM comments
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [commentId, req.user.id]
    );

    if (r.rows.length === 0) {
      const exists = await pool.query(`SELECT id FROM comments WHERE id = $1`, [commentId]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "Comment not found" });
      }
      return res.status(403).json({ ok: false, message: "Not allowed to delete this comment" });
    }

    res.json({ ok: true, deletedId: r.rows[0].id });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, message: "failed to delete comment", error: e.message });
  }
});

module.exports = router;
