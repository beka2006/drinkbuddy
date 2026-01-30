// frontend/src/api/comments.js

export async function fetchComments(meetupId) {
  const res = await fetch(`/api/comments/meetup/${meetupId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `GET comments failed: ${res.status}`);
  return data.comments || [];
}

export async function postComment({ meetupId, content, token }) {
  const res = await fetch(`/api/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ meetupId, content }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `POST comment failed: ${res.status}`);
  return data.comment;
}

export async function deleteComment({ commentId, token }) {
  const res = await fetch(`/api/comments/${commentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `DELETE comment failed: ${res.status}`);
  return data; // { ok: true, deletedId }
}

export async function patchComment({ commentId, content, token }) {
  const res = await fetch(`/api/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PATCH comment failed: ${res.status}`);
  return data.comment;
}
