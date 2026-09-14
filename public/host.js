import { applyI18n, normalizeLang, t, withLang } from "./i18n.js";
import { bindGlobeNav } from "./nav.js";

const LANG_KEY = "birthday-link-lang";
let linkLang = normalizeLang(localStorage.getItem(LANG_KEY) || "sv");

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

function syncLangButtons() {
  for (const button of document.querySelectorAll(".lang-toggle [data-lang]")) {
    button.classList.toggle("on", button.dataset.lang === linkLang);
  }
}

function applyHostLang() {
  applyI18n(linkLang);
  document.title = t(linkLang, "hostTitle");
  syncLangButtons();
}

function refreshUrls(session) {
  shareInput.value = withLang(session.shareUrl, linkLang);
  const globe = document.querySelector("#nav-globe");
  if (globe && session.memoryUrl) globe.href = withLang(session.memoryUrl, linkLang);
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

for (const button of document.querySelectorAll(".lang-toggle [data-lang]")) {
  button.addEventListener("click", () => {
    linkLang = normalizeLang(button.dataset.lang);
    localStorage.setItem(LANG_KEY, linkLang);
    applyHostLang();
    if (shareInput.value) {
      shareInput.value = withLang(shareInput.value, linkLang);
    }
    bindGlobeNav();
    if (currentId) loadSession(currentId).catch(() => {});
  });
}

applyHostLang();

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
