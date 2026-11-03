// How far this device's clock is from the server's (from the play
// function's answers), so live games like /crash show the server's timing.
// The server read its clock somewhere inside the round trip, so the best
// guess is its middle; quick round trips say the most, so a slow answer
// only replaces a quick one's guess after a while (the network may change).
let skew = 0;
let best = { rtt: Infinity, at: 0 };
export const setServerSkew = (serverNow, sentAt) => {
  if (!serverNow) return;
  const now = Date.now();
  if (sentAt == null) {
    if (best.rtt === Infinity) skew = serverNow - now;
    return;
  }
  const rtt = Math.max(0, now - sentAt);
  // A quick answer from a while ago counts for less: 20 ms a second.
  const bar = best.rtt + (now - best.at) / 50;
  if (rtt <= bar) {
    skew = serverNow - (sentAt + now) / 2;
    best = { rtt, at: now };
  }
};
export const serverNow = () => Date.now() + skew;
