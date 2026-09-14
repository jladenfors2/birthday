import * as THREE from "/vendor/three.module.js";

const GOLD = 0xd4af37;
const CREAM = 0xfff3e0;

function fibonacciSphere(count, radius) {
  const points = [];
  if (count === 1) {
    return [new THREE.Vector3(0.72, 0.28, 0.63).normalize().multiplyScalar(radius)];
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = Math.max(count, 1);
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return points;
}

function badgeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffdfa";
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#d4af37";
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "#e5c158";
  ctx.beginPath();
  ctx.arc(256, 256, 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#2b2421";
  ctx.font = "600 120px 'Playfair Display', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("K 50", 256, 230);
  ctx.fillStyle = "#d4af37";
  ctx.font = "600 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("GOLDEN JUBILEE", 256, 318);
  return new THREE.CanvasTexture(canvas);
}

const PIN_W = 384;
const PIN_H = 480;

function drawPinCanvas(frame, name) {
  const canvas = document.createElement("canvas");
  canvas.width = PIN_W;
  canvas.height = PIN_H;
  const ctx = canvas.getContext("2d");
  const r = 36;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, PIN_W, PIN_H, r);
  ctx.clip();
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(0, 0, PIN_W, PIN_H);
  if (frame) {
    const fw = frame.videoWidth || frame.width || PIN_W;
    const fh = frame.videoHeight || frame.height || PIN_H;
    const scale = Math.max(PIN_W / fw, PIN_H / fh);
    const dw = fw * scale;
    const dh = fh * scale;
    ctx.drawImage(frame, (PIN_W - dw) / 2, (PIN_H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#d4af37";
    ctx.font = "700 96px 'Playfair Display', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name || "?").slice(0, 1).toUpperCase(), PIN_W / 2, PIN_H * 0.42);
  }
  const fade = ctx.createLinearGradient(0, PIN_H * 0.52, 0, PIN_H);
  fade.addColorStop(0, "rgba(26,20,16,0)");
  fade.addColorStop(0.45, "rgba(26,20,16,0.55)");
  fade.addColorStop(1, "rgba(26,20,16,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, PIN_H * 0.5, PIN_W, PIN_H * 0.5);
  ctx.fillStyle = "#fffdf8";
  ctx.font = "700 42px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 12;
  const label = (name || "Vän").trim() || "Vän";
  wrapCentered(ctx, label, PIN_W / 2, PIN_H - 38, PIN_W - 40, 46);
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#d4af37";
  ctx.beginPath();
  ctx.roundRect(5, 5, PIN_W - 10, PIN_H - 10, r - 4);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapCentered(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 2);
  const startY = y - (shown.length - 1) * lineHeight;
  shown.forEach((row, i) => ctx.fillText(row, x, startY + i * lineHeight));
}

function captureFrame(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const done = (frame) => {
      video.removeAttribute("src");
      video.load();
      resolve(frame);
    };
    const timer = window.setTimeout(() => done(null), 8000);
    video.addEventListener("error", () => {
      window.clearTimeout(timer);
      done(null);
    });
    const grab = () => {
      window.clearTimeout(timer);
      done(video);
    };
    video.addEventListener("seeked", grab, { once: true });
    video.addEventListener("loadeddata", () => {
      const t = Math.min(0.35, (video.duration || 1) * 0.12);
      if (Math.abs(video.currentTime - t) < 0.05) grab();
      else video.currentTime = t;
    });
  });
}

export function createGlobe(container, { hoverEl, onSelect } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(0, 18, 360);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xfff3e0, 1.15));
  const key = new THREE.DirectionalLight(0xfff0c2, 1.6);
  key.position.set(180, 220, 240);
  scene.add(key);
  const gold = new THREE.PointLight(GOLD, 2.2, 700);
  scene.add(gold);

  const globe = new THREE.Group();
  scene.add(globe);

  const ringMat = new THREE.MeshBasicMaterial({
    color: GOLD,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.28,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(168, 170, 96), ringMat);
  ring.rotation.x = Math.PI / 2;
  globe.add(ring);
  const ring2 = ring.clone();
  ring2.rotation.y = Math.PI / 3;
  globe.add(ring2);

  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(36, 28, 28),
      new THREE.MeshBasicMaterial({ color: CREAM, wireframe: true, transparent: true, opacity: 0.16 }),
    ),
  );
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(150, 48, 48),
      new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.07 }),
    ),
  );

  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(78, 78),
    new THREE.MeshBasicMaterial({ map: badgeTexture(), transparent: true, side: THREE.DoubleSide, depthTest: false }),
  );
  badge.renderOrder = 2;
  globe.add(badge);

  const starCount = 280;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 190 + Math.random() * 110;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  globe.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: GOLD, size: 2.4, transparent: true, opacity: 0.7 })));

  const pins = new THREE.Group();
  globe.add(pins);
  const worldPos = new THREE.Vector3();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let wishes = [];
  let spinning = true;
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let hoverId = null;
  let raf = 0;
  let wishGen = 0;

  function size() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function setWishes(next) {
    const gen = ++wishGen;
    wishes = next || [];
    pins.clear();
    const points = fibonacciSphere(wishes.length, 148);
    wishes.forEach((wish, index) => {
      const group = new THREE.Group();
      group.position.copy(points[index]);
      group.userData.depthScale = true;

      const thumb = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 35),
        new THREE.MeshBasicMaterial({
          map: drawPinCanvas(null, wish.name),
          transparent: true,
          side: THREE.DoubleSide,
        }),
      );
      thumb.userData.wish = wish;
      thumb.userData.billboard = true;
      group.add(thumb);
      pins.add(group);

      captureFrame(wish.url).then((frame) => {
        if (gen !== wishGen) return;
        const map = drawPinCanvas(frame, wish.name);
        const old = thumb.material.map;
        thumb.material.map = map;
        thumb.material.needsUpdate = true;
        old?.dispose();
      });
    });
  }

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pins.children, true);
    return hits[0]?.object?.userData?.wish || null;
  }

  function showHover(wish) {
    if (!hoverEl) return;
    if (!wish) {
      hoverEl.classList.add("hidden");
      hoverId = null;
      return;
    }
    if (hoverId === wish.id) return;
    hoverId = wish.id;
    hoverEl.classList.remove("hidden");
    hoverEl.querySelector("[data-name]").textContent = wish.name || "Friend";
    hoverEl.querySelector("[data-note]").textContent = wish.note || "A 10-second birthday wish";
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (dragging) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      globe.rotation.y += dx * 0.005;
      globe.rotation.x = Math.max(-0.7, Math.min(0.7, globe.rotation.x + dy * 0.004));
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }
    showHover(pick(event));
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    dragging = false;
    if (!moved) {
      const wish = pick(event);
      if (wish && onSelect) onSelect(wish);
    }
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    dragging = false;
    showHover(null);
  });
  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      camera.position.z = Math.max(220, Math.min(520, camera.position.z + event.deltaY * 0.18));
    },
    { passive: false },
  );

  function tick() {
    raf = requestAnimationFrame(tick);
    if (spinning && !dragging) globe.rotation.y += 0.0022;
    badge.lookAt(camera.position);
    pins.traverse((obj) => {
      if (obj.userData.billboard) obj.lookAt(camera.position);
      if (obj.userData.depthScale) {
        obj.getWorldPosition(worldPos);
        const dist = worldPos.distanceTo(camera.position);
        const t = THREE.MathUtils.clamp((dist - 210) / 320, 0, 1);
        const s = THREE.MathUtils.lerp(1.45, 0.38, t);
        obj.scale.setScalar(s);
      }
    });
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(size);
  observer.observe(container);
  size();
  tick();

  return {
    setWishes,
    setSpinning(value) {
      spinning = Boolean(value);
    },
    isSpinning() {
      return spinning;
    },
    reset() {
      globe.rotation.set(0, 0, 0);
      camera.position.set(0, 18, 360);
    },
    zoom(delta) {
      camera.position.z = Math.max(220, Math.min(520, camera.position.z + delta));
    },
    resize: size,
  };
}
