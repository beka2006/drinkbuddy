async function assertHost(db, meetupId, userId) {
  const r = await db.query("SELECT user_id FROM meetups WHERE id = $1", [meetupId]);

  if (!r.rows.length) {
    const e = new Error("Meetup not found");
    e.status = 404;
    throw e;
  }

  if (r.rows[0].user_id !== userId) {
    const e = new Error("Host only");
    e.status = 403;
    throw e;
  }
}

module.exports = { assertHost };
