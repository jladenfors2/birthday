import { applyI18n, detectLang, t } from "./i18n.js";

const lang = detectLang();

const createButton = document.querySelector("#create");
const active = document.querySelector("#active");
const shareInput = document.querySelector("#share-url");
const copyButton = document.querySelector("#copy");
const copyStatus = document.querySelector("#copy-status");

const STORAGE_KEY = "birthday-active-session";

let currentId = localStorage.getItem(STORAGE_KEY);

async function api(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function refreshUrls(session) {
  shareInput.value = session.shareUrl;
  const globe = document.querySelector("#nav-globe");
  if (globe && session.memoryUrl) globe.href = session.memoryUrl;
}

async function loadSession(id) {
  const session = await api(`/api/sessions/${id}`);
  currentId = session.id;
  localStorage.setItem(STORAGE_KEY, session.id);
  refreshUrls(session);
  active.classList.remove("hidden");
  return session;
}

async function ensureCampaign() {
  if (currentId) {
    try {
      return await loadSession(currentId);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      currentId = null;
    }
  }
  const sessions = await api("/api/sessions");
  if (sessions[0]) return loadSession(sessions[0].id);
  const session = await api("/api/sessions", { method: "POST" });
  return loadSession(session.id);
}

applyI18n(lang);
document.title = t(lang, "hostTitle");

createButton.addEventListener("click", async () => {
  createButton.disabled = true;
  try {
    await ensureCampaign();
  } catch (err) {
    alert(err.message);
  } finally {
    createButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareInput.value);
  } catch {
    shareInput.select();
    document.execCommand("copy");
  }
  copyStatus.classList.remove("hidden");
});

ensureCampaign().catch(() => {});
