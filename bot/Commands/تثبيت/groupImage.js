const fs = require("fs");

function parseFacebookResponse(response) {
  if (!response) return {};
  if (typeof response === "object" && response !== null) {
    return response;
  }

  let body = Buffer.isBuffer(response)
    ? response.toString("utf8")
    : String(response || "");
  body = body.replace(/^\s*for\s*\(\s*;\s*;\s*\)\s*;\s*/, "").trim();

  try {
    return JSON.parse(body);
  } catch (_) {
    throw new Error(`استجابة غير مفهومة من فيسبوك: ${body.slice(0, 180)}`);
  }
}

function makeMessageID() {
  return `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
}

function findImageURL(value, threadID, seen = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || depth > 10 || seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (value.message_thread && typeof value.message_thread === "object") {
    const thread = value.message_thread;
    const threadKey = thread.thread_key || {};
    const foundThreadID = String(
      threadKey.thread_fbid || threadKey.other_user_id || "",
    );
    const imageURL = thread.image && thread.image.uri;
    if (imageURL && (!foundThreadID || foundThreadID === String(threadID))) {
      return String(imageURL);
    }
  }

  if (
    typeof value.image_src === "string" &&
    (!value.thread_fbid || String(value.thread_fbid) === String(threadID))
  ) {
    return value.image_src;
  }

  if (
    value.image &&
    typeof value.image === "object" &&
    typeof value.image.uri === "string"
  ) {
    return value.image.uri;
  }

  if (typeof value.image_uri === "string") {
    return value.image_uri;
  }

  for (const child of Object.values(value)) {
    const result = findImageURL(child, threadID, seen, depth + 1);
    if (result) return result;
  }
  return null;
}

async function readGroupImage(api, threadID) {
  if (!api || typeof api.httpPost !== "function") {
    throw new Error("جلسة فيسبوك غير جاهزة");
  }

  const form = {
    queries: JSON.stringify({
      o0: {
        doc_id: "3449967031715030",
        query_params: {
          id: String(threadID),
          message_limit: 0,
          load_messages: false,
          load_read_receipts: false,
          before: null,
        },
      },
    }),
    batch_name: "MessengerGraphQLThreadFetcher",
  };

  const body = await api.httpPost(
    "https://www.facebook.com/api/graphqlbatch/",
    form,
  );
  const parsed = parseFacebookResponse(body);
  return findImageURL(parsed, threadID);
}

async function changeGroupImage(api, imagePath, threadID) {
  if (!api || typeof api.httpPostFormData !== "function") {
    throw new Error("جلسة فيسبوك غير جاهزة");
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error("ملف الصورة المحفوظة غير موجود");
  }

  const uploadBody = await api.httpPostFormData(
    "https://upload.facebook.com/ajax/mercury/upload.php",
    {
      images_only: "true",
      "attachment[]": fs.createReadStream(imagePath),
    },
  );
  const uploadData = parseFacebookResponse(uploadBody);
  const metadata = uploadData.payload && uploadData.payload.metadata;
  const imageID = metadata && metadata[0] && metadata[0].image_id;
  if (!imageID) {
    throw new Error("فشل رفع الصورة إلى فيسبوك");
  }

  const messageID = makeMessageID();
  const timestamp = Date.now();
  const form = {
    client: "mercury",
    action_type: "ma-type:log-message",
    author: `fbid:${api.getCurrentUserID()}`,
    author_email: "",
    ephemeral_ttl_mode: "0",
    is_filtered_content: false,
    is_filtered_content_account: false,
    is_filtered_content_bh: false,
    is_filtered_content_invalid_app: false,
    is_filtered_content_quasar: false,
    is_forward: false,
    is_spoof_warning: false,
    is_unread: false,
    log_message_type: "log:thread-image",
    manual_retry_cnt: "0",
    message_id: messageID,
    offline_threading_id: messageID,
    source: "source:chat:web",
    "source_tags[0]": "source:chat",
    status: "0",
    thread_fbid: threadID,
    thread_id: threadID,
    timestamp,
    timestamp_absolute: "Today",
    timestamp_relative: new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    timestamp_time_passed: "0",
    thread_image_id: String(imageID),
  };

  const body = await api.httpPost(
    "https://www.facebook.com/messaging/set_thread_image/",
    form,
  );
  const result = parseFacebookResponse(body);
  if (result && (result.error || result.errors)) {
    throw new Error(
      result.error_description ||
        result.error ||
        "رفض فيسبوك تغيير صورة المجموعة",
    );
  }
  return result;
}

module.exports = { changeGroupImage, readGroupImage };
