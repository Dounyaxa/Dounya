const test = require("node:test");
const assert = require("node:assert/strict");
const { createJoinTracker } = require("../join-tracker");

function makeTracker({ now = 10000, graceMs = 5000 } = {}) {
  return createJoinTracker({ now: () => now, graceMs });
}

test("recordJoin with object participants detects the bot and sets a cutoff", () => {
  const t = makeTracker();
  const joined = t.recordJoin("group-1", "bot-1", [{ userFbId: "bot-1" }, { userID: "other" }]);
  assert.equal(joined, true);
  assert.equal(t.isTracked("group-1"), true);
});

test("recordJoin with string participants detects the bot", () => {
  const t = makeTracker();
  const joined = t.recordJoin("group-1", "bot-1", ["bot-1", "other-user"]);
  assert.equal(joined, true);
});

test("recordJoin returns false when the bot is not in the added list", () => {
  const t = makeTracker();
  const joined = t.recordJoin("group-1", "bot-1", [{ userID: "someone-else" }]);
  assert.equal(joined, false);
  assert.equal(t.isTracked("group-1"), false);
});

test("isHistoricalMessage drops a message timestamped before the join cutoff", () => {
  const t = makeTracker({ now: 10000, graceMs: 5000 });
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  // cutoff = 10000 + 5000 = 15000
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 12000 }), true);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 14000 }), true);
});

test("isHistoricalMessage allows a message timestamped at or after the cutoff", () => {
  const t = makeTracker({ now: 10000, graceMs: 5000 });
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 15000 }), false);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 20000 }), false);
});

test("isHistoricalMessage does not filter untracked groups", () => {
  const t = makeTracker();
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  assert.equal(t.isHistoricalMessage({ threadID: "group-2", timestamp: 100 }), false);
});

test("isHistoricalMessage does not filter when timestamp is missing or invalid", () => {
  const t = makeTracker();
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1" }), false);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 0 }), false);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: "abc" }), false);
});

test("forget removes a group from tracking", () => {
  const t = makeTracker();
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  assert.equal(t.isTracked("group-1"), true);
  t.forget("group-1");
  assert.equal(t.isTracked("group-1"), false);
  assert.equal(t.isHistoricalMessage({ threadID: "group-1", timestamp: 100 }), false);
});

test("clear removes all tracked groups", () => {
  const t = makeTracker();
  t.recordJoin("group-1", "bot-1", [{ userID: "bot-1" }]);
  t.recordJoin("group-2", "bot-1", [{ userID: "bot-1" }]);
  assert.equal(t.size(), 2);
  t.clear();
  assert.equal(t.size(), 0);
});

test("recordJoin handles addedParticipants with fbid field", () => {
  const t = makeTracker();
  const joined = t.recordJoin("group-1", "bot-1", [{ fbid: "bot-1" }]);
  assert.equal(joined, true);
});

test("recordJoin handles empty threadID gracefully", () => {
  const t = makeTracker();
  assert.equal(t.recordJoin("", "bot-1", [{ userID: "bot-1" }]), false);
});
