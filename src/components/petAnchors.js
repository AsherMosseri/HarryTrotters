// Where things sit on each pet, for overlays (caps, goggles, a headset, a
// crown, a bandana, a medal, a halo). All numbers are in PetArt's 64x64
// viewBox, for the 'young' stage drawn at scale 1 (the figure before the stage
// transforms in PetArt). head: the head's center and radius; eyes: the eye
// line's y and the distance between the two eyes (centered on x 32); neck: the
// middle of the scarf band, and how wide it is. up (optional): how far hats and
// the halo sit higher than the head's top, for pets with something on top (a comb).
export const PET_ANCHORS = {
  cat: { head: { x: 32, y: 28.6, r: 16 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  dog: { head: { x: 32, y: 28.6, r: 15.8 }, eyes: { x: 32, y: 27.2, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  bunny: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 28.6, gap: 16 }, neck: { x: 32, y: 44.5, w: 26 } },
  fox: { head: { x: 32, y: 28.5, r: 16 }, eyes: { x: 32, y: 28.4, gap: 15.6 }, neck: { x: 32, y: 44.5, w: 26 } },
  owl: { head: { x: 32, y: 28.2, r: 16.5 }, eyes: { x: 32, y: 29.2, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 } },
  frog: { head: { x: 32, y: 30.4, r: 16 }, eyes: { x: 32, y: 20.8, gap: 19.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  panda: { head: { x: 32, y: 28.6, r: 16.2 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  monkey: { head: { x: 32, y: 27.6, r: 15.3 }, eyes: { x: 32, y: 27.8, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 } },
  redpanda: { head: { x: 32, y: 28.6, r: 16 }, eyes: { x: 32, y: 28.4, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 } },
  // Spines crown the head to about y 12.6, so hats ride 2 up (see `up` below).
  hedgehog: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 29.4, gap: 15.6 }, neck: { x: 32, y: 44.5, w: 26 }, up: 2 },
  // The comb rises to y 7 above the head, so hats and the halo ride 5 up and cover it.
  chicken: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 28.2, gap: 14.8 }, neck: { x: 32, y: 44.5, w: 26 }, up: 5 },
  // The head sits high on a long neck: the blue ball; the casque rises to y 5.6 above it, the wattle hangs to y 43.
  cassowary: { head: { x: 32, y: 22.6, r: 12.4 }, eyes: { x: 32, y: 22.8, gap: 12 }, neck: { x: 32, y: 41, w: 17 } },
  // A pear-cut gem on its side, point to the right: the face sits on the table,
  // a little left of center (the round end); the top of the stone is the head's top.
  // The neck is low (a bib under the mouth), since the stone is all one piece.
  gem: { head: { x: 30, y: 34, r: 14.6 }, eyes: { x: 30, y: 34, gap: 13 }, neck: { x: 31, y: 47.5, w: 24 } },
};

// How PetArt places the figure per stage. `s` scales the whole figure about
// the ground point (32, 60); `head` scales the head (and so the eyes and any
// head gear) about the neck point (32, 41) before that.
export const PET_STAGE = {
  baby: { s: 0.86, head: 1.2, body: 0.86 },
  young: { s: 0.94, head: 1, body: 1 },
  grown: { s: 1, head: 1, body: 1.03 },
};
// A gem is all one piece (no head on a body), so it just grows as a whole:
// a small rough crystal, then a cut stone, then a full-size polished one.
const GEM_STAGE = {
  baby: { s: 0.86, head: 1, body: 1 },
  young: { s: 0.94, head: 1, body: 1 },
  grown: { s: 1, head: 1, body: 1 },
};
export const petStage = (species, stage) => {
  const t = species === 'gem' ? GEM_STAGE : PET_STAGE;
  return t[stage] || t.young;
};

// The anchors in the final svg coordinates for a stage. The scarf (grown) is
// not scaled by the head, so its neck point only gets the overall scale.
export function stageAnchors(species, stage = 'young') {
  const a = PET_ANCHORS[species] || PET_ANCHORS.cat;
  const { s, head: hk } = petStage(species, stage);
  const X = (x) => 32 + (x - 32) * s;
  const Y = (y) => 60 + (y - 60) * s;
  const H = (y) => 41 + (y - 41) * hk; // head scale about the neck point
  return {
    head: { x: X(a.head.x), y: Y(H(a.head.y)), r: a.head.r * hk * s, up: (a.up || 0) * hk * s },
    eyes: { x: X(a.eyes.x), y: Y(H(a.eyes.y)), gap: a.eyes.gap * hk * s },
    neck: { x: X(a.neck.x), y: Y(a.neck.y), w: a.neck.w * s },
  };
}
