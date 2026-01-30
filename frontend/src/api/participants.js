export async function fetchParticipants(meetupId) {
  const res = await fetch(`/api/meetups/${meetupId}/participants`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `GET participants failed: ${res.status}`);
  return data.participants || [];
}

export async function joinMeetup(meetupId, token) {
  const res = await fetch(`/api/meetups/${meetupId}/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));

  // If already joined, treat as OK (idempotent join)
  if (res.status === 409 && data?.message === "Already joined") return { ok: true, already: true };

  if (!res.ok) throw new Error(data?.message || `JOIN failed: ${res.status}`);
  return { ok: true };
}

export async function leaveMeetup(meetupId, token) {
  const res = await fetch(`/api/meetups/${meetupId}/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `LEAVE failed: ${res.status}`);
  return true;
}

// ✅ NEW: host kicks participant
export async function kickParticipant(meetupId, userId, token) {
  const res = await fetch(`/api/meetups/${meetupId}/participants/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `KICK failed: ${res.status}`);

  // { ok:true, kickedUserId, joinedCount }
  return data;
}
