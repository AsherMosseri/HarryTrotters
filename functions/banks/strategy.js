// Strategy (G2 extra): BIOBUZZ scoring math and timing, worked from the point
// tables and rules in the 2026-27 Competition Manual, TU07. Every answer is
// arithmetic on numbers the manual states; the explanation shows the sum.
import { mc, tf } from './util.js';

const M = (...a) => mc('strategy', ...a);
const T = (...a) => tf('strategy', ...a);

const PTS = 'Section 10.5.5, Table 10-2, p. 89';
const RP = 'Section 10.5.5, Tables 10-2 and 10-3, p. 89';
const FOUL = 'Section 10.6, Table 10-4, p. 90';
const TIME = 'Section 10.4, p. 83; Table 9-1, p. 77';

// Choices for a number answer: the right value plus near misses, as text.
function nums(value, wrong, unit = '') {
  return [value, ...wrong].map((n) => `${n}${unit}`);
}

// AUTO points
const auto = [
  M('s-au-1', 1, 'Both of your ROBOTS LEAVE in AUTO and nothing else scores. How many AUTO points?', nums(6, [3, 5, 10]), '2 ROBOTS x 3 points for LEAVE = 6.', PTS),
  M('s-au-2', 1, 'One ROBOT LEAVES and ends AUTO PARKED in the LOADING ZONE. How many points does it earn in AUTO?', nums(8, [5, 3, 10]), 'LEAVE 3 + AUTO PARK 5 = 8.', PTS),
  M('s-au-3', 2, 'Both ROBOTS LEAVE, both AUTO PARK, and your HIVE TIPS once in AUTO. AUTO total?', nums(36, [26, 33, 46]), '2 x 3 (LEAVE) + 2 x 5 (PARK) + 20 (TIP) = 6 + 10 + 20 = 36.', PTS),
  M('s-au-4', 2, 'Your HIVE TIPS twice in AUTO and both ROBOTS LEAVE. AUTO total?', nums(46, [40, 43, 26]), '2 x 20 (TIPS) + 2 x 3 (LEAVE) = 40 + 6 = 46.', PTS),
  M('s-au-5', 1, 'What is the most LEAVE points an ALLIANCE can earn in a MATCH?', nums(6, [3, 10, 12]), 'LEAVE is 3 points per ROBOT, AUTO only: 2 x 3 = 6.', PTS),
  M('s-au-6', 2, 'What is the most PARK points an ALLIANCE can earn in a MATCH?', nums(20, [10, 15, 26]), 'PARK is 5 in AUTO and 5 in TELEOP for each of 2 ROBOTS: 2 x (5 + 5) = 20.', PTS),
  M('s-au-7', 2, 'What is the most LEAVE + PARK points an ALLIANCE can earn in one MATCH?', nums(26, [20, 16, 30]), '6 (LEAVE) + 20 (PARK) = 26.', PTS),
  M('s-au-8', 3, 'A HIVE TIP finishes 3 seconds after AUTO ends, during the transition. How many points, and in which period?', ['20, as an AUTO TIP', '20, as a TELEOP TIP', '0, it was late', '10, half credit'], 'TIPS complete before TELEOP starts count as AUTO; a TIP is 20 points in either period.', 'Section 10.5 (B), p. 84; Table 10-2, p. 89'),
  T('s-au-9', 2, 'True or false: a HIVE TIP is worth more in AUTO than in TELEOP.', false, 'Table 10-2 lists a HIVE TIP as 20 points in AUTO and 20 in TELEOP.', PTS),
  M('s-au-10', 3, 'Why can an AUTO TIP be worth more to rankings than a TELEOP TIP, even at the same 20 points?', ['Average AUTO points is a ranking tiebreaker', 'AUTO TIPS earn an extra RP', 'AUTO TIPS count double for POLLINATOR', 'They don\'t; there is no difference'], 'Table 13-1 sorts by average number of TIPS (3rd) and average AUTO points (4th); AUTO TIPS add to both.', 'Section 13.6.3, Table 13-1, p. 151'),
  M('s-au-11', 2, 'A ROBOT starts AUTO with how many POLLEN it can try to LAUNCH right away?', nums(4, [3, 5, 2]), 'Each ROBOT starts contacting exactly 4 pre-loaded POLLEN.', 'Section 10.3.4, p. 82; G304, p. 102'),
  M('s-au-12', 2, 'How many POLLEN does an ALLIANCE start with as pre-loads in total?', nums(8, [4, 16, 12]), '4 pre-loads per ROBOT x 2 ROBOTS = 8.', 'Section 10.3.1, p. 81'),
  M('s-au-13', 3, 'In AUTO, red LEAVES with both ROBOTS (no PARK) and TIPS once. Blue AUTO PARKS both ROBOTS without LEAVING the wall and doesn\'t TIP. AUTO points difference?', ['Red ahead by 16', 'Red ahead by 26', 'Blue ahead by 4', 'Tied'], 'Red: 6 + 20 = 26. Blue: 2 x 5 = 10. 26 - 10 = 16.', PTS),
  M('s-au-14', 2, 'What is the most LEAVE + AUTO PARK points an ALLIANCE can earn at the end of AUTO?', nums(16, [6, 10, 26]), '2 x 3 (LEAVE) + 2 x 5 (AUTO PARK) = 16.', PTS),
];

// RANKING POINTS
const rp = [
  M('s-rp-1', 2, 'At a regular event, both ROBOTS LEAVE and both TELEOP PARK, nothing else. Does the ALLIANCE earn SWARM?', ['Yes: 6 + 10 = 16 meets the 16 threshold', 'No: 16 is below the threshold', 'No: AUTO PARK is required', 'Only if they win'], 'SWARM needs combined LEAVE + PARK points at or above 16. 6 + 10 = 16.', RP),
  M('s-rp-2', 2, 'Both ROBOTS LEAVE and only one ROBOT PARKS, at the end of the MATCH. LEAVE + PARK points?', nums(11, [16, 8, 13]), '6 (LEAVE) + 5 (one TELEOP PARK) = 11, short of the 16 needed for SWARM.', RP),
  M('s-rp-3', 2, 'Neither ROBOT LEAVES, but both AUTO PARK and both TELEOP PARK. Is SWARM earned at a regular event?', ['Yes: 20 points', 'No: 10 points', 'No: LEAVE is required', 'Yes: 26 points'], '2 x 5 + 2 x 5 = 20, which is at or above 16.', RP),
  M('s-rp-4', 2, 'At a regular event, your HIVE TIPS 5 times in the MATCH. Which TIP RPs do you earn?', ['POLLINATOR 1 only', 'POLLINATOR 1 and 2', 'Neither', 'POLLINATOR 2 only'], 'POLLINATOR 1 needs 4 TIPS; POLLINATOR 2 needs 7. 5 TIPS earns only POLLINATOR 1.', RP),
  M('s-rp-5', 2, 'Your ALLIANCE wins with 7 TIPS and earns SWARM, at a regular event. How many RP?', nums(6, [5, 4, 3]), 'WIN 3 + SWARM 1 + POLLINATOR 1 (4+ TIPS) + POLLINATOR 2 (7+ TIPS) = 6.', RP),
  M('s-rp-6', 1, 'What is the most RANKING POINTS a team can earn in one Qualification MATCH?', nums(6, [3, 4, 5]), 'WIN 3 + SWARM 1 + POLLINATOR 1 + POLLINATOR 2 = 6.', RP),
  M('s-rp-7', 2, 'Your ALLIANCE loses but has 4 TIPS and earns SWARM. How many RP?', nums(2, [0, 3, 1]), 'No WIN or TIE RP. SWARM 1 + POLLINATOR 1 = 2.', RP),
  M('s-rp-8', 2, 'A MATCH ends in a TIE. Each ALLIANCE had 3 TIPS and no SWARM. How many RP does each team get?', nums(1, [0, 2, 3]), 'TIE = 1 RP. 3 TIPS is below the POLLINATOR 1 threshold of 4.', RP),
  M('s-rp-9', 3, 'Your HIVE TIPS 6 times. How many more TIPS do you need for another RP at a regular event?', nums(1, [2, 3, 0]), 'POLLINATOR 2 needs 7 TIPS; 7 - 6 = 1 more.', RP),
  M('s-rp-10', 2, 'A team\'s RP over 5 Qualification MATCHES: 4, 6, 2, 3, 5. What is its RANKING SCORE?', nums(4, [20, 5, 3.5]), 'RANKING SCORE is the average RP: (4 + 6 + 2 + 3 + 5) / 5 = 20 / 5 = 4.', 'Section 13.6.3, p. 150; Table 10-2, p. 89'),
  M('s-rp-11', 3, 'A team plays 6 MATCHES, one as a SURROGATE with 6 RP. The other five earned 3, 3, 4, 1, 4. RANKING SCORE?', nums(3, [3.5, 21, 15]), 'SURROGATE MATCHES are excluded: (3 + 3 + 4 + 1 + 4) / 5 = 15 / 5 = 3.', 'Section 13.6.2-13.6.3, pp. 150-151'),
  M('s-rp-12', 3, 'A team is DISQUALIFIED in one of its 5 MATCHES (its ALLIANCE won with 7 TIPS). RP in the other four: 3, 4, 2, 3. RANKING SCORE?', nums(2.4, [3, 3.6, 4]), 'A DISQUALIFIED team gets 0 RP in that MATCH: (3 + 4 + 2 + 3 + 0) / 5 = 12 / 5 = 2.4.', 'Section 10.6, Table 10-4, pp. 90-91; Section 13.6.3, pp. 150-151'),
  T('s-rp-13', 2, 'True or false: you can earn the SWARM RP in a MATCH you lose.', true, 'SWARM, POLLINATOR 1 and POLLINATOR 2 are each 1 RP for reaching a threshold, separate from WIN and TIE.', RP),
  M('s-rp-14', 3, 'Your partner is DISQUALIFIED in a Qualification MATCH your ALLIANCE wins with 4 TIPS and SWARM. How many RP do YOU get?', nums(5, [0, 3, 6]), 'T601: DISQUALIFICATION in Qualifications doesn\'t affect the partner. WIN 3 + SWARM 1 + POLLINATOR 1 = 5.', 'T601, p. 151; Table 10-2, p. 89'),
  M('s-rp-15', 2, 'What is the most RP a team can earn in a MATCH it loses?', nums(3, [0, 1, 2]), 'SWARM 1 + POLLINATOR 1 + POLLINATOR 2 = 3.', RP),
  M('s-rp-16', 2, 'Over 6 MATCHES a team earns 30 RP. What is its RANKING SCORE?', nums(5, [6, 30, 4.5]), '30 / 6 = 5.', 'Section 13.6.3, p. 150'),
];

// TELEOP and end game
const tele = [
  M('s-te-1', 1, 'Your HIVE TIPS 3 times in TELEOP. How many points is that?', nums(60, [20, 40, 80]), '3 x 20 = 60.', PTS),
  M('s-te-2', 2, 'At the end, your upward-facing CELL holds 3 NECTAR and 2 POLLEN. How many points?', nums(10, [5, 8, 15]), '5 elements x 2 points = 10.', PTS),
  M('s-te-3', 1, 'Your GARDEN holds 6 POLLEN at the end. How many points?', nums(6, [12, 3, 18]), 'GARDEN: 1 point each. 6 x 1 = 6.', PTS),
  M('s-te-4', 2, 'You own a FLOWER holding 4 POLLEN and 2 NECTAR. How many owner points?', nums(12, [6, 10, 17]), 'Owned FLOWER: 2 points per element. 6 x 2 = 12.', PTS),
  M('s-te-5', 2, 'Red has the bottom NECTAR in a FLOWER and blue owns it with 5 elements in it. Points from that FLOWER?', ['Red 5, blue 10', 'Red 10, blue 5', 'Red 5, blue 5', 'Blue 15, red 0'], 'Bottom NECTAR Bonus 5 to red; owner gets 2 x 5 = 10 to blue.', 'Section 10.5.2, p. 86; Table 10-2, p. 89'),
  M('s-te-6', 2, 'What is the most Bottom NECTAR Bonus points one ALLIANCE can earn?', nums(20, [5, 10, 40]), 'There are 4 FLOWERS, one bonus each: 4 x 5 = 20.', 'Section 9.7, p. 70; Table 10-2, p. 89'),
  M('s-te-7', 3, 'A FLOWER holds only one red NECTAR, in the scoring volume. How many points does red get from it?', nums(7, [5, 2, 10]), 'It is both the bottom-most (5 bonus) and top-most NECTAR, so red owns the FLOWER: 5 + 2 x 1 = 7.', 'Section 10.5.2, p. 86; Table 10-2, p. 89'),
  M('s-te-8', 3, 'A FLOWER has red at the bottom, then 3 POLLEN, then blue on top. Blue drops one more blue NECTAR on top. How do blue\'s points from this FLOWER change?', ['+2 (one more owned element)', '+7', '+5 (another bonus)', 'No change'], 'Blue already owns it; one more element in an owned FLOWER is +2. The bottom bonus stays red\'s.', 'Section 10.5.2, p. 86; Table 10-2, p. 89'),
  M('s-te-10', 2, 'How many NECTAR does each ALLIANCE have in a MATCH?', nums(8, [5, 3, 16]), '8 red and 8 blue NECTAR: 3 in the up CELL + 5 in the ALLIANCE AREA.', 'Section 9.8, p. 72; Section 10.3.1, p. 82'),
  M('s-te-11', 2, 'Your HIVE TIPPED twice before 1:00 left. How many NECTAR may your HUMAN PLAYER have entered by then?', nums(2, [1, 5, 0]), 'G426.A: one NECTAR per TIP before the last 60 seconds.', 'G426, p. 114'),
  M('s-te-12', 2, 'Your HIVE TIPPED twice before 1:00 and you entered 2 NECTAR. How many more may you enter at 1:00?', nums(3, [5, 2, 0]), '5 start in the ALLIANCE AREA; 5 - 2 = 3 remain, and all can be entered with 60 seconds or less left.', 'G426, p. 114; Section 10.3.1, p. 82'),
  M('s-te-13', 3, 'Your HIVE TIPS 6 times before 1:00 left. How many NECTAR can you have entered by then?', nums(5, [6, 3, 8]), 'One per TIP, but only 5 start in the ALLIANCE AREA, so at most 5.', 'G426, p. 114; Section 10.3.1, p. 82'),
  M('s-te-14', 2, 'How long is the window when NECTAR may be put into FLOWERS?', ['60 seconds', '30 seconds', '2 minutes', '20 seconds'], 'G410: NECTAR only goes into FLOWERS in the last 60 seconds.', 'G410, p. 107'),
  M('s-te-15', 2, 'How long is TELEOP before FLOWER ownership unlocks?', ['60 seconds', '30 seconds', '90 seconds', '2 minutes'], 'TELEOP starts at 2:00 and FLOWER ownership unlocks at 1:00: 60 seconds.', TIME),
  M('s-te-16', 1, 'How long does a whole MATCH last, AUTO plus TELEOP (not counting the transition)?', ['2 minutes 30 seconds', '2 minutes', '3 minutes', '2 minutes 38 seconds'], '30 seconds AUTO + 2 minutes TELEOP = 2:30.', TIME),
  M('s-te-17', 2, 'From the start of AUTO to the end of TELEOP, how much time passes, including the transition?', ['2 minutes 38 seconds', '2 minutes 30 seconds', '2 minutes 45 seconds', '3 minutes'], '30 s + 8 s + 120 s = 158 s = 2:38.', 'Section 10.1, p. 79'),
  M('s-te-18', 2, 'Both ROBOTS end the MATCH in the LOADING ZONE. How many TELEOP PARK points?', nums(10, [5, 20, 6]), '2 x 5 = 10.', PTS),
  M('s-te-19', 2, 'In TELEOP: 2 TIPS, 4 elements left in the up CELL, 3 GARDEN POLLEN, both ROBOTS PARK. TELEOP points?', nums(61, [56, 71, 51]), '40 + 8 + 3 + 10 = 61.', PTS),
  M('s-te-20', 3, 'TELEOP: 4 TIPS, you own 2 FLOWERS with 5 elements each, 1 Bottom NECTAR Bonus, 2 GARDEN POLLEN, one ROBOT PARKS. TELEOP points?', nums(112, [107, 122, 102]), '80 (TIPS) + 20 (10 owned elements x 2) + 5 (bonus) + 2 (GARDEN) + 5 (PARK) = 112.', PTS),
  M('s-te-21', 2, 'What gives more points: one HIVE TIP, or owning a FLOWER with 8 elements?', ['The TIP, by 4 points', 'The FLOWER, by 4 points', 'They are equal', 'The FLOWER, by 12 points'], 'TIP = 20. FLOWER = 8 x 2 = 16. The TIP is 4 more.', PTS),
  M('s-te-22', 2, 'How many POLLEN in your GARDEN equal one HIVE TIP in points?', nums(20, [10, 5, 4]), 'GARDEN is 1 point each; a TIP is 20.', PTS),
  M('s-te-23', 2, 'How many elements in an owned FLOWER equal one HIVE TIP in points?', nums(10, [20, 5, 4]), 'Owned FLOWER is 2 points each; 20 / 2 = 10.', PTS),
  T('s-te-24', 2, 'True or false: POLLEN you put in the opponent\'s GARDEN scores for the opponent.', true, 'GARDENS score for the ALLIANCE of their color, whoever placed the elements.', 'Section 10.5.3, p. 87'),
  M('s-te-25', 3, 'A blue ROBOT pushes 4 POLLEN out of the red GARDEN into the blue GARDEN. Change in the score difference (blue minus red)?', nums(8, [4, 0, 2]), 'Red loses 4 x 1 and blue gains 4 x 1: the difference moves by 8.', 'Section 10.5.3, p. 87; Table 10-2, p. 89'),
  T('s-te-26', 2, 'True or false: elements in a CELL score only if they are still there when everything comes to rest at the end.', true, 'POLLEN and NECTAR remaining in the CELL are assessed after everything has come to rest at the end of the MATCH.', 'Section 10.5 (C), p. 84'),
  M('s-te-27', 3, 'Your last LAUNCH TIPS the HIVE at 0:02. The new up CELL is empty. How many points did that last LAUNCH add?', nums(20, [22, 2, 0]), 'The TIP scores 20. The elements fell out of the CELL that turned downward, so no CELL points.', 'Section 10.5.1, p. 85; Table 10-2, p. 89'),
  M('s-te-28', 2, 'How many POLLEN are on the FIELD in total at the start?', nums(40, [16, 24, 32]), '16 in FLOWERS + 4 + 4 in GARDENS + 16 pre-loads = 40.', 'Section 10.3.1, p. 81'),
  M('s-te-29', 2, 'How many POLLEN start inside FLOWERS in total?', nums(16, [4, 8, 12]), '4 POLLEN in each of 4 FLOWERS = 16.', 'Section 10.3.1, p. 81'),
  M('s-te-30', 2, 'If the POLLEN staged in your GARDEN at the start are all still there at the end, how many points are they worth?', nums(4, [0, 8, 2]), '4 POLLEN start in each GARDEN, at 1 point each when assessed at the end: 4.', 'Section 10.3.1, p. 81; Section 10.5 (E), p. 84'),
];

// FOULS and their value
const fouls = [
  M('s-fo-1', 1, 'Your opponent commits 2 MINOR FOULS. How many points does your ALLIANCE get?', nums(10, [5, 20, 40]), 'Each MINOR FOUL credits 5 points to the opponent: 2 x 5 = 10.', FOUL),
  M('s-fo-2', 1, 'Your opponent commits 1 MAJOR FOUL. How many points do you get?', nums(20, [5, 10, 30]), 'A MAJOR FOUL credits 20 points to the opponent.', FOUL),
  M('s-fo-3', 2, 'A MAJOR FOUL is worth the same as what?', ['One HIVE TIP', 'A LEAVE', 'A PARK', 'A Bottom NECTAR Bonus'], 'Both are 20 points.', 'Section 10.6, Table 10-4, p. 90; Table 10-2, p. 89'),
  M('s-fo-4', 2, 'A MINOR FOUL is worth the same as what?', ['One PARK', 'One LEAVE', 'One HIVE TIP', 'One GARDEN POLLEN'], 'Both are 5 points.', 'Section 10.6, Table 10-4, p. 90; Table 10-2, p. 89'),
  M('s-fo-5', 2, 'A HUMAN PLAYER enters 3 NECTAR early (G426). How many points go to the other ALLIANCE?', nums(15, [5, 60, 20]), 'MINOR FOUL per NECTAR: 3 x 5 = 15.', 'G426, p. 114; Table 10-4, p. 90'),
  M('s-fo-6', 2, 'A ROBOT puts 2 NECTAR into a FLOWER at 1:05. How many points go to the opponent?', nums(40, [10, 20, 0]), 'G410: MAJOR FOUL per NECTAR, 2 x 20 = 40 (the NECTAR still scores but is penalized).', 'G410, p. 107; Table 10-4, p. 90'),
  M('s-fo-7', 3, 'A ROBOT drops 1 NECTAR into a FLOWER at 1:03. What does that do to the score?', ['It can still score, but the opponent gets 20 for a MAJOR FOUL', 'It doesn\'t score, and there is no penalty', 'The opponent gets 5 for a MINOR FOUL', 'Nothing, NECTAR may enter at 1:05'], 'Achievements before one minute remaining are still scored but penalized; G410 is a MAJOR FOUL (20) per NECTAR.', 'Section 10.5.2, p. 86; G410, p. 107'),
  M('s-fo-8', 3, 'A ROBOT PINS an opponent and stays in violation for 6 seconds. How many points go to the opponent?', nums(60, [20, 40, 80]), 'G421: MAJOR FOUL plus one more per 3 seconds: 1 + 2 = 3 MAJOR FOULS = 60.', 'G421, p. 112; Section 10.6.4, Table 10-6, p. 93'),
  M('s-fo-9', 2, 'A team deliberately ejects 2 POLLEN from the FIELD. How many points for the opponent?', nums(40, [10, 20, 5]), 'G405: MAJOR FOUL per SCORING ELEMENT: 2 x 20 = 40.', 'G405, p. 105; Table 10-4, p. 90'),
  M('s-fo-10', 2, 'A DRIVER takes 2 POLLEN off the FIELD. How many points for the opponent?', nums(10, [40, 5, 20]), 'G428: MINOR FOUL per SCORING ELEMENT: 2 x 5 = 10.', 'G428, p. 115; Table 10-4, p. 90'),
  M('s-fo-12', 2, 'Opponent fouls give your ALLIANCE points. Do those points count for the 2nd ranking sort (average MATCH points)?', ['No, that sort leaves out FOULS', 'Yes, all points count', 'Only MAJOR FOULS count', 'Only in Playoffs'], 'Table 13-1: average ALLIANCE MATCH points, not including MINOR and MAJOR FOULS.', 'Section 13.6.3, Table 13-1, p. 151'),
  M('s-fo-13', 3, 'G301 (late again in the same phase) costs a MAJOR FOUL. How many PARK achievements is that worth?', nums(4, [2, 1, 5]), '20 / 5 = 4 PARKS.', 'G301, p. 100; Table 10-4, p. 90; Table 10-2, p. 89'),
  M('s-fo-14', 2, 'A ROBOT\'s G411 hoarding violation costs how many points?', nums(20, [5, 40, 0]), 'G411: MAJOR FOUL and YELLOW CARD per MATCH. A MAJOR FOUL is 20 points.', 'G411, p. 107; Table 10-4, p. 90'),
];

// Timing and planning
const plan = [
  M('s-pl-1', 1, 'The FIELD timer shows 1:00. What changes?', ['FLOWERS can take NECTAR and all NECTAR may be entered', 'TELEOP begins', 'AUTO ends', 'The endgame PARK is scored'], 'At 60 seconds left: G410 FLOWER NECTAR and G426.B all remaining NECTAR.', 'G410, p. 107; G426, p. 114'),
  M('s-pl-2', 2, 'Which sound plays at the start of the last 20 seconds?', ['Train Whistle', 'Chime', '3 Bells', 'Foghorn'], 'Final 20 seconds (0:20) plays a Train Whistle; a good cue to head to the LOADING ZONE.', 'Section 9.11, Table 9-1, p. 77'),
  M('s-pl-3', 2, 'What should your ROBOT be doing when the timer hits 0:00 to get TELEOP PARK?', ['Be at least partly in the LOADING ZONE', 'Touch the perimeter wall', 'Touch the HIVE frame', 'Be fully inside the GARDEN'], 'TELEOP PARK is assessed at the end of the MATCH: at least partially in the LOADING ZONE.', 'Section 10.5.4, p. 88; Section 10.5 (G), p. 84'),
  M('s-pl-4', 2, 'What is the earliest a HUMAN PLAYER may enter the first NECTAR from the ALLIANCE AREA?', ['After the ALLIANCE\'s first HIVE TIP', 'At the start of TELEOP', 'At 1:00 left', 'Any time'], 'G426.A: one NECTAR per TIP of their HIVE, or all at 60 seconds, whichever comes first.', 'G426, p. 114'),
  M('s-pl-5', 2, 'Where do HUMAN PLAYERS enter NECTAR?', ['Into the LOADING ZONE, touching its TILE first', 'Into the GARDEN', 'Straight into a FLOWER', 'Into the CELL'], 'G427: NECTAR must contact the TILE within the LOADING ZONE first.', 'G427, p. 115'),
  T('s-pl-6', 2, 'True or false: a team can enter NECTAR later rather than right after a TIP, to time it for the endgame.', true, 'NECTAR does not have to be entered immediately when a HIVE TIP occurs.', 'G426, p. 114'),
  M('s-pl-7', 3, 'Why is it risky to send your ROBOT onto the other ALLIANCE\'s side during AUTO?', ['G402: it may be seen as STRATEGIC disruption', 'It loses LEAVE points', 'It can\'t PARK there', 'POLLEN there score for them'], 'Navigating into the opposing side during AUTO is a risky strategy that may be seen as STRATEGIC (G402: MAJOR FOUL, plus YELLOW CARD if STRATEGIC).', 'G402, p. 104'),
  M('s-pl-8', 2, 'Which RP threshold is easiest to reach with no game pieces at all?', ['SWARM (LEAVE + PARK)', 'POLLINATOR 1', 'POLLINATOR 2', 'None'], 'SWARM is from LEAVE + PARK only: drive off the wall and park in the LOADING ZONE.', RP),
  M('s-pl-9', 3, 'Both your ROBOTS LEAVE in AUTO. What is the fewest PARK achievements needed for SWARM at a regular event?', nums(2, [1, 3, 4]), '6 from LEAVE; 16 - 6 = 10 more, which is 2 PARKS (5 each).', RP),
  M('s-pl-10', 3, 'Neither ROBOT LEAVES. How many PARK achievements are needed for SWARM at a regular event?', nums(4, [2, 3, 5]), '16 / 5 = 3.2, so 4 PARKS (20 points): both ROBOTS in AUTO and in TELEOP.', RP),
  M('s-pl-11', 3, 'Only one of your ROBOTS can move. Can your ALLIANCE still earn SWARM at a regular event?', ['No: at most 3 + 5 + 5 = 13', 'Yes: 16 exactly', 'Yes: 18', 'Only with a TIP'], 'One ROBOT can earn LEAVE 3 + AUTO PARK 5 + TELEOP PARK 5 = 13, below 16.', RP),
  M('s-pl-12', 2, 'What is the most POLLEN + NECTAR a ROBOT may CONTROL at once?', nums(4, [5, 3, 8]), 'G407: no more than 4 SCORING ELEMENTS at a time.', 'G407, p. 106'),
  M('s-pl-13', 3, 'A ROBOT carries the max legal load each trip. How many trips to move all 8 of its ALLIANCE\'s NECTAR?', nums(2, [1, 3, 4]), 'G407 allows 4 at a time: 8 / 4 = 2 trips.', 'G407, p. 106; Section 9.8, p. 72'),
  M('s-pl-14', 2, 'How many points is an ALLIANCE\'s TIP worth compared with filling its GARDEN with 10 POLLEN?', ['TIP 20 vs GARDEN 10', 'TIP 20 vs GARDEN 20', 'TIP 10 vs GARDEN 10', 'TIP 20 vs GARDEN 5'], 'A TIP is 20; 10 GARDEN POLLEN are 10 x 1 = 10.', PTS),
  T('s-pl-15', 2, 'True or false: each HIVE TIP both scores points and lets your HUMAN PLAYER enter another NECTAR.', true, 'Each TIP is 20 points and unlocks one more NECTAR (until 60 seconds left).', 'Section 10.1, p. 79; G426, p. 114'),
  M('s-pl-16', 3, 'How many NECTAR could an ALLIANCE place in FLOWERS before 1:00 without a penalty?', nums(0, [1, 3, 5]), 'G410: NECTAR may not enter FLOWERS until the last 60 seconds; each early NECTAR is a MAJOR FOUL.', 'G410, p. 107'),
  M('s-pl-17', 2, 'Where do NECTAR first become available to ROBOTS without any TIP?', ['The 3 in the ALLIANCE\'s up CELL', 'The 5 in the ALLIANCE AREA', 'In the FLOWERS', 'In the GARDEN'], '3 NECTAR start in each upward-facing CELL; the 5 in the ALLIANCE AREA need TIPS or the 60-second mark.', 'Section 10.3.1, p. 82; G426, p. 114'),
  M('s-pl-18', 3, 'During the 8-second transition, which is allowed?', ['Pressing stop on AUTO and INIT on TELEOP (if INIT doesn\'t move the ROBOT)', 'Driving to line up for TELEOP', 'Running an intake to finish grabbing a ball', 'Raising an arm'], 'G403: no powered movement; buttons may be pressed to stop AUTO and INIT TELEOP if INIT doesn\'t cause motion.', 'G403, pp. 104-105'),
  M('s-pl-19', 2, 'Which ROBOT gets the AUTO side of the FIELD with priority over SCORING ELEMENTS in columns A-C?', ['The red ALLIANCE', 'The blue ALLIANCE', 'Whichever arrives first', 'Neither'], 'During AUTO, columns A, B, C are the red side; each ALLIANCE has priority on its side.', 'G402, p. 104'),
  M('s-pl-20', 3, 'You expect the opponent to TIP 7 times. You can TIP 5 times. How many more points from other scoring do you need to tie on TIPS alone?', nums(40, [20, 60, 35]), 'They get 7 x 20 = 140, you get 5 x 20 = 100: 40 behind.', PTS),
];

// Whole-MATCH totals
const totals = [
  M('s-to-1', 2, 'Full MATCH for blue: both LEAVE, 1 AUTO TIP, 3 TELEOP TIPS, both TELEOP PARK. Total?', nums(96, [86, 106, 91]), '6 + 20 + 60 + 10 = 96.', PTS),
  M('s-to-2', 2, 'Red: both LEAVE and AUTO PARK, 4 TIPS in TELEOP, 3 elements in the up CELL at the end, nobody PARKS at the end. Total?', nums(102, [96, 112, 92]), 'AUTO 6 + 10 = 16. TELEOP 80 + 6 = 86. 16 + 86 = 102.', PTS),
  M('s-to-3', 3, 'Red: 2 LEAVE, 2 AUTO TIPS, 4 TELEOP TIPS, owns 1 FLOWER with 6 elements, 1 Bottom NECTAR Bonus, 5 GARDEN POLLEN, 2 PARK. Total?', nums(158, [148, 168, 153]), '6 + 40 + 80 + 12 + 5 + 5 + 10 = 158.', PTS),
  M('s-to-4', 3, 'Same red score of 158, and blue committed 1 MAJOR and 1 MINOR FOUL. Red\'s final score?', nums(183, [178, 158, 198]), '158 + 20 + 5 = 183.', 'Section 10.6, Table 10-4, p. 90; Table 10-2, p. 89'),
  M('s-to-5', 2, 'Blue scored 120 and earned 8 TIPS, red scored 100 with 5 TIPS; both earned SWARM. RP for a blue team at a regular event?', nums(6, [5, 4, 3]), 'WIN 3 + SWARM 1 + POLLINATOR 1 + POLLINATOR 2 = 6.', RP),
  M('s-to-6', 2, 'Same MATCH: red lost 100-120 with 5 TIPS and SWARM. RP for a red team?', nums(2, [1, 3, 0]), 'SWARM 1 + POLLINATOR 1 (5 TIPS >= 4) = 2.', RP),
  M('s-to-7', 3, 'An ALLIANCE TIPS 7 times total, all in TELEOP, owns 2 FLOWERS with 4 elements each, and both ROBOTS LEAVE and PARK both times. Total?', nums(182, [176, 162, 192]), '140 (TIPS) + 16 (FLOWERS) + 6 (LEAVE) + 20 (PARK) = 182.', PTS),
  M('s-to-8', 2, 'If both ALLIANCES score 90 MATCH points, what happens in a Qualification MATCH?', ['TIE: 1 RP each, plus any threshold RPs', 'Replay', 'Higher seed wins', 'Most TIPS wins'], 'Same MATCH points = TIE, worth 1 RP; SWARM/POLLINATOR still count.', RP),
  M('s-to-9', 2, 'If two ALLIANCES tie in a Playoff MATCH, what happens?', ['They play another MATCH', 'Most TIPS wins', 'Higher seed advances', 'Both advance'], 'Ties play another MATCH until there is 1 winner.', 'Section 13.7.2, p. 154'),
];

// More end-of-MATCH swings and totals
const swings = [
  M('s-te-31', 3, 'Red owns a FLOWER with 6 elements. Blue drops one blue NECTAR on top. By how much does the score difference (blue minus red) change?', nums(26, [14, 12, 2]), 'Red loses 6 x 2 = 12. Blue now owns 7 elements: +14. The difference moves 12 + 14 = 26.', 'Section 10.5.2, p. 86; Table 10-2, p. 89'),
  M('s-fo-15', 3, 'Red scored 140 before fouls and blue 150. Blue committed 1 MAJOR FOUL and red committed 2 MINOR FOULS. What is the result?', ['A TIE, 160 to 160', 'Red wins by 10', 'Blue wins by 10', 'Blue wins by 20'], 'Red: 140 + 20 = 160. Blue: 150 + 2 x 5 = 160. It is a TIE.', FOUL),
  M('s-to-11', 3, 'Red: 2 LEAVE, 1 AUTO TIP, 2 TELEOP TIPS, 2 TELEOP PARK. Blue: 2 LEAVE, 2 AUTO PARK, 3 TELEOP TIPS. Result?', ['Tied at 76', 'Red by 10', 'Blue by 10', 'Blue by 20'], 'Red: 6 + 20 + 40 + 10 = 76. Blue: 6 + 10 + 60 = 76. Tied.', PTS),
];

export const STRATEGY = [...auto, ...rp, ...tele, ...fouls, ...plan, ...totals, ...swings];
