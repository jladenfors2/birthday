import { applyI18n, normalizeLang, t, withLang } from "./i18n.js";

const LANG_KEY = "birthday-link-lang";
let linkLang = normalizeLang(localStorage.getItem(LANG_KEY) || "sv");

const createButton = document.querySelector("#create");
const active = document.querySelector("#active");
const shareInput = document.querySelector("#share-url");
const copyButton = document.querySelector("#copy");
const copyStatus = document.querySelector("#copy-status");
const empty = document.querySelector("#empty");
const wishesEl = document.querySelector("#wishes");
const memoryInput = document.querySelector("#memory-url");
const memoryCopied = document.querySelector("#memory-copied");

const STORAGE_KEY = "birthday-active-session";

let currentId = localStorage.getItem(STORAGE_KEY);
let pollTimer = null;

async function api(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

const wishCount = document.querySelector("#wish-count");
const shareWhatsapp = document.querySelector("#share-whatsapp");
const shareEmail = document.querySelector("#share-email");

function renderWishes(session) {
  wishesEl.replaceChildren();
  const wishes = session.wishes || [];
  empty.classList.toggle("hidden", wishes.length > 0);
  wishCount.classList.toggle("hidden", wishes.length === 0);
  wishCount.textContent =
    wishes.length === 1 ? t(linkLang, "wishCountOne") : t(linkLang, "wishCountMany", { n: wishes.length });

  for (const wish of [...wishes].reverse()) {
    const card = document.createElement("article");
    card.className = "card stack";
    const head = document.createElement("div");
    head.className = "wish-head";
    const titleRow = document.createElement("div");
    titleRow.className = "brand-row";
    const name = document.createElement("strong");
    name.textContent = wish.name || t(linkLang, "anonymous");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-coral btn-compact";
    remove.textContent = t(linkLang, "delete");
    remove.addEventListener("click", () => deleteWish(wish, remove));
    titleRow.append(name, remove);
    const when = document.createElement("p");
    when.className = "muted";
    when.textContent = new Date(wish.createdAt).toLocaleString(linkLang === "sv" ? "sv-SE" : "en-GB");
    head.append(titleRow, when);
    if (wish.note) {
      const note = document.createElement("p");
      note.className = "lede";
      note.textContent = wish.note;
      head.append(note);
    }
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.src = wish.url;
    card.append(head, video);
    wishesEl.append(card);
  }
}

async function deleteWish(wish, button) {
  const who = wish.name || t(linkLang, "anonymous");
  if (!window.confirm(t(linkLang, "deleteConfirm", { name: who }))) return;
  button.disabled = true;
  try {
    await api(`/api/sessions/${currentId}/wishes/${wish.id}`, { method: "DELETE" });
    await loadSession(currentId);
  } catch (err) {
    button.disabled = false;
    alert(err.message);
  }
}

function setShareLinks(url) {
  const message = t(linkLang, "shareMessage", { url });
  shareWhatsapp.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  shareEmail.href = `mailto:?subject=${encodeURIComponent(t(linkLang, "shareSubject"))}&body=${encodeURIComponent(message)}`;
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
  memoryInput.value = withLang(session.memoryUrl, linkLang);
  setShareLinks(shareInput.value);
}

async function loadSession(id) {
  const session = await api(`/api/sessions/${id}`);
  currentId = session.id;
  localStorage.setItem(STORAGE_KEY, session.id);
  refreshUrls(session);
  active.classList.remove("hidden");
  renderWishes(session);
  startPolling();
  return session;
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!currentId) return;
    try {
      const session = await api(`/api/sessions/${currentId}`);
      renderWishes(session);
      refreshUrls(session);
    } catch {
      clearInterval(pollTimer);
    }
  }, 4000);
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
      memoryInput.value = withLang(memoryInput.value, linkLang);
      setShareLinks(shareInput.value);
    }
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

document.querySelector("#open-link").addEventListener("click", () => {
  if (shareInput.value) window.open(shareInput.value, "_blank", "noopener,noreferrer");
});

document.querySelector("#copy-memory").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(memoryInput.value);
  } catch {
    memoryInput.select();
    document.execCommand("copy");
  }
  memoryCopied.classList.remove("hidden");
});

document.querySelector("#open-memory").addEventListener("click", () => {
  if (memoryInput.value) window.open(memoryInput.value, "_blank", "noopener,noreferrer");
});

ensureCampaign().catch(() => {});
