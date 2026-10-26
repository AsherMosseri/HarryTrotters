import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

const IN = 0.0254;
const SELECT = new THREE.Color('#6366f1');

// A world-space offset expressed in obj's local space (handles scaled parents,
// e.g. models exported in millimeters).
function toLocalVector(obj, worldVec) {
  obj.updateWorldMatrix(true, false);
  const origin = obj.worldToLocal(new THREE.Vector3());
  return obj.worldToLocal(worldVec.clone()).sub(origin);
}

// One 3D viewport: camera + touch controls, picking, highlighting, exploded
// view, sandbox gizmo, and screen positions for pin markers.
export class RobotScene {
  constructor(container, { background, onSelect, onPinPlace, onTransform } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onPinPlace = onPinPlace;
    this.onTransform = onTransform;
    this.mode = 'view';
    this.model = null;
    this.hidden = new Set();
    this.tints = new Map(); // key -> hex, for compare
    this.selected = null;
    this.explode = 0;
    this.pins = []; // { el, key, point: Vector3 (local to part) }
    this.peer = null; // compare: the other viewport, cameras kept in sync
    this.active = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background || '#f0f1f6');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.005, 200);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 1.5);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-1.5, 1, -1);
    this.scene.add(key, fill);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.addEventListener('start', () => (this.active = true));
    this.orbit.addEventListener('end', () => (this.active = false));

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(1.15);
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (!e.value) this.onTransform?.();
    });
    this.scene.add(this.gizmo.getHelper());

    this.raycaster = new THREE.Raycaster();
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => this.handleTap(e));

    // Draw only while something can be changing: for a moment after a touch,
    // a scroll, or any change made through the methods below. Idle, the
    // viewer draws nothing, which saves battery on iPads and phones.
    this.awakeUntil = 0;
    for (const type of ['pointerdown', 'pointermove', 'wheel']) el.addEventListener(type, () => this.wake(), { passive: true });
    for (const name of [
      'resize',
      'setBackground',
      'setModel',
      'view',
      'setMode',
      'setGizmoMode',
      'paint',
      'setSelected',
      'setTints',
      'setHidden',
      'setExplode',
      'applyTransforms',
      'resetPart',
      'nudge',
      'turn',
      'setPins',
    ]) {
      const fn = this[name].bind(this);
      this[name] = (...args) => (this.wake(), fn(...args));
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  wake(ms = 1500) {
    this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setBackground(color) {
    this.scene.background = new THREE.Color(color);
  }

  setModel(model) {
    if (this.model) this.scene.remove(this.model.root);
    this.gizmo.detach();
    this.model = model;
    this.selected = null;
    if (!model) return;
    this.scene.add(model.root);
    if (this.grid) this.scene.remove(this.grid);
    const span = Math.max(model.size.x, model.size.z, 0.3) * 3;
    this.grid = new THREE.GridHelper(span, 24, 0x9aa1b1, 0xc9cdd6);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.grid.position.set(model.center.x, model.box.min.y, model.center.z);
    this.scene.add(this.grid);
    this.view('iso');
  }

  view(preset) {
    if (!this.model) return;
    const { center, size } = this.model;
    // Back off further in narrow (portrait or side-by-side) viewports.
    const r = ((Math.max(size.x, size.y, size.z) * 1.6 + 0.05) / Math.min(1, this.camera.aspect)) * (1 + this.explode * 0.8);
    const dirs = { iso: [1, 0.75, 1.1], front: [0, 0.15, -1], side: [1, 0.15, 0], top: [0, 1, 0.001] };
    const d = new THREE.Vector3(...(dirs[preset] || dirs.iso)).normalize();
    this.camera.position.copy(center).addScaledVector(d, r);
    this.orbit.target.copy(center);
    this.camera.near = r / 200;
    this.camera.far = r * 50;
    this.camera.updateProjectionMatrix();
    this.orbit.update();
  }

  node(key) {
    return this.model?.nodes.get(key);
  }

  partAt(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.model.root, true).filter((h) => h.object.visible && this.isShown(h.object));
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.partKey) o = o.parent;
    return o ? { key: o.userData.partKey, point: hits[0].point } : null;
  }

  isShown(obj) {
    for (let o = obj; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  handleTap(e) {
    if (!this.model || !this.down || this.gizmo.dragging) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    if (moved > 6 || performance.now() - this.down.t > 600) return;
    const hit = this.partAt(e);
    if (this.mode === 'pin') {
      if (!hit) return;
      const obj = this.node(hit.key).object;
      this.onPinPlace?.({ key: hit.key, point: obj.worldToLocal(hit.point.clone()).toArray() });
    } else {
      this.onSelect?.(hit ? hit.key : null);
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.attachGizmo();
  }

  setGizmoMode(mode) {
    this.gizmo.setMode(mode); // 'translate' | 'rotate'
  }

  attachGizmo() {
    const n = this.selected && this.node(this.selected);
    if (this.mode === 'sandbox' && n) this.gizmo.attach(n.object);
    else this.gizmo.detach();
  }

  // Tints: selection outranks compare colors.
  paint() {
    if (!this.model) return;
    const colorFor = new Map();
    for (const [key, hex] of this.tints) colorFor.set(key, new THREE.Color(hex));
    if (this.selected) colorFor.set(this.selected, SELECT);
    this.model.root.traverse((o) => {
      if (!o.isMesh) return;
      let c = null;
      for (let p = o; p && !c; p = p.parent)
        if (p.userData.partKey && colorFor.has(p.userData.partKey)) c = colorFor.get(p.userData.partKey);
      for (const m of [].concat(o.material)) {
        if (!m.emissive) continue;
        m.emissive.copy(c || new THREE.Color(0x000000));
        m.emissiveIntensity = c ? 0.55 : 0;
      }
    });
  }

  setSelected(key) {
    this.selected = key && this.node(key) ? key : null;
    this.paint();
    this.attachGizmo();
  }

  setTints(map) {
    this.tints = new Map(Object.entries(map || {}));
    this.paint();
  }

  setHidden(keys) {
    this.hidden = new Set(keys);
    if (!this.model) return;
    for (const n of this.model.nodes.values()) n.object.visible = !this.hidden.has(n.key);
  }

  // Exploded view: top-level parts slide away from the robot's center.
  setExplode(f) {
    if (!this.model) return;
    const prev = this.explode;
    this.explode = f;
    const dist = Math.max(this.model.size.x, this.model.size.y, this.model.size.z) * 0.35;
    for (const n of this.model.explodeParts) {
      const dir = n.center.clone().sub(this.model.center);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      dir.normalize().multiplyScalar(dist);
      n.object.position.addScaledVector(toLocalVector(n.object.parent, dir), f - prev);
    }
    // Pull the camera back as the parts spread so they stay in view.
    if (!this.silentExplode && f !== prev) {
      const scale = (1 + 0.8 * f) / (1 + 0.8 * prev);
      this.camera.position.sub(this.orbit.target).multiplyScalar(scale).add(this.orbit.target);
    }
  }

  // Sandbox moves, as offsets from where each part started.
  getTransforms() {
    const out = {};
    if (!this.model) return out;
    const saved = this.explode;
    this.silentExplode = true;
    this.setExplode(0);
    for (const n of this.model.nodes.values()) {
      const o = n.object;
      if (o.position.distanceTo(n.home.p) > 1e-5 || o.quaternion.angleTo(n.home.q) > 1e-4) {
        out[n.key] = { p: o.position.toArray(), q: o.quaternion.toArray() };
      }
    }
    this.setExplode(saved);
    this.silentExplode = false;
    return out;
  }

  applyTransforms(transforms = {}) {
    if (!this.model) return;
    const saved = this.explode;
    this.silentExplode = true;
    this.setExplode(0);
    for (const n of this.model.nodes.values()) {
      const t = transforms[n.key];
      n.object.position.copy(t ? new THREE.Vector3(...t.p) : n.home.p);
      n.object.quaternion.copy(t ? new THREE.Quaternion(...t.q) : n.home.q);
    }
    this.setExplode(saved);
    this.silentExplode = false;
  }

  resetPart(key) {
    const n = this.node(key);
    if (!n) return;
    n.object.position.copy(n.home.p);
    n.object.quaternion.copy(n.home.q);
    this.onTransform?.();
  }

  // Nudge buttons: move 1/2 inch or turn 15 degrees along the robot's axes.
  nudge(axis, sign) {
    const n = this.selected && this.node(this.selected);
    if (!n) return;
    const o = n.object;
    const world = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0).multiplyScalar(sign * 0.5 * IN);
    o.position.add(toLocalVector(o.parent, world));
    this.onTransform?.();
  }

  turn(axis, sign) {
    const n = this.selected && this.node(this.selected);
    if (!n) return;
    const v = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    n.object.rotateOnWorldAxis(v, (sign * Math.PI) / 12);
    this.onTransform?.();
  }

  setPins(pins) {
    this.pins = pins.map((p) => ({ ...p, point: new THREE.Vector3(...p.point) }));
  }

  frame() {
    let moved;
    if (this.peer && this.peer.active && !this.active) {
      this.camera.position.copy(this.peer.camera.position);
      this.camera.quaternion.copy(this.peer.camera.quaternion);
      this.orbit.target.copy(this.peer.orbit.target);
      moved = true;
    } else moved = this.orbit.update();
    const now = performance.now();
    if (!moved && !this.active && now > this.awakeUntil && !(this.peer && now <= this.peer.awakeUntil)) return;
    this.renderer.render(this.scene, this.camera);

    // Pin markers are HTML elements laid over the canvas.
    if (this.pins.length && this.model) {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const v = new THREE.Vector3();
      for (const p of this.pins) {
        if (!p.el) continue;
        const n = this.node(p.key);
        if (!n || !this.isShown(n.object)) {
          p.el.style.display = 'none';
          continue;
        }
        v.copy(p.point);
        n.object.localToWorld(v);
        v.project(this.camera);
        if (v.z > 1) {
          p.el.style.display = 'none';
          continue;
        }
        p.el.style.display = '';
        p.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.gizmo.detach();
    this.gizmo.dispose();
    this.orbit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
