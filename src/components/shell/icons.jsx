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
  sidebar: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
    </>
  ),
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
