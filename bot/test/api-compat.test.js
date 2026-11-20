const test = require("node:test");
const assert = require("node:assert/strict");
const { wrapApi, LEGACY_METHODS } = require("../api-compat");

test("wrapApi installs nickname alias routing to changeNickname with same args", async () => {
  const calls = [];
  const api = {
    changeNickname(nickname, threadID, participantID) {
      calls.push({ nickname, threadID, participantID });
      return Promise.resolve();
    },
  };
  const wrapped = wrapApi(api);
  assert.equal(typeof wrapped.nickname, "function");
  await wrapped.nickname("TestNick", "group-1", "user-1");
  assert.deepEqual(calls, [{ nickname: "TestNick", threadID: "group-1", participantID: "user-1" }]);
});

test("wrapApi installs gcname alias routing to setTitle with same args", async () => {
  const calls = [];
  const api = {
    setTitle(title, threadID) {
      calls.push({ title, threadID });
      return Promise.resolve();
    },
  };
  const wrapped = wrapApi(api);
  assert.equal(typeof wrapped.gcname, "function");
  await wrapped.gcname("My Group", "group-2");
  assert.deepEqual(calls, [{ title: "My Group", threadID: "group-2" }]);
});

test("wrapApi does not shadow an existing legacy method", () => {
  const original = () => "original";
  const api = { nickname: original, changeNickname: () => "real" };
  const wrapped = wrapApi(api);
  assert.equal(wrapped.nickname, original);
});

test("wrapApi leaves api untouched when real method is missing", () => {
  const api = { sendMessage: () => {} };
  const wrapped = wrapApi(api);
  assert.equal(typeof wrapped.nickname, "undefined");
  assert.equal(typeof wrapped.gcname, "undefined");
});

test("wrapApi preserves all existing methods and properties", () => {
  const api = {
    sendMessage: () => "msg",
    getCurrentUserID: () => "123",
    listenMqtt: () => () => {},
    customProp: 42,
  };
  const wrapped = wrapApi(api);
  assert.equal(wrapped.sendMessage, api.sendMessage);
  assert.equal(wrapped.getCurrentUserID, api.getCurrentUserID);
  assert.equal(wrapped.listenMqtt, api.listenMqtt);
  assert.equal(wrapped.customProp, 42);
});

test("wrapApi returns null/undefined for falsy input", () => {
  assert.equal(wrapApi(null), null);
  assert.equal(wrapApi(undefined), undefined);
});

test("LEGACY_METHODS maps nickname to changeNickname and gcname to setTitle", () => {
  assert.equal(LEGACY_METHODS.nickname, "changeNickname");
  assert.equal(LEGACY_METHODS.gcname, "setTitle");
});
