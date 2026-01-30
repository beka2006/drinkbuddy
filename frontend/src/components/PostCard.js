import React from "react";

function formatTime(value) {
  // Keep it simple: show as-is. If later you store ISO dates, we can format nicely.
  return value || "";
}

export default function PostCard({ post, onJoin, onOpenComments, onClose, onCancel }) {
  // status: "open" | "closed" | "canceled" (based on your backend)
  const status = post.status || "open";

  const badgeClass =
    status === "open"
      ? "bg-success"
      : status === "closed"
      ? "bg-secondary"
      : "bg-danger";

  const canJoin = status === "open";

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-body">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div className="fw-bold">
              {post.user} <span className="text-muted">•</span> {post.city}
            </div>
            <div className="text-muted small">
              {post.drink} • {formatTime(post.time)} • {post.people} people
            </div>
          </div>

          <span className={`badge ${badgeClass} text-uppercase`}>
            {status}
          </span>
        </div>

        {/* Text */}
        {post.text && (
          <p className="mt-3 mb-0" style={{ whiteSpace: "pre-wrap" }}>
            {post.text}
          </p>
        )}

        {/* Actions */}
        <div className="d-flex flex-wrap gap-2 mt-3">
          <button
            className="btn btn-outline-primary btn-sm"
            type="button"
            onClick={() => onOpenComments?.(post)}
          >
            💬 Comments
          </button>

          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={!canJoin}
            onClick={() => onJoin?.(post)}
          >
            ✅ Join
          </button>

          {/* Optional admin/owner actions (only show if you want) */}
          {onClose && (
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              disabled={status !== "open"}
              onClick={() => onClose(post)}
            >
              Close
            </button>
          )}

          {onCancel && (
            <button
              className="btn btn-outline-danger btn-sm"
              type="button"
              disabled={status !== "open"}
              onClick={() => onCancel(post)}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Optional footer info */}
        {(post.participants_count != null || post.comments_count != null) && (
          <div className="text-muted small mt-3">
            {post.participants_count != null && (
              <span>{post.participants_count} joined</span>
            )}
            {post.participants_count != null && post.comments_count != null && (
              <span className="mx-2">•</span>
            )}
            {post.comments_count != null && (
              <span>{post.comments_count} comments</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
