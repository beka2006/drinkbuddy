import React from "react";

export default function PostCard({ post }) {
  return (
    <article className="card placeholder" style={{ marginTop: 16 }}>
      <strong>
        {post.user} • {post.city}
      </strong>

      <div style={{ marginTop: 6, color: "#a7adbd" }}>
        {post.drink} • {post.time} • {post.people} people
      </div>

      <p style={{ marginTop: 10 }}>{post.text}</p>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="btn">Comment</button>
        <button className="btn btn--primary">Message</button>
      </div>
    </article>
  );
}
