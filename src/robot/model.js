import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSampleRobot } from './sampleRobot.js';

// Loads a robot model and turns it into a parts tree the UI can use.
// Sources: { sample: 1 | 2 } (built-in demo robot), { url } or { buffer }.
export async function loadModel(source) {
  if (source.sample) return analyzeModel(buildSampleRobot(source.sample));
  let buffer = source.buffer;
  if (!buffer) {
    let res;
    try {
      res = await fetch(source.url);
    } catch {
      // Firebase Storage blocks downloads from other sites until CORS is set up.
      const err = new Error('download-blocked');
      err.code = 'download-blocked';
      throw err;
    }
    if (!res.ok) throw new Error(`Couldn't download the model (error ${res.status}).`);
    buffer = await res.arrayBuffer();
  }
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  return analyzeModel(gltf.scene);
}

// The glTF loader swaps spaces for underscores in object names but keeps the
// original in userData.name.
const rawName = (obj) => obj.userData?.name || obj.name || '';

// Onshape names instances like "Intake Roller <1>"; show them without the counter.
export const displayName = (name) => name.replace(/\s*<\d+>\s*$/, '') || 'Part';

// Cached: big CAD exports have thousands of nodes.
const meshCache = new WeakMap();
function hasMesh(obj) {
  if (!meshCache.has(obj)) meshCache.set(obj, obj.isMesh || obj.children.some(hasMesh));
  return meshCache.get(obj);
}

export function analyzeModel(scene) {
  const root = new THREE.Group();
  root.name = '__model';
  root.add(scene);

  // Assume Onshape's meters; a model tens of meters across was exported in millimeters.
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (Math.max(size.x, size.y, size.z) > 20) {
    scene.scale.multiplyScalar(0.001);
    box = new THREE.Box3().setFromObject(root);
  }

  // Skip the wrapper levels at the top (scene → "Robot assembly") so the
  // list starts at the robot's real subassemblies.
  let top = scene;
  while (top.children.filter(hasMesh).length === 1 && !top.isMesh) top = top.children.find(hasMesh);

  const nodes = new Map(); // key -> node
  const order = [];
  let triangles = 0;

  const add = (obj, parentKey, depth, siblingNames) => {
    const base = rawName(obj) || (obj.isMesh ? 'Part' : 'Group');
    const n = (siblingNames.get(base) || 0) + 1;
    siblingNames.set(base, n);
    const name = n > 1 ? `${base}#${n}` : base;
    const key = parentKey ? `${parentKey}/${name}` : name;
    const node = { key, name: displayName(base), object: obj, depth, parent: parentKey, children: [] };
    nodes.set(key, node);
    order.push(node);
    obj.userData.partKey = key;
    if (parentKey) nodes.get(parentKey).children.push(key);
    walk(obj, key, depth + 1);
  };

  const walk = (obj, parentKey, depth) => {
    const siblingNames = new Map();
    for (const child of obj.children) {
      if (!hasMesh(child)) continue;
      // A mesh that just repeats its parent's name adds nothing to the list.
      const parent = parentKey && nodes.get(parentKey);
      if (child.isMesh && parent && obj.children.length === 1 && displayName(rawName(child)) === parent.name) {
        child.userData.partKey = parentKey;
        walk(child, parentKey, depth);
        continue;
      }
      if (!rawName(child) && !child.isMesh && child.children.length) {
        walk(child, parentKey, depth); // unnamed wrapper: flatten
        continue;
      }
      add(child, parentKey, depth, siblingNames);
    }
  };
  walk(top, '', 0);

  root.traverse((o) => {
    if (!o.isMesh) return;
    // Own material per mesh so highlighting one part never tints another.
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });

  // Remember where everything started, for Reset, explode, and layouts.
  for (const node of nodes.values()) {
    node.home = { p: node.object.position.clone(), q: node.object.quaternion.clone() };
  }

  root.updateMatrixWorld(true);
  const center = box.getCenter(new THREE.Vector3());
  for (const node of nodes.values()) {
    const b = new THREE.Box3().setFromObject(node.object);
    node.center = b.isEmpty() ? center.clone() : b.getCenter(new THREE.Vector3());
  }
  const explodeParts = order.filter((n) => n.depth === 0);

  return { root, nodes, order, explodeParts, box, size: box.getSize(new THREE.Vector3()), center, triangles: Math.round(triangles) };
}

// Parts are matched between versions by their place in the tree and name.
export function diffModels(a, b, tolerance = 0.003) {
  const leaves = (m) => [...m.nodes.values()].filter((n) => !n.children.length);
  const inA = new Map(leaves(a).map((n) => [n.key, n]));
  const inB = new Map(leaves(b).map((n) => [n.key, n]));
  const added = [];
  const removed = [];
  const moved = [];
  for (const [key, n] of inB) {
    if (!inA.has(key)) added.push(n.key);
    else if (inA.get(key).center.distanceTo(n.center) > tolerance) moved.push(n.key);
  }
  for (const key of inA.keys()) if (!inB.has(key)) removed.push(key);
  return { added, removed, moved };
}
