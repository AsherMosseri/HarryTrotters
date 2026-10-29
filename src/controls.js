import { createContext, useContext } from 'react';
import { COMMANDS } from './commands.js';

// Asher's switches (settings/controls): tabs, channels, and features that are
// off for everyone but him. Off means hidden everywhere in the app, old posts
// included; nothing is deleted, so turning one back on brings it all back.
// The Firestore rules and the play function refuse what they can while it's
// off (see featureOff in firestore.rules), using the same ids.
export const FEATURE_GROUPS = [
  [
    'chat',
    'Chat',
    [
      ['gifs', 'GIFs', 'The GIF button, GIFs in chat, and GIF profile pictures'],
      ['photos', '📷 Photos', 'Sending photos and photos already in chat'],
      ['files', '📎 Files and videos', 'Attaching files, and files already in chat'],
      ['polls', '📊 Polls', 'Making, answering, and seeing polls (required ones too)'],
      ['stickers', '🎫 Stickers', 'Sending stickers and stickers already in chat'],
      ['teamEmoji', 'Team emoji', 'Custom :emoji: in messages, reactions, and the picker'],
      ['reactions', 'Reactions', 'Reacting to messages and seeing reactions'],
      ['replies', 'Replies', 'Replying to a message, and the quoted message above replies'],
      ['editing', 'Editing messages', 'Changing a message after it’s sent'],
      ['pins', '📌 Pins', 'Pinning messages and the pinned list'],
      ['search', '🔎 Search', 'Searching chat'],
      ['linkPreviews', 'Link previews', 'Website and YouTube previews under links'],
      ['formatting', 'Text formatting', 'Bold, italics, and the rest (messages show as plain text)'],
      ['mentions', '@mentions', 'Mentioning people and subteams'],
      ['everyone', '@everyone', 'Notifying the whole team'],
      ['makeTask', 'Make a task from a message', 'The 📋 button on messages'],
    ],
  ],
  [
    'profiles',
    'Profiles and fun',
    [
      ['profilePictures', 'Profile pictures', 'Everyone shows as their initials'],
      ['gifAvatars', 'GIF profile pictures', 'Animated profile pictures show as initials'],
      ['status', 'Custom status', 'The status line under names'],
      ['decorations', 'Avatar decorations', 'Decorations and stickers around profile pictures'],
      ['nameEffects', 'Name effects', 'Animated and colored names'],
      ['nameplates', 'Nameplates', 'Backgrounds behind names'],
      ['fonts', 'Name fonts', 'Custom fonts for names'],
      ['borders', 'Borders', 'Borders around people’s messages and profile cards'],
      ['banners', 'Profile banners', 'Banner pictures and colors on profiles'],
      ['profileEffects', 'Profile effects', 'Animations that play over profiles'],
      ['profileColors', 'Profile colors', 'Custom colors on profile cards'],
      ['coins', '🪙 Jackson coins', 'Coins, the casino, games, and coin commands'],
      ['ads', '📺 Ads', 'Every ad in the app'],
      ['themes', '🎨 Themes', 'Color themes (everyone gets the standard look)'],
      ['catParty', '🐱 Cat party', 'The team logo surprise'],
    ],
  ],
  [
    'team',
    'Team tools',
    [
      ['checkins', '🧪 Lab check-ins', 'Who’s-going-to-the-lab questions'],
      ['requiredPolls', 'Required polls', 'Polls in #announcements that everyone has to answer'],
      ['requests', '💡 Feature requests', 'Sending ideas to you'],
      ['electrical', '⚡ Electrical diagram', 'The diagram in Resources'],
    ],
  ],
];
export const FEATURES = FEATURE_GROUPS.flatMap(([, , list]) => list);
export const LAB_LOG_MODES = [
  ['required', 'Required'],
  ['optional', 'Optional'],
  ['off', 'Off'],
];

// What a component sees. Asher (unless he's previewing) is never switched off.
const ALL_ON = { exempt: true, isOn: () => true, tabOn: () => true, channelOn: () => true, labLog: 'required' };
export const ControlsContext = createContext(ALL_ON);
export const useControls = () => useContext(ControlsContext);
export const useFeature = (id) => useContext(ControlsContext).isOn(id);

export function makeControls(doc, exempt, legacyHiddenTabs = []) {
  if (exempt) return { ...ALL_ON, doc: doc || {} };
  const d = doc || {};
  const off = new Set(d.off || []);
  const tabs = new Set([...(d.tabsOff || []), ...legacyHiddenTabs]);
  const channels = new Set(d.channelsOff || []);
  return {
    exempt: false,
    doc: d,
    isOn: (id) => !off.has(id),
    tabOn: (id) => !tabs.has(id),
    channelOn: (id) => !channels.has(id),
    labLog: d.labLog || 'required',
  };
}

// How many things are off (for the Controls page and its menu item).
export const offCount = (d = {}) =>
  (d.off || []).length + (d.tabsOff || []).length + (d.channelsOff || []).length + (d.labLog && d.labLog !== 'required' ? 1 : 0);

// Commands that belong to a switched-off feature count as off too (the
// Commands page's own switches stay as they are). Same rule as the play function.
export const COIN_GROUPS = ['economy', 'casino', 'arcade'];
export function commandCfgFor(cfg = {}, controls) {
  const extra = COMMANDS.filter(
    (c) => (c.name === 'poll' && !controls.isOn('polls')) || (COIN_GROUPS.includes(c.group) && !controls.isOn('coins')),
  ).map((c) => c.name);
  return extra.length ? { ...cfg, off: [...new Set([...(cfg.off || []), ...extra])] } : cfg;
}

// A profile as everyone else sees it: switched-off looks taken out. Only for
// showing; editors keep the real profile so saving never erases anything.
const GIF_RE = /\.gif(\?|$)|giphy\.com/i;
export function profileView(p, isOn) {
  if (!p) return p;
  const out = { ...p };
  const gif = GIF_RE.test(p.photo?.url || '');
  if (!isOn('profilePictures') || (gif && (!isOn('gifAvatars') || !isOn('gifs')))) delete out.photo;
  if (!isOn('status')) delete out.status;
  if (!isOn('decorations')) {
    delete out.decoration;
    delete out.decorationCustom;
  }
  if (!isOn('nameplates')) delete out.nameplate;
  if (!isOn('borders')) {
    delete out.msgBorder;
    delete out.cardBorder;
  }
  if (!isOn('banners')) {
    delete out.banner;
    delete out.bannerColor;
  }
  if (!isOn('profileEffects')) {
    delete out.effect;
    delete out.effectCustom;
  }
  if (!isOn('profileColors')) delete out.theme;
  if (out.nameStyle && (!isOn('nameEffects') || !isOn('fonts'))) {
    const ns = { ...out.nameStyle };
    if (!isOn('nameEffects')) {
      delete ns.effect;
      delete ns.colors;
    }
    if (!isOn('fonts')) delete ns.font;
    out.nameStyle = ns;
  }
  return out;
}

// Coin commands' cards in chat (casino, economy, games) hide with the coins.
const COIN_COMMANDS = new Set(COMMANDS.filter((c) => COIN_GROUPS.includes(c.group)).map((c) => c.name));
export const isCoinCommand = (name) => COIN_COMMANDS.has(name);
