const fs = require('fs');
const path = require('path');

const IDS_FILE = path.join(__dirname, '..', 'السياجين', 'ids.json');

function loadIDs() {
  let rawIDs;

  try {
    rawIDs = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  } catch (error) {
    throw new Error(`تعذر قراءة ملف IDs: ${error.message}`);
  }

  if (!Array.isArray(rawIDs)) {
    throw new Error('ملف IDs يجب أن يحتوي على مصفوفة من الأرقام.');
  }

  const ids = [];
  const seen = new Set();

  for (const value of rawIDs) {
    const id = String(value).trim();
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addUsersToGroup(api, userIDs, threadID) {
  const added = [];
  const failed = [];

  for (const userID of userIDs) {
    try {
      await api.addUserToGroup(userID, threadID);
      added.push(userID);
      await sleep(800);
    } catch (error) {
      failed.push({
        userID,
        reason: error.message || String(error),
      });
    }
  }

  return { added, failed };
}

module.exports = {
  name: 'السياجين',

  async execute(api, event) {
    const threadID = String(event.threadID || '');
    if (!threadID) return;

    let ids;
    try {
      ids = loadIDs();
    } catch (error) {
      console.error('[السياجين] خطأ في ملف IDs:', error.message);
      await api.sendMessage(`❌ ${error.message}`, threadID);
      return;
    }

    if (ids.length === 0) {
      await api.sendMessage('⚠️ ملف السياجين فارغ. أضف IDs داخل bot/السياجين/ids.json', threadID);
      return;
    }

    try {
      if (event.isGroup === false) {
        await api.sendMessage('⚠️ هذا الأمر يعمل داخل المجموعات فقط.', threadID);
        return;
      }

      const participantIDs = (Array.isArray(event.participantIDs)
        ? event.participantIDs
        : [])
        .map(id => String(id))
        .filter(Boolean);
      const currentMembers = new Set(participantIDs);
      const botID = api.getCurrentUserID
        ? String(api.getCurrentUserID())
        : null;
      const pendingIDs = ids.filter(id => id !== botID && !currentMembers.has(id));

      if (pendingIDs.length === 0) {
        await api.sendMessage('✅ كل الأشخاص الموجودين في ملف السياجين داخل المجموعة بالفعل.', threadID);
        return;
      }

      try {
        const result = await addUsersToGroup(api, pendingIDs, threadID);
        const addedCount = result.added.length;
        const failedCount = result.failed.length;

        console.log(
          `[السياجين] ✅ تمت إضافة ${addedCount} من ${pendingIDs.length} شخص في ${threadID}`
        );

        if (failedCount === 0) {
          await api.sendMessage('𝒚𝒐𝒖 𝒇𝒂𝒄𝒆 𝒕𝒉𝒆 𝒓𝒖𝒊𝒏𝒆𝒅 𝒌𝒊𝒏𝒈', threadID);
        } else {
          await api.sendMessage(
            `⚠️ تمت إضافة ${addedCount} شخص، وتعذر إضافة ${failedCount}.`,
            threadID
          );
        }
      } catch (error) {
        console.error('[السياجين] ❌ فشل الإضافة الجماعية:', error.message || error);
        await api.sendMessage(
          `❌ فشلت الإضافة الجماعية: ${error.message || error}`,
          threadID
        );
      }
    } catch (error) {
      console.error('[السياجين] خطأ:', error.message || error);
      try {
        await api.sendMessage(`❌ حدث خطأ في أمر السياجين: ${error.message || error}`, threadID);
      } catch (_) {}
    }
  },
};
