"use strict";

/**
 * Compatibility shim that exposes the legacy api method names the bot commands
 * were written against, routing them to the real neokex-fca@5.0.6 methods after
 * verifying they exist.
 *
 * Each legacy name is resolved once at wrap time: if the real method exists on
 * the underlying api, a proxy is installed; otherwise the shim leaves it
 * undefined so a clear "is not a function" surfaces instead of a silent
 * no-op. Nothing is guessed or defaulted.
 *
 * The returned object is the same api instance with the legacy names added —
 * every real method, property and sync member (getCurrentUserID, getAppState,
 * listenMqtt, …) passes through untouched.
 */

// Map of legacyName -> realName. Only pairs verified against neokex-fca@5.0.6
// belong here; add one only after confirming the real method's signature.
const LEGACY_METHODS = {
  // api.nickname(nickname, threadID, participantID) -> api.changeNickname(...)
  nickname: "changeNickname",
  // api.gcname(name, threadID) -> api.setTitle(name, threadID)
  gcname: "setTitle",
};

function wrapApi(api) {
  if (!api || typeof api !== "object") return api;

  for (const [legacyName, realName] of Object.entries(LEGACY_METHODS)) {
    const real = api[realName];
    if (typeof real !== "function") continue;
    // Don't shadow if a method with the legacy name already exists.
    if (typeof api[legacyName] === "function") continue;
    api[legacyName] = function compatLegacy(...args) {
      return real.apply(api, args);
    };
  }

  return api;
}

module.exports = { wrapApi, LEGACY_METHODS };
