import { applyI18n, normalizeLang, t } from "./i18n.js";

const lang = normalizeLang(localStorage.getItem("birthday-link-lang") || "sv");
applyI18n(lang);
document.title = t(lang, "galleryTitle");

const board = document.querySelector("#board");
const empty = document.querySelector("#empty");
const lightbox = document.querySelector("#lightbox");
const lightboxVideo = document.querySelector("#lightbox-video");
const lightboxName = document.querySelector("#lightbox-name");
const lightboxNote = document.querySelector("#lightbox-note");

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
  caption.append(name);
  if (wish.note) {
    const note = document.createElement("p");
    note.textContent = wish.note;
    caption.append(note);
  }

  pin.append(media, caption);

  video.addEventListener("mouseenter", () => video.play().catch(() => {}));
  video.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) video.play().catch(() => {});
        else {
          video.pause();
          video.currentTime = 0;
        }
      }
    },
    { threshold: 0.6 },
  );
  observer.observe(video);

  return pin;
}

async function load() {
  const res = await fetch("/api/sessions");
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent("/gallery")}`;
    return;
  }
  const sessions = await res.json();
  const wishes = (sessions[0]?.wishes || []).slice().reverse();
  empty.classList.toggle("hidden", wishes.length > 0);
  board.replaceChildren();
  for (const wish of wishes) board.append(pinCard(wish));
}

load().catch(() => {
  empty.classList.remove("hidden");
});
