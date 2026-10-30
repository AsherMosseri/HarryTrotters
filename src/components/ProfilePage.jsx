import { useEffect, useMemo, useState } from 'react';
import { mondayOf, parseDay, todayISO } from '../milestones.js';
import { gradientStops, nameProps } from '../nitro.js';
import { SUBTEAM_COLORS, gradeLabel } from '../config.js';
import { activeStatus } from '../people.js';
import { borderProps } from '../borders.js';
import { fullTime, relTime, useEscape, useMedia } from '../util.js';
import { Avatar, CloseIcon, DisplayName, Overlay, StatusDot, usePeople } from './common.jsx';
import { ProfileEffect, SubteamBadges, SubteamIcon } from './People.jsx';
import { hoursOf, mergedMs } from '../../functions/shared/hours.js';

// Hours are added up the same way as the Shifts page (shared/hours.js).
const fmtHours = (ms) => hoursOf(ms).toFixed(1);

// The full profile, like Discord's: a big banner, the person's look, and
// tabs for About, Activity, and Team. Opened from the profile card.
export default function ProfilePage({
  name,
  actor,
  tasks,
  shifts,
  joinedAt,
  lastSeen,
  notes,
  api,
  onPerson,
  onMessage,
  onEdit,
  onOpenTask,
  onClose,
}) {
  useEscape(onClose);
  const people = usePeople();
  const phone = useMedia('(max-width: 760px)');
  const [tab, setTab] = useState('about');
  const [note, setNote] = useState(notes[name] || '');
  useEffect(() => setNote(notes[name] || ''), [name, notes]);
  const me = name === actor.name;
  const profile = people?.profileOf(name) || {};
  const info = people?.infoOf(name) || {};
  const status = activeStatus(profile);
  const online = people?.isOnline(name);
  const themed = profile.theme?.a && profile.theme?.b;
  const banner = profile.banner?.url;
  const border = borderProps(profile.cardBorder);

  const mine = useMemo(() => shifts.filter((s) => s.person === name), [shifts, name]);
  const onShift = mine.find((s) => !s.end);
  const monday = parseDay(mondayOf(todayISO())).getTime();
  const weekHours = mergedMs(mine.filter((s) => s.start >= monday));
  const seasonHours = mergedMs(mine);
  const open = tasks.filter((t) => t.status !== 'done' && (t.assignees || []).includes(name));
  const done = tasks
    .filter((t) => t.status === 'done' && (t.assignees || []).includes(name))
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const lastShift = [...mine].sort((a, b) => b.start - a.start)[0];
  const subteammates = useMemo(() => {
    const out = new Map();
    for (const s of info.subteams || []) {
      out.set(
        s,
        (people?.roster || []).filter((n) => n !== name && (people?.infoOf(n)?.subteams || []).includes(s)),
      );
    }
    return out;
  }, [people, info.subteams, name]);
  const daysOnTeam = joinedAt ? Math.max(1, Math.round((Date.now() - joinedAt) / 86400000)) : 0;

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div
          className={`dialog profile-page ${border.className}`}
          style={border.style}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`${name}'s profile`}
        >
          <div
            className={`pp${themed ? ' themed' : ''}`}
            style={{
              ...(themed
                ? { '--pc-grad': `linear-gradient(180deg, ${gradientStops([profile.theme.a, profile.theme.m, profile.theme.b])})` }
                : {}),
              '--pc-ring': themed ? profile.theme.a : 'var(--surface)',
            }}
          >
            <div
              className="pp-banner"
              style={
                banner
                  ? { backgroundImage: `url("${banner}")` }
                  : {
                      background:
                        profile.bannerColor ||
                        (themed ? `color-mix(in srgb, ${profile.theme.a} 70%, #000)` : info.color || 'var(--accent)'),
                    }
              }
            />
            <button className="icon-btn profile-close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
            <div className="pp-head">
              <div className="pc-avatar pp-avatar">
                <Avatar
                  name={name}
                  size={phone ? 92 : 120}
                  showOnline
                  decoration={profile.decoration}
                  decorationCustom={profile.decorationCustom}
                />
              </div>
              {status && (
                <div className="pc-bubble pp-bubble">
                  <p className="profile-status">
                    {status.emoji} {status.text}
                  </p>
                </div>
              )}
              <div className="pp-actions">
                {!me && (
                  <button className="btn primary" onClick={onMessage}>
                    Message
                  </button>
                )}
                {(me || actor.admin) && (
                  <button className="btn" onClick={onEdit}>
                    Edit profile
                  </button>
                )}
              </div>
            </div>
            <div className="pp-panel">
              <div className="pp-title">
                <h2 {...nameProps(profile, info.color, name, 'pp-name')}>{name}</h2>
                <SubteamBadges subteams={info.subteams} className="pp-badges" />
              </div>
              <p className="pc-sub">
                {profile.pronouns && <span className="pronouns">{profile.pronouns} · </span>}
                {online ? (
                  <>
                    <span className="online-inline" aria-hidden="true" />
                    Online now
                  </>
                ) : lastSeen ? (
                  `Last seen ${relTime(lastSeen)}`
                ) : (
                  'Offline'
                )}
                {onShift && (
                  <span className="pp-onshift">
                    {' '}
                    · At the lab since {new Date(onShift.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </p>
              {status && (
                <p className="profile-status pp-status-inline">
                  {status.emoji} {status.text}
                </p>
              )}
              <div className="segmented pp-tabs" role="tablist">
                {[
                  ['about', 'About'],
                  ['activity', 'Activity'],
                  ['team', 'Team'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={`plain-seg${tab === id ? ' on' : ''}`}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'about' && (
                <div className="pp-body">
                  {profile.about && (
                    <section className="profile-section">
                      <h3>About me</h3>
                      <p className="about-text">{profile.about}</p>
                    </section>
                  )}
                  <section className="profile-section">
                    <h3>Team</h3>
                    {(info.title || info.grade) && (
                      <p className="profile-title">{[info.title, info.grade && gradeLabel(info.grade)].filter(Boolean).join(' · ')}</p>
                    )}
                    {info.subteams?.length > 0 && (
                      <div className="profile-pills">
                        {info.subteams.map((s) => (
                          <span key={s} className="pill" style={{ '--pill': SUBTEAM_COLORS[s] || 'var(--muted)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {info.responsibilities?.some((r) => !(info.subteams || []).includes(r)) && (
                      <p className="muted small">{info.responsibilities.join(' · ')}</p>
                    )}
                  </section>
                  {joinedAt > 0 && (
                    <section className="profile-section">
                      <h3>Member since</h3>
                      <p>
                        {new Date(joinedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        <span className="muted small"> · {daysOnTeam === 1 ? '1 day' : `${daysOnTeam} days`} on the team</span>
                      </p>
                    </section>
                  )}
                  {!me && (
                    <section className="profile-section">
                      <h3>Note</h3>
                      <textarea
                        className="input pp-note"
                        rows={2}
                        maxLength={500}
                        value={note}
                        placeholder="Only you can see this. Click to add a note…"
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={() => note !== (notes[name] || '') && api.saveNote(name, note.trim())}
                        aria-label={`Your note about ${name}`}
                      />
                    </section>
                  )}
                </div>
              )}

              {tab === 'activity' && (
                <div className="pp-body">
                  <div className="pp-stats">
                    <div>
                      <b>{fmtHours(weekHours)}</b>
                      <span>hours this week</span>
                    </div>
                    <div>
                      <b>{fmtHours(seasonHours)}</b>
                      <span>hours this season</span>
                    </div>
                    <div>
                      <b>{done.length}</b>
                      <span>tasks done</span>
                    </div>
                    <div>
                      <b>{open.length}</b>
                      <span>open tasks</span>
                    </div>
                  </div>
                  <section className="profile-section">
                    <h3>At the lab</h3>
                    <p>
                      {onShift
                        ? `On shift now${onShift.note ? `: ${onShift.note}` : ''}`
                        : lastShift
                          ? `Last shift ${relTime(lastShift.start)} (${fmtHours((lastShift.end || Date.now()) - lastShift.start)} h)`
                          : 'No shifts yet'}
                    </p>
                  </section>
                  <section className="profile-section">
                    <h3>Working on</h3>
                    {open.length ? (
                      <ul className="pp-tasks">
                        {open.slice(0, 5).map((t) => (
                          <li key={t.id}>
                            <button className="link-btn" onClick={() => onOpenTask(t.id)}>
                              <StatusDot status={t.status} /> {t.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nothing open.</p>
                    )}
                  </section>
                  <section className="profile-section">
                    <h3>Recently finished</h3>
                    {done.length ? (
                      <ul className="pp-tasks">
                        {done.slice(0, 5).map((t) => (
                          <li key={t.id}>
                            <button className="link-btn" onClick={() => onOpenTask(t.id)}>
                              {t.title}
                            </button>
                            {t.completedAt && <span className="muted tiny"> · {relTime(t.completedAt)}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nothing finished yet.</p>
                    )}
                  </section>
                </div>
              )}

              {tab === 'team' && (
                <div className="pp-body">
                  {subteammates.size ? (
                    [...subteammates].map(([s, names]) => (
                      <section key={s} className="profile-section">
                        <h3>
                          <SubteamIcon s={s} size={16} /> {s}
                        </h3>
                        {names.length ? (
                          <div className="pp-mates">
                            {names.map((n) => (
                              <button key={n} className="pp-mate" onClick={() => onPerson(n)}>
                                <Avatar name={n} size={28} showOnline />
                                <DisplayName name={n} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="muted small">Just {name.split(' ')[0]} so far.</p>
                        )}
                      </section>
                    ))
                  ) : (
                    <p className="muted">Not on a subteam yet.</p>
                  )}
                </div>
              )}
              {profile.updatedAt && <p className="muted tiny pp-foot">Profile updated {fullTime(profile.updatedAt)}</p>}
            </div>
            <ProfileEffect id={profile.effect} custom={profile.effectCustom} />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
