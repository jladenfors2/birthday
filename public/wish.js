import { applyI18n, langFromUrl, t } from "./i18n.js";

const RECORD_MS = 10_000;
const COUNTDOWN_S = 3;
const sessionId = location.pathname.split("/").filter(Boolean)[1] || "";
const lang = langFromUrl();
applyI18n(lang);
document.title = t(lang, "wishTitle");

const headerTitle = document.querySelector("#header-title");
const headerKicker = document.querySelector("#header-kicker");
const progressEl = document.querySelector("#progress");
const liveVideo = document.querySelector("#live");
const playback = document.querySelector("#playback");
const recBadge = document.querySelector("#rec-badge");
const countOverlay = document.querySelector("#count-overlay");
const countNum = document.querySelector("#count-num");
const levelEl = document.querySelector("#level");
const eqBars = [...document.querySelectorAll("#eq span")];
const camError = document.querySelector("#cam-error");
const startButton = document.querySelector("#start");
const startLabel = document.querySelector("#start-label");
const retryCam = document.querySelector("#retry-cam");
const sendError = document.querySelector("#send-error");
const saved = document.querySelector("#saved");
const toast = document.querySelector("#toast");
const toastText = document.querySelector("#toast-text");
const copyLinkLabel = document.querySelector("#copy-link-label");
const sendLabel = document.querySelector("#send-label");
const guestName = document.querySelector("#guest-name");
const guestNote = document.querySelector("#guest-note");
const charCount = document.querySelector("#char-count");
const thanksCopy = document.querySelector("#thanks-copy");

const steps = {
  invalid: document.querySelector("#step-invalid"),
  1: document.querySelector("#step-1"),
  2: document.querySelector("#step-2"),
  3: document.querySelector("#step-3"),
  preview: document.querySelector("#step-preview"),
  thanks: document.querySelector("#step-thanks"),
};

const labels = {
  1: { title: t(lang, "headerWelcome"), kicker: t(lang, "kicker"), step: 1 },
  2: { title: t(lang, "headerReady"), kicker: t(lang, "kicker"), step: 2 },
  3: { title: t(lang, "headerCamera"), kicker: t(lang, "kicker"), step: 3 },
  preview: { title: t(lang, "headerPreview"), kicker: t(lang, "kicker"), step: 4 },
  thanks: { title: t(lang, "headerThanks"), kicker: t(lang, "kicker"), step: 4 },
  invalid: { title: t(lang, "headerInvalid"), kicker: t(lang, "kicker"), step: 0 },
};

let stream = null;
let audio = null;
let recorder = null;
let chunks = [];
let recordedBlob = null;
let recordedType = "";
let tickTimer = null;
let countdownTimer = null;
let countingDown = false;
let meterFrame = 0;

function show(name) {
  for (const [key, el] of Object.entries(steps)) {
    el.classList.toggle("hidden", key !== String(name));
  }
  const meta = labels[name] || labels.invalid;
  headerTitle.textContent = meta.title;
  headerKicker.textContent = meta.kicker;
  for (const bar of progressEl.querySelectorAll("span")) {
    bar.classList.toggle("on", Number(bar.dataset.step) <= meta.step);
  }
}

function showToast(message) {
  toastText.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2400);
}

function pickMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function stopStream() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  if (audio) {
    audio.context.close().catch(() => {});
    audio = null;
  }
  cancelAnimationFrame(meterFrame);
  liveVideo.srcObject = null;
}

function setCamError(message) {
  camError.textContent = message || "";
  camError.classList.toggle("hidden", !message);
  retryCam.classList.toggle("hidden", !message);
  startButton.disabled = Boolean(message);
}

async function openCamera() {
  setCamError("");
  stopStream();
  startButton.disabled = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
  } catch {
    setCamError(t(lang, "camDenied"));
    return;
  }

  liveVideo.srcObject = stream;
  await liveVideo.play().catch(() => {});
  startButton.disabled = false;
  startAudioMeter(stream);
}

function startAudioMeter(mediaStream) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(mediaStream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  audio = { context, analyser, data };

  const draw = () => {
    if (!audio) return;
    audio.analyser.getByteTimeDomainData(audio.data);
    let sum = 0;
    for (const value of audio.data) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / audio.data.length);
    levelEl.style.width = `${Math.min(100, Math.round(rms * 280))}%`;
    eqBars.forEach((bar, index) => {
      const falloff = 1 - Math.abs(index - 7.5) / 10;
      const height = Math.max(30, Math.min(100, 24 + rms * 520 * falloff + Math.random() * 22));
      bar.style.height = `${height}%`;
      bar.style.background =
        height > 70 ? "var(--primary-container)" : "var(--tertiary-fixed)";
    });
    meterFrame = requestAnimationFrame(draw);
  };

  if (context.state === "suspended") context.resume().catch(() => {});
  draw();
}

function stopRecordingClock() {
  clearInterval(tickTimer);
  recBadge.classList.add("hidden");
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countingDown = false;
  countOverlay.classList.add("hidden");
}

function pulseCount(value) {
  countNum.textContent = String(value);
  countNum.style.animation = "none";
  void countNum.offsetWidth;
  countNum.style.animation = "";
}

function startCountdownThenRecord() {
  if (!stream || recorder || countingDown) return;
  if (typeof MediaRecorder === "undefined") {
    setCamError(t(lang, "camUnsupported"));
    return;
  }

  countingDown = true;
  startButton.disabled = true;
  startLabel.textContent = t(lang, "getReadyEllipsis");
  countOverlay.classList.remove("hidden");
  let left = COUNTDOWN_S;
  pulseCount(left);

  countdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      stopCountdown();
      beginRecording();
      return;
    }
    pulseCount(left);
  }, 1000);
}

function beginRecording() {
  if (!stream || recorder) {
    startButton.disabled = false;
    startLabel.textContent = t(lang, "startRecord");
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    setCamError(t(lang, "camUnsupported"));
    return;
  }

  chunks = [];
  recordedBlob = null;
  const mimeType = pickMimeType();
  recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  recordedType = recorder.mimeType || mimeType || "video/webm";

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    stopRecordingClock();
    startButton.disabled = false;
    startLabel.textContent = t(lang, "startRecord");
    recorder = null;
    recordedBlob = new Blob(chunks, { type: recordedType });
    stopStream();
    playback.src = URL.createObjectURL(recordedBlob);
    show("preview");
    playback.play().catch(() => {});
  };

  recorder.start();
  startButton.disabled = true;
  startLabel.textContent = t(lang, "recording");
  recBadge.classList.remove("hidden");

  const started = Date.now();
  const update = () => {
    const left = Math.max(0, Math.ceil((RECORD_MS - (Date.now() - started)) / 1000));
    recBadge.textContent = String(left);
  };
  update();
  tickTimer = setInterval(update, 200);

  window.setTimeout(() => {
    if (recorder && recorder.state === "recording") recorder.stop();
  }, RECORD_MS);
}

async function sendWish() {
  if (!recordedBlob) return;
  sendError.classList.add("hidden");
  const name = guestName.value.trim();
  if (!name) {
    sendError.textContent = t(lang, "needName");
    sendError.classList.remove("hidden");
    guestName.focus();
    return;
  }

  const sendButton = document.querySelector("#send");
  const againButton = document.querySelector("#again");
  sendButton.disabled = true;
  againButton.disabled = true;
  sendLabel.textContent = t(lang, "sending");

  const ext = recordedType.includes("mp4") ? "mp4" : "webm";
  const mime = recordedType.includes("mp4") ? "video/mp4" : "video/webm";
  const file = new File([recordedBlob], `wish.${ext}`, { type: mime });
  const form = new FormData();
  form.append("video", file);
  form.append("name", name);
  form.append("note", guestNote.value.trim());

  try {
    const res = await fetch(`/api/sessions/${sessionId}/wishes`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t(lang, "needName"));
    thanksCopy.textContent = t(lang, "thanksNamed", { name });
    show("thanks");
  } catch (err) {
    sendError.textContent = err.message;
    sendError.classList.remove("hidden");
    sendButton.disabled = false;
    againButton.disabled = false;
    sendLabel.textContent = t(lang, "sendWish");
  }
}

document.querySelector("#do-now").addEventListener("click", () => show(2));
document.querySelector("#copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    copyLinkLabel.textContent = t(lang, "copyLinkDone");
    saved.textContent = t(lang, "saved");
  } catch {
    saved.textContent = t(lang, "savedFallback");
  }
  saved.classList.remove("hidden");
  showToast(t(lang, "toastCopied"));
});
document.querySelector("#ready").addEventListener("click", async () => {
  show(3);
  await openCamera();
});
startButton.addEventListener("click", startCountdownThenRecord);
retryCam.addEventListener("click", () => {
  stopCountdown();
  openCamera();
});
document.querySelector("#again").addEventListener("click", async () => {
  if (playback.src) URL.revokeObjectURL(playback.src);
  playback.removeAttribute("src");
  recordedBlob = null;
  sendLabel.textContent = t(lang, "sendWish");
  stopCountdown();
  show(3);
  await openCamera();
});
document.querySelector("#send").addEventListener("click", sendWish);

guestNote.addEventListener("input", () => {
  charCount.textContent = `${guestNote.value.length}/200`;
});

for (const spark of document.querySelectorAll(".spark")) {
  spark.addEventListener("click", () => {
    const text = spark.dataset.spark || "";
    const current = guestNote.value.trim();
    guestNote.value = current ? `${current} ${text}` : text;
    guestNote.value = guestNote.value.slice(0, 200);
    guestNote.dispatchEvent(new Event("input"));
  });
}

async function boot() {
  if (!/^[a-f0-9]{16}$/.test(sessionId)) {
    show("invalid");
    return;
  }
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      show("invalid");
      return;
    }
    show(1);
  } catch {
    show("invalid");
  }
}

boot();
