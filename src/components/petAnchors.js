// Where things sit on each pet, for overlays (caps, goggles, a headset, a
// crown, a bandana, a medal, a halo). All numbers are in PetArt's 64x64
// viewBox, for the 'young' stage drawn at scale 1 (the figure before the stage
// transforms in PetArt). head: the head's center and radius; eyes: the eye
// line's y and the distance between the two eyes (centered on x 32); neck: the
// middle of the scarf band, and how wide it is.
export const PET_ANCHORS = {
  cat: { head: { x: 32, y: 28.6, r: 16 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  dog: { head: { x: 32, y: 28.6, r: 15.8 }, eyes: { x: 32, y: 27.2, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  bunny: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 28.6, gap: 16 }, neck: { x: 32, y: 44.5, w: 26 } },
  fox: { head: { x: 32, y: 28.5, r: 16 }, eyes: { x: 32, y: 28.4, gap: 15.6 }, neck: { x: 32, y: 44.5, w: 26 } },
  owl: { head: { x: 32, y: 28.2, r: 16.5 }, eyes: { x: 32, y: 29.2, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 } },
  frog: { head: { x: 32, y: 30.4, r: 16 }, eyes: { x: 32, y: 20.8, gap: 19.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  panda: { head: { x: 32, y: 28.6, r: 16.2 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  monkey: { head: { x: 32, y: 27.6, r: 15.3 }, eyes: { x: 32, y: 27.8, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 } },
  // The head sits high on a long neck: the blue ball; the casque rises to y 5.6 above it, the wattle hangs to y 43.
  cassowary: { head: { x: 32, y: 22.6, r: 12.4 }, eyes: { x: 32, y: 22.8, gap: 12 }, neck: { x: 32, y: 41, w: 17 } },
};

// How PetArt places the figure per stage. `s` scales the whole figure about
// the ground point (32, 60); `head` scales the head (and so the eyes and any
// head gear) about the neck point (32, 41) before that.
export const PET_STAGE = {
  baby: { s: 0.86, head: 1.2, body: 0.86 },
  young: { s: 0.94, head: 1, body: 1 },
  grown: { s: 1, head: 1, body: 1.03 },
};

// The anchors in the final svg coordinates for a stage. The scarf (grown) is
// not scaled by the head, so its neck point only gets the overall scale.
export function stageAnchors(species, stage = 'young') {
  const a = PET_ANCHORS[species] || PET_ANCHORS.cat;
  const { s, head: hk } = PET_STAGE[stage] || PET_STAGE.young;
  const X = (x) => 32 + (x - 32) * s;
  const Y = (y) => 60 + (y - 60) * s;
  const H = (y) => 41 + (y - 41) * hk; // head scale about the neck point
  return {
    head: { x: X(a.head.x), y: Y(H(a.head.y)), r: a.head.r * hk * s },
    eyes: { x: X(a.eyes.x), y: Y(H(a.eyes.y)), gap: a.eyes.gap * hk * s },
    neck: { x: X(a.neck.x), y: Y(a.neck.y), w: a.neck.w * s },
  };
}
