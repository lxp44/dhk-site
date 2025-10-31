// netlify/functions/get-signed-media.js
// Node 18+ / AWS SDK v3
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// ---------- CONFIG (env-driven) ----------
const {
  AWS_REGION = "us-east-1",
  S3_BUCKET,
  S3_PREFIX = "",                 // e.g. "dhk-media/"
  SIGNED_TTL_SECONDS = "900",     // 15 minutes
  REQUIRED_ROLE = "members",      // change if you want a different gate
} = process.env;

if (!S3_BUCKET) {
  console.warn("[get-signed-media] Missing S3_BUCKET env var");
}

const s3 = new S3Client({ region: AWS_REGION });

// Simple catalog mapping your logical IDs to S3 keys and optional per-item role
// (You can also move this to a JSON file or DB later.)
const MEDIA_CATALOG = {
  // audio
  "track1": { key: "audio/track1.mp3", type: "audio", role: "members" },
  "track2": { key: "audio/track2.mp3", type: "audio", role: "members" },
  // video
  "video1": { key: "video/video1.mp4", type: "video", role: "members" },
};

// ---------- Helpers ----------
const CORS = {
  "Access-Control-Allow-Origin": "*", // or lock to your domain
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function deny(status, msg) {
  return { statusCode: status, headers: CORS, body: msg };
}

function okJSON(obj) {
  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}

function hasRole(user, role) {
  const roles =
    user?.app_metadata?.roles ||
    user?.roles ||
    user?.user_metadata?.roles ||
    [];
  return Array.isArray(roles) && roles.includes(role);
}

// ---------- Handler ----------
exports.handler = async (event, context) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS, body: "ok" };
    }

    // Only GET/POST
    if (!["GET", "POST"].includes(event.httpMethod)) {
      return deny(405, "Method Not Allowed");
    }

    // Auth: Identity injects user into clientContext when a valid token is sent
    const user = context.clientContext && context.clientContext.user;
    if (!user) return deny(401, "Unauthorized");

    // Parse params (either querystring or JSON body)
    let id, mediaType;
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      id = (qs.id || "").trim();
      mediaType = (qs.type || "").trim(); // "audio" | "video" (optional)
    } else {
      const payload = JSON.parse(event.body || "{}");
      id = (payload.id || "").trim();
      mediaType = (payload.type || "").trim();
    }

    if (!id) return deny(400, "Missing id");
    const item = MEDIA_CATALOG[id];
    if (!item) return deny(404, "Media not found");

    // Optional type filter
    if (mediaType && item.type !== mediaType) {
      return deny(400, "Type does not match the requested media");
    }

    // Role gate (per-item if set, else REQUIRED_ROLE)
    const neededRole = item.role || REQUIRED_ROLE;
    if (neededRole && !hasRole(user, neededRole)) {
      return deny(403, "Forbidden");
    }

    // Build S3 key (prefix + item key)
    const objectKey = `${S3_PREFIX}${item.key}`.replace(/\/{2,}/g, "/");

    // Sign the URL
    const ttl = Math.max(60, parseInt(SIGNED_TTL_SECONDS, 10) || 900);
    const cmd = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      // Optionally force a content-type:
      // ResponseContentType: item.type === "audio" ? "audio/mpeg" : "video/mp4",
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: ttl });

    // (Optional) include when it expires for the client
    const expiresAt = Date.now() + ttl * 1000;

    return okJSON({ url, expiresAt, id, type: item.type });
  } catch (err) {
    console.error("[get-signed-media] Error:", err);
    return deny(500, "Server Error");
  }
};