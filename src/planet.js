import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { latLonToPoint, pointToLatLon } from './coordinates.js';

const colors = { wonder: '#b5f5c5', hope: '#ffb6a3', curiosity: '#a5caff' };
const radius = 1.45;

export class MercuryScene {
  markers = new Map();
  mode = 'surface';
  picking = false;
  active = true;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0.3, 0.6, 5.4);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x111313, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive Mercury globe');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.active = false;
      callbacks.onError('The graphics connection was interrupted. Reload to return to orbit.');
    });

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.rotateSpeed = 0.55;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.38;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI - 0.12;
    this.controls.addEventListener('start', () => {
      gsap.killTweensOf(this.camera.position);
      this.flight?.kill();
      this.setPlaying(false);
    });
    this.controls.addEventListener('change', () => {
      callbacks.onCoordinates(pointToLatLon(this.camera.position));
      this.updateLabels();
    });

    this.ambient = new THREE.AmbientLight(0xd5e0e4, 0.42);
    this.sun = new THREE.DirectionalLight(0xfff6e6, 3.6);
    this.sun.position.set(-3.8, 2.8, 4.5);
    this.fill = new THREE.DirectionalLight(0xacc9dd, 0.25);
    this.fill.position.set(3, -1, -2);
    this.scene.add(this.ambient, this.sun, this.fill);

    this.surfaceMaterial = new THREE.MeshStandardMaterial({ color: 0xcfcfc9, roughness: 0.94, metalness: 0.02 });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 144, 96), this.surfaceMaterial);
    this.scene.add(this.planet);
    this.grid = this.makeGrid();
    this.grid.visible = false;
    this.scene.add(this.grid);
    this.addStars();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerStart = null;
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!this.pointerStart || this.pointerStart.id !== event.pointerId || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 7) return;
      const rect = canvas.getBoundingClientRect();
      this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObject(this.planet)[0];
      if (hit) {
        const coordinates = pointToLatLon(hit.point);
        this.setPlaying(false);
        this.setSelection(coordinates);
        callbacks.onPick(coordinates);
      }
    });
    canvas.addEventListener('pointercancel', () => { this.pointerStart = null; });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => { this.active = entry.isIntersecting; });
    this.intersectionObserver.observe(container);
    this.previousTime = performance.now();
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
    this.loadTexture();
  }

  async loadTexture() {
    try {
      const texture = await new THREE.TextureLoader().loadAsync('/assets/mercury.jpg');
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.surfaceMaterial.map = texture;
      this.surfaceMaterial.bumpMap = texture;
      this.surfaceMaterial.bumpScale = 0.028;
      this.surfaceMaterial.needsUpdate = true;
      const reliefCanvas = document.createElement('canvas');
      reliefCanvas.width = 128;
      reliefCanvas.height = 64;
      const reliefContext = reliefCanvas.getContext('2d');
      reliefContext.imageSmoothingQuality = 'high';
      reliefContext.drawImage(texture.image, 0, 0, 128, 64);
      const reliefMap = new THREE.CanvasTexture(reliefCanvas);
      reliefMap.colorSpace = THREE.SRGBColorSpace;
      this.contourMaterial = new THREE.ShaderMaterial({
        uniforms: { surfaceMap: { value: reliefMap } },
        vertexShader: `varying vec2 vUv; varying vec3 vNormal;
          void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform sampler2D surfaceMap; varying vec2 vUv; varying vec3 vNormal;
          void main() {
            vec3 surface = texture2D(surfaceMap, vUv).rgb;
            float height = dot(surface, vec3(0.299, 0.587, 0.114));
            float band = height * 35.0;
            float line = 1.0 - smoothstep(0.018, 0.018 + clamp(fwidth(band), 0.008, 0.06), abs(fract(band) - 0.5));
            float light = 0.16 + 0.84 * max(0.0, dot(normalize(vNormal), normalize(vec3(-0.6, 0.8, 1.0))));
            vec3 base = vec3(0.008, 0.023, 0.014) + height * vec3(0.06, 0.13, 0.075);
            gl_FragColor = vec4((base + line * vec3(0.15, 0.40, 0.24)) * light, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      this.callbacks.onReady();
    } catch {
      this.callbacks.onError('Surface imagery could not load. Check your connection and reload.');
    }
  }

  makeGrid() {
    const points = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) {
        points.push(...Object.values(latLonToPoint(lat, lon, radius + 0.005)), ...Object.values(latLonToPoint(lat, lon + 3, radius + 0.005)));
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += 3) {
        points.push(...Object.values(latLonToPoint(lat, lon, radius + 0.005)), ...Object.values(latLonToPoint(lat + 3, lon, radius + 0.005)));
      }
    }
    return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color: 0xb5f5c5, transparent: true, opacity: 0.13 }));
  }

  addStars() {
    const points = [];
    let seed = 918;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 550; i++) {
      const point = latLonToPoint(Math.asin(random() * 2 - 1) * 180 / Math.PI, random() * 360 - 180, 35);
      points.push(point.x, point.y, point.z);
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: 0xcad5d2, size: 0.027, transparent: true, opacity: 0.55, sizeAttenuation: true }));
    this.scene.add(this.stars);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const distance = radius / (Math.tan(THREE.MathUtils.degToRad(19)) * Math.min(1, width / height)) * 1.25;
    this.camera.position.multiplyScalar(distance / (this.defaultDistance || this.camera.position.length()));
    this.defaultDistance = distance;
    this.controls.minDistance = distance * 0.72;
    this.controls.maxDistance = distance * 1.5;
    this.updateLabels();
  }

  setPlaying(playing) {
    this.controls.autoRotate = playing;
    this.callbacks.onPlaying(playing);
  }

  setMode(mode) {
    if (mode === 'contours' && !this.contourMaterial) return false;
    this.mode = mode;
    this.planet.material = mode === 'contours' ? this.contourMaterial : this.surfaceMaterial;
    this.grid.visible = mode !== 'surface';
    const duration = this.reducedMotion ? 0 : 1.5;
    gsap.to(this.sun.position, { x: mode === 'nightfall' ? -6 : -3.8, z: mode === 'nightfall' ? -1 : 4.5, duration });
    gsap.to(this.ambient, { intensity: mode === 'nightfall' ? 0.22 : 0.42, duration });
    return true;
  }

  zoom(direction) {
    this.setPlaying(false);
    const distance = THREE.MathUtils.clamp(this.camera.position.length() * (direction > 0 ? 0.85 : 1.18), this.defaultDistance * 0.72, this.defaultDistance * 1.5);
    const destination = this.camera.position.clone().normalize().multiplyScalar(distance);
    gsap.to(this.camera.position, { ...destination, duration: this.reducedMotion ? 0 : 0.5, onUpdate: () => this.controls.update() });
  }

  reset() {
    this.focus({ latitude: 7, longitude: 87 }, false);
  }

  focus({ latitude, longitude }, closer = true) {
    this.setPlaying(false);
    this.flight?.kill();
    const start = this.camera.position.clone().normalize();
    const end = new THREE.Vector3(...Object.values(latLonToPoint(latitude, longitude))).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(start, end);
    const state = { progress: 0 };
    const distance = this.camera.position.length();
    const targetDistance = this.defaultDistance * (closer ? 0.89 : 1);
    // Interpolate on the sphere so a long flight never passes through Mercury.
    this.flight = gsap.to(state, {
      progress: 1, duration: this.reducedMotion ? 0 : 1.7, ease: 'power2.inOut',
      onUpdate: () => {
        const step = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), rotation, state.progress);
        this.camera.position.copy(start).applyQuaternion(step).multiplyScalar(THREE.MathUtils.lerp(distance, targetDistance, state.progress));
        this.controls.update();
      },
    });
  }

  setSignals(signals) {
    const ids = new Set(signals.map((signal) => signal.id));
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) {
        this.scene.remove(marker.mesh);
        marker.mesh.geometry.dispose();
        marker.mesh.material.dispose();
        marker.element.remove();
        this.markers.delete(id);
      }
    }
    for (const signal of signals) {
      if (this.markers.has(signal.id)) continue;
      const position = new THREE.Vector3(...Object.values(latLonToPoint(signal.latitude, signal.longitude, radius + 0.022)));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: colors[signal.mood] }));
      mesh.position.copy(position);
      this.scene.add(mesh);
      const element = document.createElement('button');
      element.className = `planet-pin ${signal.mood}`;
      element.setAttribute('aria-label', `Read signal from ${signal.name}`);
      element.title = `Signal from ${signal.name}`;
      element.innerHTML = '<span></span>';
      element.addEventListener('pointerdown', (event) => event.stopPropagation());
      element.addEventListener('click', () => this.callbacks.onSignal(signal));
      this.container.append(element);
      this.markers.set(signal.id, { mesh, element, position });
    }
    this.updateLabels();
  }

  updateLabels() {
    if (!this.renderer) return;
    this.camera.updateMatrixWorld();
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    for (const { element, position } of this.markers.values()) {
      const projected = position.clone().project(this.camera);
      const visible = position.dot(this.camera.position.clone().sub(position)) > 0.03 && Math.abs(projected.x) < 0.96 && Math.abs(projected.y) < 0.96 && !this.picking;
      element.hidden = !visible;
      element.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width - 18}px, ${(-projected.y * 0.5 + 0.5) * height - 18}px)`;
    }
  }

  setSelection(coordinates) {
    if (!this.selection) {
      this.selection = new THREE.Mesh(new THREE.RingGeometry(0.025, 0.031, 40), new THREE.MeshBasicMaterial({ color: 0xb5f5c5, side: THREE.DoubleSide, depthTest: true }));
      this.scene.add(this.selection);
    }
    const point = new THREE.Vector3(...Object.values(latLonToPoint(coordinates.latitude, coordinates.longitude, radius + 0.018)));
    this.selection.position.copy(point);
    this.selection.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), point.clone().normalize());
    this.selection.visible = true;
  }

  clearSelection() {
    if (this.selection) this.selection.visible = false;
  }

  pulse(signal) {
    if (this.reducedMotion) {
      this.setSelection(signal);
      setTimeout(() => this.clearSelection(), 2000);
      return;
    }
    const point = new THREE.Vector3(...Object.values(latLonToPoint(signal.latitude, signal.longitude, radius + 0.026)));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.042, 64), new THREE.MeshBasicMaterial({ color: colors[signal.mood], side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false }));
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), point.clone().normalize());
    this.scene.add(ring);
    gsap.to(ring.scale, { x: 9, y: 9, z: 9, duration: 2.5, ease: 'power1.out' });
    gsap.to(ring.material, { opacity: 0, duration: 2.5, onComplete: () => { this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); } });
  }

  capture() {
    this.renderer.render(this.scene, this.camera);
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111313';
    ctx.fillRect(0, 0, 1600, 1200);
    const source = this.renderer.domElement;
    const ratio = Math.min(1450 / source.width, 980 / source.height);
    const width = source.width * ratio;
    const height = source.height * ratio;
    ctx.drawImage(source, (1600 - width) / 2, (1140 - height) / 2, width, height);
    ctx.fillStyle = '#b5f5c5';
    ctx.font = '24px monospace';
    ctx.fillText('MERCURYZZ / OBSERVATORY', 70, 80);
    ctx.fillStyle = '#f2f4ef';
    ctx.font = '72px sans-serif';
    ctx.fillText('Mercury', 70, 1090);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#a3aba6';
    ctx.fillText(`${this.mode.toUpperCase()} / ${new Date().toISOString().slice(0, 10)}`, 70, 1140);
    ctx.textAlign = 'right';
    ctx.fillText('mercuryzz.com', 1530, 1100);
    ctx.font = '14px monospace';
    ctx.fillText('Surface: Solar System Scope / CC BY 4.0', 1530, 1140);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  animate(time) {
    this.frame = requestAnimationFrame(this.animate);
    const delta = Math.min((time - this.previousTime) / 1000, 0.1);
    this.previousTime = time;
    if (!this.active || document.hidden) return;
    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
  }
}
