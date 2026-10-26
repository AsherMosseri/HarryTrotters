// The Resources tab. Team links (the robot's CAD, the code repo, ...) live in
// Firestore so private links stay out of this public repo; these are the
// public FTC links everyone gets, grouped into sections.

// Kinds for team links: icon + label.
export const LINK_KINDS = [
  ['cad', '📐', 'CAD'],
  ['code', '💻', 'Code'],
  ['electrical', '⚡', 'Electrical'],
  ['doc', '📄', 'Doc'],
  ['video', '🎬', 'Video'],
  ['other', '🔗', 'Link'],
];
export const kindOf = (id) => LINK_KINDS.find(([k]) => k === id) || LINK_KINDS[LINK_KINDS.length - 1];

// A link's kind from its address, so pasting a URL picks a sensible icon.
export function guessKind(url = '') {
  const u = url.toLowerCase();
  if (/onshape\.com|cad\.|fusion|autodesk|solidworks|\.step$|\.stl$/.test(u)) return 'cad';
  if (/github\.com|gitlab|bitbucket|replit/.test(u)) return 'code';
  if (/youtube\.com|youtu\.be|vimeo/.test(u)) return 'video';
  if (/docs\.google|drive\.google|notion|\.pdf$/.test(u)) return 'doc';
  return 'other';
}

export const BUILTIN_RESOURCES = [
  {
    title: 'This season: BIOBUZZ (2026–27)',
    links: [
      [
        'Competition Manual',
        'https://ftc-resources.firstinspires.org/ftc/game/manual',
        'The rules for BIOBUZZ. Check the version: FIRST posts updates.',
      ],
      [
        'Game & season page',
        'https://www.firstinspires.org/programs/ftc/game-and-season',
        'Game animation, field drawings, and season documents.',
      ],
      ['FTC Events', 'https://ftc-events.firstinspires.org', 'Event schedules, match results, and rankings.'],
    ],
  },
  {
    title: 'Programming',
    links: [
      ['FTC Docs', 'https://ftc-docs.firstinspires.org', 'Official docs: setup, the SDK, configuring hubs, vision.'],
      [
        'FTC SDK (FtcRobotController)',
        'https://github.com/FIRST-Tech-Challenge/FtcRobotController',
        'The official robot code project to build on.',
      ],
      ['Learn Java for FTC', 'https://github.com/alan412/LearnJavaForFTC', 'A free book that teaches Java with FTC robots.'],
      ['Pedro Pathing', 'https://pedropathing.com', 'Autonomous path following, with a path visualizer.'],
      ['Road Runner', 'https://rr.brott.dev', 'Motion planning library for autonomous.'],
      ['FTC Dashboard', 'https://acmerobotics.github.io/ftc-dashboard/', 'Live telemetry, graphs, and tuning variables from a laptop.'],
    ],
  },
  {
    title: 'Electrical',
    links: [
      [
        'Control Hub ports',
        'https://ftc-docs.firstinspires.org/control_hard_compon/rc_components/hub/ports/ch-ports.html',
        'What each port on the Control Hub is for.',
      ],
      [
        'Expansion Hub ports',
        'https://ftc-docs.firstinspires.org/control_hard_compon/rc_components/hub/ports/exh-ports.html',
        'Same for the Expansion Hub.',
      ],
      [
        'Using two hubs',
        'https://ftc-docs.firstinspires.org/hardware_and_software_configuration/configuring/configuring_dual_hubs/configuring-dual-hubs.html',
        'Power and RS485 between hubs, and setting hub addresses.',
      ],
    ],
  },
  {
    title: 'Building & CAD',
    links: [
      ['Game Manual 0', 'https://gm0.org', 'The community guide: drivetrains, intakes, design, and software.'],
      ['Onshape Learning Center', 'https://learn.onshape.com', 'Free Onshape courses, from basics to assemblies.'],
      ['goBILDA', 'https://www.gobilda.com', 'Parts, with CAD files for each one.'],
      ['REV Robotics', 'https://www.revrobotics.com', 'Hubs, motors, servos, and sensors, with docs.'],
    ],
  },
  {
    title: 'Scouting',
    links: [['FTCScout', 'https://ftcscout.org', 'Team stats and match history, handy for alliance selection.']],
  },
];
