// Line icons for the app's frame (sidebar, page headers). One stroke weight,
// drawn on a 20px grid, colored by the text around them.
const PATHS = {
  today: (
    <>
      <path d="M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
      <path d="M8 17v-4.5h4V17" />
    </>
  ),
  tasks: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="m6.8 10.2 2.2 2.2 4.3-4.6" />
    </>
  ),
  chat: <path d="M4 4.5h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.5 2.5V14H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />,
  shifts: (
    <>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 7v3.7l2.4 1.5M8 2.5h4" />
    </>
  ),
  milestones: (
    <>
      <path d="M5 17.5V3" />
      <path d="M5 3.5h9.5l-2 3.25 2 3.25H5" />
    </>
  ),
  parts: (
    <>
      <path d="m10 2.8 6.5 3.4v7.6L10 17.2l-6.5-3.4V6.2z" />
      <path d="M3.5 6.2 10 9.6l6.5-3.4M10 9.6v7.6" />
    </>
  ),
  checklists: (
    <>
      <path d="m3.5 5.5 1.5 1.5 2.5-2.5M3.5 12.5 5 14l2.5-2.5" />
      <path d="M10 6h6.5M10 13h6.5" />
    </>
  ),
  runs: (
    <>
      <path d="M6.5 3h7v4.5a3.5 3.5 0 0 1-7 0z" />
      <path d="M6.5 4.5H4a2 2 0 0 0 2.5 3M13.5 4.5H16a2 2 0 0 1-2.5 3M10 11v3M7 17h6M8 14h4v3H8z" />
    </>
  ),
  robot: (
    <>
      <rect x="4" y="6.5" width="12" height="9" rx="2" />
      <path d="M10 6.5V3.5M8 3.5h4M7.5 11h.01M12.5 11h.01M2.5 10v3M17.5 10v3" />
    </>
  ),
  resources: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5z" />
      <path d="M4 16.5A1.5 1.5 0 0 0 5.5 18H16v-3" />
    </>
  ),
  team: (
    <>
      <circle cx="7.5" cy="7" r="2.8" />
      <path d="M2.5 16.5a5 5 0 0 1 10 0" />
      <path d="M13 4.6a2.8 2.8 0 0 1 0 4.8M14.5 11.8a5 5 0 0 1 3 4.7" />
    </>
  ),
  // The market: a shopping bag; its shelves: a paw (pets), a ticket (perks),
  // a sparkle (chat extras) and a controller (game entries).
  market: (
    <>
      <path d="M4.5 6.5h11l-.8 10a1 1 0 0 1-1 .9H6.3a1 1 0 0 1-1-.9z" />
      <path d="M7.5 8.5V6a2.5 2.5 0 0 1 5 0v2.5" />
    </>
  ),
  paw: (
    <>
      <path d="M10 10.5c-2.4 0-4.5 2.4-4.5 4.4 0 1.3 1 1.9 2.2 1.9.9 0 1.5-.5 2.3-.5s1.4.5 2.3.5c1.2 0 2.2-.6 2.2-1.9 0-2-2.1-4.4-4.5-4.4z" />
      <ellipse cx="4.6" cy="8.6" rx="1.4" ry="1.8" />
      <ellipse cx="8" cy="5.2" rx="1.4" ry="1.9" />
      <ellipse cx="12" cy="5.2" rx="1.4" ry="1.9" />
      <ellipse cx="15.4" cy="8.6" rx="1.4" ry="1.8" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 6.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a1.5 1.5 0 0 0 0 3v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1.5 1.5 0 0 0 0-3z" />
      <path d="M12 5.5v9" strokeDasharray="1.5 1.8" />
    </>
  ),
  sparkle: (
    <>
      <path d="M9 3.5 10.4 8 15 9.5l-4.6 1.4L9 15.5l-1.4-4.6L3 9.5 7.6 8z" />
      <path d="M15.5 3v3M14 4.5h3M15 14.5v2.5M13.75 15.75h2.5" />
    </>
  ),
  game: (
    <>
      <path d="M6.5 6.5h7a4 4 0 0 1 3.9 4.8l-.6 3a1.8 1.8 0 0 1-3.2.7L12 13.5H8l-1.6 1.5a1.8 1.8 0 0 1-3.2-.7l-.6-3A4 4 0 0 1 6.5 6.5z" />
      <path d="M6.5 9v2.5M5.25 10.25h2.5M12.5 10h.01M14.5 11h.01" />
    </>
  ),
  hash: <path d="M8 3 6.5 17M13.5 3 12 17M4 7.5h13M3 12.5h13" />,
  announce: (
    <>
      <path d="M3.5 8v4h3l6 3.5v-11l-6 3.5z" />
      <path d="M15.5 7.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  more: (
    <>
      <circle cx="5" cy="10" r="0.6" />
      <circle cx="10" cy="10" r="0.6" />
      <circle cx="15" cy="10" r="0.6" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3.5" width="4" height="13" rx="1" />
      <rect x="8.5" y="3.5" width="4" height="9" rx="1" />
      <rect x="14" y="3.5" width="3" height="6" rx="1" />
    </>
  ),
  table: <path d="M3 4.5h14M3 8.5h14M3 12.5h14M3 16.5h14" />,
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="m12.2 12.2 4.3 4.3" />
    </>
  ),
  filter: <path d="M3 5h14M5.5 10h9M8.5 15h3" />,
  flag: (
    <>
      <path d="M5 17.5V3" />
      <path d="M5 3.5h10v6.5H5" />
      <path d="M8.3 3.5v6.5M11.7 3.5v6.5M5 6.75h10" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  camera: (
    <>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h2l1.3-2h4.4l1.3 2h2A1.5 1.5 0 0 1 17 7v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15z" />
      <circle cx="10" cy="10.8" r="3" />
    </>
  ),
  poll: <path d="M4 16.5V11M8 16.5V5M12 16.5V8.5M16 16.5V3.5M2.5 16.5h15" />,
  clip: <path d="m15.5 9.5-5.8 5.8a3.6 3.6 0 0 1-5.1-5.1l6.4-6.4a2.4 2.4 0 0 1 3.4 3.4l-6.3 6.3a1.2 1.2 0 0 1-1.7-1.7l5.6-5.6" />,
  sticker: (
    <>
      <path d="M16.5 10.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h5.5z" />
      <path d="M16.5 10.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5" />
    </>
  ),
  smile: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7 11.8a3.6 3.6 0 0 0 6 0M7.6 8h.01M12.4 8h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.3 1.5H3.7z" />
      <path d="M8.3 17.3a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  bellOff: (
    <>
      <path d="M5 13.5V9a5 5 0 0 1 8.4-3.7M15 9v4.5l1.3 1.5H6" />
      <path d="M8.3 17.3a1.9 1.9 0 0 0 3.4 0M3 3l14 14" />
    </>
  ),
  pin: (
    <>
      <path d="M7 3.5h6M8 3.5v5L5.5 11.5h9L12 8.5v-5M10 11.5v5.5" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M8 4.8A8.6 8.6 0 0 1 10 4.5c5.2 0 8.2 5.5 8.2 5.5a14 14 0 0 1-2.2 2.9M5.4 6.1A14 14 0 0 0 1.8 10s3 5.5 8.2 5.5a8.4 8.4 0 0 0 3.6-.8" />
      <path d="M3 3l14 14" />
    </>
  ),
  at: (
    <>
      <circle cx="10" cy="10" r="3" />
      <path d="M13 7v4a2 2 0 0 0 4 0v-1a7 7 0 1 0-2.8 5.6" />
    </>
  ),
  reply: <path d="M8 5 3.5 9.5 8 14M3.5 9.5H12a4.5 4.5 0 0 1 4.5 4.5v1.5" />,
  edit: <path d="M12.8 3.7a1.8 1.8 0 0 1 2.5 2.5L6.8 14.7 3.5 15.5l.8-3.3z" />,
  trash: (
    <>
      <path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5 5.5l.8 11h8.4l.8-11" />
      <path d="M8.3 8.5v5M11.7 8.5v5" />
    </>
  ),
  smilePlus: (
    <>
      <path d="M16.6 9.2A6.8 6.8 0 1 1 10.8 3.2" />
      <path d="M7 11.8a3.6 3.6 0 0 0 6 0M7.6 8h.01M12.4 8h.01M15.5 1.8v4.4M13.3 4h4.4" />
    </>
  ),
  smileOff: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.6 8h.01M12.4 8h.01M4.5 4.5l11 11" />
    </>
  ),
  chevron: <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />,
  // Select (several messages): a checked circle.
  select: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10.2 2.1 2.1 4-4.3" />
    </>
  ),
  // Super reaction: a burst (not an emoji, so it doesn't read as one).
  superReact: (
    <>
      <path d="M9 3.5c.6 3.2 1.8 4.4 5 5-3.2.6-4.4 1.8-5 5-.6-3.2-1.8-4.4-5-5 3.2-.6 4.4-1.8 5-5z" />
      <path d="M15.5 12.5v4M13.5 14.5h4M15.5 2.5v2M14.5 3.5h2" />
    </>
  ),
  // Subteam badges on profiles.
  shield: <path d="M10 2.8 16 5v4.6c0 3.6-2.5 6.3-6 7.6-3.5-1.3-6-4-6-7.6V5z" />,
  ruler: (
    <>
      <path d="m3 13.5 10.5-10.5 3.5 3.5L6.5 17z" />
      <path d="m6.5 10 1.5 1.5M9 7.5l1.5 1.5M11.5 5l1.5 1.5" />
    </>
  ),
  wrench: <path d="M12.5 3.2a4 4 0 0 0-4.8 5.2L3.3 12.8a1.6 1.6 0 0 0 2.3 2.3L10 10.7a4 4 0 0 0 5.2-4.8l-2.4 2.4-2.1-.6-.6-2.1z" />,
  nut: (
    <>
      <path d="M10 2.5 16.5 6.2v7.6L10 17.5l-6.5-3.7V6.2z" />
      <circle cx="10" cy="10" r="2.6" />
    </>
  ),
  bolt: <path d="M11 2.5 4.5 11h5l-1 6.5L15.5 9h-5z" />,
  code: <path d="M7 6 3 10l4 4M13 6l4 4-4 4M11.2 4.5 8.8 15.5" />,
  tag: (
    <>
      <path d="M3 3.5h6.5l7.5 7.5-6 6-7.5-7.5z" />
      <circle cx="6.8" cy="7.2" r="1" />
    </>
  ),
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  // No internet: a cloud with a line through it.
  cloudOff: (
    <>
      <path d="M7.4 5.2a4.6 4.6 0 0 1 8 2.9 3.3 3.3 0 0 1 1.4 5.6M13.8 15.5H6.6a3.9 3.9 0 0 1-.9-7.7" />
      <path d="m3 3 14 14" />
    </>
  ),
  chevronDown: <path d="m5 7.5 5 5 5-5" />,
  chevronUp: <path d="m5 12.5 5-5 5 5" />,
  // Opens somewhere else (a link to another site).
  external: <path d="M8.5 4.5h-4v11h11v-4M11.5 3.5h5v5M16.5 3.5l-7 7" />,
  // Resource link kinds.
  doc: (
    <>
      <path d="M5 2.8h6.5L15.5 7v10.2H5z" />
      <path d="M11.5 2.8V7h4M7.8 10.5h4.8M7.8 13.5h4.8" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m8.5 7.6 4 2.4-4 2.4z" />
    </>
  ),
  link: <path d="M8.6 11.4a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-1 1M11.4 8.6a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l1-1" />,
  // Emoji picker tabs.
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.2V10l2.6 1.6" />
    </>
  ),
  person: (
    <>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
    </>
  ),
  leaf: (
    <>
      <path d="M4.5 15.5C4 8.5 8.5 4.5 16 4.2c.3 7.5-3.8 11.6-11.5 11.3z" />
      <path d="M4.5 15.5c2.8-4 5.4-6.3 8.5-7.8" />
    </>
  ),
  food: <path d="M6 3v4.5a2 2 0 0 0 4 0V3M8 3v14M14.5 17V3C12.8 4 12 6 12 8.5s.8 2.5 2.5 2.5" />,
  car: (
    <>
      <path d="M3.5 13.5v-3l1.7-3.8a1.5 1.5 0 0 1 1.4-.9h6.8a1.5 1.5 0 0 1 1.4.9l1.7 3.8v3a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM3.5 10.5h13" />
      <path d="M6 14.5v1.5M14 14.5v1.5M6.5 12.3h.01M13.5 12.3h.01" />
    </>
  ),
  ball: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M5.2 5c2.4 2.6 2.4 7.4 0 10M14.8 5c-2.4 2.6-2.4 7.4 0 10" />
    </>
  ),
  bulb: <path d="M7.8 14.5h4.4M8.3 17h3.4M10 3a5 5 0 0 0-3 9c.6.5.8 1.2.8 2.5h4.4c0-1.3.2-2 .8-2.5A5 5 0 0 0 10 3z" />,
  heart: <path d="M10 16.5s-6.5-3.8-6.5-8.4A3.4 3.4 0 0 1 10 6.3a3.4 3.4 0 0 1 6.5 1.8c0 4.6-6.5 8.4-6.5 8.4z" />,
  copy: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
    </>
  ),
  // Electrical diagram parts.
  battery: (
    <>
      <rect x="2.5" y="6" width="13.5" height="8" rx="1.5" />
      <path d="M16 8.5h1.5v3H16M5.5 10h3M7 8.5v3M11 10h2.5" />
    </>
  ),
  power: <path d="M10 3v7M6.2 5.6a6 6 0 1 0 7.6 0" />,
  gear: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
      <circle cx="10" cy="10" r="5.3" />
    </>
  ),
  servo: (
    <>
      <rect x="3" y="7" width="10" height="9" rx="1.5" />
      <circle cx="8" cy="7" r="2" />
      <path d="M8 7 16.5 3.5" />
    </>
  ),
  signal: <path d="M10 15.5h.01M7.2 12.6a4 4 0 0 1 5.6 0M4.6 10a7.6 7.6 0 0 1 10.8 0M2.2 7.4a11 11 0 0 1 15.6 0" />,
  touch: <path d="M8 9.5V4a1.5 1.5 0 0 1 3 0v5M11 8.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V13a5 5 0 0 1-5 5H11a5 5 0 0 1-4.3-2.4L4.4 11.7a1.4 1.4 0 0 1 2.3-1.6L8 11.5" />,
  sliders: <path d="M4 3v14M10 3v14M16 3v14M2.5 13h3M8.5 7h3M14.5 11h3" />,
  wheel: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v4.5M10 12.5V17M3 10h4.5M12.5 10H17" />
    </>
  ),
  chip: (
    <>
      <rect x="4.5" y="4.5" width="11" height="11" rx="1.5" />
      <path d="M7.5 2v2.5M12.5 2v2.5M7.5 15.5V18M12.5 15.5V18M2 7.5h2.5M2 12.5h2.5M15.5 7.5H18M15.5 12.5H18" />
    </>
  ),
  sidebar: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
    </>
  ),
  // The pit screen's number pad.
  backspace: (
    <>
      <path d="M7 4.5h9a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H7L2.5 10z" />
      <path d="m9.5 8 4 4M13.5 8l-4 4" />
    </>
  ),
  // Competition mode: a trophy.
  trophy: (
    <>
      <path d="M6 3.5h8v4a4 4 0 0 1-8 0z" />
      <path d="M6 5H3.5v1A2.5 2.5 0 0 0 6 8.5M14 5h2.5v1A2.5 2.5 0 0 1 14 8.5M10 11.5V14M7 16.5h6M8 14h4v2.5H8z" />
    </>
  ),
  // Lab log: how a task went, and voice notes.
  progress: <path d="M3 14.5 8 9.5l3 3 6-6.5M12.5 6H17v4.5" />,
  stuck: (
    <>
      <path d="M7 2.8h6l4.2 4.2v6L13 17.2H7L2.8 13V7z" />
      <path d="M10 6.5v4.2M10 13.4v.1" />
    </>
  ),
  play: <path d="M6.5 4.2v11.6l9.3-5.8z" />,
  pause: <path d="M7 4.5v11M13 4.5v11" />,
  mic: (
    <>
      <rect x="7.5" y="2.5" width="5" height="9.5" rx="2.5" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    </>
  ),
  repeat: <path d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H16m-2.5-2.5L16 5l-2.5 2.5M16 11v1.5a2.5 2.5 0 0 1-2.5 2.5H4m2.5 2.5L4 15l2.5-2.5" />,
  // Team life: lab bingo, the weekly recap, score guesses, streaks.
  grid: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 7.7h14M3 12.3h14M7.7 3v14M12.3 3v14" />
    </>
  ),
  news: (
    <>
      <path d="M4.5 4h9a1 1 0 0 1 1 1v10.5a1.5 1.5 0 0 0 1.5-1.5V7.5h-1.5" />
      <path d="M4.5 4v11a1.5 1.5 0 0 0 1.5 1.5h10M7 7.5h5M7 10.5h5M7 13.5h3" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.8" />
      <path d="M10 9.6v.8" />
    </>
  ),
  flame: (
    <path d="M10 17.5c-3 0-5-2.1-5-4.8 0-3.2 2.6-4.4 3.3-8.2 2.5 1.6 3.4 3.6 3.2 5.6.8-.4 1.4-1.2 1.6-2.2 1.4 1.3 1.9 3 1.9 4.6 0 2.9-2 5-5 5z" />
  ),
  // Learn (educational games)
  learn: (
    <>
      <path d="M10 4 2.5 7.8 10 11.6l7.5-3.8z" />
      <path d="M5.5 9.4v3.8c1.2 1.2 2.7 1.8 4.5 1.8s3.3-.6 4.5-1.8V9.4M17.5 7.8v4.4" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="15" r="1.8" />
      <circle cx="15" cy="5" r="1.8" />
      <path d="M6.8 15H12a2.5 2.5 0 0 0 0-5H8a2.5 2.5 0 0 1 0-5h5.2" />
    </>
  ),
  coin: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M12.3 7.6c-.4-.7-1.2-1.1-2.3-1.1-1.4 0-2.3.7-2.3 1.7 0 2.4 4.8 1.2 4.8 3.7 0 1-1 1.8-2.5 1.8-1.1 0-2-.5-2.4-1.2M10 5v1.5M10 13.7v1.3" />
    </>
  ),
  cross: <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />,
  order: <path d="M4 5.5h8M4 10h6M4 14.5h4M15 4v12m0 0-2.5-2.5M15 16l2.5-2.5" />,
  // Game controls (Tetris, Minesweeper, Battleship).
  rotateCw: <path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M14.5 2.8v3.6h-3.6" />,
  rotateCcw: <path d="M4.5 10a5.5 5.5 0 1 0 1.6-3.9M5.5 2.8v3.6h3.6" />,
  left: <path d="M12.5 4.5 7 10l5.5 5.5" />,
  right: <path d="M7.5 4.5 13 10l-5.5 5.5" />,
  down: <path d="M4.5 7.5 10 13l5.5-5.5" />,
  drop: <path d="M10 3v10m-4-4 4 4 4-4M4.5 16.5h11" />,
  swap: <path d="M6 3.5 3.5 6 6 8.5M3.5 6H14a2.5 2.5 0 0 1 2.5 2.5M14 16.5l2.5-2.5-2.5-2.5m2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5" />,
  blocks: (
    <>
      <rect x="3" y="9.5" width="4.5" height="4.5" rx="0.6" />
      <rect x="7.5" y="9.5" width="4.5" height="4.5" rx="0.6" />
      <rect x="12" y="9.5" width="4.5" height="4.5" rx="0.6" />
      <rect x="7.5" y="5" width="4.5" height="4.5" rx="0.6" />
    </>
  ),
  mine: (
    <>
      <circle cx="10" cy="10.5" r="4.5" />
      <path d="M10 3v2.5M10 15.5V18M3 10.5h2.5M14.5 10.5H17M5 5.5l1.8 1.8M13.2 13.7l1.8 1.8M15 5.5l-1.8 1.8M6.8 13.7 5 15.5" />
    </>
  ),
  // Scout: binoculars; ban: "don't pick"; grip: the drag handle on the pick list.
  scout: (
    <>
      <circle cx="5.6" cy="13.4" r="3.1" />
      <circle cx="14.4" cy="13.4" r="3.1" />
      <path d="M4.2 10.8 6 4.5h2l.6 4.5M15.8 10.8 14 4.5h-2l-.6 4.5M8.7 12.6h2.6" />
    </>
  ),
  ban: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="m5.2 14.8 9.6-9.6" />
    </>
  ),
  grip: <path d="M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01" strokeWidth="2.6" />,
  // Four arrows: the hand tool (drag to move the view).
  move: <path d="M10 3v14M3 10h14M10 3 7.8 5.2M10 3l2.2 2.2M10 17l-2.2-2.2M10 17l2.2-2.2M3 10l2.2-2.2M3 10l2.2 2.2M17 10l-2.2-2.2M17 10l-2.2 2.2" />,
  shuffle: <path d="M3 6h2.6c3.4 0 5.4 8 8.8 8H17m-2-2 2 2-2 2M3 14h2.6c1.2 0 2.2-1 3-2.3M11.5 7.6c.8-.9 1.7-1.6 2.9-1.6H17m-2-2 2 2-2 2" />,
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] || null}
    </svg>
  );
}
