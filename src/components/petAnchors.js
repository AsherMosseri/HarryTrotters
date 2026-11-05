// Where things sit on each pet, for overlays (caps, goggles, a headset, a
// crown, a bandana, a medal, a halo). All numbers are in PetArt's 64x64
// viewBox, for the 'young' stage drawn at scale 1 (the figure before the stage
// transforms in PetArt). head: the head's center and radius; eyes: the eye
// line's y and the distance between the two eyes (centered on x 32); neck: the
// middle of the scarf band, and how wide it is. up (optional): how far hats and
// the halo sit higher than the head's top, for pets with something on top (a comb).
// under (optional): neck gear is drawn under the head instead of over the whole
// pet, for pets with something hanging over the neck (a long nose, a wattle).
// body: the torso, for an outfit (the jersey): the ellipse it fills (x, y, rx,
// ry, in the body's own coordinates), `top`, how far down the head (or what
// hangs from it) covers it, and `hem`, where the outfit ends above the feet.
export const PET_ANCHORS = {
  cat: { head: { x: 32, y: 28.6, r: 16 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 14.6, ry: 11, top: 43, hem: 53.4 } },
  dog: { head: { x: 32, y: 28.6, r: 15.8 }, eyes: { x: 32, y: 27.2, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 14.8, ry: 11, top: 43, hem: 53.4 } },
  bunny: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 28.6, gap: 16 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47.4, rx: 14.4, ry: 11, top: 43, hem: 53.6 } },
  fox: { head: { x: 32, y: 28.5, r: 16 }, eyes: { x: 32, y: 28.4, gap: 15.6 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 14, ry: 11, top: 43.4, hem: 53.4 } },
  owl: { head: { x: 32, y: 28.2, r: 16.5 }, eyes: { x: 32, y: 29.2, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 42.4, rx: 15.4, ry: 15.4, top: 42.8, hem: 52.6 } },
  frog: { head: { x: 32, y: 30.4, r: 16 }, eyes: { x: 32, y: 20.8, gap: 19.2 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 16.2, ry: 10.8, top: 43.2, hem: 53.2 } },
  panda: { head: { x: 32, y: 28.6, r: 16.2 }, eyes: { x: 32, y: 28.6, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 15.6, ry: 11.4, top: 43.1, hem: 53.6 } },
  // The long nose hangs down over the neck: a bandana goes under it.
  monkey: { head: { x: 32, y: 27.6, r: 15.3 }, eyes: { x: 32, y: 27.8, gap: 14 }, neck: { x: 32, y: 44.5, w: 26 }, under: true, body: { x: 32, y: 47, rx: 14.8, ry: 11.2, top: 45.6, hem: 53.6 } },
  redpanda: { head: { x: 32, y: 28.6, r: 16 }, eyes: { x: 32, y: 28.4, gap: 15.2 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47, rx: 14.8, ry: 11, top: 43, hem: 53.4 } },
  // Spines crown the head to about y 12.6, so hats ride 2 up (see `up` below).
  hedgehog: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 29.4, gap: 15.6 }, neck: { x: 32, y: 44.5, w: 26 }, up: 2, body: { x: 32, y: 47.4, rx: 13.6, ry: 10.6, top: 43.4, hem: 53.6 } },
  // The comb rises to y 7 above the head, so hats and the halo ride 5 up and cover it.
  chicken: { head: { x: 32, y: 29, r: 16 }, eyes: { x: 32, y: 28.2, gap: 14.8 }, neck: { x: 32, y: 44.5, w: 26 }, up: 5, under: true, body: { x: 32, y: 46, rx: 15.4, ry: 10.8, top: 43.4, hem: 53 } },
  // The head sits high on a long neck: the blue ball; the casque rises to y 5.6 above it, the wattle hangs to y 43.
  // Neck gear sits at the base of the neck, below the wattle (it hangs to y 43).
  cassowary: { head: { x: 32, y: 22.6, r: 12.4 }, eyes: { x: 32, y: 22.8, gap: 12 }, neck: { x: 32, y: 47.4, w: 20 }, body: { x: 32, y: 47, rx: 17.2, ry: 11.8, top: 44.8, hem: 53.8 } },
  // A pear-cut gem on its side, point to the right: the face sits on the table,
  // a little left of center (the round end); the top of the stone is the head's top.
  // The neck is low (a bib under the mouth), since the stone is all one piece.
  gem: { head: { x: 30, y: 34, r: 14.6 }, eyes: { x: 30, y: 34, gap: 13 }, neck: { x: 31, y: 47.5, w: 24 }, body: { x: 31, y: 48.6, rx: 15.6, ry: 11, top: 43.4, hem: 56, gem: true } },
  // Horns rise from the top of the head (hats ride 1.5 up and the horns show at
  // the sides); the beard hangs over the neck, so neck gear goes under it.
  goat: { head: { x: 32, y: 28.4, r: 15.4 }, eyes: { x: 32, y: 27.4, gap: 14.4 }, neck: { x: 32, y: 44.5, w: 26 }, up: 1.5, under: true, body: { x: 32, y: 47, rx: 14.8, ry: 10.6, top: 45.6, hem: 53.4 } },
  // The buck teeth hang down over the neck: neck gear goes under them.
  molerat: { head: { x: 32, y: 29.6, r: 15.8 }, eyes: { x: 32, y: 26.4, gap: 12.8 }, neck: { x: 32, y: 44.5, w: 26 }, under: true, body: { x: 32, y: 47.4, rx: 16.2, ry: 10.6, top: 44.4, hem: 53.8 } },
  starmole: { head: { x: 32, y: 29, r: 15.8 }, eyes: { x: 32, y: 26.6, gap: 13.6 }, neck: { x: 32, y: 44.5, w: 26 }, body: { x: 32, y: 47.4, rx: 15.2, ry: 10.8, top: 43.2, hem: 53.8 } },
  // The topknot puffs up to about y 11, so hats ride 1.5 up.
  goldendoodle: { head: { x: 32, y: 28.6, r: 16.4 }, eyes: { x: 32, y: 27, gap: 14.8 }, neck: { x: 32, y: 44.5, w: 26 }, up: 1.5, body: { x: 32, y: 47, rx: 15, ry: 11.2, top: 43, hem: 53.4 } },
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

// Where an outfit goes, in the body's own coordinates (PetGear draws it with
// the same stage transforms PetArt gives the body): the torso ellipse, and
// `top` moved for the stage's head scale (a baby's big head covers more).
export function bodyAnchor(species, stage = 'young') {
  const a = PET_ANCHORS[species] || PET_ANCHORS.cat;
  const { head: hk, body: kb } = petStage(species, stage);
  const b = a.body;
  // The head's bottom moves with the head scale (about y 41), then back into body coordinates (about y 58).
  const top = 58 + (41 + (b.top - 41) * hk - 58) / kb;
  return { ...b, top: Math.min(top, b.hem - 6) };
}
