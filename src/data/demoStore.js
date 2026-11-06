// In-browser backend used with ?demo in the URL: no sign-in, data kept in
// localStorage. Handy for trying the UI before Firebase is set up.
import {
  describeChanges,
  derivedFields,
  newTaskDefaults,
  newMilestoneDefaults,
  newPartDefaults,
  newRunDefaults,
  personId,
} from './diff.js';
import { STARTER_CHECKLISTS, isQueueChecklist, starterItems } from '../checklists.js';
import { matchId, matchLabel } from '../../functions/shared/matches.js';
import { REQUESTS_TO } from '../config.js';
import { deliver } from '../adOrders.js';
import * as casino from '../../functions/shared/casino.js';
import { dayOf, logFields, taskArea } from '../labLog.js';
import * as arcade from '../../functions/shared/arcade.js';
import * as challenge from '../../functions/shared/challenge.js';
import * as dispute from '../../functions/shared/disputes.js';
import { ARCADE, ARCADE_NOTE, blocked, isOff, serverGroup } from '../../functions/shared/commandRules.js';
import { skipReason as moveSkip } from '../../functions/shared/moveArcade.js';
import { FIND } from '../../functions/shared/hiddenCoins.js';
import * as coinAsk from '../../functions/shared/coinRequests.js';
import { AWARD_CAPS, breakdown, capWin, ceilingNote, earnBalance, giftEntry, overCeiling, scaleId, scaledPay, sumCoins, groupGiftEntries, prizeEntry, teamDay, teamMidnight } from '../../functions/shared/coins.js';
import { BOT, groupLabel, resolveTargets } from '../../functions/shared/groups.js';
import * as fun from '../../functions/shared/funGames.js';
import * as mines from '../../functions/shared/minesweeper.js';
const MINE_LEVELS = mines.LEVELS;
import { attemptSeed, newSeed, secureRandom } from '../../functions/shared/rng.js';
import { asksOn, scheduledCheckinFields } from '../../functions/shared/checkin.js';
import * as market from '../../functions/shared/market.js';
import { PERK_IDEAS } from '../../functions/shared/market.js';
import { giftAccept, giftEnd, giftOffer, petEdit, petsIn, withPet } from '../../functions/shared/pets.js';
import { cleanScore, scoreAfter } from '../../functions/shared/petgames.js';
import { ROSTER, SUBTEAMS, cleanName, sameName } from '../../functions/shared/team.js';
import * as chan from '../../functions/shared/channels.js';
import { checkPicks, myPicks, personOptionId, usesVoteButton } from '../../functions/shared/polls.js';
import { demoLife } from './demoLife.js';
import { demoLearn } from './demoLearn.js';
import { demoEvents } from './demoEvents.js';
import { demoPetPhotos } from './demoPetPhotos.js';
import { demoLoans } from './demoLoans.js';
import { demoBuddy } from './demoBuddy.js';
import { buddyBlocks, lockNote } from '../../functions/shared/buddy.js';
import { PHOTO_ACTIONS } from '../../functions/shared/petphotos.js';
import { earnedIds } from '../../functions/shared/events.js';
import { coinsText } from '../../functions/shared/coinText.js';

const KEY = 'ftc32313-demo-v13';
const listeners = new Set();
const uid = () => Math.random().toString(36).slice(2, 11);

function seed() {
  const now = Date.now();
  const day = 86400000;
  const iso = (offset) => new Date(now + offset * day).toISOString().slice(0, 10);
  const t = (title, extra) => ({
    id: uid(),
    ...newTaskDefaults({ title, ...extra }),
    createdAt: now - 5 * day,
    createdBy: 'Asher Mosseri',
    updatedAt: now - day,
    updatedBy: 'Asher Mosseri',
    completedAt: extra.status === 'done' ? now - day : null,
  });
  const tasks = [
    t('Finish intake roller CAD', {
      status: 'in_progress',
      assignees: ['Cooper Mlezcko'],
      subteam: 'CAD',
      priority: 'high',
      dueDate: iso(2),
    }),
    t('Tune autonomous path for left start', {
      status: 'todo',
      assignees: ['Jackson Lucks', 'Asher Mosseri'],
      subteam: '',
      priority: 'urgent',
      dueDate: iso(-1),
    }),
    t('Order 2 more GoBILDA 312 RPM motors', {
      status: 'blocked',
      assignees: ['Sophia Bermudez'],
      subteam: 'Team Management',
      priority: 'high',
      blockedReason: 'Waiting on coach to approve purchase order',
    }),
    t('Rewire control hub with labeled cables', {
      status: 'testing',
      assignees: ['Michael Meidan'],
      subteam: 'Electrical',
      priority: 'medium',
      dueDate: iso(4),
    }),
    t('Write portfolio page on drivetrain design', {
      status: 'backlog',
      assignees: ['Katarina Jurasic'],
      subteam: 'Team Management',
      priority: 'low',
    }),
    t('Library outreach demo signup', { status: 'done', assignees: ['Matthew Kuehl'], subteam: 'Team Management', priority: 'medium' }),
    t('Driver practice: 10 full matches', {
      status: 'todo',
      assignees: ['Sebastian Tolbert'],
      subteam: 'Assembly',
      priority: 'medium',
      dueDate: iso(6),
    }),
    t('Fix drivetrain drift in TeleOp', {
      status: 'in_progress',
      assignees: ['Asher Mosseri', 'Katarina Jurasic'],
      subteam: 'Programming',
      priority: 'high',
    }),
    t('Replace left drivetrain bearings', {
      status: 'in_progress',
      assignees: ['Cooper Mlezcko'],
      subteam: 'Mechanical',
      priority: 'high',
    }),
    t('Cable-manage the shooter wiring', {
      status: 'todo',
      assignees: ['Jackson Lucks'],
      subteam: 'Electrical',
      priority: 'medium',
    }),
    t('Mount the new shooter on the robot', {
      status: 'todo',
      assignees: ['Sebastian Tolbert', 'Cooper Mlezcko'],
      subteam: 'Assembly',
      priority: 'medium',
    }),
  ];
  const activity = {};
  for (const task of tasks) activity[task.id] = [{ id: uid(), type: 'created', by: 'Asher Mosseri', at: task.createdAt }];
  const m = (title, subteam, start, end, extra = {}) => ({
    id: uid(),
    ...newMilestoneDefaults({ title, subteam, start: iso(start), end: iso(end), ...extra }),
  });
  const milestones = [
    m('Review robot and pick revisions', 'Team Management', -1, 1, { owners: ['Sebastian Tolbert'], done: true }),
    m('CAD revised intake', 'CAD', 0, 6, { owners: ['Shrey Kumar', 'Matthew Kuehl'] }),
    m('Build and assemble revisions', 'Assembly', 7, 15, { owners: ['Cooper Mlezcko', 'Ira Kumar'] }),
    m('Autonomous + TeleOp updates', 'Programming', 10, 19, { owners: ['Katarina Jurasic', 'Asher Mosseri'] }),
    m('Full-robot testing', 'Assembly', 18, 23),
  ];
  tasks[0].milestoneId = milestones[1].id;
  tasks[1].milestoneId = milestones[3].id;
  tasks[3].milestoneId = milestones[2].id;
  tasks[0].checklist = [
    { id: 'c1', text: 'Sketch roller layout', done: true },
    { id: 'c2', text: 'Model side plates', done: true },
    { id: 'c3', text: 'Check clearance with drivetrain', done: false },
  ];
  const p = (name, vendor, qty, unitCost, status, extra = {}) => ({
    id: uid(),
    ...newPartDefaults({ name, vendor, qty, unitCost, status, ...extra }),
  });
  const parts = [
    p('5203 Yellow Jacket motor, 312 RPM', 'goBILDA', 2, 39.99, 'needed', { subteam: 'Mechanical', taskId: tasks[2].id }),
    p('Smart Robot Servo', 'REV Robotics', 3, 34.0, 'ordered', { subteam: 'Assembly' }),
    p('1/4" ID polycarbonate tubing, 1 ft', 'McMaster-Carr', 4, 6.5, 'arrived', { subteam: 'Mechanical' }),
  ];
  const checklists = STARTER_CHECKLISTS.slice(0, 2).map((c) => ({ id: uid(), title: c.title, items: starterItems(c) }));
  const r = (offset, type, auto, teleop, endgame, extra = {}) => ({
    id: uid(),
    ...newRunDefaults({ date: iso(offset), type, auto, teleop, endgame, drivers: ['Sebastian Tolbert', 'Jackson Lucks'], ...extra }),
    createdAt: now + offset * day,
  });
  const runs = [
    r(-9, 'practice', 10, 42, 8, { issues: 'Intake jammed twice' }),
    r(-8, 'practice', 15, 48, 10),
    r(-6, 'practice', 15, 40, 0, { issues: 'Lift string snapped' }),
    r(-5, 'practice', 20, 55, 15),
    r(-3, 'practice', 25, 58, 15),
    r(-2, 'match', 20, 61, 20, { matchNumber: 'Q4', result: 'win' }),
    r(-1, 'practice', 30, 64, 20),
  ];
  const msg = (minsAgo, by, text, extra = {}) => ({
    id: uid(),
    text,
    by,
    byUid: by,
    at: now - minsAgo * 60000,
    mentions: [],
    taskIds: [],
    replyTo: null,
    photo: null,
    reactions: {},
    ...extra,
  });
  const chat = {
    announcements: [
      msg(45, 'Sebastian Tolbert', 'Inspection practice Thursday at 4pm. Everyone bring safety glasses 🥽', { byUid: 'sebastian' }),
    ],
    general: [
      msg(180, 'Sebastian Tolbert', 'Practice moved to 4pm tomorrow, everyone bring safety glasses'),
      msg(170, 'Sophia Bermudez', 'got it 👍', { reactions: { '👍': { 'Jackson Lucks': 'Jackson Lucks' } } }),
      msg(75, 'Sebastian Tolbert', 'Who should drive in match 1?', {
        poll: {
          question: 'Who should drive in match 1? Pick up to 2',
          kind: 'people',
          multi: true,
          pick: { mode: 'upto', n: 2 },
          selfVote: true,
          options: ['Sebastian Tolbert', 'Jackson Lucks', 'Cooper Mlezcko', 'Michael Meidan', 'Matthew Kuehl', 'Katarina Jurasic'].map((n) => ({
            id: personOptionId(n),
            text: n,
            person: n,
          })),
        },
        votes: {
          [personOptionId('Sebastian Tolbert')]: { 'jackson-lucks': 'Jackson Lucks', 'katarina-jurasic': 'Katarina Jurasic', 'michael-meidan': 'Michael Meidan' },
          [personOptionId('Jackson Lucks')]: { 'sebastian-tolbert': 'Sebastian Tolbert', 'sophia-bermudez': 'Sophia Bermudez', 'ira-kumar': 'Ira Kumar' },
          [personOptionId('Cooper Mlezcko')]: { 'sebastian-tolbert': 'Sebastian Tolbert', 'matthew-kuehl': 'Matthew Kuehl' },
          [personOptionId('Michael Meidan')]: { 'jackson-lucks': 'Jackson Lucks', 'shrey-kumar': 'Shrey Kumar' },
        },
      }),
      msg(55, 'Michael Meidan', 'Which three should we practice most?', {
        poll: {
          question: 'Which 3 things should we practice most this week? Pick exactly 3',
          kind: 'choices',
          multi: true,
          pick: { mode: 'exact', n: 3 },
          options: [
            { id: 'a', text: 'Intake' },
            { id: 'b', text: 'Lift' },
            { id: 'c', text: 'Auto' },
            { id: 'd', text: 'Parking' },
            { id: 'e', text: 'Driver practice' },
          ],
        },
        votes: {
          a: { 'sebastian-tolbert': 'Sebastian Tolbert', 'jackson-lucks': 'Jackson Lucks', 'katarina-jurasic': 'Katarina Jurasic', 'ira-kumar': 'Ira Kumar' },
          b: { 'sebastian-tolbert': 'Sebastian Tolbert', 'katarina-jurasic': 'Katarina Jurasic' },
          c: { 'sebastian-tolbert': 'Sebastian Tolbert', 'jackson-lucks': 'Jackson Lucks', 'ira-kumar': 'Ira Kumar', 'shrey-kumar': 'Shrey Kumar' },
          d: { 'jackson-lucks': 'Jackson Lucks', 'shrey-kumar': 'Shrey Kumar' },
          e: { 'katarina-jurasic': 'Katarina Jurasic', 'ira-kumar': 'Ira Kumar', 'shrey-kumar': 'Shrey Kumar' },
        },
      }),
      msg(30, 'Cooper Mlezcko', '@Asher Mosseri can you check the auto path before practice?', {
        mentions: ['Asher Mosseri'],
        taskIds: [tasks[1].id],
      }),
    ],
    assembly: [msg(60, 'Ira Kumar', 'Intake side plates are printed')],
    programming: [
      msg(
        240,
        'Katarina Jurasic',
        '## Auto plan for Saturday\n- **Left start:** score preload, park\n- *Right start:* 2 samples\n> Test both before 5pm\n-# updated after Tuesday practice',
        {
          pinned: true,
          pinnedBy: 'Asher Mosseri',
          pinnedAt: now - 200 * 60000,
        },
      ),
      msg(90, 'Michael Meidan', 'Which day works for the code review?', {
        poll: {
          question: 'Which day works for the code review?',
          multi: false,
          options: [
            { id: 'a', text: 'Thursday' },
            { id: 'b', text: 'Friday' },
            { id: 'c', text: 'Saturday' },
          ],
        },
        votes: {
          a: { 'katarina-jurasic': 'Katarina Jurasic' },
          c: { 'michael-meidan': 'Michael Meidan', 'asher-mosseri': 'Asher Mosseri' },
        },
      }),
      msg(20, 'Michael Meidan', 'Odometry docs: https://gm0.org/en/latest/docs/software/concepts/odometry.html ||spoiler: it works now||', {
        preview: {
          url: 'https://gm0.org/en/latest/docs/software/concepts/odometry.html',
          site: 'gm0.org',
          title: 'Odometry — Game Manual 0',
          description: 'A guide to odometry for FTC robots: dead wheels, localization, and tuning.',
        },
      }),
    ],
    'dm:asher-mosseri--cooper-mlezcko': [msg(15, 'Cooper Mlezcko', 'hey, can you send me the intake CAD link?', { byUid: 'cooper' })],
  };
  const dms = [
    {
      id: 'asher-mosseri--cooper-mlezcko',
      people: ['Asher Mosseri', 'Cooper Mlezcko'],
      name: '',
      createdBy: 'Cooper Mlezcko',
      createdAt: now - 15 * 60000,
      lastAt: now - 15 * 60000,
      lastBy: 'Cooper Mlezcko',
      lastText: 'hey, can you send me the intake CAD link?',
    },
  ];
  const profiles = [
    {
      id: 'sebastian-tolbert',
      name: 'Sebastian Tolbert',
      status: { emoji: '🔧', text: 'at the lab' },
      decoration: 'crown',
      effect: 'sparkles',
      nameStyle: { font: 'chunky', colors: ['#f97316', '#db2777'] },
      theme: { a: '#f97316', b: '#7c3aed' },
      about: 'Team management, logistics, and assembly. Ask me about parts orders.',
      pronouns: 'he/him',
      updatedAt: now,
    },
    {
      id: 'katarina-jurasic',
      name: 'Katarina Jurasic',
      status: { emoji: '💻', text: 'tuning auto' },
      decoration: 'rainbow',
      nameStyle: { font: 'script', colors: ['#22c55e'] },
      about: 'Programming. Autonomous is my thing.',
      updatedAt: now,
    },
  ];
  const robot = {
    versions: [
      { id: 'sample-1', name: 'v1 – original robot', notes: 'Built-in sample model', sample: 1, by: 'Shrey Kumar', at: now - 6 * day },
      { id: 'sample-2', name: 'v2 – raised intake + claw', notes: 'Built-in sample model', sample: 2, by: 'Matthew Kuehl', at: now - day },
    ],
    pins: [
      {
        id: uid(),
        versionId: 'sample-2',
        key: 'Intake/Intake Roller',
        point: [0, 0.028, 0],
        text: 'Roller slips on the hex shaft, add a set screw',
        taskId: tasks[0].id,
        partId: '',
        resolved: false,
        by: 'Cooper Mlezcko',
        byUid: 'Cooper Mlezcko',
        at: now - 3 * 3600000,
      },
    ],
    layouts: [],
  };
  // Sample notifications, the same for whoever the demo signs in as.
  const inbox = [
    // What the queue alert looks like (the real one is sent by the queueAlert function).
    {
      id: uid(),
      type: 'queue',
      title: 'Match 9 in 20 min',
      body: 'Time to queue — start the checklist',
      open: 'view:today',
      at: now - 60000,
      read: false,
    },
    {
      id: uid(),
      type: 'announcement',
      title: 'Announcement from Sebastian',
      body: chat.announcements?.[0]?.text || 'Team meeting Friday',
      open: 'chat:announcements',
      at: now - 2 * 3600000,
      read: false,
    },
    {
      id: uid(),
      type: 'assigned',
      title: 'Asher gave you a task',
      body: tasks[0].title,
      open: `task:${tasks[0].id}`,
      at: now - 5 * 3600000,
      read: false,
    },
    {
      id: uid(),
      type: 'mention',
      title: 'Jackson mentioned you in #assembly',
      body: 'Can you check the drivetrain bolts?',
      open: 'chat:assembly',
      at: now - day,
      read: true,
    },
    { id: uid(), type: 'due', title: 'Due tomorrow', body: tasks[1].title, open: `task:${tasks[1].id}`, at: now - 1.5 * day, read: true },
  ];
  const shifts = demoShifts(now);
  const lab = demoLabLog(shifts, tasks);
  return {
    tasks,
    activity,
    people: [],
    milestones,
    roles: [],
    parts,
    checklists,
    runs,
    chat: { ...chat, 'lab-log': lab.posts },
    labLogs: lab.logs,
    // How often the team taps each lab log chip (labChips/counts for real).
    labChips: { 'coding-test': 6, 'mech-fixed': 4, 'elec-cables': 3, 'gen-helped': 2 },
    robot,
    inbox,
    dms,
    profiles,
    channels: [],
    emoji: [],
    stickers: [],
    shifts,
    shiftPlans: demoPlans(),
    shiftRequests: demoShiftRequests(shifts, now),
    requests: [
      {
        id: uid(),
        text: 'A timer for driver practice that logs the run in the Match Log when it ends.',
        by: 'Sophia Bermudez',
        at: now - 26 * 3600000,
        status: 'planned',
        votes: { 'Sophia Bermudez': true, 'Jackson Lucks': true, 'Michael Meidan': true },
        reply: 'Good one. Adding it after the next competition.',
        updatedBy: 'Asher Mosseri',
      },
      {
        id: uid(),
        text: 'Dark mode for the robot viewer',
        by: 'Jackson Lucks',
        at: now - 4 * 86400000,
        status: 'done',
        votes: { 'Jackson Lucks': true },
        reply: 'Added in 2.2.',
        updatedBy: 'Asher Mosseri',
      },
    ],
  };
}

// Sample shifts: a few past ones this week and last, and Cooper at the lab now.
// Sample lab logs for the sample shifts that already ended, and #lab-log's
// post for each of those days (the onLabLog function makes these for real).
function demoLabLog(shifts, tasks) {
  const NOTES = {
    'Asher Mosseri': [
      'Tuned the autonomous path for the left start. It hits the backdrop 4 out of 5 times now.',
      'Planned the next two weeks with the leads and updated the milestones.',
    ],
    'Sebastian Tolbert': ['Mounted the shooter and re-tightened the drivetrain set screws.'],
    'Jackson Lucks': ['Labeled every wire on the Control Hub and redid the battery connector.'],
    'Cooper Mlezcko': ['Rebuilt the drivetrain: new bearings on the left side, and it drives straight again.'],
    'Sophia Bermudez': ['Finished the intake roller CAD and exported the plates for cutting.'],
    'Michael Meidan': ['Started the arm pivot in CAD.'],
  };
  const extra = {
    'Asher Mosseri': { next: 'Try the right start, and record a video for the portfolio.' },
    'Jackson Lucks': { blockers: 'Waiting on the new Anderson connectors to arrive.' },
    'Cooper Mlezcko': { next: 'Check the motor temperatures after a full match run.' },
  };
  // Logged with taps (person|n: their nth most recent log).
  const TAPPED = {
    'Asher Mosseri|0': {
      areas: ['coding'],
      tasks: [
        ['Tune autonomous path for left start', 'progress'],
        ['Fix drivetrain drift in TeleOp', 'started'],
      ],
      note: 'Tuned auto, tested on the robot. Left start hits the backdrop 4 out of 5 times.',
      chips: ['coding-auto', 'coding-test'],
    },
    'Sebastian Tolbert|0': {
      areas: ['assembly', 'mechanical'],
      tasks: [['Mount the new shooter on the robot', 'progress']],
      note: 'Mounted parts on the robot, tightened / replaced screws',
      chips: ['asm-mounted', 'asm-screws'],
      with: ['Jackson Lucks'],
    },
    'Sophia Bermudez|0': {
      areas: ['cad'],
      tasks: [['Finish intake roller CAD', 'done']],
      note: 'Modeled a part, exported for printing. The roller plates are ready to cut.',
      chips: ['cad-part', 'cad-print'],
      with: ['Michael Meidan'],
    },
    'Jackson Lucks|0': {
      areas: ['electrical', 'assembly'],
      tasks: [
        ['Cable-manage the shooter wiring', 'progress'],
        ['Mount the new shooter on the robot', 'stuck', 'Waiting on the new Anderson connectors'],
      ],
      note: 'Wired, cable managed',
      chips: ['elec-wired', 'elec-cables'],
      with: ['Sebastian Tolbert'],
    },
  };
  const logs = [];
  const used = {};
  for (const sh of shifts.filter((x) => x.end)) {
    const day = dayOf(sh.start);
    const id = `${day}_${personId(sh.person)}`;
    if (logs.some((l) => l.id === id)) continue;
    const i = (used[sh.person] = (used[sh.person] ?? -1) + 1);
    const notes = NOTES[sh.person] || ['Helped out around the lab.'];
    const mine = tasks.filter((t) => (t.assignees || []).includes(sh.person)).slice(0, 1);
    const tapped = TAPPED[`${sh.person}|${i}`];
    if (tapped) {
      const picks = tapped.tasks.map(([title, outcome, blocker = '']) => {
        const t = tasks.find((x) => x.title === title);
        return { id: t?.id || null, title, area: t ? taskArea(t) : tapped.areas[0], outcome, blocker };
      });
      logs.push({
        id,
        day,
        person: sh.person,
        uid: 'demo',
        ...logFields({ areas: tapped.areas, picks, note: tapped.note, chips: tapped.chips || [], photos: [], voice: null, workedWith: tapped.with || [] }),
        shiftIds: [sh.id],
        at: sh.end,
      });
      continue;
    }
    logs.push({
      id,
      day,
      person: sh.person,
      uid: 'demo',
      note: notes[i % notes.length],
      taskIds: mine.map((t) => t.id),
      doneTaskIds: [],
      photos: [],
      blockers: i === 0 ? extra[sh.person]?.blockers || '' : '',
      next: i === 0 ? extra[sh.person]?.next || '' : '',
      at: sh.end,
    });
  }
  const days = [...new Set(logs.map((l) => l.day))].sort();
  const posts = days.map((day) => {
    const mine = logs.filter((l) => l.day === day);
    const people = mine.map((l) => l.person);
    return {
      id: `labday-${day}`,
      text: `🧪 Lab log: ${people.join(', ')}`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: Math.min(...mine.map((l) => l.at)),
      cmd: { name: 'labday', day, people },
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: {},
    };
  });
  return { logs, posts };
}

function demoShifts(now) {
  const h = 3600000;
  const day = (n, hour) => {
    const d = new Date(now - n * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const s = (person, start, hours, extra = {}) => ({
    id: uid(),
    person,
    start,
    end: hours == null ? null : start + hours * h,
    note: '',
    subteam: '',
    taskIds: [],
    createdBy: person,
    ...extra,
  });
  return [
    s('Cooper Mlezcko', now - 1.4 * h, null, { subteam: 'Mechanical' }),
    s('Jackson Lucks', now - 2.5 * h, 1.5, { subteam: 'Electrical' }),
    s('Asher Mosseri', day(1, 15), 3, { subteam: 'Programming', note: 'Tuned the autonomous path' }),
    s('Sebastian Tolbert', day(1, 15), 2.5, { subteam: 'Assembly', note: 'Shooter mount' }),
    s('Jackson Lucks', day(1, 16), 2),
    s('Cooper Mlezcko', day(2, 15), 3.5, { subteam: 'Mechanical', note: 'Drivetrain rebuild' }),
    s('Sophia Bermudez', day(3, 15), 2, { subteam: 'CAD' }),
    s('Asher Mosseri', day(8, 15), 4, { subteam: 'Team Management' }),
    s('Michael Meidan', day(8, 15), 3, { subteam: 'CAD', autoEnded: true }),
  ];
}
// Jackson asking for his shift yesterday to be 30 minutes longer, so team
// management has one to approve.
function demoShiftRequests(shifts, now) {
  const s = shifts.find((x) => x.person === 'Jackson Lucks' && x.end);
  if (!s) return [];
  return [
    {
      id: uid(),
      kind: 'extend',
      person: s.person,
      shiftId: s.id,
      start: s.start,
      end: s.end + 1800000,
      oldStart: s.start,
      oldEnd: s.end,
      note: 'Forgot to clock out, stayed to help with wiring',
      status: 'pending',
      by: s.person,
      at: now - 3 * 3600000,
    },
  ];
}
function demoPlans() {
  const iso = (n) => {
    const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return [
    {
      id: uid(),
      date: iso(1),
      start: '15:30',
      end: '18:00',
      title: 'Build session',
      subteam: '',
      people: { 'Cooper Mlezcko': 'in', 'Sebastian Tolbert': 'in' },
    },
    {
      id: uid(),
      date: iso(3),
      start: '15:30',
      end: '17:30',
      title: 'Driver practice',
      subteam: 'Programming',
      people: { 'Jackson Lucks': 'out' },
    },
  ];
}

// Demo uploads: version id -> object URL (not saved across reloads).
const demoFiles = new Map();

const dataUrl = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });

const findMsg = (conv, id) => (state.chat[conv] || []).find((m) => m.id === id);
function updateMsg(conv, id, fn) {
  state.chat = { ...state.chat, [conv]: (state.chat[conv] || []).map((m) => (m.id === id ? fn(m) : m)) };
  commit();
}

function demoPreview(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { url, site: host, title: `A page on ${host}`, description: 'Link previews are made by the server on the real board.' };
}

// A sample event around now: one match played and scored, one just played
// waiting for its score, and the next few coming up. Re-made once they're all
// more than half a day old. Also the drive team and the "before queueing"
// checklist the pit screen uses.
const DEMO_EVENT = 'DEMO';
function demoMatchesStale() {
  const list = state.matches;
  return !list || (list.length > 0 && list.every((m) => m.event === DEMO_EVENT && m.time && m.time < Date.now() - 12 * 3600000));
}
function seedDemoMatches() {
  const min = 60000;
  const base = Math.round(Date.now() / (5 * min)) * 5 * min;
  const m = (number, offset, alliance, partners, opponents, extra = {}) => {
    const label = matchLabel('qual', number);
    return { id: matchId(DEMO_EVENT, label), event: DEMO_EVENT, label, level: 'qual', number, time: base + offset * min, alliance, partners, opponents, source: 'typed', ...extra };
  };
  state.matches = [
    m(2, -95, 'blue', [24601], [11115, 8565], { ours: { auto: 25, teleop: 62, endgame: 20, total: 107, by: 'Jackson Lucks', at: base - 85 * min }, result: 'win' }),
    m(6, -35, 'red', [16236], [9794, 20409]),
    m(9, 22, 'red', [7244], [14270, 3491]),
    m(14, 70, 'blue', [19055], [23122, 12454]),
    m(19, 118, 'red', [5961], [16626, 21229]),
    m(23, 165, 'blue', [9773], [18421, 6022]),
  ];
  state.settings = {
    ...(state.settings || {}),
    compEvent: state.settings?.compEvent || { code: DEMO_EVENT, name: 'Demo Qualifier' },
    driveTeam: state.settings?.driveTeam || { coach: 'Asher Mosseri', drivers: ['Sebastian Tolbert', 'Jackson Lucks'], human: '' },
    // The practice score the "Before the event" card on Today measures against.
    runGoal: state.settings?.runGoal ?? 120,
  };
  if (!(state.checklists || []).some(isQueueChecklist)) {
    const list = STARTER_CHECKLISTS.find(isQueueChecklist);
    state.checklists = [...(state.checklists || []), { id: uid(), title: list.title, items: starterItems(list), createdAt: Date.now() }];
  }
}

// Six sample batteries: one on the robot (put on for the last match played),
// two charged (one rested longer), one charging, one waiting, one retired.
function seedDemoBatteries() {
  const min = 60000;
  const now = Date.now();
  const hist = (...steps) => steps.map(([ago, by, status, match]) => ({ at: now - ago * min, by, status, ...(match ? { match } : {}) }));
  const make = (label, color, order, steps) => {
    const history = hist(...steps);
    const last = history.at(-1);
    return {
      id: `bat${label}`,
      label,
      color,
      order,
      status: last.status,
      statusAt: last.at,
      statusBy: last.by,
      match: last.status === 'robot' ? last.match || '' : '',
      history,
      createdAt: now - 20 * 86400000,
      createdBy: 'Asher Mosseri',
    };
  };
  return [
    make('1', 'red', 1, [[300, 'Jackson Lucks', 'charged'], [150, 'Jackson Lucks', 'robot', 'Q2'], [100, 'Sebastian Tolbert', 'needs'], [60, 'Jackson Lucks', 'charging'], [25, 'Jackson Lucks', 'charged']]),
    make('2', 'blue', 2, [[400, 'Cooper Mlezcko', 'charged'], [75, 'Sebastian Tolbert', 'robot', 'Q6']]),
    make('3', 'green', 3, [[500, 'Cooper Mlezcko', 'charged']]),
    make('4', 'yellow', 4, [[240, 'Jackson Lucks', 'robot', 'Q1'], [190, 'Jackson Lucks', 'needs'], [45, 'Cooper Mlezcko', 'charging']]),
    make('5', 'purple', 5, [[200, 'Sebastian Tolbert', 'needs']]),
    make('6', 'gray', 6, [[600, 'Asher Mosseri', 'charged'], [30, 'Asher Mosseri', 'retired']]),
  ];
}

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || seed();
} catch {
  state = seed();
}
if (!state.marketSeeded) seedMarket();
if (!state.scoutSeeded) seedScout();
if (!state.petsFamilySeeded) seedPetFamily();
// Someone new waiting for team management to let them in (Roster, Today).
if (!state.joinSeeded) {
  state.joinRequests = [{ id: 'riley-chen', name: 'Riley Chen', at: Date.now() - 25 * 60000 }];
  state.joinSeeded = 1;
}

// 3.2.8: older shifts for teammates who come now and then, so two of them
// (Matthew, 26 days ago, and Ira, 45) are inactive: 3 weeks with no lab time
// (functions/shared/activity.js). Not in the lab log: these are from before.
if (!state.inactiveSeeded) {
  const now = Date.now();
  const h = 3600000;
  const s = (person, days, hours, subteam) => {
    const start = now - days * 86400000 - 3 * h;
    return { id: uid(), person, start, end: start + hours * h, note: '', subteam, taskIds: [], createdBy: person };
  };
  state.shifts = [
    ...(state.shifts || []),
    s('Katarina Jurasic', 5, 2, 'Programming'),
    s('Shrey Kumar', 12, 2.5, 'CAD'),
    s('Matthew Kuehl', 26, 2, 'CAD'),
    s('Ira Kumar', 45, 1.5, 'Assembly'),
  ];
  state.inactiveSeeded = 1;
}

// Channel requests waiting for team management (the real ones are made and
// answered by functions/channels.js; the demo runs the same checks).
if (!state.channelRequestsSeeded) {
  const at = Date.now();
  const sample = (id, by, name, purpose, kind, invitees, ago) => ({
    id, name, purpose, kind, invitees, by, byUid: 'demo', at: at - ago, status: 'pending', decidedBy: '', decidedAt: null, note: '', channelId: '',
  });
  state.channelRequests = [
    ...(state.channelRequests || []),
    sample('cr-sophia', 'Sophia Bermudez', 'prototypes', 'Early sketches and ideas before we build them', 'public', [], 3 * 3600000),
    sample('cr-jackson', 'Jackson Lucks', 'driver-prep', 'Driver practice plans, only for the drive team', 'private', ['Cooper Mlezcko', 'Michael Meidan'], 40 * 60000),
  ];
  state.privateChannels = state.privateChannels || [];
  state.channelRequestsSeeded = 1;
}

// The market and pets in the demo: a few perks, Asher's dog, a shout-out, a
// perk waiting for approval and an open tournament (the real ones are made
// by team management and functions/market.js).
function seedMarket() {
  const now = Date.now();
  const day = 86400000;
  const idea = (i, extra = {}) => ({ id: `perk${i}`, ...PERK_IDEAS[i], stock: null, limit: null, per: 'season', approval: true, active: true, by: 'Asher Mosseri', at: now - 9 * day, ...extra });
  state.perks = [idea(0, { limit: 1, per: 'week' }), idea(1), idea(3, { stock: 3 }), idea(6, { approval: false, price: 30 })];
  state.purchases = [];
  state.coins = state.coins || [];
  // Each seeded buy comes with a bonus that pays for it, so nobody starts the
  // demo with fewer coins than before.
  const bonus = (to, amount, at) =>
    state.coins.push({ id: `c${uid()}`, type: 'grant', to, amount, note: 'Helped at the open house', by: 'Asher Mosseri', at: at - 60000 });
  const buy = (person, item, name, price, at, extra = {}) => {
    const id = uid();
    bonus(person, price, at);
    state.purchases.push({ id, item, kind: item.split(':')[0], name, price, person, at, ...extra });
    state.coins.push({ id: `c${id}`, ...market.spendEntry(person, item, price, name, at) });
  };
  buy('Cooper Mlezcko', 'perk:perk1', PERK_IDEAS[1].name, PERK_IDEAS[1].price, now - 3 * 3600000, { status: 'pending' });
  buy('Jackson Lucks', 'perk:perk0', PERK_IDEAS[0].name, PERK_IDEAS[0].price, now - 2 * day, { status: 'approved', decidedBy: 'Asher Mosseri', decidedAt: now - day });
  buy('Sophia Bermudez', 'extra:banner', 'Shout-out on Today', 40, now - 2 * 3600000, {
    status: 'active',
    until: now + 22 * 3600000,
    text: 'Huge thanks to the CAD crew for the new intake! 🎉',
  });
  buy('Jackson Lucks', 'extra:glow', 'Glowing messages', 25, now - 5 * 3600000, { status: 'active', until: now + 19 * 3600000 });
  state.pets = [
    {
      id: 'asher-mosseri',
      person: 'Asher Mosseri',
      species: 'dog',
      name: 'Bolt',
      adoptedAt: now - 20 * day,
      food: { v: 70, at: now - 6 * 3600000 },
      fun: { v: 45, at: now - day },
      inChat: true,
      cared: 6,
    },
    {
      id: 'jackson-lucks',
      person: 'Jackson Lucks',
      species: 'owl',
      name: 'Hoot',
      adoptedAt: now - 12 * day,
      food: { v: 60, at: now - day },
      fun: { v: 80, at: now - day },
      inChat: true,
      cared: 3,
    },
  ];
  // Pet games' best scores (functions/petgames.js), for the team boards.
  const lap = (ms, ago) => ({ ms, at: now - ago });
  state.petGames = [
    { id: 'jackson-lucks', person: 'Jackson Lucks', hop: { best: 23, at: now - day }, rally: { 1: lap(8420, 2 * day), 2: lap(12950, 2 * day), 3: lap(19310, day) } },
    { id: 'sophia-bermudez', person: 'Sophia Bermudez', hop: { best: 31, at: now - 5 * 3600000 }, rally: { 1: lap(7990, day) } },
    { id: 'cooper-mlezcko', person: 'Cooper Mlezcko', hop: { best: 12, at: now - 2 * day }, rally: {} },
  ];
  const players = {
    'Jackson Lucks': { joinedAt: now - day, best: 4200, at: now - 20 * 3600000 },
    'Sophia Bermudez': { joinedAt: now - 20 * 3600000, best: 3100, at: now - 10 * 3600000 },
    'Sebastian Tolbert': { joinedAt: now - 3 * 3600000, best: null, at: null },
  };
  state.tournaments = [
    { id: 'tour1', game: 'tetris', title: 'Friday Tetris', entry: 15, pot: 45, seed: 'demo1', better: 'high', status: 'open', opensAt: now - day, endsAt: now + 2 * day, players, winners: [], by: 'Asher Mosseri', at: now - day },
  ];
  for (const [name, p] of Object.entries(players)) {
    bonus(name, 15, p.joinedAt);
    state.coins.push({ id: `c${uid()}`, type: 'spend', person: name, amount: 15, what: 'tournament', item: 'tour:tour1', label: 'Tournament entry: Friday Tetris', at: p.joinedAt });
  }
  state.marketSeeded = 1;
}
// Scouting in the demo: a dozen teams at the demo event with standings, twenty
// scouting entries from a few people, and a short pick list.
// Pets with levels and babies (functions/shared/pets.js): Asher's dog Bolt
// gets weeks of lab time behind him, so he is a high-level pet to try the
// style sheet, a baby and giving a pet away on (the same math as the real
// app: lab time since adoption).
function seedPetFamily() {
  const now = Date.now();
  const day = 86400000;
  const hour = 3600000;
  state.petGifts = state.petGifts || [];
  const bolt = (state.pets || []).find((p) => p.person === 'Asher Mosseri');
  if (bolt) {
    bolt.adoptedAt = now - 40 * day;
    bolt.gear = { head: 'cap', face: '', neck: 'bandana', extra: '', palette: '' };
    state.shifts = [
      ...(state.shifts || []),
      ...Array.from({ length: 20 }, (_, i) => {
        const d = new Date(now - (14 + i) * day);
        d.setHours(15, 0, 0, 0);
        return { id: uid(), person: 'Asher Mosseri', start: d.getTime(), end: d.getTime() + 8 * hour, note: '', subteam: '', taskIds: [], createdBy: 'Asher Mosseri', at: d.getTime() };
      }),
    ];
  }
  state.petsFamilySeeded = 1;
}

function seedScout() {
  const now = Date.now();
  const min = 60000;
  const rows = [
    [24601, 'Les Mécaniques', 'Brooklyn, NY', [4, 0, 0, 12.5]],
    [16236, 'Gear Goblins', 'Queens, NY', [3, 1, 0, 9.5]],
    [9794, 'Cardboard Dynamics', 'Yonkers, NY', [3, 1, 0, 9]],
    [32313, 'Harry Trotters', 'Miami, FL', [2, 1, 1, 7.25]],
    [7244, 'Byte Force', 'Newark, NJ', [2, 2, 0, 6.5]],
    [19055, 'Wrench Wizards', 'Stamford, CT', [2, 2, 0, 6]],
    [11115, 'The Bolt Bunch', 'Hoboken, NJ', [2, 2, 0, 5.5]],
    [5961, 'Servo Squad', 'White Plains, NY', [1, 3, 0, 4]],
    [9773, 'Torque Titans', 'Bronx, NY', [1, 3, 0, 3.5]],
    [14270, 'Red Hot Cobalt', 'Staten Island, NY', [1, 3, 0, 3]],
    [20409, 'Loose Screws', 'Paterson, NJ', [0, 4, 0, 1.5]],
    [3491, 'Open Circuit', 'Jersey City, NJ', [0, 4, 0, 1]],
  ];
  state.scoutTeams = rows.map(([number, name, city, [w, l, t, rp]], i) => ({
    id: String(number),
    number,
    name,
    city,
    event: DEMO_EVENT,
    source: 'api',
    rank: { rank: i + 1, wins: w, losses: l, ties: t, played: w + l + t, rp, tb1: 40 + (12 - i) * 3, tb2: 80 + (12 - i) * 5 },
    notes: number === 16236 ? 'Wide drivetrain. Cycles from the left side, good partner for a team that scores in auto.' : '',
    notesBy: number === 16236 ? 'Cooper Mlezcko' : '',
    syncedAt: now - 20 * min,
  }));
  const who = ['Cooper Mlezcko', 'Jackson Lucks', 'Sebastian Tolbert', 'Katarina Jurasic', 'Sophia Bermudez'];
  const e = (team, match, [a, tp, en, r, d], tags, note, ago, by) => ({
    id: `s${uid()}`,
    team,
    match,
    ratings: { auto: a, teleop: tp, endgame: en, reliability: r, drive: d },
    tags,
    note,
    event: DEMO_EVENT,
    createdBy: by,
    createdByUid: `demo-${personId(by)}`,
    createdAt: now - ago * min,
  });
  state.scoutEntries = [
    e(24601, 'Q2', [5, 5, 4, 5, 3], ['autoScores', 'fastCycles', 'consistent'], 'Best robot we saw so far. Never missed.', 150, who[1]),
    e(24601, 'Q8', [5, 4, 5, 5, 2], ['autoScores', 'strongEndgame'], '', 80, who[0]),
    e(16236, 'Q6', [4, 4, 3, 4, 5], ['goodDefense', 'fastCycles'], 'Blocked two of ours in the middle.', 110, who[0]),
    e(16236, 'Q11', [3, 4, 3, 4, 4], ['goodDefense'], '', 60, who[2]),
    e(9794, 'Q6', [2, 4, 4, 3, 2], ['strongEndgame'], 'Slow to start but a solid finish.', 110, who[3]),
    e(9794, 'Q13', [3, 3, 4, 3, 3], [], '', 45, who[3]),
    e(7244, 'Q9', [4, 3, 2, 4, 3], ['autoScores', 'consistent'], '', 95, who[4]),
    e(7244, 'Q15', [4, 3, 3, 4, 3], ['autoScores'], '', 30, who[1]),
    e(19055, 'Q14', [1, 3, 2, 2, 2], ['penalties'], 'Two penalties for pinning.', 40, who[2]),
    e(19055, 'Q5', [2, 3, 2, 3, 3], [], '', 100, who[4]),
    e(11115, 'Q2', [2, 2, 1, 2, 2], ['brokeDown', 'tippy'], 'Lost a wheel mid-match.', 150, who[1]),
    e(11115, 'Q10', [3, 3, 2, 3, 2], [], '', 85, who[0]),
    e(5961, 'Q19', [3, 2, 3, 3, 4], ['goodDefense'], '', 20, who[0]),
    e(9773, 'Q4', [1, 2, 1, 1, 2], ['brokeDown'], 'Dead on the field for the last minute.', 125, who[2]),
    e(14270, 'Q3', [3, 4, 4, 4, 3], ['fastCycles', 'consistent'], 'Surprisingly quick for a 1-3 team.', 135, who[3]),
    e(14270, 'Q12', [3, 4, 3, 4, 3], ['fastCycles'], '', 55, who[4]),
    e(20409, 'Q7', [1, 1, 1, 2, 1], ['brokeDown'], '', 90, who[1]),
    e(3491, 'Q1', [2, 2, 3, 3, 2], [], 'Still figuring out their endgame.', 160, who[2]),
    e(3491, 'Q16', [2, 3, 3, 3, 3], ['penalties'], '', 15, who[3]),
    e(16236, 'Q17', [4, 5, 3, 4, 5], ['goodDefense', 'fastCycles', 'consistent'], 'Even better this time.', 10, who[1]),
  ];
  state.scoutPicks = { order: [24601, 16236, 14270, 9794, 7244], dont: [11115], taken: [24601], updatedBy: 'Asher Mosseri', updatedAt: now - 5 * min };
  state.scoutSeeded = 1;
}
// Tournaments that ended get paid, the way payTournaments does it.
function settleDemoTournaments(now = Date.now()) {
  let changed = false;
  for (const t of state.tournaments || []) {
    if (t.status !== 'open' || t.endsAt > now || market.reviewHolds(t, now)) continue;
    settleDemoTournament(t, now, false);
    changed = true;
  }
  return changed;
}
// The app's balances, from the last market call (the server reads them
// fresh), so payouts stop at a googol like capPays does there.
let demoBalanceOf = null;
function settleDemoTournament(t, now, cancel, by = '', del = false) {
  const r0 = cancel ? { winners: [], pays: [], refunds: Object.keys(t.players || {}).map((name) => ({ name, amount: t.entry })) } : market.payoutOf(t);
  const have = demoBalanceOf ? Object.fromEntries([...r0.pays, ...r0.refunds].map((p) => [p.name, demoBalanceOf(p.name)])) : {};
  const r = { ...r0, pays: market.capPays(r0.pays, have), refunds: market.capPays(r0.refunds, have) };
  state.coins = state.coins || [];
  for (const p of r.pays)
    for (const amount of market.payParts(p))
      state.coins.push({ id: `c${uid()}`, type: 'prize', person: p.name, amount, what: 'tournament', label: market.prizeLabel(t), item: `tour:${t.id}`, at: now });
  for (const p of r.refunds) state.coins.push({ id: `c${uid()}`, ...market.refundEntry(p.name, p.amount, t.title, `tour:${t.id}`, now) });
  Object.assign(t, { status: 'done', winners: r.winners, paid: r.pays.map(({ parts: _p, ...x }) => x), paidAt: now, ...(cancel && { cancelled: true, cancelledBy: by }), ...(cancel && del && { deleted: true, deletedBy: by, deletedAt: now }) });
}

// A finished tournament game, the way recordTournamentRun saves it: the
// player's best, or a run held for review (too fast for a person).
function recordDemoRun(s, me, r, score, problem, review, now) {
  const note = (title, body = '') => ({ note: { title, body } });
  Object.assign(s, { done: true, finishedAt: now, result: r, score, problem, review: review || null });
  commit();
  const t = (state.tournaments || []).find((x) => x.id === s.tournament);
  if (problem) return note(problem);
  if (!t?.players?.[me] || t.status !== 'open') return note('That tournament is over.');
  if (t.players[me].voided) return note('Your result in this tournament was voided.', 'Team management voided it, so new games don’t count.');
  const before = t.players[me].best ?? null;
  const text = fun.tournamentText(s.game, score);
  const id = Object.keys(state.funGames || {}).find((k) => state.funGames[k] === s);
  if (review) {
    t.review = { ...(t.review || {}), [id]: { name: me, score, at: now, why: review } };
    commit();
    return { ok: true, score, best: before, improved: false, held: true, why: review, text, bestText: fun.tournamentText(s.game, before) };
  }
  const improved = fun.beats(fun.betterOf(t), score, before);
  const best = improved ? score : before;
  if (improved) t.players = { ...t.players, [me]: { ...t.players[me], best, at: now } };
  commit();
  return { ok: true, score, best, improved, text, bestText: fun.tournamentText(s.game, best) };
}

// Team life (demoLife.js): bingo, predictions, streak coins, the weekly recap.
const life = demoLife({ get: () => state, commit: () => commit(), uid });
life.seedSamples();

// Team events and the pet park (demoEvents.js): a running event with progress.
const events = demoEvents({ get: () => state, commit: () => commit(), uid });
const petPhotos = demoPetPhotos({ get: () => state, commit: () => commit(), uid });
events.seedSamples();
// 3.2: one of the new pets in the park (Cooper had none). The food values are
// stored as of a day ago, like the other sample pets.
if (!state.pets32Seeded) {
  const at = Date.now() - 9 * 86400000;
  const fed = Date.now() - 86400000;
  if (!(state.pets || []).some((p) => p.person === 'Cooper Mlezcko'))
    state.pets = [
      ...(state.pets || []),
      {
        id: 'cooper-mlezcko',
        person: 'Cooper Mlezcko',
        species: 'goldendoodle',
        name: 'Waffles',
        adoptedAt: at,
        food: { v: 85, at: fed },
        fun: { v: 90, at: fed },
        inChat: true,
        cared: 1,
        gear: { head: '', face: '', neck: 'bandana', body: '', extra: '', palette: '' },
        babyBorn: false,
      },
    ];
  state.pets32Seeded = 1;
}
// Loans (demoLoans.js): the same checks as functions/loans.js.
const loans = demoLoans({ get: () => state, commit: () => commit(), uid });
// Gambling buddy (demoBuddy.js): the same decisions as functions/buddy.js.
const buddies = demoBuddy({ get: () => state, commit: () => commit(), uid });

// Refunds on game cards (ownerRefund, disputeDecide): the person's history
// line for the card, and the card's "Refunded by Asher" tag, like the server.
function demoLine({ who, conv, msgId, game, net, cardAt }) {
  const recent = (state.bank || {})[who]?.recent || [];
  const note = (title, body = '') => ({ note: { title, body } });
  if (recent.some((x) => x.hold === msgId)) return { problem: note('Their bet in that game is still held.', 'Finish or cancel the game first.') };
  const { line } = dispute.cardLine(recent, { conv, msgId, game, net, cardAt });
  if (line?.card && line.amount !== net) return { problem: note('The card and their coin history don’t match.', 'Nothing was changed. Check it by hand.') };
  if (!line) return { reverses: '' };
  const key = dispute.lineKey(line);
  if ((state.coins || []).some((x) => x.reverses === key && (x.to === who || x.person === who)))
    return { problem: note('Already reversed in their coin history.', 'That line was put right from Coins. Nothing more to do.') };
  return { reverses: key };
}
// A handled casino report: the owner's "X reported a … result" notification
// goes away (by its report id; older ones by who sent it and when).
function clearReportNote(x) {
  state.inbox = (state.inbox || []).filter(
    (n) => !(n.type === 'dispute' && (n.report === x.id || (!n.report && /reported a/.test(n.title || '') && Math.abs((n.at || 0) - (x.at || 0)) < 120000 && n.title.startsWith(x.by.split(' ')[0])))),
  );
}
// Who's watching the move to #arcade (the owner's Controls screen).
const moveWatchers = new Set();
function demoTag(conv, msgId, tag) {
  const list = (state.chat || {})[conv] || [];
  const k = personId(tag.name);
  state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === msgId ? { ...x, cmd: { ...x.cmd, adjust: { ...(x.cmd.adjust || {}), [k]: tag } } } : x)) };
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep in memory */
  }
  // Tests: localStorage 'demo-snap-lag' ("1000-3000", ms) shows changes that
  // late, like a slow connection's snapshots coming after the play answer.
  const lag = snapLag();
  if (lag) return setTimeout(() => listeners.forEach((fn) => fn()), lag);
  for (const fn of listeners) fn();
}
function snapLag() {
  try {
    const [a, b = a] = (localStorage.getItem('demo-snap-lag') || '').split('-').map(Number);
    return a > 0 ? a + Math.random() * (b - a) : 0;
  } catch {
    return 0;
  }
}

function listen(fn) {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

// Learn in demo mode (demoLearn.js plays from demo-only sample questions).
const learn = demoLearn(() => state, commit, listen);
learn.ensureDaily();

// A shiftEdits record (the same shape firebaseStore.js writes).
function addShiftEdit(shift, kind, after, actor, at, requestId) {
  const edit = {
    id: uid(),
    shiftId: shift.id,
    person: shift.person,
    kind,
    by: actor.name,
    at,
    before: shift.start != null ? { start: shift.start, end: shift.end ?? null } : null,
    after,
    ...(requestId ? { requestId } : {}),
  };
  state.shiftEdits = [edit, ...(state.shiftEdits || [])].slice(0, 200);
}

// The server asks the scheduled lab check-in (functions/index.js
// scheduledCheckin); the demo asks it when the app opens, on the same days.
function demoScheduledCheckin() {
  const s = state.settings?.checkinSchedule;
  if (!s?.on || !(s.slots || []).length) return;
  const today = teamDay(Date.now());
  if (!asksOn(s, today) || Date.now() < teamMidnight(today) + clockMs(s.time)) return;
  if ((state.checkins || []).some((c) => c.date === today)) return;
  state.checkins = [
    ...(state.checkins || []),
    { id: `auto-${today}`, date: today, question: s.question || 'Who’s going to the lab today?', ...scheduledCheckinFields(s, today), answers: {}, by: s.by || 'Team management', auto: true, at: Date.now() },
  ];
  commit();
}
const clockMs = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60000;
};

// Fridays at 6 PM, like the real draw (local time in the demo).
function nextFridayLocal(now) {
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d.getTime();
}
// Change fields on a command card's cmd (the open lottery card).
// Earnings that grow with the balance (3.2, shared/coins.js EARN_SCALE): the
// app's own wallets (Workspace hands them over with useWallets), the lowest
// balance in the last day, as on the server.
let demoWallet = null;
const demoLow = (name, now = Date.now()) => {
  try {
    return demoWallet ? earnBalance(demoWallet(name).history, now) : 0;
  } catch {
    return 0;
  }
};

// Coins from games and quizzes, the way functions/award.js pays them: each
// source capped per person per team day, and a key pays only once.
function demoAward({ person, amount, source, label = '', key = '' }, now = Date.now()) {
  const want = Math.floor(Number(amount) || 0);
  const cap = AWARD_CAPS[source] || 0;
  if (!person || want <= 0 || !cap) return 0;
  const keys = state.awardKeys || {};
  if (key && keys[key]) return 0;
  const day = teamDay(now);
  // The cap counts normal coins; a big balance pays more for them (3.2).
  const sofar = (state.coins || [])
    .filter((x) => x.type === 'award' && x.person === person && x.source === source && x.day === day)
    .reduce((t, x) => t + (x.base ?? x.amount ?? 0), 0);
  const base = Math.min(want, Math.max(0, cap - sofar));
  if (!base) return 0;
  const pay = scaledPay(source, base, demoLow(person, now));
  state.coins = [
    ...(state.coins || []),
    { id: uid(), type: 'award', person, amount: pay, ...(pay !== base && { base }), source, label: String(label).slice(0, 80), day, at: now },
  ];
  if (key) state.awardKeys = { ...keys, [key]: { person, source, day, at: now } };
  return pay;
}
// Returns { name: paid } for prizes the daily limit cut short (shown on the card).
const payDemoAwards = (awards, msgId, now) => {
  const cut = {};
  for (const a of awards || []) {
    const paid = demoAward({ ...a, source: 'game', key: `game-${msgId}-${personId(a.person)}` }, now);
    if (paid < a.amount) cut[a.person] = paid;
  }
  return cut;
};
// Demo mode's own few /trivia questions and /hangman words. The real ones
// stay on the server (functions/banks/arcade.js), out of the app.
const DEMO_ARCADE = {
  trivia: [
    ['How long is the autonomous period of an FTC match?', '30 seconds', '15 seconds', '45 seconds', '1 minute'],
    ['What does CAD stand for?', 'Computer-aided design', 'Custom assembly drawing', 'Calibrated axis drive', 'Coded arm design'],
    ['Which tool measures a part’s thickness most precisely?', 'Calipers', 'A tape measure', 'A ruler', 'A square'],
    ['What does a motor encoder count?', 'How far the shaft turned', 'The battery’s voltage', 'The motor’s temperature', 'The robot’s weight'],
  ],
  words: [
    ['ALLEN KEY', 'Tool'],
    ['GYROSCOPE', 'Sensor'],
    ['SPROCKET', 'Part'],
    ['AUTONOMOUS', 'Match'],
  ],
};

function setCard({ conv, id }, fields) {
  const list = state.chat?.[conv];
  if (!list) return;
  state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === id ? { ...x, cmd: { ...x.cmd, ...fields } } : x)) };
}

let reminderTimer = null;
function startReminders() {
  if (reminderTimer) return;
  const tick = () => {
    const now = Date.now();
    const due = (state.reminders || []).filter((r) => r.at <= now);
    if (!due.length) return;
    state.reminders = state.reminders.filter((r) => r.at > now);
    state.inbox = [
      ...due.map((r) => ({
        id: uid(),
        type: 'reminder',
        icon: '⏰',
        title: 'Reminder',
        body: r.text,
        open: r.conv ? `chat:${r.conv}` : '',
        at: now,
        read: false,
      })),
      ...(state.inbox || []),
    ];
    commit();
  };
  tick();
  reminderTimer = setInterval(tick, 5000);
}
if ((state.reminders || []).length) startReminders();

// Tests (scripts/test-no-shift.mjs): other people busy in a demo chat while
// you play. demo-post { conv, m } adds a message from someone else at the end;
// demo-edit { conv, id, patch } changes one that's there (a reaction, their
// game card moving on). localStorage 'demo-lag' (ms) answers game moves like a
// server a phone's round trip away; 'demo-no-card' leaves the card out of a
// casino move's answer (like the server before 3.1.1).
if (typeof window !== 'undefined') {
  window.addEventListener('demo-post', (e) => {
    const { conv, m } = e.detail || {};
    if (!conv || !m?.by) return;
    const msg = { id: uid(), text: '', mentions: [], taskIds: [], replyTo: null, reactions: {}, at: Date.now(), ...m };
    state.chat = { ...(state.chat || {}), [conv]: [...((state.chat || {})[conv] || []), msg] };
    commit();
  });
  window.addEventListener('demo-edit', (e) => {
    const { conv, id, patch } = e.detail || {};
    const list = (state.chat || {})[conv];
    if (!list || !patch) return;
    state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    commit();
  });
}
const demoLag = () => {
  try {
    const ms = Number(localStorage.getItem('demo-lag')) || 0;
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : null;
  } catch {
    return null;
  }
};

// Who counts as on the team in the demo (the starting roster and anyone added).
const demoNames = () => [...new Set([...ROSTER, ...(state.roles || []).filter((r) => r.name && !r.removed).map((r) => r.name)])];

export const demoStore = {
  ...learn,
  mode: 'demo',

  onAuth(cb) {
    cb({ uid: 'demo' });
    return () => {};
  },
  async getMember() {
    // ?demo=member previews the app as a regular teammate; ?demo=signin shows
    // the sign-in screen (Asher "has" a password there, everyone else makes one);
    // ?demo=pending, a new name waiting for team management to let it in;
    // ?demo=manager, Sebastian: team management, but not the owner.
    const as = new URLSearchParams(location.search).get('demo');
    if (as === 'signin' && !sessionStorage.getItem('demo-signed-in')) return null;
    // Removed from the team (the preview's stand-in for the server deleting this device's sign-in).
    if (localStorage.getItem('demo-removed') === '1') return null;
    if (as === 'pending') return { name: 'Riley Chen', admin: false, via: 'password', pending: true };
    if (as === 'manager') return { name: 'Sebastian Tolbert', admin: true, via: 'password' };
    // ?demo=newapp: an old Home Screen app still signed in with the team code
    // (Cooper, no password yet); ?demo=newapp-pw: Asher, who has one;
    // ?demo=newapp-offline: the server can't be reached.
    if (as === 'newapp' || as === 'newapp-offline') return { name: 'Cooper Mlezcko', admin: false, via: '' };
    if (as === 'newapp-pw') return { name: 'Asher Mosseri', admin: true, via: '' };
    const asMember = as === 'member';
    return asMember ? { name: 'Cooper Mlezcko', admin: false, via: 'password' } : { name: 'Asher Mosseri', admin: true, via: 'password' };
  },
  // Says so when this device's sign-in is gone: a test sets demo-removed in
  // localStorage and sends a demo-member-check event (or reopens the app).
  subscribeMember(uid, cb) {
    const check = () => localStorage.getItem('demo-removed') === '1' && cb(null, { cached: false });
    check();
    window.addEventListener('demo-member-check', check);
    return () => window.removeEventListener('demo-member-check', check);
  },
  forgetDevice() {},
  subscribeJoinRequests(cb) {
    return listen(() => cb([...(state.joinRequests || [])]));
  },
  async account({ action, name, password }) {
    if (new URLSearchParams(location.search).get('demo') === 'newapp-offline')
      throw new Error('Can’t reach the server right now. Try again in a minute.');
    // Letting a new name in puts them on the Roster; turning them away just
    // drops the request (the way functions/index.js does it). addedAt stands
    // in for the people doc the server writes (when they joined, activity.js).
    if (action === 'approve' || action === 'turnAway') {
      state.joinRequests = (state.joinRequests || []).filter((r) => r.name !== name);
      if (action === 'approve')
        state.roles = [...(state.roles || []).filter((r) => r.id !== personId(name)), { id: personId(name), name, removed: false, addedAt: Date.now(), updatedAt: Date.now(), updatedBy: REQUESTS_TO }];
      commit();
      return { ok: true };
    }
    if (action === 'answerReset') {
      state.resetRequest = null;
      commit();
      return { ok: true };
    }
    if (action === 'reset') {
      state.resetRequest = { name, by: 'Asher Mosseri', at: Date.now() };
      commit();
      return { ok: true, asked: true };
    }
    if (action === 'status' && !name) return { member: null, ...(localStorage.getItem('demo-removed') === '1' && { removed: true }) };
    if (action === 'status')
      return { hasPassword: name === 'Asher Mosseri', thisDevice: new URLSearchParams(location.search).get('demo')?.startsWith('newapp') === true };
    if (action === 'signIn' && password !== 'trotters1') return { error: 'That password isn’t right.' };
    if (action === 'signIn' || action === 'create') {
      sessionStorage.setItem('demo-signed-in', '1');
      localStorage.removeItem('demo-removed');
      return { ok: true, member: { name, admin: name === 'Asher Mosseri', via: 'password' } };
    }
    if (action === 'list')
      return { accounts: ['Asher Mosseri', 'Sebastian Tolbert', 'Cooper Mlezcko'].map((name, i) => ({ name, hasPassword: i < 2, setAt: Date.now() - 864e5, lastSignIn: Date.now() - i * 36e5 })) };
    return { ok: true };
  },
  async saveSetupTicket() {},
  subscribeResetRequest(name, cb) {
    return listen(() => cb(state.resetRequest?.name === name ? state.resetRequest : null));
  },
  async leave() {
    localStorage.removeItem(KEY);
    location.search = '';
  },
  subscribeInbox(name, cb) {
    // Pet offers carry who they are for; the rest is one shared inbox.
    return listen(() => cb([...(state.inbox || [])].filter((n) => !n.to || n.to === name).sort((a, b) => b.at - a.at)));
  },
  async markInboxRead(name, ids) {
    state.inbox = (state.inbox || []).map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
    commit();
  },
  async clearInbox(name, ids) {
    state.inbox = (state.inbox || []).filter((n) => !ids.includes(n.id));
    commit();
  },
  pushStatus: () => 'demo',
  async enablePush() {
    return 'demo';
  },
  async disablePush() {
    return 'demo';
  },
  async refreshPush() {},

  subscribePeople(cb) {
    return listen(() => cb([...(state.people || [])]));
  },

  subscribeTasks(cb) {
    return listen(() => cb(state.tasks.map((t) => ({ ...t }))));
  },

  async createTask(data, actor) {
    const now = Date.now();
    const task = {
      id: uid(),
      ...newTaskDefaults(data),
      createdAt: now,
      createdBy: actor.name,
      updatedAt: now,
      updatedBy: actor.name,
      completedAt: data.status === 'done' ? now : null,
    };
    state.tasks.push(task);
    state.activity[task.id] = [{ id: uid(), type: 'created', by: actor.name, at: now }];
    commit();
    return task.id;
  },

  async updateTask(id, patch, actor, prev) {
    const changes = describeChanges(prev, patch);
    if (!changes.length) return;
    const now = Date.now();
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, ...patch, ...derivedFields(prev, patch, now), updatedAt: now, updatedBy: actor.name } : t,
    );
    const log = (state.activity[id] ||= []);
    for (const c of changes) log.push({ id: uid(), ...c, by: actor.name, at: now });
    commit();
  },

  async trashTask(id, actor, restore = false) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, deletedAt: restore ? null : Date.now(), deletedBy: restore ? '' : actor.name } : t,
    );
    (state.activity[id] ||= []).push({
      id: uid(),
      type: 'change',
      field: 'deleted',
      to: restore ? 'restored' : 'deleted',
      by: actor.name,
      at: Date.now(),
    });
    commit();
  },
  async deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    delete state.activity[id];
    commit();
  },

  // Demo keeps only the thumbnail, as a data URL, so localStorage doesn't fill up.
  async addTaskPhoto(taskId, { thumb, width, height }, actor) {
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(thumb);
    });
    const photo = { id: uid(), url: dataUrl, thumbUrl: dataUrl, width, height, by: actor.name, at: Date.now() };
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t));
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'change', field: 'photos', to: 'added', by: actor.name, at: Date.now() });
    commit();
  },
  async removeTaskPhoto(taskId, photo, actor) {
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, photos: (t.photos || []).filter((p) => p.id !== photo.id) } : t));
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'change', field: 'photos', to: 'removed', by: actor.name, at: Date.now() });
    commit();
  },

  subscribeActivity(taskId, cb) {
    return listen(() => cb([...(state.activity[taskId] || [])]));
  },

  async addComment(taskId, text, actor) {
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'comment', text, by: actor.name, at: Date.now() });
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t));
    commit();
  },

  subscribeMilestones(cb) {
    return listen(() => cb([...(state.milestones || [])]));
  },
  async createMilestone(data, actor) {
    const now = Date.now();
    const ms = { id: uid(), ...newMilestoneDefaults(data), createdAt: now, createdBy: actor.name, updatedAt: now, updatedBy: actor.name };
    state.milestones = [...(state.milestones || []), ms];
    commit();
    return ms.id;
  },
  async updateMilestone(id, patch, actor) {
    state.milestones = state.milestones.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now(), updatedBy: actor.name } : m));
    commit();
  },
  async deleteMilestone(id, taskIds) {
    state.milestones = state.milestones.filter((m) => m.id !== id);
    state.tasks = state.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, milestoneId: '' } : t));
    commit();
  },

  subscribeRoles(cb) {
    return listen(() => cb([...(state.roles || [])]));
  },
  async saveRole(id, data, actor) {
    state.roles = [...(state.roles || []).filter((r) => r.id !== id), { id, ...data, updatedAt: Date.now(), updatedBy: actor.name }];
    commit();
  },

  async mergeRenames(map) {
    state.renames = { ...(state.renames || {}), ...map };
    commit();
  },
  subscribeNames(cb) {
    return listen(() => cb({ ...(state.renames || {}) }));
  },
  async renamePerson(oldName, newName, { renames, tasks, milestones, role }, actor) {
    const swap = (list) => list.map((n) => (n === oldName ? newName : n));
    state.dms = (state.dms || []).map((d) => ({ ...d, people: swap(d.people) }));
    const taskIds = new Set(tasks.map((t) => t.id));
    const msIds = new Set(milestones.map((m) => m.id));
    state.renames = { ...(state.renames || {}), ...renames };
    state.tasks = state.tasks.map((t) => (taskIds.has(t.id) ? { ...t, assignees: swap(t.assignees) } : t));
    state.milestones = state.milestones.map((m) => (msIds.has(m.id) ? { ...m, owners: swap(m.owners) } : m));
    state.roles = [
      ...(state.roles || []).filter((r) => r.id !== personId(oldName) && r.id !== personId(newName)),
      { id: personId(newName), ...role, name: newName, removed: false, updatedBy: actor.name },
    ];
    commit();
  },

  subscribeSettings(cb) {
    return listen(() => cb({ ...(state.settings || {}) }));
  },
  async saveSettings(patch) {
    state.settings = { ...(state.settings || {}), ...patch };
    commit();
  },
  // Like the real store: settings/team.inactive, one entry per person.
  async setActiveMode(id, entry) {
    const inactive = { ...(state.settings?.inactive || {}) };
    if (entry) inactive[id] = entry;
    else delete inactive[id];
    state.settings = { ...(state.settings || {}), inactive };
    commit();
  },
  async saveAdSettings(ads) {
    state.settings = { ...(state.settings || {}), ads };
    commit();
  },
  subscribeAdStats(cb) {
    return listen(() => cb({ ...(state.adStats || {}) }));
  },
  subscribeAdPeople(cb) {
    return listen(() => cb({ ...(state.adPeople || {}) }));
  },
  async bumpAdStats(counts, name) {
    if (name) {
      const was = (state.adPeople || {})[name] || { name, views: 0, taps: 0 };
      const add = (k) => Object.values(counts).reduce((t, c) => t + (c[k] || 0), 0);
      state.adPeople = { ...(state.adPeople || {}), [name]: { name, views: was.views + add('views'), taps: was.taps + add('taps') } };
    }
    const stats = { ...(state.adStats || {}) };
    for (const [id, c] of Object.entries(counts)) {
      const was = stats[id] || { views: 0, taps: 0 };
      stats[id] = { views: was.views + (c.views || 0), taps: was.taps + (c.taps || 0) };
    }
    state.adStats = stats;
    commit();
  },
  subscribeCoins(cb) {
    return listen(() => cb([...(state.coins || [])]));
  },
  async addCoinTx(tx) {
    state.coins = [
      ...(state.coins || []),
      { ...tx, id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: Date.now() },
    ];
    commit();
  },
  async deleteCoinTx(id) {
    state.coins = (state.coins || []).filter((x) => x.id !== id);
    commit();
  },
  // The market and pets, run here the way functions/market.js runs them,
  // with the same checks (shared/market.js, shared/pets.js).
  subscribePerks(cb) {
    return listen(() => cb([...(state.perks || [])]));
  },
  async savePerk(id, data, actor) {
    const now = Date.now();
    state.perks = id
      ? (state.perks || []).map((p) => (p.id === id ? { ...p, ...data, by: actor.name, updatedAt: now } : p))
      : [...(state.perks || []), { id: `perk${uid()}`, ...data, by: actor.name, at: now }];
    commit();
  },
  async deletePerk(id) {
    state.perks = (state.perks || []).filter((p) => p.id !== id);
    commit();
  },
  subscribePurchases(cb) {
    return listen(() => cb([...(state.purchases || [])]));
  },
  subscribePets(cb) {
    return listen(() => cb([...(state.pets || [])]));
  },
  subscribePetGifts(name, cb) {
    return listen(() => cb((state.petGifts || []).filter((g) => g.from === name || g.to === name).map((g) => ({ ...g }))));
  },
  // Team events (functions/petevents.js, demoEvents.js here).
  subscribePetEvents(cb) {
    return listen(() => cb((state.petEvents || []).map((e) => ({ ...e }))));
  },
  subscribePetUnlocks(cb) {
    return listen(() => cb((state.petUnlocks || []).map((u) => ({ ...u }))));
  },
  async petEvent(req, actor) {
    return events.petEvent(req, actor);
  },
  // Best scores in the pet games (functions/petgames.js does the same).
  subscribePetGames(cb) {
    return listen(() => cb((state.petGames || []).map((d) => ({ ...d }))));
  },
  // Photos of real pets (demoPetPhotos.js).
  subscribePetPhotos(cb) {
    return petPhotos.subscribeLive(listen, cb);
  },
  subscribePetPhotoRequests(actor, names, cb) {
    return petPhotos.subscribeRequests(listen, actor, cb);
  },
  uploadPetPhoto(blob) {
    return petPhotos.upload(blob);
  },
  subscribeTournaments(cb) {
    const tick = () => settleDemoTournaments() && commit();
    tick();
    const t = setInterval(tick, 15000);
    const off = listen(() => cb((state.tournaments || []).map((x) => ({ ...x }))));
    return () => {
      clearInterval(t);
      off();
    };
  },
  // fn: 'buy' | 'joinTournament' | 'marketManage' | 'pet'. balanceOf: the
  // person's coins from the app's wallet (the server reads them fresh).
  async market(fn, data = {}, actor, { balanceOf, coinsOff = false }) {
    const me = actor.name;
    const now = Date.now();
    const note = (title, body = '') => ({ note: { title, body } });
    const done = (r) => (commit(), r);
    const myPet = () => (state.pets || []).find((p) => p.person === me);
    demoBalanceOf = balanceOf;
    // Turning your own chat extra off or back on (functions/market.js extraSwitch): no coins move.
    if (fn === 'buy' && data.action === 'extraSwitch') {
      const p = (state.purchases || []).find((x) => x.id === data.id) || null;
      const on = data.on === true;
      const r = market.extraSwitchCheck(p, on, { aliases: [me], now, purchases: (state.purchases || []).filter((x) => x !== p && x.item === p?.item) });
      if (r.error) return note(r.error, r.body);
      if (r.patch) {
        const { pausedAt, ...rest } = r.patch;
        Object.assign(p, rest, pausedAt == null ? {} : { pausedAt });
        if (pausedAt == null) delete p.pausedAt;
      }
      return done({ ok: true, on, changed: !r.same });
    }
    if (coinsOff && (fn === 'buy' || fn === 'joinTournament')) return note('🪙 Jackson coins are off right now.');
    // An overdue loan locks buying (functions/market.js does the same).
    const lock = fn === 'buy' || fn === 'joinTournament' ? loans.lockFor(me, balanceOf) : null;
    if (lock) return note(lock.title, lock.body);

    if (fn === 'buy') {
      const item = String(data.item || '');
      const [kind, id] = item.split(/:(.*)/s);
      const r = market.buyCheck(item, {
        me,
        balance: balanceOf(me),
        now,
        pet: kind === 'pet' ? petsIn(myPet())[data.born == null ? 0 : petsIn(myPet()).findIndex((p) => p.adoptedAt === Number(data.born))] || null : null,
        perk: kind === 'perk' ? (state.perks || []).find((p) => p.id === id) || null : null,
        purchases: (state.purchases || []).filter((p) => p.item === item),
        text: data.text,
      });
      if (r.error) return note(r.error, r.body);
      state.coins = [...(state.coins || []), { id: `c${uid()}`, ...market.spendEntry(me, item, r.price, r.label, now) }];
      let purchase = null;
      if (r.purchase) {
        purchase = { id: uid(), ...r.purchase };
        state.purchases = [...(state.purchases || []), purchase];
        // The demo's one inbox stands in for team management's.
        if (purchase.kind === 'perk' && !actor.admin)
          state.inbox = [
            {
              id: uid(),
              type: 'market',
              icon: '🛍️',
              title: `${me.split(' ')[0]} bought “${purchase.name}”`,
              body: purchase.status === 'pending' ? 'Approve or decline it in the Market.' : 'Mark it done in the Market once it happens.',
              open: 'view:market',
              at: now,
              read: false,
            },
            ...(state.inbox || []),
          ];
      }
      if (r.pet)
        state.pets = state.pets.map((p) => {
          if (p.person !== me) return p;
          const list = petsIn(p);
          const at = data.born == null ? 0 : list.findIndex((x) => x.adoptedAt === Number(data.born));
          return { ...withPet(p, at, { ...r.pet, cared: (list[at].cared || 0) + 1, caredAt: now }), id: p.id };
        });
      return done({ ok: true, price: r.price, purchase, pet: r.pet || null });
    }

    if (fn === 'joinTournament') {
      const t = (state.tournaments || []).find((x) => x.id === data.id);
      const r = market.joinCheck(t, { me, balance: balanceOf(me), now });
      if (r.error) return note(r.error);
      state.coins = [
        ...(state.coins || []),
        { id: `c${uid()}`, type: 'spend', person: me, amount: t.entry, what: 'tournament', item: `tour:${t.id}`, label: `Tournament entry: ${t.title}`.slice(0, 80), at: now },
      ];
      t.pot = r.pot;
      t.players = { ...(t.players || {}), [me]: r.player };
      return done({ ok: true, pot: r.pot });
    }

    if (fn === 'marketManage') {
      if (!actor.admin) return note('Team management only.');
      const { action, id } = data;
      if (action === 'decide') {
        const p = (state.purchases || []).find((x) => x.id === id);
        const d = market.decideCheck(p, data.status);
        if (d.error) return note(d.error);
        Object.assign(p, { status: d.status, decidedBy: me, decidedAt: now });
        if (d.refund) state.coins = [...(state.coins || []), { id: `c${uid()}`, ...market.refundEntry(p.person, p.price, p.name, p.item, now) }];
        return done({ ok: true, status: d.status });
      }
      if (action === 'removeBanner') {
        const p = (state.purchases || []).find((x) => x.id === id && x.item === 'extra:banner');
        if (!p) return note('That shout-out is gone.');
        Object.assign(p, { status: 'removed', removedBy: me, removedAt: now });
        return done({ ok: true });
      }
      if (action === 'createTournament') {
        const t = market.newTournament(data, { by: me, now, seed: uid() });
        if (t.error) return note(t.error);
        const tid = `tour${uid()}`;
        state.tournaments = [...(state.tournaments || []), { id: tid, ...t }];
        return done({ ok: true, id: tid });
      }
      // The same as functions/market.js: cancel (and with delete, off the
      // list too), or delete one that's cancelled or finished.
      const deleteOne = (t) => {
        const d = market.deleteCheck(t);
        if (d.error) return note(d.error);
        if (!d.same) Object.assign(t, { deleted: true, deletedBy: me, deletedAt: now });
        return done({ ok: true, changed: !d.same });
      };
      if (action === 'cancelTournament') {
        const t = (state.tournaments || []).find((x) => x.id === id);
        const del = data.delete === true;
        if (t?.status === 'open') {
          settleDemoTournament(t, now, true, me, del);
          return done({ ok: true });
        }
        return del ? deleteOne(t || null) : note('That tournament is already over.');
      }
      if (action === 'deleteTournament') return deleteOne((state.tournaments || []).find((x) => x.id === id) || null);
      if (action === 'voidResult') {
        const t = (state.tournaments || []).find((x) => x.id === id);
        const p = t?.players?.[data.name];
        if (!t || t.cancelled) return note('That tournament is gone.');
        if (!p) return note('They’re not in that tournament.');
        if (p.voided) return note('Already voided.');
        t.players = { ...t.players, [data.name]: { ...p, voided: { by: me, at: now, afterPayout: t.status === 'done' } } };
        t.review = Object.fromEntries(Object.entries(t.review || {}).filter(([, r]) => r.name !== data.name));
        return done({ ok: true });
      }
      if (action === 'review') {
        const t = (state.tournaments || []).find((x) => x.id === id);
        const r = t?.review?.[data.run];
        if (!r) return note('That run was already checked.');
        t.review = Object.fromEntries(Object.entries(t.review).filter(([k]) => k !== data.run));
        const best = data.clear === true && t.status === 'open' ? market.clearedBest(t, r) : null;
        if (best) t.players = { ...t.players, [r.name]: { ...t.players[r.name], ...best } };
        const g = (state.funGames || {})[data.run];
        if (g) Object.assign(g, { review: data.clear === true ? 'cleared' : 'voided', reviewedBy: me, reviewedAt: now });
        return done({ ok: true, counted: !!best });
      }
      return note('Unknown action.');
    }

    if (fn === 'pet' && PHOTO_ACTIONS.includes(data.action)) return petPhotos.run(data, actor);

    // A best score in the pet games: the same checks as functions/petgames.js.
    if (fn === 'pet' && data.action === 'gameScore') {
      const score = cleanScore(data);
      if (score.note) return score;
      const list = state.petGames || (state.petGames = []);
      const had = list.find((d) => d.person === me) || null;
      const r = scoreAfter(had, score, { me, now });
      if (r.note) return r;
      if (r.better) state.petGames = [...list.filter((d) => d.person !== me), { id: personId(me), ...r.doc }];
      return done({ ok: true, better: r.better });
    }

    if (fn === 'pet') {
      // The same moves as functions/petfamily.js, on the demo's own docs.
      const docOfName = (n) => (state.pets || []).find((p) => p.person === n) || null;
      const putDoc = (n, doc) => {
        state.pets = (state.pets || []).filter((p) => p.person !== n);
        if (!doc) return;
        // docOf already leaves ids off the pets after the first.
        state.pets.push({ ...doc, id: personId(n) });
      };
      const tell = (to, title, body) => {
        state.inbox = [{ id: uid(), type: 'market', icon: '🐾', title, body, open: 'view:market', at: now, read: false, to }, ...(state.inbox || [])];
      };
      const first = (n) => (n || '').split(' ')[0];
      const gifts = state.petGifts || (state.petGifts = []);
      const action = data.action;
      if (['adopt', 'rename', 'inChat', 'release', 'style', 'hatch'].includes(action)) {
        // Event gear counts only for whoever earned it (petUnlocks, like the server).
        const earned = earnedIds((state.petUnlocks || []).find((u) => u.person === me));
        const r = petEdit(action, data, { me, doc: docOfName(me), shifts: state.shifts || [], earned, now });
        if (r.unknown) return note('Unknown action.');
        if (r.note) return r;
        putDoc(me, r.doc);
        return done({ ok: true, ...(r.born && { born: r.born }) });
      }
      if (action === 'offer') {
        const to = ROSTER.find((n) => sameName(n, cleanName(data.to))) || cleanName(data.to);
        const r = giftOffer(data, {
          me,
          doc: docOfName(me),
          to,
          toOk: ROSTER.includes(to),
          gifts: gifts.filter((g) => g.from === me),
          shifts: state.shifts || [],
          now,
        });
        if (r.note) return r;
        const gift = { id: uid(), ...r.gift };
        gifts.push(gift);
        tell(gift.to, `${first(me)} wants to give you ${gift.pet.name}`, `A ${gift.pet.species}. Open Market, Pets to say yes or no thanks.`);
        return done({ ok: true, id: gift.id });
      }
      if (action === 'cancelOffer' || action === 'decline' || action === 'accept') {
        const gift = gifts.find((g) => g.id === data.id) || null;
        if (action !== 'accept') {
          const r = giftEnd(action === 'decline' ? 'decline' : 'cancel', gift, { me, now });
          if (r.status) Object.assign(gift, { status: r.status, decidedAt: now });
          if (r.note) return done(r);
          if (r.status === 'declined') tell(gift.from, `${first(me)} said no thanks`, `${gift.pet.name} stays with you.`);
          return done({ ok: true });
        }
        if (!gift || gift.to !== me) return note('That offer is gone.');
        const r = giftAccept(gift, { me, doc: docOfName(me), giverDoc: docOfName(gift.from), giver: gift.from, shifts: state.shifts || [], now });
        if (r.status && r.status !== 'accepted') Object.assign(gift, { status: r.status, decidedAt: now });
        if (r.note) return done(r);
        putDoc(me, r.doc);
        putDoc(gift.from, r.giverDoc);
        Object.assign(gift, { status: 'accepted', decidedAt: now });
        tell(gift.from, `${first(me)} took ${gift.pet.name}`, `${gift.pet.name} has a new home.`);
        return done({ ok: true, name: r.pet.name });
      }
      return note('Unknown action.');
    }
    return note('Unknown action.');
  },
  // Coin requests (/request @person amount), run the way the coinRequest
  // function runs them (functions/coinRequests.js), with the same checks
  // (shared/coinRequests.js). Paying adds the same gift /give adds.
  async coinRequest(req, actor, { balanceOf, roster = [], subteamsOf = () => [] }) {
    const now = Date.now();
    const me = actor.name;
    const note = (title, body = '') => ({ note: { title, body } });
    const asks = state.coinRequests || (state.coinRequests = {});
    const groups = state.coinRequestGroups || (state.coinRequestGroups = {});
    const ctl = state.controls || {};
    const cfg = state.settings?.commands;
    const coinsOff = me !== REQUESTS_TO && (ctl.off || []).includes('coins');
    const action = String(req.action || '');
    const first = (n) => (n || '').split(' ')[0];
    const tell = (to, title, body, conv) => {
      state.inbox = [{ id: uid(), type: 'coinRequest', title, body, open: `chat:${conv}`, at: now, read: false, to }, ...(state.inbox || [])];
    };
    const msgs = (conv) => (state.chat || {})[conv] || [];
    const setCard = (conv, id, fn) => {
      state.chat = { ...state.chat, [conv]: msgs(conv).map((x) => (x.id === id ? { ...x, cmd: fn(x.cmd) } : x)) };
    };
    // No count limits since 3.1.5 (like the server): any number waiting or
    // made in a day, the same person again, and groups as big as the team.
    // The switches /give has, where a request is made.
    const switchedOff = (conv) => {
      if (coinsOff) return note('🪙 Jackson coins are off right now.');
      if (me !== REQUESTS_TO && (ctl.channelsOff || []).includes(conv)) return note('Not here.', 'This channel is off right now.');
      if (isOff('give', cfg)) return note('/give is turned off', 'Sending coins is off for now, so coin requests are too.');
      const stop = blocked('request', 'basics', conv, cfg) || blocked('give', 'economy', conv, cfg);
      return stop ? { note: stop } : null;
    };
    if (action === 'create' && req.group != null) {
      // A group: the same steps as the server's createGroup.
      const conv = String(req.conv || '');
      // Coins and games only in #arcade (3.2), like the server.
      if (conv !== ARCADE) return { note: { ...ARCADE_NOTE } };
      if (conv.startsWith('dm:')) return note('Groups work in channels.', 'In a DM, ask people one by one.');
      const off = switchedOff(conv);
      if (off) return off;
      const g = req.group && typeof req.group === 'object' ? req.group : {};
      const gs = (Array.isArray(g.groups) ? g.groups : []).map(String);
      if (gs.some((x) => !SUBTEAMS.includes(x))) return note('Which group?', `Groups: @everyone, ${SUBTEAMS.map((x) => `@${x}`).join(', ')}.`);
      const everyone = g.everyone === true;
      if (!gs.length && !everyone) return note('Which group?', 'Try: /request @Programming 5 for pizza');
      const team = roster.filter((n) => n !== BOT);
      const named = (Array.isArray(g.people) ? g.people : []).map(String);
      for (const n of named) if (n !== me && !team.includes(n)) return note(`Who’s ${n}?`, 'They aren’t on the team. Nobody was asked.');
      const label = groupLabel({ groups: gs, everyone });
      const people = resolveTargets({ groups: gs, everyone, people: named }, { roster: team, subteamsOf, me });
      if (!people.length) return note(`Nobody in ${label} to ask.`, `${label} has nobody in it besides you.`);
      const id = `g-${req.key || uid()}-${personId(me)}`;
      const was = groups[id];
      if (was) return { ok: true, id, repeat: true, asked: was.rows.length, skipped: was.skipped, reply: coinAsk.groupReply({ asked: was.rows.map((x) => x.to), skipped: was.skipped, amount: was.amount }) };
      const ask = people;
      const skipped = [];
      const r = coinAsk.startGroupAsk({ me, people: ask, label, amount: req.amount, reason: req.reason, now });
      if (r.error) return note(r.error, r.body);
      const pub = r.pub;
      const rows = ask.map((to, i) => ({ id: `${id}-${i}`, to, row: `r${i}` }));
      groups[id] = { id, from: me, conv, amount: pub.amount, reason: pub.reason, label, everyone, quiet: everyone && !actor.admin, at: now, expiresAt: pub.expiresAt, rows, skipped };
      for (const x of rows) asks[x.id] = { from: me, to: x.to, amount: pub.amount, reason: pub.reason, at: now, expiresAt: pub.expiresAt, status: 'open', id: x.id, conv, group: id, row: x.row };
      const m = {
        id,
        text: `/request ${label} ${pub.amount}${pub.reason ? ` ${pub.reason}` : ''}`,
        by: me,
        byUid: actor.uid,
        at: now,
        cmd: {
          name: 'request',
          kind: 'coins',
          group: { label, count: rows.length },
          ask: { from: me, amount: pub.amount, reason: pub.reason, at: now, expiresAt: pub.expiresAt, label },
          rows: Object.fromEntries(rows.map((x) => [x.row, { to: x.to, status: 'open' }])),
          status: 'open',
          line: coinAsk.groupAskLine(pub),
        },
        mentions: [],
        taskIds: [],
        replyTo: req.replyTo || null,
        reactions: {},
      };
      state.chat = { ...(state.chat || {}), [conv]: [...msgs(conv), m] };
      for (const x of rows) tell(x.to, `${first(me)} asks you for ${coinAsk.coinText(pub.amount)}`, `${label}${pub.reason ? `: ${pub.reason}` : '. Tap to pay or decline.'}`, conv);
      commit();
      return { ok: true, id, group: label, asked: rows.length, skipped, reply: coinAsk.groupReply({ asked: ask, skipped, amount: pub.amount }) };
    }
    if (action === 'create') {
      const conv = String(req.conv || '');
      if (conv !== ARCADE) return { note: { ...ARCADE_NOTE } };
      const off = switchedOff(conv);
      if (off) return off;
      const to = String(req.to || '');
      const r = coinAsk.startAsk({ me, to, amount: req.amount, reason: req.reason, roster, active: roster.includes(to), now });
      if (r.error) return note(r.error, r.body);
      const dm = conv.startsWith('dm:') ? (state.dms || []).find((d) => `dm:${d.id}` === conv) : null;
      if (dm && !dm.people.includes(to)) return note(`${first(to)} isn’t in this conversation.`, 'Ask in a channel they can see, or in a DM with them.');
      const id = uid();
      const pub = r.pub;
      asks[id] = { ...pub, id, conv };
      const m = {
        id,
        text: `/request @${to} ${pub.amount}${pub.reason ? ` ${pub.reason}` : ''}`,
        by: me,
        byUid: actor.uid,
        at: now,
        cmd: { name: 'request', kind: 'coins', ask: { from: me, to, amount: pub.amount, reason: pub.reason, at: now, expiresAt: pub.expiresAt }, status: 'open', line: coinAsk.askLine(pub) },
        mentions: [],
        taskIds: [],
        replyTo: req.replyTo || null,
        reactions: {},
      };
      state.chat = { ...(state.chat || {}), [conv]: [...msgs(conv), m] };
      if (dm) state.dms = state.dms.map((d) => (d === dm ? { ...d, lastAt: now, lastBy: me, lastText: `${first(me)} ${m.cmd.line}` } : d));
      else tell(to, `${first(me)} asks you for ${coinAsk.coinText(pub.amount)}`, pub.reason || 'Tap to pay or decline.', conv);
      commit();
      return { ok: true, id };
    }
    if (!coinAsk.MOVES.includes(action)) return note('Unknown action.');
    if (action === 'pay') {
      if (coinsOff) return note('🪙 Jackson coins are off right now.');
      if (isOff('give', cfg)) return note('/give is turned off', 'Sending coins is off for now, so coin requests are too.');
      if (isOff('request', cfg)) return note('/request is turned off', 'It’s off for now.');
    }
    // One request (a person's own, or one row of a group), as the server's move().
    const moveOne = (id, mv) => {
      const pub = asks[id];
      if (!pub) return note('That request is gone.');
      const balance = mv === 'pay' && me === pub.to ? balanceOf(me) : 0;
      const toBalance = mv === 'pay' && me === pub.to && pub.from !== me ? balanceOf(pub.from) : undefined;
      const r = coinAsk.askMove({ pub, me, move: mv, balance, toBalance, roster, now });
      if (!r.write) return r.error ? note(r.error, r.body) : { ok: true, status: pub.status, ...(r.already && { already: r.already }) };
      const { status, decidedAt, paidAt } = r.pub;
      asks[id] = { ...pub, status, decidedAt, ...(paidAt && { paidAt }) };
      if (r.entry && !(state.coins || []).some((x) => x.id === `req-${id}`))
        state.coins = [...(state.coins || []), { ...r.entry, id: `req-${id}`, request: id }];
      if (pub.group)
        setCard(pub.conv, pub.group, (c) => {
          const rows = { ...c.rows, [pub.row]: { ...c.rows[pub.row], status, at: decidedAt, ...(paidAt && { paidAt }) } };
          return { ...c, rows, status: Object.values(rows).some((x) => x.status === 'open') ? 'open' : 'closed' };
        });
      else setCard(pub.conv, id, (c) => ({ ...c, status, decidedAt, ...(paidAt && { paidAt }) }));
      if (status === 'paid') tell(pub.from, `${first(pub.to)} paid your request: ${coinAsk.coinText(pub.amount)}`, pub.reason || 'The coins are in your balance.', pub.conv);
      if (status === 'declined') tell(pub.from, `${first(pub.to)} declined your request for ${coinAsk.coinText(pub.amount)}`, pub.reason || '', pub.conv);
      return { ok: true, status, ...(r.error && { note: { title: r.error, body: '' } }) };
    };
    let out;
    if (String(req.id || '').startsWith('g-')) {
      // A tap on a group card: your own row, or (Cancel, time's up) every open row.
      const g = groups[req.id];
      if (!g) return note('That request is gone.');
      if (action === 'pay' || action === 'decline') {
        const mine = g.rows.find((x) => x.to === me);
        if (!mine) return me === g.from ? note('Waiting for their answers.') : note('This request isn’t for you.', `${first(g.from)} asked ${g.label}.`);
        out = moveOne(mine.id, action);
      } else if (action === 'cancel' && me !== g.from) return note(`Only ${first(g.from)} can cancel this.`);
      else if (action === 'peek' && now < g.expiresAt) return { ok: true, status: 'open' };
      else {
        const done = g.rows.filter((x) => asks[x.id]?.status === 'open').map((x) => moveOne(x.id, action));
        out = { ok: true, status: action === 'cancel' ? 'cancelled' : 'expired', closed: done.filter((x) => x.ok && !x.already).length };
      }
    } else out = moveOne(req.id, action);
    commit();
    return out;
  },
  subscribeAdSubmissions(cb) {
    return listen(() => cb([...(state.adSubmissions || [])]));
  },
  async submitAd(data, actor) {
    state.adSubmissions = [
      ...(state.adSubmissions || []),
      { ...data, id: `sub${Date.now().toString(36)}`, by: actor.name, status: 'pending', note: '', at: Date.now() },
    ];
    commit();
  },
  async updateAdSubmission(id, patch) {
    state.adSubmissions = (state.adSubmissions || []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    commit();
  },
  async deleteAdSubmission(id) {
    state.adSubmissions = (state.adSubmissions || []).filter((x) => x.id !== id);
    commit();
  },
  // What happens after an ad's booking / order (see adOrders.js). The demo
  // delivers the notifications itself, like the adDeliveries function does.
  subscribeAdOrders(name, cb) {
    const tick = () => {
      const now = Date.now();
      let changed = false;
      state.adOrders = (state.adOrders || []).map((o) => {
        if (o.due == null || o.due > now) return o;
        const { latest, sent, due } = deliver(o, now);
        if (latest) {
          state.inbox = [
            {
              id: uid(),
              type: 'ad',
              icon: latest.icon,
              title: latest.title,
              body: latest.body,
              open: `adorder:${o.id}`,
              at: now,
              read: false,
            },
            ...(state.inbox || []),
          ];
        }
        changed = true;
        return { ...o, sent, due };
      });
      if (changed) commit();
    };
    tick();
    const t = setInterval(tick, 5000);
    const off = listen(() => cb((state.adOrders || []).filter((o) => o.by === name)));
    return () => {
      clearInterval(t);
      off();
    };
  },
  async addAdOrder(order, actor) {
    const id = `ord${Date.now().toString(36)}`;
    state.adOrders = [...(state.adOrders || []), { ...order, id, by: actor.name }];
    commit();
    return id;
  },
  async deleteAdOrder(id) {
    state.adOrders = (state.adOrders || []).filter((o) => o.id !== id);
    commit();
  },
  // The casino and economy, run here the way the play function runs them on
  // the server (functions/index.js), with the same rules (casino.js).
  // balanceOf(name): the person's coins, from the app's wallet; roster: the team.
  async play(req, actor, { balanceOf, roster = [], subteamsOf = () => [] }, verified = null) {
    await demoLag();
    const now = Date.now();
    const me = actor.name;
    const { action, game, conv = '', args = [], msgId, move } = req;
    const words = args.map(String);
    const note = (title, body = '') => ({ note: { title, body } });
    const bank = (n) => (state.bank || {})[n] || {};
    const setBank = (n, b) => (state.bank = { ...(state.bank || {}), [n]: b });
    const ICON = { slots: '🎰', dice: '🎲', coinflip: '🪙', roulette: '🎡', blackjack: '🃏', crash: '🚀', mines: '💣', highlow: '🔼' };
    const LABEL = {
      slots: 'Slots',
      dice: 'Dice',
      coinflip: 'Coin flip',
      roulette: 'Roulette',
      blackjack: 'Blackjack',
      crash: 'Crash',
      mines: 'Mines',
      highlow: 'High-low',
    };
    const result = (net, g, capped = false) => ({
      game: g,
      icon: ICON[g],
      label: `${LABEL[g]}: ${net >= 0 ? `won ${net}` : `lost ${-net}`}${capped ? casino.CAPPED : ''}`,
    });
    const post = (cmd, mentions = []) => {
      const m = {
        id: uid(),
        text: `/${game}${words.length ? ` ${words.join(' ')}` : ''}`,
        by: me,
        byUid: actor.uid,
        at: now,
        cmd: { ...cmd, name: game },
        mentions,
        taskIds: [],
        replyTo: null,
        reactions: {},
      };
      state.chat = { ...(state.chat || {}), [conv]: [...((state.chat || {})[conv] || []), m] };
      return m;
    };
    const done = (r) => (commit(), r);
    // An overdue loan locks gifts and bets, the same check as play on the server.
    const betting =
      action === 'gift' ||
      (action === 'move'
        ? ['accept', 'join', 'double', 'rock', 'paper', 'scissors'].includes(String(move))
        : action !== 'prize' && (casino.CASINO.includes(game) || (arcade.MULTI.includes(game) && !['trivia', 'hangman', 'typerace'].includes(game))));
    const lock = betting ? loans.lockFor(me, balanceOf) : null;
    if (lock) return note(lock.title, lock.body);
    // A gambling buddy's lock refuses new casino bets, like the server's play.
    const buddyLock = buddyBlocks({ action, game, move, args: words }) ? buddies.lockFor(me) : null;
    if (buddyLock) return note(lockNote(buddyLock).title, lockNote(buddyLock).body);
    // Several people's coins at once (multiplayer games).
    // card: the game and its card's id, so a held bet and its result share a history line.
    // A win past a googol is cut (arcade.capMoney, like the server's payOut);
    // returns { name: net paid } for the card (pub.capped).
    const payOut = (money, card) => {
      const winners = money.filter((x) => x.delta > 0 && x.entry?.shown > 0).map((x) => x.name);
      const { money: paid, capped } = arcade.capMoney(money, Object.fromEntries(winners.map((n) => [n, balanceOf(n)])));
      for (const x of paid)
        setBank(x.name, casino.bankAfter(bank(x.name), x.name, x.delta, arcade.moneyLine(x, card.game, card.id, conv), x.extra || {}, now));
      return capped;
    };
    const withCapped = (pub, capped) => (Object.keys(capped).length ? { ...pub, capped: { ...(pub.capped || {}), ...capped } } : pub);

    // A group gift (/give @Programming 10): the same rules as the server's
    // giveMany, against the demo team. A second send with the same key is
    // already done.
    if (action === 'gift' && req.group) {
      const g = req.group;
      const groups = (g.groups || []).filter((x) => SUBTEAMS.includes(x));
      const team = roster.filter((n) => n !== BOT);
      for (const n of g.people || [])
        if (n !== me && !team.includes(n)) return note(`Who’s ${n}?`, 'They aren’t on the team. Nothing was sent.');
      const people = resolveTargets({ groups, everyone: !!g.everyone, people: g.people || [] }, { roster: team, subteamsOf, me });
      const label = groupLabel({ groups, everyone: !!g.everyone });
      if (!people.length) return note(`Nobody in ${label} to give to.`, `${label} has nobody in it besides you.`);
      const batch = `${personId(me)}-${req.key}`;
      const before = (state.coins || []).filter((x) => x.type === 'gift' && x.batch === batch);
      const total = before.reduce((t, x) => t + x.amount, 0);
      if (before.length) return { ok: true, repeat: true, people: before.map((x) => x.to), amount: before[0].amount, total, group: label, batch };
      const made = groupGiftEntries(
        me,
        { people, amount: req.amount, note: req.note, batch, group: label },
        { roster: team, balance: balanceOf(me), balances: Object.fromEntries(people.filter((n) => n !== me).map((n) => [n, balanceOf(n)])), now },
      );
      if (made.error) return note(made.error, made.body);
      for (const e of made.entries) await demoStore.addCoinTx(e);
      return { ok: true, people, amount: made.entries[0].amount, total: made.total, group: label, batch };
    }
    // Gifts and ad prizes, checked the way the server checks them.
    if (action === 'gift' || action === 'prize') {
      const entry =
        action === 'gift'
          ? giftEntry(me, req, { roster, balance: balanceOf(me), toBalance: roster.includes(req.to) && req.to !== me ? balanceOf(req.to) : undefined, now })
          : prizeEntry(me, req, { ledger: state.coins || [], gameCap: state.settings?.ads?.games?.cap ?? 10, now });
      if (entry.error) return note(entry.error, entry.body);
      // A /give with a key: the card keeps it, for the owner's Undo (key, not
      // batch: batch makes a group line in the giver's history).
      const batch = action === 'gift' && req.key ? `${personId(me)}-${req.key}` : '';
      await demoStore.addCoinTx(batch ? { ...entry, key: batch } : entry);
      return { ok: true, entry, ...(batch && { batch }) };
    }

    if (action === 'move') {
      // A warm-up (the server wakes up for a live game); nothing to do here.
      if (move === 'warm') return { ok: true, serverNow: now };
      const list = (state.chat || {})[conv] || [];
      const m = list.find((x) => x.id === msgId);
      const secret = (state.gameSecrets || {})[msgId];
      if (!m?.cmd || !secret) return note('That game is gone.');
      const c = m.cmd;
      // Gambling buddy: accepting a challenge is a bet too, like the server.
      if (String(move) === 'accept' && c.name === 'challenge') {
        const bl = buddies.lockFor(me);
        if (bl) return note(lockNote(bl).title, lockNote(bl).body);
      }
      // Controls: Casino and games during shifts off: no accepting or joining while clocked in.
      if (
        (move === 'accept' || move === 'join') &&
        casino.shiftLocked(c.name) &&
        me !== REQUESTS_TO &&
        (state.controls?.off || []).includes('casinoOnShift') &&
        (state.shifts || []).some((x) => !x.end && x.person === me)
      )
        return note(...casino.SHIFT_NOTE);
      if (arcade.MULTI.includes(c.name)) {
        if (move === 'mine') return { ok: true, mine: arcade.myFleet(c.name, secret, me) };
        if (move === 'sync') return { ok: true, serverNow: now, card: { game: c.game, status: c.status } };
        if (!arcade.isLive(c.status)) return { ok: true };
        const r = arcade.move(c.name, {
          pub: { ...c.game, status: c.status },
          secret,
          me,
          move: String(move),
          balance: balanceOf(me),
          now,
          verified,
        });
        if (r.error) return note(r.error);
        if (!r.write) return { ok: true, serverNow: now };
        const capped = payOut(r.money, { game: c.name, id: msgId });
        const cut = payDemoAwards(r.awards, msgId, now);
        const { status, ...g } = withCapped(r.pub, capped);
        if (Object.keys(cut).length) g.paid = cut;
        if (arcade.isLive(status)) state.gameSecrets = { ...state.gameSecrets, [msgId]: r.secret };
        else delete state.gameSecrets[msgId];
        state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === msgId ? { ...x, cmd: { ...c, game: g, status } } : x)) };
        return done({ ok: true, serverNow: now, card: { game: g, status } });
      }
      if (move !== 'peek' && m.by !== me) return note('That’s not your game.');
      if (c.status !== 'playing') return { ok: true };
      if (move === 'double' && balanceOf(m.by) < c.bet) return note('Not enough coins to double.');
      const r = casino.moveGame(c.name, { ...c.game, status: c.status }, secret, String(move), c.bet, now);
      if (r.error) return note(r.error);
      if (move === 'peek' && !r.done) return { ok: true, serverNow: now };
      const bet = c.bet + (r.extraBet || 0);
      const { status, ...g } = r.pub;
      const cmd = { ...c, game: g, status, bet };
      if (r.done) {
        // Like the server: a win pays up to a googol at most (before: now plus the bet held).
        const won = r.payout - bet;
        const net = won > 0 ? capWin(won, balanceOf(m.by) + c.bet) : won;
        const capped = net < won;
        const label = `${LABEL[c.name]}: ${net > 0 ? `won ${net}` : net < 0 ? `lost ${-net}` : 'bet back'}${capped ? casino.CAPPED : ''}`;
        setBank(m.by, casino.bankAfter(bank(m.by), m.by, bet + net - (r.extraBet || 0), { ...result(net, c.name), label, shown: net, settles: msgId, card: `${conv}/${msgId}` }, {}, now));
        Object.assign(cmd, { payout: bet + net, net, ...(capped && { capped: true }) });
        delete state.gameSecrets[msgId];
      } else state.gameSecrets = { ...state.gameSecrets, [msgId]: r.secret };
      state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === msgId ? { ...x, cmd } : x)) };
      const card = { game: g, status, bet, ...(r.done && { payout: cmd.payout, net: cmd.net, ...(cmd.capped && { capped: true }) }) };
      return done({ ok: true, serverNow: now, ...(localStorage.getItem('demo-no-card') ? {} : { card }) });
    }

    // Coins and games only in #arcade (3.2), like the server.
    if (conv !== ARCADE) return { note: { ...ARCADE_NOTE } };
    const isCasino = casino.CASINO.includes(game);
    const stop = blocked(game, serverGroup(game), conv, state.settings?.commands);
    if (stop) return { note: stop };
    // A bet that isn't a whole number of coins ("1.2345k"), like the server.
    const whole = casino.wholeCoinsNote(words);
    if (whole) return note(...whole);
    // Controls, "Casino and games during shifts" off: not while you're clocked in (like the server; Asher is exempt).
    if (
      casino.shiftLocked(game) &&
      me !== REQUESTS_TO &&
      (state.controls?.off || []).includes('casinoOnShift') &&
      (state.shifts || []).some((x) => !x.end && x.person === me)
    )
      return note(...casino.SHIFT_NOTE);
    const balance = balanceOf(me);
    const mine = bank(me);
    if (arcade.MULTI.includes(game)) {
      // /challenge: who they asked, and whether you already have one waiting (like the server).
      let more = {};
      if (game === 'challenge') {
        const { them, known } = challenge.parseWords(words, roster);
        const old = mine.chOpen ? ((state.chat || {})[mine.chOpen.conv] || []).find((x) => x.id === mine.chOpen.id)?.cmd : null;
        more = {
          peer: known && them !== me && them !== arcade.BOT ? { name: them, active: roster.includes(them), balance: balanceOf(them) } : null,
          hasOpen: old?.name === 'challenge' && old.status === 'open' && old.game.expiresAt > now,
        };
      }
      const r = arcade.start(game, { me, words, roster, balance, bank: mine, now, content: DEMO_ARCADE, ...more });
      if (r.error) return note(r.error);
      const { status, ...g } = r.pub;
      const m = post({ game: g, status, bet: g.bet || 0 }, r.mentions);
      const capped = payOut(r.money, { game, id: m.id });
      if (Object.keys(capped).length) setCard({ conv, id: m.id }, { game: withCapped(g, capped) });
      if (r.open) setBank(me, { ...bank(me), chOpen: { conv, id: m.id } });
      state.gameSecrets = { ...(state.gameSecrets || {}), [m.id]: r.secret };
      return done({ ok: true, serverNow: now });
    }

    if (game === 'lottery') {
      const lot = state.lottery || {};
      const drawAt = lot.drawAt && lot.drawAt > now ? lot.drawAt : nextFridayLocal(now);
      const n = words[0] ? casino.parseBet(words[0], Math.floor(balance / casino.TICKET)) : 0;
      if (words[0] && (!n || n < 1)) return note('How many tickets?', `Tickets are ${casino.TICKET} coins. Try: /lottery 3`);
      const cost = (n || 0) * casino.TICKET;
      if (cost > balance) return note(`That’s ${coinsText(cost)} coins. You have ${coinsText(balance)}.`);
      const tickets = { ...(lot.tickets || {}) };
      if (n) tickets[me] = (tickets[me] || 0) + n;
      const pot = (lot.pot || 0) + cost;
      const people = Object.keys(tickets).length;
      // One open lottery card at a time (like the play function).
      const open = lot.open && (state.chat?.[lot.open.conv] || []).some((x) => x.id === lot.open.id) ? lot.open : null;
      if (n) setBank(me, casino.bankAfter(mine, me, -cost, { icon: '🎟️', label: `Lottery: ${n} ticket${n > 1 ? 's' : ''}` }, {}, now));
      if (!open) {
        const m = post({ bought: n || 0, mine: tickets[me] || 0, pot, drawAt, people, last: lot.last || null });
        state.lottery = { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null, open: { conv, id: m.id } };
        return done({ ok: true });
      }
      state.lottery = { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null, open };
      setCard(open, { pot, people });
      return done({ ok: true, note: casino.lotteryNote(n, tickets[me] || 0, pot, open.conv, conv) });
    }
    if (isCasino) {
      const bet = casino.parseBet(words[0], balance);
      if (!bet || bet < 1) return note(`/${game} needs a bet`, `Try: /${game} 20 (or 1k, all, half, 25%). You have ${coinsText(balance)} coins.`);
      if (bet > balance) return note(`You only have ${coinsText(balance)} coins.`, 'Try /daily, /work, or /beg.');
      const r = casino.startGame(game, bet, words.slice(1), secureRandom, now);
      if (r.error) return note(r.error);
      const { status = 'done', ...g } = r.pub;
      if (r.done) {
        // Like the server: a win pays up to a googol at most.
        const net = capWin(r.payout - bet, balance);
        const capped = net < r.payout - bet;
        const m = post({ game: g, status, bet, payout: bet + net, net, ...(capped && { capped: true }) });
        setBank(me, casino.bankAfter(mine, me, net, { ...result(net, game, capped), card: `${conv}/${m.id}` }, {}, now));
      } else {
        const m = post({ game: g, status, bet });
        setBank(me, casino.bankAfter(mine, me, -bet, casino.holdEntry(ICON[game], LABEL[game], bet, m.id), {}, now));
        state.gameSecrets = { ...(state.gameSecrets || {}), [m.id]: r.secret };
      }
      return done({ ok: true, serverNow: now });
    }
    if (game === 'rob') {
      const target = words.join(' ').replace(/^@/, '').toLowerCase();
      const people = roster;
      const them =
        people.find((n) => target.includes(n.toLowerCase())) || people.find((n) => n.toLowerCase().split(' ')[0] === target.split(' ')[0]);
      if (!them) return note('Rob who?', 'Try: /rob @name');
      if (them === me) return note('You can’t rob yourself.', 'You’d just be moving coins between pockets.');
      const r = casino.capRob(casino.rob(mine, balance, balanceOf(them), now), balance, balanceOf(them));
      if (r.error) return note(r.error);
      setBank(
        me,
        casino.bankAfter(
          mine,
          me,
          r.amount,
          { icon: r.card.ok ? '🦹' : '🚓', label: r.card.ok ? `Robbed ${them}` : `Caught robbing ${them}` },
          r.bank,
          now,
        ),
      );
      setBank(
        them,
        casino.bankAfter(
          bank(them),
          them,
          r.theirs,
          { icon: r.card.ok ? '😱' : '🚓', label: r.card.ok ? `Robbed by ${me}` : `${me} paid you a fine` },
          {},
          now,
        ),
      );
      post(
        {
          ...r.card,
          to: them,
          line: r.card.ok ? `robbed you and got away with ${coinsText(r.amount)} coins` : `tried to rob you and paid you a ${coinsText(r.amount)} coin fine`,
        },
        [them],
      );
      return done({ ok: true });
    }
    const r =
      game === 'daily'
        ? casino.daily(mine, teamDay(now), teamDay(now - 86400000))
        : game === 'work'
          ? casino.work(mine, now, Math.random, {
              onShift: (state.shifts || []).some((x) => !x.end && x.person === me),
              tasks: (state.tasks || [])
                .filter((t) => t.status !== 'done' && !t.deletedAt && (t.assignees || []).includes(me))
                .map((t) => t.title || 'a task'),
            })
          : casino.beg(mine, now);
    if (r.error) return note(r.error);
    // /work grows with the balance (3.2), like the server.
    if (game === 'work' && r.amount > 0) {
      const scaled = scaledPay('work', r.amount, demoLow(me, now));
      if (scaled > r.amount) {
        r.amount = scaled;
        r.card = { ...r.card, amount: scaled, scaled: true };
      }
    }
    // /work and /beg pay up to a googol at most (like the server).
    if (game !== 'daily' && capWin(r.amount, balance) < r.amount) {
      r.amount = capWin(r.amount, balance);
      r.card = { ...r.card, amount: r.amount, capped: true };
    }
    const label = { daily: `Daily coins (streak ${r.card.streak})`, work: `Work: ${r.card.job}`, beg: 'Begging' }[game];
    if (game === 'daily') {
      // Like the server: an award within the 20-a-day game limit; the bank keeps the streak.
      const paid = demoAward({ person: me, amount: r.amount, source: 'game', label, key: `cmd-daily-${personId(me)}-${teamDay(now)}` }, now);
      setBank(me, casino.bankAfter(mine, me, 0, null, r.bank, now));
      post({ ...r.card, amount: paid, ...(paid < r.amount && { limit: AWARD_CAPS.game }) });
      return done({ ok: true });
    }
    setBank(
      me,
      casino.bankAfter(mine, me, r.amount, r.amount ? { icon: { daily: '📅', work: '🛠️', beg: '🥺' }[game], label } : null, r.bank, now),
    );
    post(r.card);
    return done({ ok: true });
  },
  subscribeBank(cb) {
    return listen(() => cb({ ...(state.bank || {}) }));
  },
  // Casino reports, checked the way functions/disputes.js checks them
  // (shared/disputes.js). The owner (Asher) sees every report, everyone else
  // (Sebastian too, ?demo=manager) their own.
  subscribeDisputes(actor, cb) {
    const owner = actor.admin && actor.name === REQUESTS_TO;
    return listen(() => cb((state.disputes || []).filter((x) => owner || x.by === actor.name).sort((a, b) => b.at - a.at)));
  },
  async dispute(req, actor) {
    const now = Date.now();
    const me = actor.name;
    const note = (title, body = '') => ({ note: { title, body } });
    const { conv, msgId, reason, note: text } = req;
    if (!dispute.REASONS[reason]) return note('What looks wrong?', 'Pick one of the reasons.');
    const m = ((state.chat || {})[conv] || []).find((x) => x.id === msgId);
    const problem = dispute.reportProblem(m, me);
    if (problem) return note('Can’t report that.', problem);
    const id = dispute.reportId(msgId, me);
    const list = state.disputes || [];
    if (list.some((x) => x.id === id)) return note('You already reported this one.', `${REQUESTS_TO.split(' ')[0]} will get to it.`);
    const day = teamDay(now);
    const snapshot = dispute.snapshotOf(m, me);
    state.disputes = [
      ...list,
      { id, conv, msgId, cmd: m.cmd.name, by: me, at: now, day, reason, note: String(text || '').trim().slice(0, dispute.LIMITS.note), status: 'open', snapshot },
    ];
    const first = me.split(' ')[0];
    state.inbox = [
      ...[REQUESTS_TO].filter((n) => n !== me).map((to) => ({
        id: uid(),
        type: 'dispute',
        title: `${first} reported a ${dispute.GAME_LABEL[snapshot.game]} result`,
        body: dispute.REASONS[reason],
        open: 'disputes:',
        report: id,
        at: now,
        read: false,
        to,
      })),
      ...(state.inbox || []),
    ];
    commit();
    return { ok: true, id };
  },
  // ctx.balanceOf (when given): the ceiling, like the server (a refund that
  // would put them over a googol is refused).
  async disputeDecide(req, actor, ctx = {}) {
    const now = Date.now();
    const note = (title, body = '') => ({ note: { title, body } });
    if (!actor.admin || actor.name !== REQUESTS_TO) return note(`Only ${REQUESTS_TO.split(' ')[0]} can do that.`);
    const { id, decision } = req;
    const resolution = String(req.note || '').trim().slice(0, dispute.LIMITS.resolution);
    const x = (state.disputes || []).find((y) => y.id === id);
    if (!x) return note('That report is gone.');
    if (x.status !== 'open') return note('Already handled.', x.status === 'refunded' ? `Refunded ${coinsText(x.refund)} coins.` : 'It was dismissed.');
    if (decision !== 'refund' && decision !== 'dismiss') return note('Refund or dismiss?');
    let refund = 0;
    if (decision === 'refund') {
      const m = ((state.chat || {})[x.conv] || []).find((y) => y.id === x.msgId);
      const keys = (state.refundKeys ||= {});
      // Shared with Refund / Take back on the card (ownerRefund).
      const key = dispute.refundKeyId(x.msgId, x.by);
      if (keys[key]) return note(keys[key].mode === 'takeback' ? 'That win was already taken back.' : 'That result was already refunded.');
      const live = m?.cmd ? dispute.cardLoss(m.cmd, x.by) : null;
      const kept = x.snapshot || {};
      refund = live ? (kept.final ? Math.min(live.loss, kept.loss || 0) : live.loss) : kept.loss || 0;
      if (!(refund > 0))
        return note('There’s no loss to refund.', live && !live.final ? 'The game isn’t finished yet. Wait for it to settle, or dismiss.' : 'That card doesn’t show them losing coins.');
      const seen = dispute.historyCheck(state.bank?.[x.by]?.recent || [], x.cmd, refund, kept.cardAt || x.at);
      if (seen === 'missing') return note('I can’t find that loss in their coin history.', 'Dismiss it, or add the coins yourself as a bonus.');
      const link = demoLine({ who: x.by, conv: x.conv, msgId: x.msgId, game: x.cmd, net: -refund, cardAt: kept.cardAt || x.at });
      if (link.problem) return link.problem;
      if (ctx.balanceOf && overCeiling(ctx.balanceOf(x.by) + (ctx.paid?.[x.by] || 0), refund)) {
        const c = ceilingNote(x.by, 'Nobody can hold more than that. Nothing was refunded.');
        return note(c.error, c.body);
      }
      keys[key] = { mode: 'refund', via: 'report', at: now };
      state.coins = [...(state.coins || []), { id: `dispute-${id}`, ...dispute.refundEntry(x.by, refund, x.cmd, id, now, link.reverses) }];
      if (m?.cmd) demoTag(x.conv, x.msgId, dispute.adjustTag({ person: x.by, mode: 'refund', amount: refund, by: actor.name, now, via: 'report' }));
    }
    Object.assign(x, { status: decision === 'refund' ? 'refunded' : 'dismissed', handledBy: actor.name, handledAt: now, refund, resolutionNote: resolution });
    clearReportNote(x);
    if (req.quiet) {
      commit();
      return { ok: true, status: x.status, refund, x };
    }
    state.inbox = [
      {
        id: uid(),
        type: 'dispute',
        ...(refund && { icon: '↩️' }),
        title: refund ? `${coinsText(refund)} coins refunded` : 'Your report was looked at',
        body: refund
          ? `${REQUESTS_TO.split(' ')[0]} refunded your ${dispute.GAME_LABEL[x.cmd] || 'casino'} result.${resolution ? ` ${resolution}` : ''}`
          : `${REQUESTS_TO.split(' ')[0]} kept the result as it was.${resolution ? ` ${resolution}` : ''}`,
        open: 'disputes:',
        at: now,
        read: false,
        to: x.by,
      },
      ...(state.inbox || []),
    ];
    commit();
    return { ok: true, status: x.status, refund };
  },
  // Refund all (the disputeRefundAll function): every waiting report, or one
  // person's, each through disputeDecide; one notification per person.
  async disputeRefundAll(req, actor, ctx = {}) {
    const note = (title, body = '') => ({ note: { title, body } });
    if (!actor.admin || actor.name !== REQUESTS_TO) return note(`Only ${REQUESTS_TO.split(' ')[0]} can do that.`);
    const only = String(req?.person || '').trim();
    const open = (state.disputes || []).filter((x) => x.status === 'open' && (!only || x.by === only)).sort((a, b) => a.at - b.at);
    if (!open.length) return note(only ? `Nothing waiting from ${only.split(' ')[0]}.` : 'Nothing waiting.');
    const paid = new Map();
    const skipped = [];
    let coins = 0;
    let closed = 0;
    for (const x of open) {
      // What this run already paid each person counts toward their ceiling.
      const sofar = Object.fromEntries([...paid].map(([n, r]) => [n, r.coins]));
      const out = await this.disputeDecide({ id: x.id, decision: 'refund', note: req?.note, quiet: true }, actor, { ...ctx, paid: sofar });
      if (out?.ok) {
        const row = paid.get(x.by) || { count: 0, coins: 0, game: x.cmd };
        row.count += 1;
        row.coins += out.refund;
        paid.set(x.by, row);
        coins += out.refund;
      } else if (/already (refunded|taken back)/.test(out?.note?.title || '')) {
        const done = await this.disputeDecide({ id: x.id, decision: 'dismiss', note: 'Already put right from the card.', quiet: true }, actor, ctx);
        if (done?.ok) closed += 1;
        else skipped.push({ id: x.id, by: x.by, game: x.cmd || '', why: out.note.title });
      } else skipped.push({ id: x.id, by: x.by, game: x.cmd || '', why: out?.note?.title || 'Skipped.' });
    }
    const now = Date.now();
    const boss = REQUESTS_TO.split(' ')[0];
    state.inbox = [
      ...[...paid].map(([to, r]) => ({
        id: uid(),
        type: 'dispute',
        icon: '↩️',
        title: `${coinsText(r.coins)} coins refunded`,
        body: r.count === 1 ? `${boss} refunded your ${dispute.GAME_LABEL[r.game] || 'casino'} result.` : `${boss} refunded ${r.count} of your casino reports.`,
        open: 'disputes:',
        at: now,
        read: false,
        to,
      })),
      ...(state.inbox || []),
    ];
    commit();
    return { ok: true, refunded: [...paid.values()].reduce((n, r) => n + r.count, 0), coins, people: paid.size, skipped, closed };
  },
  // 3.2: the app's wallets, for earnings that grow with the balance.
  useWallets(fn) {
    demoWallet = fn;
  },
  // What the server's onTaskEarn and onShiftEarn do (functions/earn.js), run
  // while the app is open: a task's top-up once, a lab day's top-up up to
  // what the day pays now. name: whose (the demo's signed-in person).
  scaleTick(name, now = Date.now()) {
    if (!demoWallet || (state.controls?.off || []).includes('coins')) return;
    const w = demoWallet(name);
    let changed = false;
    for (const item of w.history) {
      if (!(item.amount > 0) || (item.kind !== 'task' && item.kind !== 'hours') || item.note) continue;
      if (item.kind === 'hours' && item.day === teamDay(now) && (state.shifts || []).some((x) => !x.end && x.person === name)) continue;
      const base = item.base ?? item.amount;
      const kind = item.kind;
      const ref = kind === 'task' ? item.id : item.day;
      const id = scaleId(kind, ref, name);
      const had = (state.coins || []).find((x) => x.id === id);
      if (kind === 'task' && (had || item.boost)) continue;
      const extra = scaledPay(kind, base, earnBalance(w.history.filter((x) => x !== item), now)) - base;
      if (!(extra > 0) || (had && had.amount >= extra)) continue;
      const entry = { id, type: 'scale', person: name, ref: `${kind}:${ref}`, source: kind, amount: extra, base, label: item.label, at: had?.at || now };
      state.coins = [...(state.coins || []).filter((x) => x.id !== id), entry];
      changed = true;
    }
    if (changed) commit();
  },
  // Hidden coins (3.2), the way the hiddenCoin function hands them out and
  // pays them (functions/earn.js FIND): a token now and then, at most 5 a
  // day, each paid once.
  async hiddenCoin(req, actor) {
    await demoLag();
    const now = Date.now();
    const me = actor.name;
    const off = state.controls?.off || [];
    if (me !== REQUESTS_TO && (off.includes('coins') || off.includes('hiddenCoins'))) return { ok: true, none: true, off: true };
    const day = teamDay(now);
    const finds = (state.coinFinds ||= {});
    const tokens = (state.coinTokens ||= {});
    const key = `${personId(me)}-${day}`;
    const d = finds[key] || {};
    if (req?.action === 'spawn') {
      const issued = d.issued || 0;
      if (issued >= FIND.perDay) return { ok: true, none: true, left: 0 };
      // Demo mode: a shorter wait, so a coin shows up while someone looks around.
      if (now - (d.lastAt || 0) < FIND.demoGap) return { ok: true, none: true, left: FIND.perDay - issued };
      if (d.lastAt && Math.random() >= FIND.chance) {
        finds[key] = { ...d, lastAt: now };
        commit();
        return { ok: true, none: true, left: FIND.perDay - issued };
      }
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      tokens[token] = { person: me, day, at: now, exp: now + FIND.ttl, base: FIND.min + Math.floor(Math.random() * (FIND.max - FIND.min + 1)), claimed: false };
      finds[key] = { ...d, issued: issued + 1, lastAt: now };
      commit();
      return { ok: true, token, exp: now + FIND.ttl, left: FIND.perDay - issued - 1 };
    }
    if (req?.action === 'claim') {
      const t = tokens[req.token];
      const note = (title) => ({ note: { title, body: '' } });
      if (!t || t.person !== me) return note('That coin isn’t yours.');
      if (t.claimed) return note('Already picked up.');
      if (now > t.exp) return note('Too late: it rolled away.');
      const paid = demoAward({ person: me, amount: t.base, source: 'find', label: 'Found a hidden coin', key: `find-${req.token}` }, now);
      tokens[req.token] = { ...t, claimed: true, claimedAt: now, paid };
      commit();
      return { ok: true, paid };
    }
    return { note: { title: 'Unknown.', body: '' } };
  },
  // 3.2, once: past coin and game cards from other channels into #arcade,
  // the way the moveToArcade function does it (functions/moveArcade.js): same
  // id and time, marked moved, everything that names the channel follows,
  // live games, open requests and pinned cards wait. DMs stay.
  watchMoveToArcade(cb) {
    moveWatchers.add(cb);
    return () => moveWatchers.delete(cb);
  },
  async moveToArcade(req, actor) {
    await demoLag();
    const note = (title, body = '') => ({ note: { title, body } });
    if (!actor.admin || actor.name !== REQUESTS_TO) return note(`Only ${REQUESTS_TO.split(' ')[0]} can do that.`);
    const now = Date.now();
    const chat = state.chat || {};
    const ctx = { lotteryOpenId: state.lottery?.open?.id || '' };
    const byChannel = {};
    const byKind = {};
    const skipped = [];
    const todo = [];
    for (const [conv, list] of Object.entries(chat)) {
      if (conv === ARCADE || conv.startsWith('dm:')) continue;
      for (const m of list) {
        const why = moveSkip(m, { ...ctx, secretExists: !!(state.gameSecrets || {})[m.id] }, m.id);
        if (why === 'not coins') continue;
        if (why) {
          skipped.push({ conv, id: m.id, kind: m.cmd.name, why, at: m.at || 0 });
          continue;
        }
        byChannel[conv] = (byChannel[conv] || 0) + 1;
        byKind[m.cmd.name] = (byKind[m.cmd.name] || 0) + 1;
        todo.push({ conv, m });
      }
    }
    // Waiting cards by kind, so the owner sees the whole split (moving + waiting).
    const waitByKind = {};
    for (const x of skipped) waitByKind[x.kind] = (waitByKind[x.kind] || 0) + 1;
    const report = { byChannel, byKind, waitByKind, total: todo.length, skipped: skipped.slice(0, 100), skippedCount: skipped.length };
    if (req?.dry) return { ok: true, dry: true, ...report };
    // Live progress, card by card, like the server's settings/moveToArcadeRun.
    const base = Math.max(0, Number(req?.base) || 0);
    for (let i = 0; i <= todo.length; i++) {
      for (const f of moveWatchers) f({ run: req?.run || '', moved: base + i, left: todo.length - i });
      if (i < todo.length) await new Promise((r) => setTimeout(r, 120));
    }
    const ids = new Set(todo.map((x) => x.m.id));
    const from = Object.fromEntries(todo.map((x) => [x.m.id, x.conv]));
    const next = { ...chat };
    for (const conv of new Set(todo.map((x) => x.conv))) next[conv] = (next[conv] || []).filter((m) => !ids.has(m.id));
    next[ARCADE] = [...(next[ARCADE] || []), ...todo.map(({ conv, m }) => ({ ...m, moved: { from: conv, at: now } }))].sort((a, b) => (a.at || 0) - (b.at || 0));
    state.chat = next;
    const to = (x, idKey = 'msgId') => (ids.has(x?.[idKey]) && x.conv === from[x[idKey]] ? { ...x, conv: ARCADE } : x);
    state.disputes = (state.disputes || []).map((x) => to(x));
    for (const k of Object.keys(state.refundKeys || {})) state.refundKeys[k] = to(state.refundKeys[k]);
    for (const k of Object.keys(state.coinRequests || {})) {
      const r = state.coinRequests[k];
      if ((ids.has(k) || ids.has(r.group)) && r.conv !== ARCADE) state.coinRequests[k] = { ...r, conv: ARCADE };
    }
    for (const k of Object.keys(state.coinRequestGroups || {})) if (ids.has(k)) state.coinRequestGroups[k] = { ...state.coinRequestGroups[k], conv: ARCADE };
    for (const g of Object.values(state.funGames || {})) if (g?.race && ids.has(g.race.msgId)) g.race = { ...g.race, conv: ARCADE };
    let history = 0;
    for (const [name, b] of Object.entries(state.bank || {})) {
      const recent = (b.recent || []).map((x) => {
        const [conv, id] = typeof x.card === 'string' ? x.card.split('/') : [];
        if (conv && conv !== ARCADE && ids.has(id)) {
          history++;
          return { ...x, card: `${ARCADE}/${id}` };
        }
        return x;
      });
      const chOpen = b.chOpen && ids.has(b.chOpen.id) ? { ...b.chOpen, conv: ARCADE } : b.chOpen;
      state.bank[name] = { ...b, recent, ...(chOpen && { chOpen }) };
    }
    commit();
    return { ok: true, moved: todo.length, more: false, history, ...report };
  },
  // The owner's Refund / Take back on a game card, checked the way the
  // ownerRefund function checks it (shared/disputes.js): the card's own
  // result, once per card and person (the key reports use too).
  async ownerRefund(req, actor, ctx = {}) {
    const now = Date.now();
    const note = (title, body = '') => ({ note: { title, body } });
    if (!actor.admin || actor.name !== REQUESTS_TO) return note(`Only ${REQUESTS_TO.split(' ')[0]} can do that.`);
    const { conv, msgId, person, mode } = req || {};
    const m = ((state.chat || {})[conv] || []).find((y) => y.id === msgId);
    if (!m?.cmd) return note('That game is gone.');
    // Undo on a /give card, the way the ownerRefund function does it.
    if (mode === 'undogift') {
      const c = m.cmd;
      if (c.name !== 'give') return note('That gift is gone.');
      if (!c.batch) return note('This gift can’t be undone from its card.', 'It was sent before Undo existed. Reverse it from their coin history instead.');
      if (c.undone) return note('That gift was already undone.');
      const boss = REQUESTS_TO.split(' ')[0];
      const list = (state.coins || []).filter((x) => x.type === 'gift' && (x.batch === c.batch || x.key === c.batch) && x.from === m.by);
      if (!list.length) return note('I can’t find that gift in the coin history.', 'Nothing was changed.');
      const total = sumCoins(list);
      // Like the server: the giver never goes past a googol.
      if (ctx.balanceOf && overCeiling(ctx.balanceOf(m.by), total)) return note(ceilingNote(m.by).error, 'Nobody can hold more than that. Nothing was undone.');
      state.coins = [
        ...(state.coins || []),
        ...list.map((x) => ({ id: `undo-${c.batch}-${personId(x.to)}`, type: 'refund', person: x.to, amount: -x.amount, label: `Gift undone by ${boss}: from ${x.from}`, at: now })),
        { id: `undo-${c.batch}-from`, type: 'refund', person: m.by, amount: total, label: `Gift undone by ${boss}: to ${c.group || list[0].to}`, at: now },
      ];
      state.chat = { ...state.chat, [conv]: state.chat[conv].map((x) => (x.id === msgId ? { ...x, cmd: { ...x.cmd, undone: { by: actor.name, at: now, total, n: list.length } } } : x)) };
      commit();
      return { ok: true, mode: 'undogift', total, n: list.length };
    }
    const who = String(person || '').trim();
    const check = dispute.fixCheck(m, who, mode);
    if (check.problem) return note(check.problem, check.body);
    const keys = (state.refundKeys ||= {});
    const key = dispute.refundKeyId(msgId, who);
    if (keys[key]) return note(keys[key].mode === 'takeback' ? 'That win was already taken back.' : 'That result was already refunded.', 'Each result is put right once.');
    const link = demoLine({ who, conv, msgId, game: check.game, net: check.net, cardAt: m.at || 0 });
    if (link.problem) return link.problem;
    const amount = check.amount;
    if (mode === 'refund' && ctx.balanceOf && overCeiling(ctx.balanceOf(who), amount)) {
      const c = ceilingNote(who, 'Nobody can hold more than that. Nothing was refunded.');
      return note(c.error, c.body);
    }
    keys[key] = { mode, via: 'card', at: now };
    state.coins = [
      ...(state.coins || []),
      { id: `card-${msgId}-${personId(who)}`, ...dispute.fixEntry({ person: who, mode, amount, game: check.game, msgId, by: actor.name, now, reverses: link.reverses }) },
    ];
    demoTag(conv, msgId, dispute.adjustTag({ person: who, mode, amount, by: actor.name, now }));
    const rep = (state.disputes || []).find((y) => y.id === dispute.reportId(msgId, who) && y.status === 'open');
    if (rep)
      Object.assign(
        rep,
        mode === 'refund'
          ? { status: 'refunded', handledBy: actor.name, handledAt: now, refund: amount, resolutionNote: 'Refunded from the card in chat.', via: 'card' }
          : { status: 'dismissed', handledBy: actor.name, handledAt: now, refund: 0, resolutionNote: 'The win was taken back.', via: 'card' },
      );
    if (rep) clearReportNote(rep);
    if (who !== actor.name)
      state.inbox = [
        { id: uid(), type: 'dispute', ...dispute.fixNote({ mode, amount, game: check.game, by: actor.name }), open: `chat:${conv}`, at: now, read: false, to: who },
        ...(state.inbox || []),
      ];
    commit();
    return { ok: true, mode, amount, person: who, game: check.game };
  },
  // Tetris and Minesweeper, run here the way the funGame function runs them
  // (functions/shared/funGames.js): a game gets its seed here and its moves
  // are replayed here before anything is paid or counted.
  // Demo mode has no server: its numbers are worked out here, so the check
  // reads the same wallet the app shows (and always matches).
  async coinCheck(req, actor, { walletOf }) {
    const name = req?.name || actor.name;
    if (name !== actor.name && !actor.admin) throw new Error('You can only check your own balance.');
    const w = walletOf(name);
    return {
      ok: true,
      demo: true,
      name,
      serverNow: Date.now(),
      cacheAgeMs: 0,
      aliases: [name],
      balance: w.balance,
      earned: w.earned,
      breakdown: breakdown(w.history),
      items: w.history.slice(0, 400).map((x) => ({ at: x.at, kind: x.kind, amount: x.amount, label: x.label, ...(x.day && { day: x.day }) })),
      bank: { net: (state.bank || {})[name]?.net || 0, since: (state.bank || {})[name]?.since || null, docs: [], recent: [] },
    };
  },
  async funGame(req, actor, ctx) {
    const now = Date.now();
    const me = actor.name;
    const note = (title, body = '') => ({ note: { title, body } });
    const games = (state.funGames ||= {});
    if (req.action === 'start') {
      const { game, mode } = req;
      if (!fun.GAMES.includes(game) || !fun.MODES[game]?.[mode]) return note('Which game?');
      if ((state.settings?.commands?.off || []).includes(game)) return note(`/${game} is turned off`);
      if (me !== REQUESTS_TO && (state.controls?.off || []).includes('casinoOnShift') && (state.shifts || []).some((x) => !x.end && x.person === me))
        return note(...casino.SHIFT_NOTE);
      const s = { person: me, game, mode, startedAt: now, done: false, level: 1, speed: '', race: null, tournament: null };
      if (mode === 'race') {
        const { conv, msgId } = req.race || {};
        const c = ((state.chat || {})[conv] || []).find((x) => x.id === msgId)?.cmd;
        if (!c || c.name !== game || c.status !== 'playing') return note('That race isn’t on.');
        if (me !== c.game.a && me !== c.game.b) return note('You’re not in this race.');
        if (c.game.results?.[me]) return note('You already finished this race.');
        Object.assign(s, { seed: c.game.seed, level: c.game.level || 'beginner', race: { conv, msgId } });
      } else if (mode === 'tournament') {
        const t = (state.tournaments || []).find((x) => x.id === req.tournament);
        if (!t || t.game !== fun.tourGame(game) || t.status !== 'open' || now >= t.endsAt) return note('That tournament is over.');
        if (!t.players?.[me]) return note('Join it first.', 'Tournament entries are in the market.');
        if (t.players[me].voided) return note('Your result in this tournament was voided.', 'Team management voided it, so new games don’t count.');
        const attempt = Object.values(games).filter((x) => x.tournament === t.id && x.person === me).length + 1;
        // Minesweeper: a board of your own each time, played "on the server" (here).
        const seed = game === 'minesweep' ? attemptSeed(`${t.seed}:demo:${me}`, attempt) : attemptSeed(`${t.seed}:demo`, attempt);
        Object.assign(s, { tournament: t.id, attempt, seed, level: game === 'minesweep' ? fun.TOURNAMENT_LEVEL : 1 });
      } else {
        s.seed = newSeed();
        if (game === 'tetris') s.level = Math.max(1, Math.min(15, Math.floor(Number(req.level)) || 1));
        else s.level = MINE_LEVELS[req.level] ? req.level : 'beginner';
        if (mode === 'bot') Object.assign(s, fun.botPick(req));
      }
      const id = uid();
      games[id] = s;
      commit();
      const server = fun.serverRun(s);
      return { ok: true, id, seed: server ? null : s.seed, server, mode, level: s.level, speed: s.speed, botLevel: s.botLevel || '', attempt: s.attempt || 0, serverNow: now };
    }
    const s = games[req.id];
    // A Minesweeper tournament tap, the way funGame 'sweep' plays it.
    if (req.action === 'sweep') {
      if (!s || s.person !== me || !fun.serverRun(s)) return note('That game is gone.');
      if (s.done) return note('That game is already over.');
      const from = req.from;
      const received = s.received || 0;
      if (!Array.isArray(req.acts) || from > received) return note('That game got out of step.', 'Start a new one.');
      const fresh = req.acts.slice(received - from);
      const log = s.log || [];
      const tooLong = now > s.startedAt + fun.tournamentGrace(s.game);
      const firstAt = s.firstAt || (fresh.some(([k]) => k !== mines.ACT.flag) ? now : 0);
      const ms = firstAt ? Math.max(log.length ? log[log.length - 3] : 0, now - firstAt) : 0;
      const opts = fun.gameOpts(s);
      const turn = mines.serverTurn(opts, log, tooLong ? [] : fresh, ms);
      Object.assign(s, { log: turn.log, received: from + req.acts.length, firstAt });
      const view = {
        open: received > from ? mines.openCells(turn.game) : turn.open,
        done: turn.done || turn.full || tooLong,
        won: turn.won,
        lost: turn.lost,
        boom: turn.boom,
        ms: turn.game.ms,
      };
      if (!view.done) {
        commit();
        return { ok: true, ...view };
      }
      const r = mines.replay(opts, turn.log);
      const problem = tooLong ? 'That game took too long to count.' : turn.full ? 'That game had too many taps.' : r.error || '';
      const result = r.error ? mines.summary(turn.game) : r;
      const rec = recordDemoRun(s, me, result, problem ? null : fun.tournamentScore(s.game, result), problem, '', now);
      const where = (turn.game.mines || []).flatMap((m, i) => (m ? [i] : []));
      return { ...rec, ...view, mines: where, result };
    }
    if (req.action === 'finish' || req.action === 'tournament') {
      if (!s || s.person !== me) return note('That game is gone.');
      if (s.done) return note('That game is already in.');
      if (fun.serverRun(s)) return note('That game is played on the server.');
      const r = fun.replayGame(s, req.moves);
      if (r.error) return note(r.error);
      const problem = fun.timingProblem(s, r, now - s.startedAt);
      if (s.mode === 'tournament') {
        const review = problem ? '' : fun.reviewReason(s, req.moves);
        return recordDemoRun(s, me, r, fun.tournamentScore(s.game, r), problem, review, now);
      }
      Object.assign(s, { done: true, finishedAt: now, result: r, problem });
      if (s.mode === 'race') {
        commit();
        const out = await demoStore.play({ action: 'move', conv: s.race.conv, msgId: s.race.msgId, move: problem ? 'resign' : 'finish' }, actor, ctx, problem ? null : r);
        if (problem) return note(problem);
        return out.note ? out : { ok: true, result: r };
      }
      const bot = s.mode === 'bot' ? fun.botResult(s) : null;
      const won = bot ? fun.beatBot(s.game, r, bot) : false;
      const coins = problem || (state.controls?.off || []).includes('coins') ? 0 : fun.coinsFor(s, r, won);
      Object.assign(s, { bot, won, coins });
      const label = `${fun.GAME_LABEL[s.game]}: ${bot ? (won ? 'beat Trotbot' : 'lost to Trotbot') : fun.resultLine(s.game, s.mode, r)}`;
      const paid = coins ? demoAward({ person: me, amount: coins, source: 'game', label, key: `game-${req.id}` }, now) : 0;
      s.paid = paid;
      commit();
      if (problem) return note(problem, 'It doesn’t count, and pays nothing.');
      return { ok: true, result: r, bot, won, coins, paid };
    }
    if (req.action === 'share') {
      if (req.conv !== ARCADE) return { note: { ...ARCADE_NOTE } };
      if (!s || s.person !== me || !s.done || s.problem) return note('That game can’t be shared.');
      if (s.shared) return note('Already posted.');
      const line = fun.resultLine(s.game, s.mode, s.result);
      s.shared = true;
      const m = {
        id: uid(),
        text: `/${s.game} · ${line}`,
        by: me,
        byUid: actor.uid,
        at: now,
        cmd: {
          name: s.game,
          share: true,
          mode: s.mode,
          level: s.level,
          speed: s.speed || '',
          result: s.result,
          line,
          bot: s.bot ? { ...s.bot, line: fun.resultLine(s.game, 'bot', s.bot) } : null,
          won: !!s.won,
          paid: s.paid || 0,
        },
        mentions: [],
        taskIds: [],
        replyTo: null,
        reactions: {},
      };
      state.chat = { ...(state.chat || {}), [req.conv]: [...((state.chat || {})[req.conv] || []), m] };
      commit();
      return { ok: true };
    }
    return note('Unknown action.');
  },
  async submitTournamentScore({ id, moves, session }, actor) {
    const s = (state.funGames || {})[session];
    if (!s || s.tournament !== id) return { note: { title: 'That game is gone.' } };
    return demoStore.funGame({ action: 'tournament', id: session, moves }, actor);
  },
  // Races in demo mode are against Trotbot, so nobody else's picture comes in.
  async setRaceLive(race, data, actor) {
    state.raceLive = { ...(state.raceLive || {}), [`${race}_${actor.name}`]: { ...data, race, name: actor.name, at: Date.now() } };
  },
  subscribeRaceLive(race, cb) {
    cb(Object.values(state.raceLive || {}).filter((x) => x.race === race));
    return () => {};
  },
  subscribeLottery(cb) {
    // Friday 6 PM came and went: draw it (the real one is a scheduled function).
    const check = () => state.lottery?.drawAt && state.lottery.drawAt <= Date.now() && state.lottery.pot && demoStore.drawLottery();
    check();
    const t = setInterval(check, 10000);
    const off = listen(() => cb(state.lottery || null));
    return () => {
      clearInterval(t);
      off();
    };
  },
  subscribeControls(cb) {
    return listen(() => cb(state.controls || {}));
  },
  // Loans (functions/loans.js; demoLoans.js here). ctx: { balanceOf, roster }.
  async loan(fn, req, actor, ctx) {
    return loans.call(fn, req, actor, ctx);
  },
  subscribeLoans(actor, cb) {
    return listen(() => cb(loans.visible(actor).map((l) => ({ ...l }))));
  },
  subscribeLoanSettings(cb) {
    return listen(() => cb(state.loanSettings || {}));
  },
  // Gambling buddy (functions/buddy.js; demoBuddy.js here): { ok, done, lock } or { note }.
  async buddy(req, actor, ctx) {
    await demoLag();
    return buddies.call(req, actor, ctx);
  },
  // The locks this person is in (theirs, or as someone's buddy); every lock for the owner.
  subscribeBuddy(actor, cb) {
    return listen(() => cb(buddies.visible(actor).map((l) => ({ ...l }))));
  },
  // The server's loanTick (due dates, reminders), run while the app is open.
  loanTick(ctx) {
    loans.tick(ctx);
  },
  async saveControls(patch, actor) {
    state.controls = { ...(state.controls || {}), ...patch, by: actor.name, updatedAt: Date.now() };
    commit();
  },
  subscribeShutdown(cb) {
    return listen(() => cb(state.shutdown || null));
  },
  async setShutdown(data, actor) {
    state.shutdown = { ...data, by: actor.name, updatedAt: Date.now() };
    commit();
  },
  async sendShutdownReply(text, round, actor, person = actor.name) {
    const sd = state.shutdown;
    const forMe = sd?.on && (!sd.people?.length || sd.people.includes(actor.name));
    if (!forMe && person === actor.name) throw new Error('The app is back on.');
    state.shutdownReplies = [
      { id: uid(), text, round, person, name: actor.name, byUid: actor.uid, at: Date.now() },
      ...(state.shutdownReplies || []),
    ];
    commit();
  },
  subscribeShutdownThread(person, cb) {
    return listen(() => cb((state.shutdownReplies || []).filter((r) => (r.person || r.name) === person).sort((a, b) => a.at - b.at)));
  },
  subscribeShutdownReplies(cb) {
    return listen(() => cb([...(state.shutdownReplies || [])]));
  },
  async deleteShutdownReply(id) {
    state.shutdownReplies = (state.shutdownReplies || []).filter((r) => r.id !== id);
    commit();
  },
  // The demo's Friday draw (the drawLottery function on the server).
  drawLottery() {
    const lot = state.lottery;
    const now = Date.now();
    if (!lot?.pot) return;
    const entries = Object.entries(lot.tickets || {});
    const total = entries.reduce((t, [, n]) => t + n, 0);
    let r = Math.floor(Math.random() * total);
    const [winner, theirs] = entries.find(([, n]) => (r -= n) < 0) || entries[0];
    state.bank = {
      ...(state.bank || {}),
      [winner]: casino.bankAfter(
        (state.bank || {})[winner] || {},
        winner,
        lot.pot,
        { icon: '🎟️', label: `Won the lottery (${lot.pot} coins)` },
        {},
        now,
      ),
    };
    const last = { winner, pot: lot.pot, tickets: theirs, of: total, people: entries.length, at: now };
    if (lot.open) setCard(lot.open, { closed: true, pot: lot.pot, people: entries.length, winner });
    state.lottery = { pot: 0, tickets: {}, drawAt: nextFridayLocal(now + 60000), round: (lot.round || 1) + 1, last };
    const m = {
      id: uid(),
      text: `🎟️ ${winner} won the lottery: ${coinsText(lot.pot)} coins!`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: now,
      cmd: { name: 'lottery', draw: last },
      mentions: [winner],
      taskIds: [],
      replyTo: null,
      reactions: {},
    };
    state.chat = { ...(state.chat || {}), arcade: [...((state.chat || {}).arcade || []), m] };
    commit();
  },
  async ping() {
    return 18 + Math.floor(Math.random() * 40);
  },
  // /remind: the demo delivers them itself, like the reminders function does.
  async addReminder({ at, text, conv }, actor) {
    state.reminders = [...(state.reminders || []), { id: uid(), by: actor.name, at, text, conv: conv || '' }];
    commit();
    startReminders();
  },
  async resetAdStats() {
    state.adStats = {};
    state.adPeople = {};
    commit();
  },

  subscribeParts(cb) {
    return listen(() => cb([...(state.parts || [])]));
  },
  async createPart(data, actor) {
    state.parts = [...(state.parts || []), { id: uid(), ...newPartDefaults(data), createdBy: actor.name, updatedAt: Date.now() }];
    commit();
  },
  async updatePart(id, patch, actor) {
    state.parts = state.parts.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now(), updatedBy: actor.name } : p));
    commit();
  },
  async deletePart(id) {
    state.parts = state.parts.filter((p) => p.id !== id);
    commit();
  },

  subscribeResources(cb) {
    return listen(() => cb([...(state.resources || [])]));
  },
  async addResource(data, actor) {
    state.resources = [...(state.resources || []), { id: uid(), ...data, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async updateResource(id, patch, actor) {
    state.resources = (state.resources || []).map((r) =>
      r.id === id ? { ...r, ...patch, updatedBy: actor.name, updatedAt: Date.now() } : r,
    );
    commit();
  },
  async deleteResource(id) {
    state.resources = (state.resources || []).filter((r) => r.id !== id);
    commit();
  },
  subscribeChatReads(owner, cb) {
    return listen(() => cb({ ...(state.chatReads || {}) }));
  },
  async saveChatReads(owner, reads) {
    state.chatReads = { ...(state.chatReads || {}), ...reads };
    commit();
  },
  subscribeNotes(owner, cb) {
    return listen(() => cb({ ...(state.notes || {}) }));
  },
  async saveNote(owner, about, text) {
    const notes = { ...(state.notes || {}) };
    if (text) notes[about] = text.slice(0, 500);
    else delete notes[about];
    state.notes = notes;
    commit();
  },
  subscribeDiagram(id, cb) {
    return listen(() => cb(state.diagrams?.[id] ? { id, ...state.diagrams[id] } : null));
  },
  async saveDiagram(id, data, actor) {
    state.diagrams = { ...state.diagrams, [id]: { ...data, updatedBy: actor.name, updatedAt: Date.now() } };
    commit();
  },
  subscribeChecklists(cb) {
    return listen(() => cb((state.checklists || []).map((c) => ({ ...c, items: { ...c.items } }))));
  },
  async createChecklist(data, actor) {
    const id = uid();
    state.checklists = [...(state.checklists || []), { id, title: '', items: {}, ...data, createdAt: Date.now(), createdBy: actor.name }];
    commit();
    return id;
  },
  async renameChecklist(id, title) {
    state.checklists = state.checklists.map((c) => (c.id === id ? { ...c, title } : c));
    commit();
  },
  async setChecklistItem(id, item) {
    state.checklists = state.checklists.map((c) => (c.id === id ? { ...c, items: { ...c.items, [item.id]: item } } : c));
    commit();
  },
  async patchChecklistItems(id, patches) {
    state.checklists = state.checklists.map((c) => {
      if (c.id !== id) return c;
      const items = { ...c.items };
      for (const [itemId, patch] of Object.entries(patches)) items[itemId] = { ...items[itemId], ...patch };
      return { ...c, items };
    });
    commit();
  },
  async removeChecklistItem(id, itemId) {
    state.checklists = state.checklists.map((c) => {
      if (c.id !== id) return c;
      const items = { ...c.items };
      delete items[itemId];
      return { ...c, items };
    });
    commit();
  },
  async deleteChecklist(id) {
    state.checklists = state.checklists.filter((c) => c.id !== id);
    commit();
  },

  subscribeRuns(cb) {
    return listen(() => cb([...(state.runs || [])]));
  },
  async createRun(data, actor) {
    const run = { id: uid(), ...newRunDefaults(data), createdAt: Date.now(), createdBy: actor.name };
    state.runs = [...(state.runs || []), run];
    life.runLogged(run);
    commit();
  },
  async updateRun(id, patch, actor) {
    state.runs = state.runs.map((r) => (r.id === id ? { ...r, ...patch, updatedBy: actor.name } : r));
    commit();
  },
  async deleteRun(id) {
    state.runs = state.runs.filter((r) => r.id !== id);
    commit();
  },

  // Competition matches: a sample event around now, so the pit screen has
  // something to show (team management turns competition mode on by hand).
  subscribeMatches(cb) {
    if (demoMatchesStale()) {
      seedDemoMatches();
      commit();
    }
    return listen(() => cb([...(state.matches || [])]));
  },
  async saveMatch({ id, ...data }, actor, oldId = null) {
    const was = (state.matches || []).find((m) => m.id === id);
    state.matches = [
      ...(state.matches || []).filter((m) => m.id !== id && m.id !== oldId),
      { ...was, id, ...data, updatedAt: Date.now(), updatedBy: actor.name },
    ];
    commit();
  },
  async deleteMatch(id) {
    state.matches = (state.matches || []).filter((m) => m.id !== id);
    commit();
  },
  async logMatchScore(matchId, run, ours, result, actor) {
    const runId = ours.runId && (state.runs || []).some((r) => r.id === ours.runId) ? ours.runId : uid();
    state.runs = ours.runId
      ? (state.runs || []).filter((r) => r.id !== runId).concat({ id: runId, ...newRunDefaults(run), updatedBy: actor.name, createdAt: Date.now() })
      : [...(state.runs || []), { id: runId, ...newRunDefaults(run), createdAt: Date.now(), createdBy: actor.name }];
    state.matches = (state.matches || []).map((m) => (m.id === matchId ? { ...m, ours: { ...ours, runId }, result, updatedBy: actor.name } : m));
    life.runLogged(state.runs.find((r) => r.id === runId));
    commit();
  },
  // Robot batteries: six sample packs, some used in the sample matches.
  subscribeBatteries(cb) {
    if (!state.batteries) {
      state.batteries = seedDemoBatteries();
      commit();
    }
    return listen(() => cb([...(state.batteries || [])]));
  },
  async addBattery(data) {
    state.batteries = [...(state.batteries || []), { id: uid(), ...data }];
    commit();
  },
  async changeBatteries(changes) {
    const by = new Map(changes.map((c) => [c.id, c.patch]));
    state.batteries = (state.batteries || []).map((b) => (by.has(b.id) ? { ...b, ...by.get(b.id) } : b));
    commit();
  },
  async updateBattery(id, patch) {
    state.batteries = (state.batteries || []).map((b) => (b.id === id ? { ...b, ...patch } : b));
    commit();
  },
  async deleteBattery(id) {
    state.batteries = (state.batteries || []).filter((b) => b.id !== id);
    commit();
  },
  async setChecklistQueue(id, queue) {
    state.checklists = state.checklists.map((c) => (c.id === id ? { ...c, queue } : c));
    commit();
  },
  // No FTC Events key in the demo: the same answer the real function gives
  // before one is set up.
  // Team life (demoLife.js), the same answers as the server's functions.
  async claimBingo(req, actor) {
    return life.claimBingo(req, actor);
  },
  async predict(req, actor) {
    return life.predict(req, actor);
  },
  async recap(req, actor) {
    return life.recap(req, actor);
  },
  subscribePredictions(cb) {
    life.tick();
    return listen(() => cb([...(state.predictions || [])]));
  },
  async ftcEvents() {
    await new Promise((r) => setTimeout(r, 400));
    return { notSetUp: true };
  },

  // Scouting (the Scout page).
  subscribeScoutTeams(cb) {
    return listen(() => cb([...(state.scoutTeams || [])]));
  },
  subscribeScoutEntries(cb) {
    return listen(() => cb([...(state.scoutEntries || [])]));
  },
  subscribeScoutPicks(cb) {
    return listen(() => cb({ ...(state.scoutPicks || {}) }));
  },
  async saveScoutTeam({ number, ...data }, actor) {
    const id = String(number);
    const was = (state.scoutTeams || []).find((t) => t.id === id);
    state.scoutTeams = [...(state.scoutTeams || []).filter((t) => t.id !== id), { ...was, id, number, ...data, updatedAt: Date.now(), updatedBy: actor.name }];
    commit();
  },
  async deleteScoutTeam(number) {
    state.scoutTeams = (state.scoutTeams || []).filter((t) => t.id !== String(number));
    commit();
  },
  async saveScoutNotes(number, notes, actor) {
    state.scoutTeams = (state.scoutTeams || []).map((t) =>
      t.id === String(number) ? { ...t, notes, notesBy: actor.name, notesAt: Date.now(), updatedAt: Date.now(), updatedBy: actor.name } : t,
    );
    commit();
  },
  async createScoutEntry(entry, actor) {
    state.scoutEntries = [...(state.scoutEntries || []), { id: `s${uid()}`, ...entry, createdBy: actor.name, createdByUid: actor.uid || 'demo', createdAt: Date.now() }];
    commit();
  },
  async updateScoutEntry(id, patch, actor) {
    state.scoutEntries = (state.scoutEntries || []).map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now(), updatedBy: actor.name } : e));
    commit();
  },
  async deleteScoutEntry(id) {
    state.scoutEntries = (state.scoutEntries || []).filter((e) => e.id !== id);
    commit();
  },
  async saveScoutPicks(patch, actor) {
    state.scoutPicks = { ...(state.scoutPicks || {}), ...patch, updatedAt: Date.now(), updatedBy: actor.name };
    commit();
  },

  // Chat: messages kept per conversation (channel id or 'dm:<id>'); photos
  // stored as small data URLs.
  subscribeChannel(conv, count, cb) {
    return listen(() => cb([...((state.chat || {})[conv] || [])].sort((a, b) => a.at - b.at).slice(-count)));
  },
  async loadOlderMessages(conv, beforeAt, count) {
    return [...((state.chat || {})[conv] || [])]
      .filter((m) => m.at < beforeAt)
      .sort((a, b) => a.at - b.at)
      .slice(-count);
  },
  subscribeSince(conv, at, cb) {
    return listen(() => cb([...((state.chat || {})[conv] || [])].filter((m) => m.at >= at).sort((a, b) => a.at - b.at)));
  },
  subscribeMessage(conv, id, cb) {
    return listen(() => cb(((state.chat || {})[conv] || []).find((m) => m.id === id) || null));
  },
  async recentMessages(conv, count) {
    return [...((state.chat || {})[conv] || [])].sort((a, b) => b.at - a.at).slice(0, count);
  },
  async sendMessage(conv, data, actor, photoFiles) {
    // Like the rules (3.2): the app's own coin cards only in #arcade.
    if (conv !== ARCADE && ['give', 'balance', 'leaderboard'].includes(data?.cmd?.name)) throw Object.assign(new Error('Coins and games are in #arcade'), { code: 'permission-denied' });
    let photo = null;
    if (photoFiles) {
      const url = await dataUrl(photoFiles.thumb);
      photo = { id: uid(), url, thumbUrl: url, width: photoFiles.width, height: photoFiles.height };
    }
    const m = {
      id: uid(),
      text: '',
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: {},
      ...data,
      photo,
      by: actor.name,
      byUid: actor.uid,
      at: Date.now(),
    };
    // Pretend the server found a preview for the first link.
    const link = /https?:\/\/[^\s<>()]+/.exec(m.text || '')?.[0];
    if (link) m.preview = demoPreview(link);
    state.chat = { ...(state.chat || {}), [conv]: [...((state.chat || {})[conv] || []), m] };
    if (conv.startsWith('dm:'))
      state.dms = state.dms.map((d) =>
        `dm:${d.id}` === conv ? { ...d, lastAt: m.at, lastBy: actor.name, lastText: m.text || 'Photo' } : d,
      );
    commit();
  },
  async uploadChatGif(conv, file) {
    if (file.size > 1.5e6) throw new Error('Demo mode only keeps GIFs under 1.5 MB.');
    return { url: await dataUrl(file) };
  },
  async editMessage(conv, id, patch) {
    updateMsg(conv, id, (m) => ({ ...m, ...patch, editedAt: Date.now() }));
  },
  async deleteMessages(conv, msgs, hard) {
    if (!hard) {
      for (const m of msgs) if (!m.deleted) await this.deleteMessage(conv, m);
      return;
    }
    const gone = new Set(msgs.map((m) => m.id));
    state.chat = { ...state.chat, [conv]: ((state.chat || {})[conv] || []).filter((m) => !gone.has(m.id)) };
    commit();
  },
  async deleteMessage(conv, msg) {
    updateMsg(conv, msg.id, (m) => ({
      ...m,
      deleted: true,
      text: '',
      photo: null,
      gif: null,
      poll: null,
      preview: null,
      taskIds: [],
      mentions: [],
      reactions: {},
      votes: {},
      supers: {},
      sticker: null,
      files: [],
      pinned: false,
    }));
  },
  async react(conv, id, emoji, actor, on) {
    updateMsg(conv, id, (m) => {
      const who = { ...((m.reactions || {})[emoji] || {}) };
      if (on) who[actor.uid] = actor.name;
      else delete who[actor.uid];
      return { ...m, reactions: { ...m.reactions, [emoji]: who } };
    });
  },
  async superReact(conv, id, emoji, actor, on) {
    updateMsg(conv, id, (m) => {
      const who = { ...((m.supers || {})[emoji] || {}) };
      if (on) who[actor.uid] = actor.name;
      else delete who[actor.uid];
      return { ...m, supers: { ...m.supers, [emoji]: who } };
    });
  },
  // Demo files stay in this browser only (an object URL).
  async uploadChatFile(conv, file, onProgress) {
    onProgress?.(1);
    return { name: file.name, size: file.size, type: file.type || '', url: URL.createObjectURL(file), path: '' };
  },
  async removeReaction(conv, id, emoji) {
    updateMsg(conv, id, (m) => {
      const reactions = { ...m.reactions };
      delete reactions[emoji];
      return { ...m, reactions };
    });
  },
  async removeSuperReaction(conv, id, emoji) {
    updateMsg(conv, id, (m) => {
      const supers = { ...m.supers };
      delete supers[emoji];
      return { ...m, supers };
    });
  },
  async vote(conv, msg, optionId, actor, on, rename) {
    const me = personId(actor.name);
    const cur = findMsg(conv, msg.id) || msg;
    if (cur.poll.closed) throw new Error('This poll has ended.');
    if (on && usesVoteButton(cur.poll)) return this.votePicks(conv, msg, [...myPicks(cur, actor.name, rename), optionId], actor, rename);
    if (on && cur.poll.selfVote === false && !checkPicks({ ...cur.poll, pick: { mode: 'any' }, multi: true }, [optionId], actor.name, rename).ok)
      throw new Error('You can’t vote for yourself here.');
    updateMsg(conv, msg.id, (m) => {
      const votes = Object.fromEntries(Object.entries(m.votes || {}).map(([k, v]) => [k, { ...v }]));
      if (on && !m.poll.multi) for (const k of Object.keys(votes)) delete votes[k][me];
      votes[optionId] = votes[optionId] || {};
      if (on) votes[optionId][me] = actor.name;
      else delete votes[optionId][me];
      return { ...m, votes };
    });
  },
  // A person's whole vote at once; the picks have to follow the poll's rule.
  async votePicks(conv, msg, ids, actor, rename, text) {
    const me = personId(actor.name);
    const cur = findMsg(conv, msg.id) || msg;
    const written = text !== undefined ? !!text : !!cur.votes?.text?.[me]?.text;
    const check = checkPicks(cur.poll, ids, actor.name, rename, { written });
    if (!check.ok) throw new Error(check.why);
    updateMsg(conv, msg.id, (m) => {
      const votes = Object.fromEntries(Object.entries(m.votes || {}).map(([k, v]) => [k, { ...v }]));
      for (const o of m.poll.options) {
        votes[o.id] = votes[o.id] || {};
        if (check.ids.includes(o.id)) votes[o.id][me] = actor.name;
        else delete votes[o.id][me];
      }
      if (text !== undefined) {
        if (text) votes.text = { ...(votes.text || {}), [me]: { name: actor.name, text, at: Date.now() } };
        else if (votes.text) delete votes.text[me];
      }
      return { ...m, votes };
    });
  },
  // A written-answer poll: votes.text[person] = { name, text, at } (empty text removes it).
  async answerPoll(conv, msg, text, actor) {
    const me = personId(actor.name);
    updateMsg(conv, msg.id, (m) => {
      const answers = { ...(m.votes?.text || {}) };
      if (text) answers[me] = { name: actor.name, text, at: Date.now() };
      else delete answers[me];
      return { ...m, votes: { ...(m.votes || {}), text: answers } };
    });
  },
  async pin(conv, id, on, actor) {
    updateMsg(conv, id, (m) => ({ ...m, pinned: on, pinnedBy: on ? actor.name : '', pinnedAt: on ? Date.now() : 0 }));
  },
  subscribePins(conv, cb) {
    return listen(() => cb(((state.chat || {})[conv] || []).filter((m) => m.pinned)));
  },
  async hidePreview(conv, id) {
    updateMsg(conv, id, (m) => ({ ...m, preview: false }));
  },

  subscribeChannels(cb) {
    return listen(() => cb([...(state.channels || [])]));
  },
  async saveChannel(id, data) {
    const rest = (state.channels || []).filter((c) => c.id !== id);
    const prev = (state.channels || []).find((c) => c.id === id) || {};
    state.channels = [...rest, { ...prev, ...data, id }];
    commit();
  },

  // Channel requests, like functions/channels.js (same checks from shared/channels.js).
  subscribeChannelRequests(actor, all, cb) {
    return listen(() => cb((state.channelRequests || []).filter((r) => all || r.by === actor.name).sort((a, b) => a.at - b.at)));
  },
  subscribePrivateChannels(actor, all, cb) {
    return listen(() => cb((state.privateChannels || []).filter((c) => all || (c.members || []).includes(actor.name))));
  },
  async savePrivateChannel(id, data, actor) {
    state.privateChannels = (state.privateChannels || []).map((c) => (c.id === id ? { ...c, ...data, updatedAt: Date.now(), updatedBy: actor.name } : c));
    commit();
  },
  async requestChannel(data, actor) {
    const mine = (state.channelRequests || []).filter((r) => r.by === actor.name);
    const limit = chan.limitError(mine, Date.now(), teamDay);
    if (limit) throw new Error(limit);
    const checked = chan.checkRequest(data, {
      me: actor.name,
      known: demoNames(),
      taken: chan.takenNames({ channels: state.channels || [], privates: state.privateChannels || [], requests: state.channelRequests || [] }),
    });
    if (checked.error) throw new Error(checked.error);
    const id = `cr-${uid()}`;
    const at = Date.now();
    state.channelRequests = [
      ...(state.channelRequests || []),
      { id, ...checked.value, by: actor.name, byUid: actor.uid || 'demo', at, status: 'pending', decidedBy: '', decidedAt: null, note: '', channelId: '' },
    ];
    // Team management's bell.
    state.inbox = [
      { id: uid(), type: 'channelRequest', title: `${actor.name.split(' ')[0]} asked for #${checked.value.name}`, body: checked.value.purpose, open: 'channels:requests', at, read: false, to: REQUESTS_TO },
      ...(state.inbox || []),
    ];
    commit();
    return { ok: true, id };
  },
  async cancelChannelRequest(id, actor) {
    const r = (state.channelRequests || []).find((x) => x.id === id);
    if (!r || r.by !== actor.name) throw new Error('That isn’t your request.');
    if (r.status !== 'pending') throw new Error(`It was already ${r.status}.`);
    state.channelRequests = state.channelRequests.map((x) => (x.id === id ? { ...x, status: 'cancelled', decidedBy: actor.name, decidedAt: Date.now() } : x));
    commit();
    return { ok: true };
  },
  // decision: { approve: true, name?, kind?, invitees? } or { decline: true, note? }
  async decideChannelRequest(id, decision, actor) {
    if (!actor.admin) throw new Error('Only team management decides.');
    const r = (state.channelRequests || []).find((x) => x.id === id);
    if (!r) throw new Error('That request is gone.');
    if (r.status !== 'pending') throw new Error(`It was already ${r.status}.`);
    const now = Date.now();
    const tell = (title, body, open) => {
      state.inbox = [{ id: uid(), type: 'channelRequest', title, body, open, at: now, read: false, to: r.by }, ...(state.inbox || [])];
    };
    if (decision.decline) {
      const note = chan.cleanNote(decision.note);
      state.channelRequests = state.channelRequests.map((x) => (x.id === id ? { ...x, status: 'declined', decidedBy: actor.name, decidedAt: now, note } : x));
      tell(`Your channel request for #${r.name} was declined`, note ? `${actor.name.split(' ')[0]}: ${note}` : 'Ask team management if you want to know more.', '');
      commit();
      return { ok: true };
    }
    const chans = state.channels || [];
    const privs = state.privateChannels || [];
    const checked = chan.checkRequest(
      { name: decision.name ?? r.name, purpose: r.purpose, kind: decision.kind ?? r.kind, invitees: decision.invitees ?? r.invitees },
      { me: r.by, known: demoNames(), taken: chan.takenNames({ channels: chans, privates: privs }) },
    );
    if (checked.error) throw new Error(checked.error);
    const v = checked.value;
    const cid = chan.freeId(v.name, chan.usedIds({ channels: chans, privates: privs }));
    const members = [r.by, ...v.invitees];
    const order = Math.max(20, ...[...chans, ...privs].map((c) => (typeof c.order === 'number' ? c.order : 0))) + 1;
    const channel = { id: cid, name: v.name, topic: v.purpose, subteam: '', order, deleted: false, createdBy: r.by, requestId: id, updatedAt: now, updatedBy: actor.name };
    if (v.kind === 'private') state.privateChannels = [...privs, { ...channel, members }];
    else state.channels = [...chans, channel];
    state.chat = {
      ...(state.chat || {}),
      [cid]: [
        {
          id: uid(), text: chan.createdText(r.by, v.purpose, v.kind, members.length), by: 'Trotbot', byUid: 'trotbot', bot: true, at: now,
          mentions: [], taskIds: [], replyTo: null, reactions: {}, photo: null,
        },
      ],
    };
    state.channelRequests = state.channelRequests.map((x) =>
      x.id === id ? { ...x, status: 'approved', name: v.name, kind: v.kind, invitees: v.invitees, decidedBy: actor.name, decidedAt: now, note: '', channelId: cid } : x,
    );
    tell(`Your channel #${v.name} was approved`, v.kind === 'private' ? 'It’s private: only the people you invited can see it.' : 'It’s ready in your channel list.', `chat:${cid}`);
    commit();
    return { ok: true, channelId: cid };
  },

  subscribeDms(actor, all, cb) {
    return listen(() => cb((state.dms || []).filter((d) => all || d.people.includes(actor.name))));
  },
  async openDm(people, actor, name = '') {
    const sorted = [...new Set(people)].sort();
    const id = sorted.length === 2 ? sorted.map(personId).join('--') : uid();
    if (!(state.dms || []).some((d) => d.id === id)) {
      state.dms = [
        ...(state.dms || []),
        { id, people: sorted, name, createdBy: actor.name, createdAt: Date.now(), lastAt: Date.now(), lastBy: '', lastText: '' },
      ];
      commit();
    }
    return `dm:${id}`;
  },
  async renameDm(id, name) {
    state.dms = state.dms.map((d) => (d.id === id ? { ...d, name } : d));
    commit();
  },

  subscribeProfiles(cb) {
    return listen(() => cb([...(state.profiles || [])]));
  },
  async saveProfile(name, patch) {
    const id = personId(name);
    const prev = (state.profiles || []).find((p) => p.id === id) || {};
    const merged = { ...prev, ...patch, id, name, updatedAt: Date.now() };
    if (patch.notify) merged.notify = { ...(prev.notify || {}), ...patch.notify };
    state.profiles = [...(state.profiles || []).filter((p) => p.id !== id), merged];
    commit();
  },
  async uploadAvatar(name, blob) {
    const photo = { url: await dataUrl(blob), path: '' };
    await this.saveProfile(name, { photo });
    return photo;
  },
  async uploadAdImage(name, blob) {
    return dataUrl(blob);
  },
  async uploadBanner(name, blob) {
    await this.saveProfile(name, { banner: { url: await dataUrl(blob), path: '' } });
  },
  async uploadEffectImage(name, file) {
    return { url: await dataUrl(file), path: '' };
  },
  async removeBanner(name) {
    await this.saveProfile(name, { banner: null });
  },
  async removeAvatar(name) {
    await this.saveProfile(name, { photo: null });
  },

  // A few teammates look online, and one is "typing" in #general.
  subscribePresence(cb) {
    return listen(() => {
      const now = Date.now();
      cb([
        ...(state.presence || []),
        { id: 'p-seb', name: 'Sebastian Tolbert', at: now },
        { id: 'p-cooper', name: 'Cooper Mlezcko', at: now, typing: 'general', typingAt: now + 3600000 },
        { id: 'p-sophia', name: 'Sophia Bermudez', at: now - 60000 },
      ]);
    });
  },
  async setPresence(actor, patch) {
    state.presence = [...(state.presence || []).filter((p) => p.id !== actor.uid), { id: actor.uid, name: actor.name, ...patch }];
    // Presence isn't saved, so skip localStorage and just notify.
    for (const fn of listeners) fn();
  },

  subscribeStickers(cb) {
    return listen(() => cb([...(state.stickers || [])]));
  },
  async addSticker(name, file, actor) {
    if (file.size > 400000) throw new Error('Demo mode only keeps stickers under 400 KB.');
    state.stickers = [...(state.stickers || []), { id: uid(), name, url: await dataUrl(file), path: '', by: actor.name, at: Date.now() }];
    commit();
  },
  async deleteSticker(s) {
    state.stickers = (state.stickers || []).filter((x) => x.id !== s.id);
    commit();
  },

  // The lab log. The real app's onLabLog function makes #lab-log's day post;
  // the demo does it here.
  subscribeLabLogs(sinceDay, cb) {
    return listen(() => cb((state.labLogs || []).filter((l) => l.day >= sinceDay)));
  },
  async saveLabLog(id, log, actor) {
    const prev = (state.labLogs || []).find((l) => l.id === id) || {};
    const merged = { ...prev, ...log, id, updatedAt: Date.now(), updatedBy: actor.name };
    state.labLogs = [...(state.labLogs || []).filter((l) => l.id !== id), merged];
    const msgId = `labday-${merged.day}`;
    const list = (state.chat || {})['lab-log'] || [];
    const people = [...new Set(state.labLogs.filter((l) => l.day === merged.day).map((l) => l.person))];
    const day = list.find((m) => m.id === msgId);
    const post = {
      id: msgId,
      text: `🧪 Lab log: ${people.join(', ')}`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: day?.at || Date.now(),
      cmd: { name: 'labday', day: merged.day, people },
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: day?.reactions || {},
    };
    state.chat = { ...(state.chat || {}), 'lab-log': day ? list.map((m) => (m.id === msgId ? { ...m, ...post } : m)) : [...list, post] };
    commit();
  },
  async uploadLabPhoto(prepared) {
    const toUrl = (blob) =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
    // Just the small one: the demo lives in this browser's storage, which is small.
    const thumb = await toUrl(prepared.thumb);
    return { url: thumb, thumbUrl: thumb, path: '', width: prepared.width, height: prepared.height };
  },
  // Voice notes are kept as data URLs (30 s of speech is small).
  async uploadLabVoice(blob, ms) {
    const url = await dataUrl(blob);
    return { url, path: '', type: (blob.type || 'audio/mp4').split(';')[0], ms: Math.round(ms) };
  },
  async deleteLabVoice() {},
  subscribeLabChips(cb) {
    return listen(() => cb({ ...(state.labChips || {}) }));
  },
  async bumpLabChips(ids) {
    if (!ids.length) return;
    const counts = { ...(state.labChips || {}) };
    for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    state.labChips = counts;
    commit();
  },
  async getLabTouches(day, name) {
    return (state.labTouches || {})[`${day}_${personId(name)}`] || [];
  },
  async addLabTouch(day, name, taskId) {
    const key = `${day}_${personId(name)}`;
    const all = state.labTouches || {};
    if ((all[key] || []).includes(taskId)) return;
    // Only today's are useful; drop older days.
    state.labTouches = Object.fromEntries([...Object.entries(all).filter(([k]) => k.startsWith(day)), [key, [...(all[key] || []), taskId]]]);
    commit();
  },
  subscribeShifts(cb) {
    return listen(() => cb([...(state.shifts || [])]));
  },
  async startShifts(people, start, extra, actor) {
    const add = people.map((person) => ({
      id: uid(),
      person,
      start,
      end: null,
      note: '',
      subteam: '',
      taskIds: [],
      ...extra,
      createdBy: actor.name,
    }));
    state.shifts = [...(state.shifts || []), ...add];
    commit();
  },
  async updateShift(id, patch, actor) {
    const was = (state.shifts || []).find((s) => s.id === id);
    state.shifts = (state.shifts || []).map((s) => (s.id === id ? { ...s, ...patch, updatedBy: actor.name } : s));
    if (was && was.end == null && patch.end != null) life.shiftEnded(was.person);
    commit();
  },
  async deleteShift(id) {
    state.shifts = (state.shifts || []).filter((s) => s.id !== id);
    commit();
  },
  // Changes to finished shifts, written down like the real store does
  // (firebaseStore.js): who, when, the times before and after.
  subscribeShiftEdits(cb) {
    return listen(() => cb([...(state.shiftEdits || [])].sort((a, b) => b.at - a.at)));
  },
  async editShift(shift, patch, kind, actor, requestId) {
    const n = (shift.editCount || 0) + 1;
    const at = Date.now();
    state.shifts = (state.shifts || []).map((s) =>
      s.id === shift.id ? { ...s, ...patch, editCount: n, editedAt: at, editedBy: actor.name, updatedBy: actor.name } : s,
    );
    addShiftEdit(shift, kind, { start: patch.start ?? shift.start, end: patch.end ?? shift.end }, actor, at, requestId);
    commit();
  },
  async removeShift(shift, actor) {
    state.shifts = (state.shifts || []).filter((s) => s.id !== shift.id);
    addShiftEdit(shift, 'delete', null, actor, Date.now());
    commit();
  },
  async addShift(data, actor) {
    const id = uid();
    const at = Date.now();
    state.shifts = [...(state.shifts || []), { id, note: '', subteam: '', taskIds: [], ...data, createdBy: actor.name, at }];
    addShiftEdit({ id, person: data.person }, 'add', { start: data.start, end: data.end }, actor, at);
    commit();
  },
  subscribeShiftRequests(cb) {
    return listen(() => cb([...(state.shiftRequests || [])]));
  },
  async requestShift(req, actor) {
    state.shiftRequests = [...(state.shiftRequests || []), { id: uid(), ...req, status: 'pending', by: actor.name, at: Date.now() }];
    commit();
  },
  async cancelShiftRequest(id) {
    state.shiftRequests = (state.shiftRequests || []).filter((r) => r.id !== id);
    commit();
  },
  async decideShiftRequest(req, approve, shift, actor) {
    const at = Date.now();
    state.shiftRequests = (state.shiftRequests || []).map((r) =>
      r.id === req.id ? { ...r, status: approve ? 'approved' : 'declined', decidedBy: actor.name, decidedAt: at } : r,
    );
    if (approve) {
      const span = { start: req.start, end: req.end };
      if (req.kind === 'extend' && shift) {
        state.shifts = (state.shifts || []).map((s) =>
          s.id === shift.id
            ? { ...s, ...span, editCount: (s.editCount || 0) + 1, editedAt: at, editedBy: actor.name, updatedBy: actor.name }
            : s,
        );
        addShiftEdit(shift, 'approve', span, actor, at, req.id);
      } else {
        const id = uid();
        const details = { note: req.note || '', subteam: req.subteam || '', taskIds: req.taskIds || [] };
        state.shifts = [...(state.shifts || []), { id, person: req.person, ...span, ...details, createdBy: actor.name, at }];
        addShiftEdit({ id, person: req.person }, 'approve', span, actor, at, req.id);
      }
    }
    commit();
  },
  subscribeCheckins(cb) {
    demoScheduledCheckin();
    return listen(() => cb([...(state.checkins || [])]));
  },
  // Undo for "Not today": the check-in put back as it was.
  async restoreCheckin(c) {
    state.checkins = [...(state.checkins || []).filter((x) => x.id !== c.id), c];
    commit();
  },
  async addCheckin(data, actor) {
    state.checkins = [...(state.checkins || []), { id: uid(), ...data, answers: {}, by: actor.name, at: Date.now() }];
    commit();
  },
  async answerCheckin(id, name, answer) {
    state.checkins = (state.checkins || []).map((c) =>
      c.id === id ? { ...c, answers: { ...c.answers, [name]: { ...answer, at: Date.now() } } } : c,
    );
    commit();
  },
  async deleteCheckin(id) {
    state.checkins = (state.checkins || []).filter((c) => c.id !== id);
    commit();
  },
  async setCheckinOff(id, slot, reason) {
    state.checkins = (state.checkins || []).map((c) => {
      if (c.id !== id) return c;
      const { [slot]: _gone, ...off } = c.off || {};
      return { ...c, off: reason == null ? off : { ...off, [slot]: reason } };
    });
    commit();
  },
  subscribeShiftPlans(cb) {
    return listen(() => cb([...(state.shiftPlans || [])]));
  },
  async addShiftPlans(plans, actor) {
    state.shiftPlans = [...(state.shiftPlans || []), ...plans.map((p) => ({ id: uid(), ...p, people: {}, createdBy: actor.name }))];
    commit();
  },
  async updateShiftPlan(id, patch) {
    state.shiftPlans = (state.shiftPlans || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    commit();
  },
  async rsvpShiftPlan(id, name, answer, oldKeys = []) {
    state.shiftPlans = (state.shiftPlans || []).map((p) => {
      if (p.id !== id) return p;
      const people = { ...p.people };
      for (const k of oldKeys) delete people[k];
      if (answer) people[name] = answer;
      else delete people[name];
      return { ...p, people };
    });
    commit();
  },
  async deleteShiftPlans(ids) {
    state.shiftPlans = (state.shiftPlans || []).filter((p) => !ids.includes(p.id));
    commit();
  },

  subscribeRequests(cb) {
    return listen(() => cb([...(state.requests || [])].sort((a, b) => b.at - a.at)));
  },
  async addRequest(text, actor, kind = '') {
    const r = { id: uid(), text, by: actor.name, at: Date.now(), status: 'new', votes: {}, ...(kind ? { kind } : {}) };
    state.requests = [r, ...(state.requests || [])];
    // What the Cloud Function does: let REQUESTS_TO know (not about their own).
    if (actor.name !== REQUESTS_TO)
      state.inbox = [
        {
          id: uid(),
          type: 'request',
          title: `${actor.name.split(' ')[0]} requested a feature`,
          body: text,
          open: `requests:${r.id}`,
          at: r.at,
          read: false,
        },
        ...(state.inbox || []),
      ];
    commit();
    // The new id, like the real store (/request's card links to it).
    return r.id;
  },
  async updateRequest(id, patch, actor) {
    state.requests = (state.requests || []).map((r) =>
      r.id === id ? { ...r, ...patch, updatedBy: actor.name, updatedAt: Date.now() } : r,
    );
    commit();
  },
  async voteRequest(id, name, vote) {
    state.requests = (state.requests || []).map((r) => {
      if (r.id !== id) return r;
      const votes = { ...r.votes };
      const downvotes = { ...r.downvotes };
      delete votes[name];
      delete downvotes[name];
      if (vote === 'up') votes[name] = true;
      if (vote === 'down') downvotes[name] = true;
      return { ...r, votes, downvotes };
    });
    commit();
  },
  async deleteRequest(id) {
    state.requests = (state.requests || []).filter((r) => r.id !== id);
    commit();
  },

  subscribeEmoji(cb) {
    return listen(() => cb([...(state.emoji || [])]));
  },
  async addEmoji(name, file, actor) {
    if (file.size > 300000) throw new Error('Demo mode only keeps emoji under 300 KB.');
    state.emoji = [
      ...(state.emoji || []).filter((e) => e.id !== name),
      { id: name, name, url: await dataUrl(file), path: '', by: actor.name, at: Date.now() },
    ];
    commit();
  },
  async deleteEmoji(e) {
    state.emoji = (state.emoji || []).filter((x) => x.id !== e.id);
    commit();
  },

  // Robot: uploaded files stay in memory only (they disappear on reload).
  subscribeRobot(cb) {
    return listen(() => {
      const r = state.robot || { versions: [], pins: [], layouts: [] };
      cb({
        versions: r.versions.filter((v) => v.sample || demoFiles.has(v.id)).map((v) => ({ ...v, url: demoFiles.get(v.id) })),
        pins: [...r.pins],
        layouts: [...r.layouts],
      });
    });
  },
  async uploadRobotVersion(file, meta, actor, onProgress) {
    const id = uid();
    demoFiles.set(id, URL.createObjectURL(file));
    onProgress?.(1);
    state.robot.versions = [...state.robot.versions, { id, ...meta, size: file.size, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async deleteRobotVersion(version) {
    state.robot.versions = state.robot.versions.filter((v) => v.id !== version.id);
    state.robot.pins = state.robot.pins.filter((p) => p.versionId !== version.id);
    state.robot.layouts = state.robot.layouts.filter((l) => l.versionId !== version.id);
    commit();
  },
  async createRobotPin(data, actor) {
    state.robot.pins = [
      ...state.robot.pins,
      { id: uid(), resolved: false, taskId: '', partId: '', ...data, by: actor.name, byUid: actor.uid, at: Date.now() },
    ];
    commit();
  },
  async updateRobotPin(id, patch) {
    state.robot.pins = state.robot.pins.map((p) => (p.id === id ? { ...p, ...patch } : p));
    commit();
  },
  async deleteRobotPin(id) {
    state.robot.pins = state.robot.pins.filter((p) => p.id !== id);
    commit();
  },
  async saveRobotLayout(data, actor) {
    state.robot.layouts = [...state.robot.layouts, { id: uid(), ...data, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async deleteRobotLayout(id) {
    state.robot.layouts = state.robot.layouts.filter((l) => l.id !== id);
    commit();
  },
};
