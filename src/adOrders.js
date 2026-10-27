// What happens after you book, order, submit, or subscribe from an ad: a
// timeline of events planned up front (with random twists). The events marked
// push become notifications (functions/index.js adDeliveries sends them; the
// demo store delivers them itself). The tracker shows how far along it is.

const MIN = 60000;
const HOUR = 60 * MIN;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const PACKED = [
  'Packed by hand. Our hands. Mostly clean.',
  'Packed in a box 40 times too big.',
  'Packed with love and six pounds of packing peanuts.',
  'Packed. Unpacked. Packed again. We got nervous.',
];
const SHIPPED = [
  'It left the warehouse. The warehouse is a garage.',
  'It left the building. It looked back once.',
  'Handed to our most trusted driver, Kevin.',
  'Shipped by the fastest pigeon we could find.',
];
// Something goes a little wrong on the way (most orders).
const TWISTS = [
  { icon: '🗺️', title: 'Your package is in Ohio', body: 'We don’t know why either. It’s coming back.' },
  { icon: '🚪', title: 'Delivery attempted', body: 'We knocked. Nobody answered. It was the wrong lab.' },
  { icon: '🏎️', title: 'Your driver took a shortcut', body: 'Kevin said “shortcut.” It was not a shortcut.' },
  { icon: '🦝', title: 'Your package is being held by a raccoon', body: 'Negotiations are going well. He wants snacks.' },
  { icon: '🛃', title: 'Your package was inspected', body: 'They kept one. For science.', lose: 1 },
  { icon: '🌧️', title: 'Weather delay', body: 'It drizzled once. Kevin needed a moment.' },
];
const OUT = [
  'Kevin is 3 stops away. Kevin has been 3 stops away for a while.',
  'It’s on the truck. The truck is on its way. The truck is a bike.',
  'Arriving soon. Please do not stand in the driveway with arms out.',
];
const PLACES = [
  'Left at the lab door.',
  'Left inside the robot. Sorry.',
  'Handed to someone who said they were you.',
  'Left on the field. Please move it before practice.',
  'Left in the snack drawer. It fit perfectly.',
  'Thrown over the fence. Great arm, Kevin.',
];
// What's inside when you open it.
const UNBOX = [
  'It’s exactly what you ordered. We’re as surprised as you.',
  'Inside: a smaller box. Inside that: your order. And a smaller box.',
  'Some assembly required. 400 screws, no instructions.',
  'It came with a free sticker of a sticker.',
  'There’s a note: “Enjoy! — Kevin.” It’s a little sticky.',
  'It smells like WD-40. Everything here does.',
];
const REMIND = [
  (b) => `${b} is warming up.`,
  () => 'Please arrive 45 minutes early to fill out 40 minutes of forms.',
  () => 'Bring a snack. Not for you.',
  (b) => `${b} has cleaned up a little. Not a lot.`,
];
const LATE = [
  { title: 'running 5 minutes late', body: 'Their last appointment was a robot. It took a while.' },
  { title: 'running a little late', body: 'They’re stuck behind the drive team in the hallway.' },
  { title: 'running late (sorry)', body: 'They locked themselves out. With the keys inside. Again.' },
];
// How the appointment goes.
const SESSION = [
  'It went great. They said you were “a natural.” They say that to everyone.',
  'They took one look and said “oh no.” Then they fixed it.',
  'It took 4 minutes. They billed for 3 hours.',
  'They asked a lot of questions about the robot. Too many. Who sent them?',
  'Halfway through, they fell asleep. You’ve never felt more relaxed.',
];
const SIGNOFF = [
  'Your next appointment is never. We’ll call you.',
  'You’ve been upgraded to Platinum. It does nothing.',
  'That’ll be 0 coins. Tip suggested: 30%.',
  'They want to see you again. Soon. Too soon.',
];
const REVIEW = [
  (b) => `A ${b} intern is reading it. Out loud. To the whole office.`,
  (b) => `${b} printed it out. They’re passing it around.`,
  (b) => `It’s at ${b} headquarters. Headquarters is a van.`,
];
const REPLIES = [
  'We printed it and put it on the fridge.',
  'Our lawyers would like a word. Just one: “wow.”',
  'We’ve forwarded this to the moon.',
  'Bold. Very bold. We’ve never seen anything like it.',
  'We read it three times. We’re okay now.',
];
const RENEW = [
  'You were charged 0 coins. You will be charged 0 coins forever.',
  'Thank you for staying. You didn’t have a choice, but thank you.',
];
const MISS = [
  (b) => `${b} misses you. Open your box. Please.`,
  (b) => `${b} noticed you haven’t opened your box. We’re hurt.`,
  (b) => `${b} wrote you a poem. It’s mostly about the box.`,
];

// The plan for one booking / order / submission / subscription. The ad's flow
// (adFlows.js) can bring its own lines for each step (flow.track); vars are
// the filled-in answers for {templates}. when: the booking's time (ms).
export function planOrder({ ad, kind, qty = 1, when = 0, text = '', ref = '', now = Date.now(), flow = null, vars = {}, summary = [] }) {
  const brand = ad.brand;
  const item = flow?.item || ad.action?.item || brand;
  const allVars = { brand, item, qty: String(qty), ...vars };
  const own = flow?.track || {};
  // One line from the flow's own list (filled in), or from the usual ones.
  const line = (key, fallback) => {
    const mine = own[key];
    return mine?.length ? fillVars(pick(mine), allVars) : typeof fallback === 'function' ? fallback() : fallback;
  };
  const story = (key, fallback) => {
    const mine = own[key];
    if (!mine?.length) return pick(fallback);
    const x = pick(mine);
    return { ...x, icon: x.icon || '❗', title: fillVars(x.title, allVars), body: fillVars(x.body, allVars) };
  };
  const base = { kind, adId: ad.id, brand, emoji: ad.emoji || '📦', item, qty, when, text, ref, at: now, sent: 0, vars: allVars, summary };
  const ev = (step, at, icon, title, body, push = false) => ({ step, at: Math.round(at), icon, title, body, push });
  const events = [];
  const extra = {};
  const scene = flow?.scene;

  if (kind === 'order' || kind === 'subscribe') {
    const thing = kind === 'order' ? `${qty} × ${item}` : `your first ${brand} box`;
    let t = now;
    events.push(
      ev(
        'placed',
        t,
        '🧾',
        kind === 'order' ? 'Order placed' : 'Subscribed',
        kind === 'order' ? `${thing} from ${brand}.` : `Welcome to ${brand}. There’s no leaving.`,
      ),
    );
    t += between(1, 3) * MIN;
    events.push(
      ev(
        'packed',
        t,
        '📦',
        'Packed',
        line('packed', () => pick(PACKED)),
      ),
    );
    t += between(5, 15) * MIN;
    events.push(
      ev(
        'shipped',
        t,
        '🚚',
        'Shipped',
        line('shipped', () => pick(SHIPPED)),
      ),
    );
    let lost = 0;
    if (Math.random() < 0.65) {
      const tw = story(
        'twists',
        TWISTS.filter((x) => !x.lose || qty > 1),
      );
      t += between(10, 30) * MIN;
      events.push(ev('twist', t, tw.icon, tw.title, tw.body, true));
      lost = qty > 1 ? tw.lose || 0 : 0;
    }
    t += between(15, 40) * MIN;
    events.push(
      ev(
        'out',
        t,
        '🛵',
        `${cap(kind === 'order' ? `your ${item}` : 'your box')} is out for delivery`,
        line('out', () => pick(OUT)),
        true,
      ),
    );
    t += between(10, 40) * MIN;
    const place = line('places', () => pick(PLACES));
    events.push(ev('delivered', t, '📬', `Delivered: ${thing}`, `${place} Tap to open it.`, true));
    Object.assign(extra, { lost, place, unbox: pick(UNBOX) });
    if (scene?.type === 'unbox' && scene.inside?.length) extra.inside = fillVars(pick(scene.inside), allVars);
    if (kind === 'subscribe') {
      events.push(ev('renew', now + 24 * HOUR, '🔁', `Your ${brand} subscription renewed`, pick(RENEW), true));
      events.push(ev('miss', now + 72 * HOUR, '🥺', `${brand} misses you`, pick(MISS)(brand), true));
    }
  } else if (kind === 'book') {
    const what = cap(item);
    events.push(ev('placed', now, '📅', 'Booked', `${what} with ${brand}.`));
    events.push(
      ev('confirmed', now + 2 * MIN, '✅', 'Confirmed', line('confirmed', `${brand} confirmed. They seemed excited. Weirdly excited.`)),
    );
    if (when - now > 70 * MIN)
      events.push(
        ev(
          'reminder',
          when - HOUR,
          '⏰',
          `${what} in 1 hour`,
          line('remind', () => pick(REMIND)(brand)),
          true,
        ),
      );
    if (Math.random() < 0.4 && when - now > 20 * MIN) {
      const l = story('late', LATE);
      events.push(ev('late', when - 10 * MIN, l.icon || '🐢', `${brand} is ${l.title}`, l.body, true));
    }
    events.push(ev('start', Math.max(when, now + 3 * MIN), '🛎️', `It’s time: ${item}`, `${brand} is ready for you. Tap to go in.`, true));
    Object.assign(extra, { line: between(2, 5), session: pick(SESSION), signoff: pick(SIGNOFF) });
  } else {
    events.push(ev('placed', now, '📨', 'Sent', `To ${brand}.`));
    events.push(
      ev(
        'review',
        now + between(2, 5) * MIN,
        '👀',
        'In review',
        line('review', () => pick(REVIEW)(brand)),
      ),
    );
    const reply = line('replies', () => pick(REPLIES));
    events.push(ev('reply', now + between(10, 40) * MIN, '💬', `${brand} replied`, `“${clip(text, 40)}” — ${reply}`, true));
    Object.assign(extra, { reply });
  }
  events.sort((a, b) => a.at - b.at);
  return { ...base, events, extra, due: nextDue(events, 0) };
}

const fillVars = (text, vars) =>
  String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null || vars[k] === '' ? m : String(vars[k])));

// When the next notification is due (null when there are none left).
export function nextDue(events, from) {
  const e = events.slice(from).find((x) => x.push);
  return e ? e.at : null;
}

// The events due by now that haven't gone out yet: only the newest one gets
// sent, so a phone that was off doesn't get five buzzes at once.
export function deliver(order, now) {
  let sent = order.sent || 0;
  let latest = null;
  while (sent < order.events.length && order.events[sent].at <= now) {
    if (order.events[sent].push) latest = order.events[sent];
    sent++;
  }
  return { latest, sent, due: nextDue(order.events, sent) };
}

// How far along it is right now.
export function progress(order, now) {
  const done = order.events.filter((e) => e.at <= now);
  const next = order.events.find((e) => e.at > now) || null;
  return { done, next, last: done[done.length - 1] || null, finished: !next };
}

export const KIND_NOUN = { order: 'Order', book: 'Booking', submit: 'Submission', subscribe: 'Subscription' };
