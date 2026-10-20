import * as THREE from 'three';

// A simple, named FTC-style robot used by the demo and tests. Units are meters,
// like a glTF export from Onshape. Version 2 raises the intake and adds a claw.
const IN = 0.0254;

function mat(color, metal = 0.2) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.55 });
}

function box(name, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * IN, h * IN, d * IN), mat(color));
  m.name = name;
  m.position.set(x * IN, y * IN, z * IN);
  return m;
}

function cyl(name, r, len, color, x, y, z, axis = 'x') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * IN, r * IN, len * IN, 28), mat(color, 0.1));
  m.name = name;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x * IN, y * IN, z * IN);
  return m;
}

function group(name, children, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x * IN, y * IN, z * IN);
  children.forEach((c) => g.add(c));
  return g;
}

export function buildSampleRobot(version = 1) {
  const alu = 0xb8bec7;
  const dark = 0x2d3340;
  const yellow = 0xf2c230;
  const green = 0x2f9e5b;

  const drivetrain = group('Drivetrain', [
    box('Left Rail', 1.5, 1.5, 16, alu, -7.5, 2, 0),
    box('Right Rail', 1.5, 1.5, 16, alu, 7.5, 2, 0),
    box('Front Crossbar', 15, 1.5, 1.5, alu, 0, 2, -7.5),
    box('Rear Crossbar', 15, 1.5, 1.5, alu, 0, 2, 7.5),
    cyl('Wheel FL', 2, 1.5, dark, -9, 2, -5.5),
    cyl('Wheel FR', 2, 1.5, dark, 9, 2, -5.5),
    cyl('Wheel BL', 2, 1.5, dark, -9, 2, 5.5),
    cyl('Wheel BR', 2, 1.5, dark, 9, 2, 5.5),
    cyl('Drive Motor FL', 1, 4, yellow, -4.5, 2, -5.5),
    cyl('Drive Motor FR', 1, 4, yellow, 4.5, 2, -5.5),
  ]);

  const electronics = group('Electronics', [
    box('Control Hub', 4.5, 1, 4, 0x1f6fd1, -3, 3.5, 3),
    box('Battery', 6, 2, 3, 0x222222, 3.5, 3.8, 3),
  ]);

  const intakeY = version >= 2 ? 4.5 : 2.5;
  const intake = group(
    'Intake',
    [
      box('Intake Side Plate L', 0.3, 4, 5, alu, -6, 0, 0),
      box('Intake Side Plate R', 0.3, 4, 5, alu, 6, 0, 0),
      cyl('Intake Roller', 1.1, 11.5, green, 0, -0.5, -1.5),
      cyl('Intake Motor', 1, 3, yellow, 7.5, 0.5, 0.5),
    ],
    0,
    intakeY,
    -10,
  );

  const lift = group('Lift', [
    box('Lift Stage 1', 1.5, 14, 1.5, alu, -5, 0, 0),
    box('Lift Stage 1 R', 1.5, 14, 1.5, alu, 5, 0, 0),
    box('Lift Stage 2', 1.2, 12, 1.2, 0x9aa3ad, -5, 4, 1.4),
    box('Lift Stage 2 R', 1.2, 12, 1.2, 0x9aa3ad, 5, 4, 1.4),
    cyl('Lift Motor', 1, 4, yellow, 0, -5, 1),
  ]);
  lift.position.set(0, 10 * IN, 5 * IN);

  const parts = [drivetrain, electronics, intake, lift];
  if (version >= 2) {
    parts.push(
      group(
        'Claw',
        [
          box('Claw Base', 6, 1, 2, dark, 0, 0, 0),
          box('Claw Finger L', 0.6, 3, 1.2, 0xe2552d, -2.2, -2, 0),
          box('Claw Finger R', 0.6, 3, 1.2, 0xe2552d, 2.2, -2, 0),
        ],
        0,
        17,
        7,
      ),
    );
  }
  return group(version >= 2 ? 'Robot v2' : 'Robot v1', parts);
}
