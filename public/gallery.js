import { applyI18n, detectLang, t } from "./i18n.js";
import { bindGlobeNav } from "./nav.js";

const lang = detectLang();
applyI18n(lang);
document.title = t(lang, "galleryTitle");
bindGlobeNav();

const board = document.querySelector("#board");
const empty = document.querySelector("#empty");
const lightbox = document.querySelector("#lightbox");
const lightboxVideo = document.querySelector("#lightbox-video");
const lightboxName = document.querySelector("#lightbox-name");
const lightboxNote = document.querySelector("#lightbox-note");
let sessionId = "";

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxVideo.pause();
  lightboxVideo.removeAttribute("src");
}

document.querySelector("#lightbox-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

function openLightbox(wish) {
  lightboxName.textContent = wish.name || t(lang, "anonymous");
  lightboxNote.textContent = wish.note || "";
  lightboxVideo.src = wish.url;
  lightbox.classList.remove("hidden");
  lightboxVideo.play().catch(() => {});
}

function pinCard(wish) {
  const pin = document.createElement("article");
  pin.className = "pin";

  const media = document.createElement("button");
  media.type = "button";
  media.className = "pin-media";
  media.addEventListener("click", () => openLightbox(wish));

  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  if (wish.posterUrl) video.poster = wish.posterUrl;
  video.src = wish.url;
  video.setAttribute("playsinline", "");

  const play = document.createElement("span");
  play.className = "pin-play";
  play.innerHTML = '<span class="material-symbols-outlined icon-fill">play_arrow</span>';

  media.append(video, play);

  const caption = document.createElement("div");
  caption.className = "pin-caption";
  const name = document.createElement("strong");
  name.textContent = wish.name || t(lang, "anonymous");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "pin-delete";
  remove.title = t(lang, "delete");
  remove.setAttribute("aria-label", t(lang, "delete"));
  remove.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  remove.addEventListener("click", () => deleteWish(wish, pin, remove));

  const head = document.createElement("div");
  head.className = "pin-caption-head";
  head.append(name, remove);
  caption.append(head);
  if (wish.note) {
    const note = document.createElement("p");
    note.textContent = wish.note;
    caption.append(note);
  }

  pin.append(media, caption);

  media.addEventListener("mouseenter", () => video.play().catch(() => {}));
  media.addEventListener("mouseleave", () => {
    video.pause();
    video.load();
  });

  return pin;
}

async function deleteWish(wish, pin, button) {
  const name = wish.name || t(lang, "anonymous");
  if (!confirm(t(lang, "deleteConfirm", { name }))) return;
  button.disabled = true;
  const res = await fetch(`/api/sessions/${sessionId}/wishes/${wish.id}`, { method: "DELETE" }).catch(
    () => null,
  );
  if (res?.status === 401) {
    location.href = `/login?next=${encodeURIComponent("/gallery")}`;
    return;
  }
  if (!res?.ok && res?.status !== 404) {
    button.disabled = false;
    alert((await res?.json().catch(() => null))?.error || "Could not delete the video.");
    return;
  }
  pin.querySelector("video")?.pause();
  pin.remove();
  empty.classList.toggle("hidden", board.children.length > 0);
}

async function load() {
  const res = await fetch("/api/sessions");
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent("/gallery")}`;
    return;
  }
  const sessions = await res.json();
  sessionId = sessions[0]?.id || "";
  const wishes = (sessions[0]?.wishes || []).slice().reverse();
  empty.classList.toggle("hidden", wishes.length > 0);
  board.replaceChildren();
  for (const wish of wishes) board.append(pinCard(wish));
}

load().catch(() => {
  empty.classList.remove("hidden");
});
