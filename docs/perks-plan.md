# Perks plan (draft, 2026-11-02)

Asked for by the team: "they want perks". Decisions so far (Asher):
- Earned by **pet levels** and **streaks / attendance**, as well as spent with coins.
- **Team management only** decides what perks are and what they cost (as today).

## What exists
Market → Perks: team management adds perks (or taps one of 20 built-in ideas),
teammates buy with Jackson coins, team management approves, then marks Done.
A decline refunds the coins. Server: `functions/market.js` (`buy`),
`functions/shared/market.js` (`PERK_IDEAS`, `cleanPerk`, purchase statuses).

## Idea: vouchers
A **voucher** is a free claim on a perk, earned instead of bought.

- Three sizes, matching perk price bands that team management sets once
  (default: small up to 100 coins, medium up to 200, large up to 400).
- Earned once per person, ever, for each milestone:
  | Milestone | Voucher |
  |---|---|
  | Pet reaches level 10 | small |
  | Pet reaches level 20 | medium |
  | Pet reaches level 30 | large |
  | Lab streak of 10 school days | small |
  | Lab streak of 20 school days | medium |
  | Lab streak of 40 school days | large |
  Keyed by person and milestone (not by pet), so gifting or rehoming a pet, or
  the baby, can never earn one twice.
- The person picks any perk in that band; it goes through the same pending →
  approved → done flow, with no coins moving. A decline gives the voucher back.
- Vouchers expire at the end of the season (date set by team management) so
  nothing piles up.
- Team management sees a "Vouchers" count next to pending purchases, and can
  turn the whole thing off or change the bands and milestones from settings.

## Safety (no coin loopholes)
- Vouchers are stored server-side (`vouchers/{personId}`), written only by the
  `pet`/`market` code, never by the client. The client never sends amounts.
- Milestones are computed on the server from real lab time (levels) and real
  shifts (streaks), keyed in `awardKeys`-style docs so a milestone pays once.
- A voucher never turns into coins; a decline restores the voucher, not coins.
- A cap on vouchers waiting to be approved per person (default 2) so approvals
  can't be flooded.

## Phases
1. **Before Nov 14 (small):** server milestones + voucher storage, Market → Perks
   shows "Your vouchers" and lets you redeem one on a perk, management settings
   for bands and season end, demo mode, tests.
2. **After the competition:** a competition-week team perk (e.g. a team treat when
   the 60-hour tier is reached) and a "save toward" goal on perks.

## Open questions
- What real perks can team management actually give? (Sets the bands and ideas.)
- Streak milestones: 10 / 20 / 40 school days, or different numbers?
- Season end date for voucher expiry.
