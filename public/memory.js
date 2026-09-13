import { createGlobe } from "./globe.js";
import { applyI18n, langFromUrl, t } from "./i18n.js";

const sessionId = location.pathname.split("/").filter(Boolean)[1] || "";
const lang = langFromUrl();
applyI18n(lang);
document.title = t(lang, "memoryTitle");

const invalid = document.querySelector("#memory-invalid");
const app = document.querySelector("#memory-app");
const countEl = document.querySelector("#memory-count");
const modal = document.querySelector("#wish-modal");
const modalName = document.querySelector("#modal-name");
const modalNote = document.querySelector("#modal-note");
const modalVideo = document.querySelector("#modal-video");
const spinButton = document.querySelector("#globe-spin");
const copyButton = document.querySelector("#copy-memory");

function closeModal() {
  modal.classList.add("hidden");
  modalVideo.pause();
  modalVideo.removeAttribute("src");
}

document.querySelector("#modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
  } catch {
    /* ignore */
  }
  copyButton.textContent = t(lang, "copied");
  window.setTimeout(() => {
    copyButton.textContent = t(lang, "copyThisLink");
  }, 2000);
});

async function boot() {
  if (!/^[a-f0-9]{16}$/.test(sessionId)) {
    invalid.classList.remove("hidden");
    return;
  }

  let session;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      invalid.classList.remove("hidden");
      return;
    }
    session = await res.json();
  } catch {
    invalid.classList.remove("hidden");
    return;
  }

  app.classList.remove("hidden");
  const wishes = session.wishes || [];
  const n = wishes.length;
  countEl.textContent =
    n === 0 ? t(lang, "memoryEmpty") : n === 1 ? t(lang, "memoryOne") : t(lang, "memoryMany", { n });

  const globe = createGlobe(document.querySelector("#globe"), {
    hoverEl: document.querySelector("#globe-hover"),
    onSelect(wish) {
      modalName.textContent = wish.name || t(lang, "friend");
      modalNote.textContent = wish.note || "";
      modalVideo.src = wish.url;
      modal.classList.remove("hidden");
      modalVideo.play().catch(() => {});
    },
  });
  globe.setWishes(wishes);
  requestAnimationFrame(() => globe.resize());

  spinButton.addEventListener("click", () => {
    globe.setSpinning(!globe.isSpinning());
    spinButton.textContent = globe.isSpinning() ? t(lang, "spinOn") : t(lang, "spinOff");
  });
  document.querySelector("#globe-in").addEventListener("click", () => globe.zoom(-40));
  document.querySelector("#globe-out").addEventListener("click", () => globe.zoom(40));
  document.querySelector("#globe-reset").addEventListener("click", () => globe.reset());
}

boot();
