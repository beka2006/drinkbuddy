// src/pages/Feed.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getToken, getUser } from "../api/auth";
import { fetchComments, postComment, deleteComment, patchComment } from "../api/comments";
import {
  fetchParticipants,
  joinMeetup,
  leaveMeetup,
  kickParticipant,
} from "../api/participants";

export default function Feed() {
  const nav = useNavigate();

  // keep your pattern (won't break build)
  useMemo(() => getToken(), []);
  useMemo(() => getUser(), []);

  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const [city, setCity] = useState("Tbilisi");
  const [drink, setDrink] = useState("Vodka");
  const [timeLabel, setTimeLabel] = useState("Today 20:00");
  const [people, setPeople] = useState(3);
  const [text, setText] = useState("");

  // --- comments state (per meetup) ---
  const [openComments, setOpenComments] = useState({});
  const [commentsByMeetup, setCommentsByMeetup] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [commentPosting, setCommentPosting] = useState({});

  // ✅ edit/delete UI state
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [commentDeleting, setCommentDeleting] = useState({}); // { [commentId]: true }

  // --- participants state (per meetup) ---
  const [openParticipants, setOpenParticipants] = useState({});
  const [participantsByMeetup, setParticipantsByMeetup] = useState({});
  const [participantsLoading, setParticipantsLoading] = useState({});
  const [joinBusy, setJoinBusy] = useState({});
  const [hostBusy, setHostBusy] = useState({});
  const [kickBusy, setKickBusy] = useState({});

  const [confirmState, setConfirmState] = useState({
  open: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  danger: false,
  onConfirm: null,
  busy: false,
});

function openConfirm({ title, message, confirmText = "Confirm", danger = false, onConfirm }) {
  setConfirmState({
    open: true,
    title,
    message,
    confirmText,
    danger,
    onConfirm: async () => onConfirm?.(),   // ✅ wrap
    busy: false,
  });
}


function closeConfirm() {
  setConfirmState((p) => ({ ...p, open: false, busy: false, onConfirm: null }));
}

useEffect(() => {
  if (!confirmState.open) return;
  function onKey(e) {
    if (e.key === "Escape") closeConfirm();
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [confirmState.open]);


  // ✅ load meetups (you referenced it, so it must exist)
  async function loadMeetups() {
    setError("");
    const t = getToken();
    const res = await fetch("/api/meetups", {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.message || "Failed to load meetups");
    setMeetups(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadMeetups()
      .catch((e) => setError(e?.message || "Failed to load meetups"))
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    clearAuth();
    nav("/login");
  }

  // ✅ ONE refreshComments (you had duplicates)
  async function refreshComments(meetupId) {
    const comments = await fetchComments(meetupId);
    setCommentsByMeetup((prev) => ({ ...prev, [meetupId]: comments }));
  }

  async function toggleComments(meetupId) {
    setError("");

    const isOpen = !!openComments[meetupId];
    const next = !isOpen;

    setOpenComments((prev) => ({ ...prev, [meetupId]: next }));

    if (next && !commentsByMeetup[meetupId]) {
      try {
        setCommentsLoading((prev) => ({ ...prev, [meetupId]: true }));
        const comments = await fetchComments(meetupId);
        setCommentsByMeetup((prev) => ({ ...prev, [meetupId]: comments }));
      } catch (e) {
        setError(e?.message || "Failed to load comments");
      } finally {
        setCommentsLoading((prev) => ({ ...prev, [meetupId]: false }));
      }
    }
  }

  async function handleCreateMeetup(e) {
    e.preventDefault();
    setError("");

    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login to post a meetup.");
      return;
    }

    const payload = {
      city: city.trim(),
      drink: drink.trim(),
      timeLabel: timeLabel.trim(),
      people: Number.isFinite(Number(people)) ? Number(people) : 1,
      text: text.trim(),
    };

    if (!payload.city || !payload.drink || !payload.timeLabel || !payload.text) {
      setError("Please fill: city, drink, time, and description.");
      return;
    }

    try {
      setPosting(true);

      const res = await fetch("/api/meetups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `POST failed: ${res.status}`);

      setText("");
      await loadMeetups();
    } catch (e) {
      setError(e?.message || "Failed to create meetup");
    } finally {
      setPosting(false);
    }
  }

  async function handlePostComment(meetupId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login to comment.");
      return;
    }

    const content = String(commentDraft[meetupId] || "").trim();
    if (!content) {
      setError("Comment cannot be empty.");
      return;
    }

    try {
      setCommentPosting((prev) => ({ ...prev, [meetupId]: true }));
      const created = await postComment({ meetupId, content, token: t });

      const item = { ...created, username: u.username };

      setCommentsByMeetup((prev) => {
        const existing = prev[meetupId] || [];
        return { ...prev, [meetupId]: [...existing, item] };
      });

      setCommentDraft((prev) => ({ ...prev, [meetupId]: "" }));
    } catch (e) {
      setError(e?.message || "Failed to post comment");
    } finally {
      setCommentPosting((prev) => ({ ...prev, [meetupId]: false }));
    }
  }

  // ✅ ONLY ONE delete function (you had two — that causes RED build errors)
  // ✅ NOT optimistic (removes AFTER success) + safe id compare + button lock
  async function handleDeleteComment(meetupId, commentId) {
    if (commentDeleting[commentId]) return;

    setError("");
    const t = getToken();
    const u = getUser();
    if (!t || !u) {
      setError("Please login.");
      return;
    }

    setCommentDeleting((prev) => ({ ...prev, [commentId]: true }));

    try {
      await deleteComment({ commentId, token: t });

      setCommentsByMeetup((prev) => {
        const list = prev[meetupId] || [];
        return {
          ...prev,
          [meetupId]: list.filter((c) => String(c.id) !== String(commentId)),
        };
      });

      if (String(editingId) === String(commentId)) {
        setEditingId(null);
        setEditDraft("");
        setEditSaving(false);
      }
    } catch (e) {
      setError(e?.message || "Failed to delete comment");
      try {
        await refreshComments(meetupId);
      } catch {}
    } finally {
      setCommentDeleting((prev) => ({ ...prev, [commentId]: false }));
    }
  }

  // ✅ EDIT your own comment (inline)
  function startEditComment(comment) {
    setEditingId(comment.id);
    setEditDraft(String(comment.content || ""));
  }


  function cancelEditComment() {
    setEditingId(null);
    setEditDraft("");
    setEditSaving(false);
  }

  function onEditKeyDown(e, meetupId, commentId) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancelEditComment();
    return;
  }

  if (e.key === "Enter") {
    // don't save if already saving
    if (editSaving) return;

    // don't save if empty
    if (!String(editDraft).trim()) return;

    e.preventDefault();
    saveEditComment(meetupId, commentId);
  }
}



  async function saveEditComment(meetupId, commentId) {
    setError("");
    const t = getToken();
    const u = getUser();
    if (!t || !u) {
      setError("Please login.");
      return;
    }

    const content = String(editDraft || "").trim();
    if (!content) {
      setError("Comment cannot be empty.");
      return;
    }

    setEditSaving(true);

    // optimistic update
    setCommentsByMeetup((prev) => {
      const list = prev[meetupId] || [];
      return {
        ...prev,
        [meetupId]: list.map((c) => (String(c.id) === String(commentId) ? { ...c, content } : c)),
      };
    });

    try {
      const updated = await patchComment({ commentId, content, token: t });

      setCommentsByMeetup((prev) => {
        const list = prev[meetupId] || [];
        return {
          ...prev,
          [meetupId]: list.map((c) =>
            String(c.id) === String(commentId) ? { ...c, content: updated.content } : c
          ),
        };
      });

      cancelEditComment();
    } catch (e) {
      setError(e?.message || "Failed to edit comment");
      try {
        await refreshComments(meetupId);
      } catch {}
      setEditSaving(false);
    }
  }

  async function toggleParticipants(meetupId) {
    setError("");
    const isOpen = !!openParticipants[meetupId];
    const next = !isOpen;

    setOpenParticipants((prev) => ({ ...prev, [meetupId]: next }));

    if (next) {
      try {
        setParticipantsLoading((prev) => ({ ...prev, [meetupId]: true }));
        const list = await fetchParticipants(meetupId);
        setParticipantsByMeetup((prev) => ({ ...prev, [meetupId]: list }));

        // keep joinedCount synced (nice)
        setMeetups((prev) =>
          prev.map((m) => (m.id === meetupId ? { ...m, joinedCount: list.length } : m))
        );
      } catch (e) {
        setError(e?.message || "Failed to load participants");
      } finally {
        setParticipantsLoading((prev) => ({ ...prev, [meetupId]: false }));
      }
    }
  }

  async function refreshParticipants(meetupId) {
    const list = await fetchParticipants(meetupId);
    setParticipantsByMeetup((prev) => ({ ...prev, [meetupId]: list }));
    setMeetups((prev) =>
      prev.map((m) => (m.id === meetupId ? { ...m, joinedCount: list.length } : m))
    );
  }

  async function handleJoin(meetupId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login to join meetups.");
      return;
    }

    try {
      setJoinBusy((prev) => ({ ...prev, [meetupId]: true }));

      // keep your call signature (do NOT change unless your api expects object)
      await joinMeetup(meetupId, t);

      setMeetups((prev) =>
        prev.map((m) =>
          m.id === meetupId
            ? { ...m, isJoined: true, joinedCount: (m.joinedCount || 0) + 1 }
            : m
        )
      );

      setOpenParticipants((prev) => ({ ...prev, [meetupId]: true }));
      await refreshParticipants(meetupId);
    } catch (e) {
      setError(e?.message || "Failed to join meetup");
    } finally {
      setJoinBusy((prev) => ({ ...prev, [meetupId]: false }));
    }
  }

  async function handleLeave(meetupId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login.");
      return;
    }

    try {
      setJoinBusy((prev) => ({ ...prev, [meetupId]: true }));

      // keep your call signature
      await leaveMeetup(meetupId, t);

      setMeetups((prev) =>
        prev.map((m) =>
          m.id === meetupId
            ? {
                ...m,
                isJoined: false,
                joinedCount: Math.max(0, (m.joinedCount || 0) - 1),
              }
            : m
        )
      );

      await refreshParticipants(meetupId);
    } catch (e) {
      setError(e?.message || "Failed to leave meetup");
    } finally {
      setJoinBusy((prev) => ({ ...prev, [meetupId]: false }));
    }
  }

  async function hostCloseMeetup(meetupId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login.");
      return;
    }

    try {
      setHostBusy((prev) => ({ ...prev, [meetupId]: true }));

      const res = await fetch(`/api/meetups/${meetupId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to close meetup");

      setMeetups((prev) => prev.map((m) => (m.id === meetupId ? { ...m, ...data.meetup } : m)));
    } catch (e) {
      setError(e?.message || "Failed to close meetup");
    } finally {
      setHostBusy((prev) => ({ ...prev, [meetupId]: false }));
    }
  }

  async function hostCancelMeetup(meetupId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login.");
      return;
    }

    try {
      setHostBusy((prev) => ({ ...prev, [meetupId]: true }));

      const res = await fetch(`/api/meetups/${meetupId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to cancel meetup");

      setMeetups((prev) => prev.map((m) => (m.id === meetupId ? { ...m, ...data.meetup } : m)));
    } catch (e) {
      setError(e?.message || "Failed to cancel meetup");
    } finally {
      setHostBusy((prev) => ({ ...prev, [meetupId]: false }));
    }
  }

  async function handleKick(meetupId, userId) {
    setError("");
    const t = getToken();
    const u = getUser();

    if (!t || !u) {
      setError("Please login.");
      return;
    }

    const key = `${meetupId}:${userId}`;
    try {
      setKickBusy((prev) => ({ ...prev, [key]: true }));

      // keep your call signature
      await kickParticipant(meetupId, userId, t);

      setParticipantsByMeetup((prev) => {
        const existing = prev[meetupId] || [];
        const nextList = existing.filter((p) => p.user_id !== userId);
        return { ...prev, [meetupId]: nextList };
      });

      setMeetups((prev) =>
        prev.map((m) =>
          m.id === meetupId ? { ...m, joinedCount: Math.max(0, (m.joinedCount || 0) - 1) } : m
        )
      );
    } catch (e) {
      setError(e?.message || "Failed to kick participant");
    } finally {
      setKickBusy((prev) => ({ ...prev, [key]: false }));
    }
  }
  function ConfirmModal({ open, title, message, confirmText, danger, busy, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(20,20,20,0.95)",
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
        <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.4 }}>{message}</div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #333",
              background: "transparent",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #333",
              background: danger ? "rgba(255,120,120,0.25)" : "rgba(100,120,255,0.25)",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              fontWeight: 800,
            }}
          >
            {busy ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
  function StatusPill({ status }) {
  const s = String(status || "open");
  const bg =
    s === "open"
      ? "rgba(100,120,255,0.25)"
      : s === "closed"
      ? "rgba(255,200,80,0.25)"
      : "rgba(255,120,120,0.25)";

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.15)",
        background: bg,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {s.toUpperCase()}
    </span>
  );
}


  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      {/* Top right auth */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12 }}>
        {getToken() ? (
          <>
            <div style={{ opacity: 0.8, alignSelf: "center" }}>
              Logged in as <b>{getUser()?.username}</b>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 44 }}>Find a meetup</h1>
        <div style={{ opacity: 0.8, marginTop: 8 }}>English: Browse posts and join.</div>
        <div style={{ opacity: 0.8, marginTop: 4 }}>ქართული: იპოვე პოსტები და შეუერთდი.</div>
      </div>

      {/* Create meetup */}
      <form
        onSubmit={handleCreateMeetup}
        style={{
          padding: 18,
          borderRadius: 16,
          border: "1px solid #333",
          background: "rgba(255,255,255,0.02)",
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create a meetup</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          <input
            value={timeLabel}
            onChange={(e) => setTimeLabel(e.target.value)}
            placeholder="Time (e.g. Today 20:00)"
          />
          <input value={drink} onChange={(e) => setDrink(e.target.value)} placeholder="Drink" />
          <input
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="People"
            type="number"
            min="1"
          />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Meetup description..."
          rows={3}
          style={{ marginTop: 10, width: "100%" }}
        />

        <button
          type="submit"
          disabled={posting}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #333",
            background: "rgba(100,120,255,0.25)",
            cursor: posting ? "not-allowed" : "pointer",
          }}
        >
          {posting ? "Posting..." : "Post meetup"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, border: "1px solid #333", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div>{error}</div>
        </div>
      )}

      {/* Meetups */}
      {loading ? (
        <div style={{ padding: 16, borderRadius: 12, border: "1px solid #333" }}>
          Loading meetups...
        </div>
      ) : (
        meetups.map((m) => {
          const commentsOpen = !!openComments[m.id];
          const comments = commentsByMeetup[m.id] || [];
          const isLoadingComments = !!commentsLoading[m.id];
          const draft = commentDraft[m.id] || "";
          const isPostingComment = !!commentPosting[m.id];

          const participantsOpen = !!openParticipants[m.id];
          const participants = participantsByMeetup[m.id] || [];
          const isLoadingParticipants = !!participantsLoading[m.id];

          const myUser = getUser();
          const myId = myUser?.id;
          const meName = myUser?.username;

          const isAuthor = meName === m.author;
          const alreadyJoined = !!m.isJoined;

          const joinedCount = Number.isFinite(Number(m.joinedCount)) ? Number(m.joinedCount) : 0;
          const capacity = Number(m.people) || 1;
          const isFull = joinedCount >= capacity;

          const busy = !!joinBusy[m.id];
          const hb = !!hostBusy[m.id];

          const status = m.status || "open";
          const isOpen = status === "open";

          return (
            <div
              key={m.id}
              style={{
                marginTop: 16,
                padding: 18,
                borderRadius: 16,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.02)",
                opacity: isOpen ? 1 : 0.9,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {m.author} • {m.city}
                </div>
                <StatusPill status={status} />
              </div>

              <div style={{ opacity: 0.8, marginTop: 6 }}>
                {m.drink} • {m.timeLabel} • {m.people} people
              </div>

              <div style={{ marginTop: 10, opacity: 0.85 }}>
                Participants: <b>{joinedCount}</b> / {capacity} {isFull ? "• Full" : ""}
              </div>

              <div style={{ marginTop: 12, lineHeight: 1.5 }}>{m.text}</div>

              {/* HOST CONTROLS */}
              {isAuthor && getToken() && status === "open" && (
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    disabled={hb}
                    onClick={() => hostCloseMeetup(m.id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #333",
                      background: "rgba(255,200,80,0.20)",
                      cursor: hb ? "not-allowed" : "pointer",
                      opacity: hb ? 0.6 : 1,
                    }}
                  >
                    {hb ? "..." : "Close meetup"}
                  </button>

                  <button
                    disabled={hb}
                    onClick={() =>
  openConfirm({
    title: "Cancel this meetup?",
    message: "This will block joining and mark the meetup as canceled.",
    confirmText: "Cancel meetup",
    danger: true,
    onConfirm: () => hostCancelMeetup(m.id),
  })
}

                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #333",
                      background: "rgba(255,120,120,0.20)",
                      cursor: hb ? "not-allowed" : "pointer",
                      opacity: hb ? 0.6 : 1,
                    }}
                  >
                    {hb ? "..." : "Cancel meetup"}
                  </button>
                </div>
              )}

              {!isOpen && (
                <div style={{ marginTop: 12, opacity: 0.8 }}>
                  This meetup is <b>{status}</b>. Joining is disabled.
                </div>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleComments(m.id)}
                >
                  {commentsOpen ? "Hide comments" : "Show comments"}
                </button>

                <button
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleParticipants(m.id)}
                >
                  {participantsOpen ? "Hide participants" : "Show participants"}
                </button>

                {/* Join/Leave (not for host) */}
                {!isAuthor ? (
                  !alreadyJoined ? (
                    <button
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #333",
                        background: "rgba(100,120,255,0.25)",
                        cursor: !getToken() || isFull || busy || !isOpen ? "not-allowed" : "pointer",
                        opacity: !getToken() || isFull || busy || !isOpen ? 0.6 : 1,
                      }}
                      disabled={!getToken() || isFull || busy || !isOpen}
                      onClick={() => handleJoin(m.id)}
                    >
                      {busy ? "..." : "Join meetup"}
                    </button>
                  ) : (
                    <button
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #333",
                        background: "rgba(255,120,120,0.20)",
                        cursor: !getToken() || busy || !isOpen ? "not-allowed" : "pointer",
                        opacity: !getToken() || busy || !isOpen ? 0.6 : 1,
                      }}
                      disabled={!getToken() || busy || !isOpen}
                      onClick={() => handleLeave(m.id)}
                    >
                      {busy ? "..." : "Leave"}
                    </button>
                  )
                ) : (
                  <div style={{ opacity: 0.7, alignSelf: "center" }}>You are the host</div>
                )}

                <button
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "rgba(100,120,255,0.25)",
                    cursor: "pointer",
                  }}
                  onClick={() => alert("Message (next step)")}
                >
                  Message
                </button>
              </div>

              {/* Participants panel with KICK */}
              {participantsOpen && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Participants</div>

                  {isLoadingParticipants ? (
                    <div style={{ opacity: 0.8 }}>Loading participants...</div>
                  ) : participants.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>Nobody joined yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {participants.map((p) => {
                        const canKick = isAuthor && isOpen && p.user_id !== myId;
                        const key = `${m.id}:${p.user_id}`;
                        const kb = !!kickBusy[key];

                        return (
                          <div
                            key={`${m.id}-${p.user_id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(0,0,0,0.15)",
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 700 }}>
                              {p.username}
                              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                                {p.user_id === myId ? " (you)" : ""}
                              </span>
                            </div>

                            {canKick ? (
                              <button
                                disabled={!getToken() || kb}
                                onClick={() =>
  openConfirm({
    title: `Kick ${p.username}?`,
    message: "They will be removed from participants.",
    confirmText: "Kick",
    danger: true,
    onConfirm: () => handleKick(m.id, p.user_id),
  })
}

                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 12,
                                  border: "1px solid #333",
                                  background: "rgba(255,120,120,0.20)",
                                  cursor: !getToken() || kb ? "not-allowed" : "pointer",
                                  opacity: !getToken() || kb ? 0.6 : 1,
                                }}
                              >
                                {kb ? "..." : "Kick"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Comments panel */}
              {commentsOpen && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Comments</div>

                  {isLoadingComments ? (
                    <div style={{ opacity: 0.8 }}>Loading comments...</div>
                  ) : comments.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>No comments yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {comments.map((c) => {
                       const isMine = !!myId && String(c.user_id) === String(myId);
                       const deleting = !!commentDeleting[c.id];
                       const createdTs = c.created_at ? new Date(c.created_at).getTime() : 0;
                        const updatedTs = c.updated_at ? new Date(c.updated_at).getTime() : 0;
                        const isEdited = !!updatedTs && !!createdTs && updatedTs - createdTs > 1000;

                        return (
  <div
    key={c.id}
    style={{
      padding: 10,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(0,0,0,0.15)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>
        {c.username || "user"}{" "}
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
  • {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
  {isEdited ? (
    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>✏️ edited</span>
  ) : null}
</span>

      </div>

      {/* ✅ owner controls */}
      {isMine && editingId !== c.id && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => startEditComment(c)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Edit
          </button>

          <button
            disabled={deleting}
            onClick={() =>
  openConfirm({
    title: "Delete comment?",
    message: "This action can’t be undone.",
    confirmText: "Delete",
    danger: true,
    onConfirm: () => handleDeleteComment(m.id, c.id),
  })
}

            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "rgba(255,120,120,0.20)",
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>

    {/* content / editor */}
    {editingId === c.id ? (
      <div style={{ marginTop: 8 }}>
        <input
          value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => onEditKeyDown(e, m.id, c.id)}
            style={{ width: "100%" }}
            disabled={editSaving}
            />

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            disabled={editSaving || !String(editDraft).trim()}
            onClick={() => saveEditComment(m.id, c.id)}
          >
            {editSaving ? "Saving..." : "Save"}
          </button>
          <button disabled={editSaving} onClick={cancelEditComment}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div style={{ marginTop: 6 }}>{c.content}</div>
    )}
  </div>
);
                      })}
                    </div>
                  )}

                  {/* Add comment */}
                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <input
                      value={draft}
                      onChange={(e) =>
                        setCommentDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder={getToken() ? "Write a comment..." : "Login to comment"}
                      disabled={!getToken() || isPostingComment}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => handlePostComment(m.id)}
                      disabled={!getToken() || isPostingComment}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #333",
                        background: "rgba(100,120,255,0.25)",
                        cursor: !getToken() || isPostingComment ? "not-allowed" : "pointer",
                      }}
                      
                    >
                      {isPostingComment ? "Posting..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
              
            </div>
          );
        }
    )
      )}
      <ConfirmModal
  open={confirmState.open}
  title={confirmState.title}
  message={confirmState.message}
  confirmText={confirmState.confirmText}
  danger={confirmState.danger}
  busy={confirmState.busy}
  onCancel={closeConfirm}
  onConfirm={async () => {
    if (!confirmState.onConfirm) return;
    setConfirmState((p) => ({ ...p, busy: true }));
    try {
      await confirmState.onConfirm();
      closeConfirm();
    } catch {
      setConfirmState((p) => ({ ...p, busy: false }));
    }
  }}
/>

    </div>
  );
}
