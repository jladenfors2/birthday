export async function bindGlobeNav() {
  const link = document.querySelector("#nav-globe");
  if (!link) return;
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) return;
    const sessions = await res.json();
    const url = sessions[0]?.memoryUrl;
    if (url) link.href = url;
  } catch {
    /* keep placeholder href */
  }
}
