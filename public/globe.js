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

function cardTexture(wish) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(canvas.width - r, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
  ctx.lineTo(canvas.width, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
  ctx.lineTo(r, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "rgba(255,250,242,0.96)");
  grad.addColorStop(1, "rgba(250,238,222,0.92)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#d4af37";
  ctx.stroke();
  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.arc(64, 72, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#554300";
  ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((wish.name || "?").slice(0, 1).toUpperCase(), 64, 74);
  ctx.textAlign = "left";
  ctx.fillStyle = "#211a17";
  ctx.font = "600 32px 'Playfair Display', serif";
  ctx.fillText((wish.name || "Friend").slice(0, 22), 110, 64);
  ctx.fillStyle = "#4d4635";
  ctx.font = "400 22px 'Plus Jakarta Sans', sans-serif";
  const note = (wish.note || "A 10-second birthday wish").slice(0, 70);
  wrapText(ctx, note, 40, 150, 430, 32);
  ctx.fillStyle = "#735c00";
  ctx.font = "700 18px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("TAP TO PLAY  ·  0:10", 40, 280);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let row = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      line = word;
      row += 1;
      if (row >= 3) return;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
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

  function size() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function setWishes(next) {
    wishes = next || [];
    pins.clear();
    const points = fibonacciSphere(wishes.length, 148);
    wishes.forEach((wish, index) => {
      const group = new THREE.Group();
      group.position.copy(points[index]);
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(6.4, 18, 18),
        new THREE.MeshStandardMaterial({
          color: GOLD,
          emissive: GOLD,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.55,
        }),
      );
      pin.userData.wish = wish;
      group.add(pin);

      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(68, 42),
        new THREE.MeshBasicMaterial({ map: cardTexture(wish), transparent: true }),
      );
      card.position.set(26, 16, 0);
      card.userData.wish = wish;
      card.userData.billboard = true;
      group.add(card);
      pins.add(group);
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
