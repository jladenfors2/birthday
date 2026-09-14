import { normalizeLang, withLang } from "./i18n.js";

export async function bindGlobeNav() {
  const link = document.querySelector("#nav-globe");
  if (!link) return;
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) return;
    const sessions = await res.json();
    const url = sessions[0]?.memoryUrl;
    if (!url) return;
    const lang = normalizeLang(localStorage.getItem("birthday-link-lang") || "sv");
    link.href = withLang(url, lang);
  } catch {
    /* keep placeholder href */
  }
}
