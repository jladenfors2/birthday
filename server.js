import express from "express";
import multer from "multer";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import { existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

function loadEnvFile() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "sessions.json");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3000;
const ID_PATTERN = /^[a-f0-9]{16}$/;
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

function newId() {
  return randomBytes(8).toString("hex");
}

async function readStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.sessions) ? parsed : { sessions: [] };
  } catch (err) {
    if (err.code === "ENOENT") return { sessions: [] };
    throw err;
  }
}

let writeQueue = Promise.resolve();

function writeStore(store) {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2));
    await fs.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}

async function updateStore(mutator) {
  const store = await readStore();
  const result = mutator(store);
  await writeStore(store);
  return result;
}

function publicBase(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sessionPayload(session, req) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    shareUrl: `${publicBase(req)}/w/${session.id}`,
    memoryUrl: `${publicBase(req)}/memory/${session.id}`,
    wishCount: session.wishes.length,
    wishes: session.wishes.map((wish) => ({
      id: wish.id,
      createdAt: wish.createdAt,
      url: `/uploads/${wish.filename}`,
      mimeType: wish.mimeType,
      size: wish.size,
      name: wish.name || "",
      note: wish.note || "",
    })),
  };
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename(req, file, cb) {
    const id = newId();
    const ext = file.mimetype.includes("mp4") ? ".mp4" : ".webm";
    req.wishFile = { id, filename: `${id}${ext}` };
    cb(null, req.wishFile.filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const type = (file.mimetype || "").toLowerCase();
    const name = (file.originalname || "").toLowerCase();
    const looksLikeVideo =
      type.startsWith("video/") ||
      type === "application/octet-stream" ||
      type === "" ||
      name.endsWith(".webm") ||
      name.endsWith(".mp4") ||
      name.endsWith(".mov");
    if (looksLikeVideo) cb(null, true);
    else cb(new Error("Only video uploads are allowed."));
  },
});

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (!left.length || !right.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sessionToken() {
  const payload = "ok";
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function isAuthed(req) {
  const token = parseCookies(req).k50_admin || "";
  const [payload, sig] = token.split(".");
  if (payload !== "ok" || !sig) return false;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return safeEqual(sig, expected);
}

function cookieHeader(clear = false) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (clear) {
    return `k50_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
  }
  return `k50_admin=${encodeURIComponent(sessionToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`;
}

function requireAdminPage(req, res, next) {
  if (isAuthed(req)) return next();
  res.redirect("/login");
}

function requireAdminApi(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "Login required." });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: false }));
app.get("/vendor/three.module.js", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "node_modules/three/build/three.module.js"));
});

app.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/");
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

function normalizePassword(value) {
  return String(value || "")
    .trim()
    .replaceAll("\u2026", "...");
}

app.post("/login", (req, res) => {
  const user = String(req.body?.username || "").trim();
  const pass = normalizePassword(req.body?.password);
  const expectedUser = String(ADMIN_USER).trim();
  const expectedPass = normalizePassword(ADMIN_PASSWORD);
  if (!expectedUser || !expectedPass || !safeEqual(user, expectedUser) || !safeEqual(pass, expectedPass)) {
    return res.redirect("/login?error=1");
  }
  res.setHeader("Set-Cookie", cookieHeader());
  res.redirect("/");
});

app.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", cookieHeader(true));
  res.redirect("/login");
});

app.get("/", requireAdminPage, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/w/:id", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "wish.html"));
});

app.get("/memory/:id", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "memory.html"));
});

function campaign(store) {
  return store.sessions[0] || null;
}

app.post("/api/sessions", requireAdminApi, async (req, res) => {
  const store = await readStore();
  const existing = campaign(store);
  if (existing) return res.json(sessionPayload(existing, req));

  const session = {
    id: newId(),
    createdAt: new Date().toISOString(),
    wishes: [],
  };
  await updateStore((next) => {
    next.sessions = [session];
  });
  res.status(201).json(sessionPayload(session, req));
});

app.get("/api/sessions", requireAdminApi, async (req, res) => {
  const store = await readStore();
  res.json(store.sessions.map((session) => sessionPayload(session, req)));
});

app.get("/api/sessions/:id", async (req, res) => {
  if (!ID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid link." });
  }
  const store = await readStore();
  const match = store.sessions.find((item) => item.id === req.params.id);
  const session = match || campaign(store);
  if (!session) return res.status(404).json({ error: "This link is not valid." });
  res.json(sessionPayload(session, req));
});

app.delete("/api/sessions/:id/wishes/:wishId", requireAdminApi, async (req, res) => {
  if (!ID_PATTERN.test(req.params.id) || !ID_PATTERN.test(req.params.wishId)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  try {
    const removed = await updateStore((store) => {
      const session =
        store.sessions.find((item) => item.id === req.params.id) || campaign(store);
      if (!session) throw new Error("missing-session");
      const index = session.wishes.findIndex((wish) => wish.id === req.params.wishId);
      if (index === -1) throw new Error("missing-wish");
      const [wish] = session.wishes.splice(index, 1);
      return wish;
    });
    const file = path.basename(removed.filename || "");
    if (file) await fs.unlink(path.join(UPLOAD_DIR, file)).catch(() => {});
    res.status(204).end();
  } catch (error) {
    if (error.message === "missing-session" || error.message === "missing-wish") {
      return res.status(404).json({ error: "This wish is not in the vault." });
    }
    console.error(error);
    res.status(500).json({ error: "Could not delete the video." });
  }
});

app.post("/api/sessions/:id/wishes", (req, res) => {
  if (!ID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  upload.single("video")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    if (!req.file || !req.wishFile) {
      return res.status(400).json({ error: "No video received." });
    }

    try {
      const wish = await updateStore((store) => {
        const session =
          store.sessions.find((item) => item.id === req.params.id) || campaign(store);
        if (!session) {
          const error = new Error("missing-session");
          throw error;
        }
        const name = cleanText(req.body?.name, 80);
        const note = cleanText(req.body?.note, 200);
        if (!name) {
          const error = new Error("missing-name");
          throw error;
        }
        const created = {
          id: req.wishFile.id,
          createdAt: new Date().toISOString(),
          filename: req.wishFile.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          name,
          note,
        };
        session.wishes.push(created);
        return created;
      });
      res.status(201).json({
        id: wish.id,
        createdAt: wish.createdAt,
        url: `/uploads/${wish.filename}`,
        name: wish.name,
        note: wish.note,
      });
    } catch (error) {
      await fs.unlink(req.file.path).catch(() => {});
      if (error.message === "missing-session") {
        return res.status(404).json({ error: "This link is not valid." });
      }
      if (error.message === "missing-name") {
        return res.status(400).json({ error: "Please add your name." });
      }
      console.error(error);
      res.status(500).json({ error: "Could not save the video." });
    }
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`Birthday wishes running at http://localhost:${PORT}`);
});
