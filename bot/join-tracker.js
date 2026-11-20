"use strict";

/**
 * Per-group join-time tracker.
 *
 * neokex-fca@5.0.6 may replay recent history when the bot is added to a group.
 * To prevent the bot from executing commands embedded in that historical
 * traffic, we record the moment the bot joins each group and drop messages
 * whose timestamp is earlier than (or equal to) that join moment.
 *
 * A small grace window is added on top of the join timestamp so that messages
 * arriving in the same MQTT batch as the join event — but legitimately sent
 * after the join — are not wrongly dropped. The window is deliberately short:
 * it only needs to cover the interleaving of the join event and the first live
 * messages in the same delivery, not an arbitrary replay.
 */

const DEFAULT_GRACE_MS = 5000;

function createJoinTracker({ graceMs = DEFAULT_GRACE_MS, now = Date.now } = {}) {
  // threadID -> earliest timestamp (ms) from which messages should be processed
  const joinTimes = new Map();

  function extractParticipantID(entry) {
    if (!entry) return "";
    if (typeof entry === "string" || typeof entry === "number") return String(entry);
    return String(entry.userFbId || entry.userID || entry.id || entry.fbid || "");
  }

  function recordJoin(threadID, botID, addedParticipants) {
    const tid = String(threadID || "");
    if (!tid) return false;

    const list = Array.isArray(addedParticipants) ? addedParticipants : [];
    const joined = list.some((p) => extractParticipantID(p) === String(botID));
    if (!joined) return false;

    const cutoff = now() + graceMs;
    // Keep the earliest cutoff: if the bot rejoins, the first join time is the
    // one that matters for filtering the initial replay. A rejoin after the
    // bot was already removed should reset so post-rejoin live messages flow.
    if (!joinTimes.has(tid) || joinTimes.get(tid) < now()) {
      joinTimes.set(tid, cutoff);
    }
    return true;
  }

  function isHistoricalMessage(event) {
    if (!event) return false;
    const tid = String(event.threadID || "");
    if (!tid) return false;

    const cutoff = joinTimes.get(tid);
    if (!cutoff) return false; // unknown group → don't filter

    const ts = Number(event.timestamp || event.timestampMs || 0);
    if (!ts || !Number.isFinite(ts)) return false; // no usable timestamp → don't filter

    return ts < cutoff;
  }

  function isTracked(threadID) {
    return joinTimes.has(String(threadID || ""));
  }

  function forget(threadID) {
    joinTimes.delete(String(threadID || ""));
  }

  function clear() {
    joinTimes.clear();
  }

  function size() {
    return joinTimes.size;
  }

  return {
    recordJoin,
    isHistoricalMessage,
    isTracked,
    forget,
    clear,
    size,
  };
}

module.exports = { createJoinTracker, DEFAULT_GRACE_MS };
