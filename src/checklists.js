import { itemId } from './data/diff.js';

// Starting points for the Checklists tab. Inspection rules change each season,
// so the team should compare the inspection list with this season's
// Competition Manual and edit it on the site.
export const STARTER_CHECKLISTS = [
  {
    title: 'Robot inspection',
    items: [
      'Robot fits inside the 18" × 18" × 18" sizing box at the start of a match',
      'Team number shown on at least two sides of the robot',
      'Red and blue alliance markers ready and easy to swap',
      'Control Hub and Driver Hub firmware and app updated',
      'Robot Controller and Driver Station named correctly (32313-RC / 32313-DS)',
      'Main power switch reachable and labeled',
      '12V battery is legal, charged, and strapped down',
      'Wires secured with no exposed copper, and the right fuses in place',
      'Only legal motors and servos, within the season limits',
      'No sharp edges, pinch points, or loose parts',
      'Checked everything against this season’s Competition Manual inspection checklist',
    ],
  },
  {
    title: 'Pit packing list',
    items: [
      'Robot',
      'Batteries (at least 3, all charged)',
      'Battery chargers',
      'Driver Hub and its charger',
      'Two gamepads, plus a spare',
      'Laptop and charger',
      'USB-C and USB-A cables',
      'Hex keys, screwdrivers, wrenches, pliers',
      'Zip ties and electrical tape',
      'Spare parts kit: motors, servos, screws, nuts, wires',
      'Power strip and extension cord',
      'Printed engineering portfolio',
      'Team shirts',
      'Safety glasses for everyone',
      'Water and snacks',
    ],
  },
  {
    title: 'Competition day plan',
    items: [
      'Arrive and check in',
      'Set up the pit',
      'Pass robot inspection',
      'Pass field inspection',
      'Judging interview (bring the portfolio)',
      'Drivers’ meeting',
      'Check the match schedule and set queue reminders',
      'Scout other teams for alliance selection',
      'Charge batteries between matches',
      'Pack up the pit and check nothing is left behind',
    ],
  },
];

export function starterItems(list) {
  const items = {};
  list.items.forEach((text, order) => {
    const id = itemId();
    items[id] = { id, text, done: false, order };
  });
  return items;
}
