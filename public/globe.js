import * as THREE from "/vendor/three.module.js";

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
  if (frame && (frame.videoWidth || frame.width)) {
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

function snapshotVideo(video) {
  const fw = video.videoWidth;
  const fh = video.videoHeight;
  if (!fw || !fh) return null;
  const canvas = document.createElement("canvas");
  canvas.width = fw;
  canvas.height = fh;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas;
}

function captureFrame(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const finish = (frame) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(frame);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    video.addEventListener("error", () => {
      window.clearTimeout(timer);
      finish(null);
    });
    const grab = () => {
      window.clearTimeout(timer);
      finish(snapshotVideo(video));
    };
    video
      .play()
      .then(() => {
        video.pause();
        if (video.videoWidth) grab();
        else {
          video.addEventListener("loadeddata", grab, { once: true });
        }
      })
      .catch(() => {
        video.addEventListener("loadeddata", grab, { once: true });
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

  scene.background = new THREE.Color(0x02040a);
  scene.add(new THREE.AmbientLight(0x1a2744, 0.55));
  const sun = new THREE.DirectionalLight(0x88a0c8, 0.35);
  sun.position.set(-220, 80, 180);
  scene.add(sun);

  const globe = new THREE.Group();
  scene.add(globe);

  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x070b14,
    emissive: 0xffffff,
    emissiveIntensity: 1.55,
    roughness: 1,
    metalness: 0,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(128, 64, 64), earthMat);
  globe.add(earth);
  new THREE.TextureLoader().load("/earth-night.jpg", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    earthMat.map = tex;
    earthMat.emissiveMap = tex;
    earthMat.needsUpdate = true;
  });

  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(136, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3d6bff,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    ),
  );
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(130, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x6ea8ff,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      }),
    ),
  );

  const starCount = 1400;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 520 + Math.random() * 380;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    const tint = 0.75 + Math.random() * 0.25;
    starCol[i * 3] = tint;
    starCol[i * 3 + 1] = tint;
    starCol[i * 3 + 2] = 0.9 + Math.random() * 0.1;
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  stars.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  scene.add(
    new THREE.Points(
      stars,
      new THREE.PointsMaterial({ vertexColors: true, size: 1.8, transparent: true, opacity: 0.9, depthWrite: false }),
    ),
  );

  const pins = new THREE.Group();
  globe.add(pins);
  const worldPos = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldRight = new THREE.Vector3(1, 0, 0);

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
    const points = fibonacciSphere(wishes.length, 168);
    wishes.forEach((wish, index) => {
      const group = new THREE.Group();
      group.position.copy(points[index]);
      group.userData.depthScale = true;
      group.renderOrder = 10;

      const thumb = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 35),
        new THREE.MeshBasicMaterial({
          map: drawPinCanvas(null, wish.name),
          transparent: true,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      thumb.userData.wish = wish;
      thumb.userData.billboard = true;
      thumb.renderOrder = 10;
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
      globe.rotateOnWorldAxis(worldUp, dx * 0.006);
      globe.rotateOnWorldAxis(worldRight, dy * 0.006);
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
    if (spinning && !dragging) globe.rotateOnWorldAxis(worldUp, 0.0022);
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
      globe.quaternion.identity();
      camera.position.set(0, 18, 360);
    },
    zoom(delta) {
      camera.position.z = Math.max(220, Math.min(520, camera.position.z + delta));
    },
    resize: size,
  };
}
