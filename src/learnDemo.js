// DEMO SAMPLES ONLY. Demo mode (?demo) can't call the server, so it plays
// the learning games from this small set of sample questions, written just
// for the demo and NOT taken from the real question banks (those stay on the
// server, functions/banks, so their answers never ship in the app). The
// real games draw from hundreds of checked questions instead.

const mc = (bank, id, difficulty, prompt, choices, answer, explain, extra = {}) => ({
  id: `demo-${id}`,
  bank,
  kind: 'choice',
  difficulty,
  prompt,
  choices,
  answer,
  explain,
  demo: true,
  ...extra,
});
const tf = (bank, id, difficulty, statement, isTrue, explain, source) =>
  mc(bank, id, difficulty, `True or false: ${statement}`, ['True', 'False'], isTrue ? 0 : 1, explain, { source });

const parts = [
  mc('parts', 'p1', 1, 'Which part is this? "A ring that clamps tight around a shaft, so the shaft can’t slide back out through its bearing."', ['Shaft coupler', 'Shaft collar', 'Flanged bearing', 'Standoff'], 1, 'A shaft collar clamps onto the shaft next to a bearing so the shaft stays put.'),
  mc('parts', 'p2', 1, 'Which part is this? "An aluminum post with threaded holes in both ends, used to hold two plates a set distance apart."', ['Standoff', 'Pillow block', 'Gusset', 'Hub'], 0, 'Standoffs space plates apart; screws go into the threads at each end.'),
  mc('parts', 'p3', 1, 'Which part is this? "Joins the ends of two shafts so turning one turns the other."', ['Shaft collar', 'Sprocket', 'Shaft coupler', 'Bearing'], 2, 'A coupler connects two shafts end to end, often a motor shaft to a longer shaft.'),
  mc('parts', 'p4', 1, 'Which part is this? "Pressed into a hole in a plate so a shaft can spin through it smoothly."', ['Ball bearing', 'Spacer', 'Gusset', 'Standoff'], 0, 'A ball bearing lets a shaft spin with little friction instead of rubbing the plate.'),
  mc('parts', 'p5', 1, 'Which part is this? "A toothed wheel that drives roller chain."', ['Timing pulley', 'Spur gear', 'Sprocket', 'Omni wheel'], 2, 'Sprockets drive chain; pulleys drive belts; gears mesh with other gears.'),
  mc('parts', 'p6', 2, 'Which part is this? "A wheel with rollers set at 45 degrees around its edge, so four of them can drive sideways."', ['Traction wheel', 'Mecanum wheel', 'Caster', 'Omni wheel'], 1, 'Mecanum rollers sit at 45°; spinning the wheels in the right pattern strafes the robot.'),
  mc('parts', 'p7', 2, 'What is the gusset for?', ['Stiffening a corner where two pieces meet', 'Holding a battery', 'Driving a belt', 'Spacing gears apart'], 0, 'A gusset is a flat plate bolted across a corner to keep it square and stiff.'),
  mc('parts', 'p8', 2, 'Which part is this? "Clamps onto a shaft and gives you a ring of bolt holes to mount a wheel, gear or arm."', ['Hub', 'Shaft collar', 'Bearing', 'Spacer'], 0, 'A hub turns with the shaft and gives you holes to bolt things to.'),
  mc('parts', 'p9', 3, 'Which part is this? "Measures the robot’s turn rate and heading; the Control Hub has one built in."', ['Encoder', 'Potentiometer', 'IMU', 'Color sensor'], 2, 'The IMU (inertial measurement unit) reports heading for field-centric drive and turns.'),
  mc('parts', 'p10', 3, 'What is a dead-wheel odometry pod for?', ['Tracking how far the robot really moved', 'Adding traction', 'Holding game pieces', 'Powering servos'], 0, 'An unpowered wheel with an encoder measures real movement, even when drive wheels slip.'),
];

const SRC_TIME = 'Section 10.4, p. 83';
const rules = [
  mc('rules', 'r1', 1, 'How long is the AUTO period in a BIOBUZZ MATCH?', ['15 seconds', '30 seconds', '45 seconds', '1 minute'], 1, 'AUTO is the first 30 seconds of the MATCH; ROBOTS run with no DRIVER input.', { source: SRC_TIME }),
  mc('rules', 'r2', 1, 'How long is TELEOP?', ['1:30', '2:00', '2:30', '3:00'], 1, 'TELEOP, the third period, is 2 minutes long.', { source: SRC_TIME }),
  tf('rules', 'r3', 1, 'a ROBOT may CONTROL up to 4 SCORING ELEMENTS at a time.', true, 'G407: no more than 4 at a time.', 'G407, p. 106'),
  mc('rules', 'r4', 1, 'How many FLOWERS does the BIOBUZZ FIELD have on its walls?', ['2', '3', '4', '6'], 2, 'The FIELD has the HIVE structure and 4 FLOWERS on the perimeter wall.', { source: 'Section 9.2, p. 62' }),
  tf('rules', 'r5', 2, 'there are 8 seconds between AUTO and TELEOP.', true, 'An 8-second transition separates AUTO and TELEOP for scoring.', 'Section 10.1, p. 79'),
  mc('rules', 'r6', 2, 'To earn PARK, a ROBOT must be at least partly in which zone?', ['Its GARDEN', 'Its LOADING ZONE', 'The middle of the FIELD', 'Any TILE'], 1, 'PARK needs the ROBOT at least partially in its LOADING ZONE.', { source: 'Section 10.5.4, p. 88' }),
  tf('rules', 'r7', 2, 'during AUTO, FIELD columns D, E and F are the red side.', false, 'Columns A, B and C are red during AUTO; D, E and F are blue.', 'G402, p. 104'),
  mc('rules', 'r8', 2, 'How many POLLEN does each ROBOT start the MATCH with?', ['2', '3', '4', '5'], 2, 'Every ROBOT starts with 4 pre-load POLLEN in it or touching it.', { source: 'Section 10.3.1, p. 81' }),
  mc('rules', 'r9', 3, 'How many NECTAR wait in each ALLIANCE AREA when a MATCH starts?', ['3', '4', '5', '8'], 2, 'Each ALLIANCE AREA stages 5 NECTAR; one may be entered per HIVE TIP.', { source: 'Section 10.3.1, Figure 10-2, p. 81' }),
  mc('rules', 'r10', 3, 'What size must a ROBOT fit in at the start of a MATCH?', ['An 18-inch cube', 'A 16-inch cube', 'An 18 by 24 inch box', 'Any size'], 0, 'The STARTING CONFIGURATION is limited to an 18-inch cube.', { source: 'R102, p. 119' }),
];

const PTS = 'Table 10-2, p. 89';
const strategy = [
  mc('strategy', 'st1', 1, 'One ROBOT LEAVES and AUTO PARKS. No TIP. How many AUTO points?', ['5', '8', '10', '13'], 1, 'LEAVE 3 + PARK 5 = 8.', { source: PTS }),
  mc('strategy', 'st2', 1, 'Your HIVE TIPS twice in TELEOP. How many points is that?', ['20', '30', '40', '60'], 2, '2 × 20 = 40.', { source: PTS }),
  mc('strategy', 'st3', 2, 'You own a FLOWER holding 6 elements. How many points?', ['6', '10', '12', '18'], 2, 'Each element in an owned FLOWER is 2 points: 6 × 2 = 12.', { source: PTS }),
  mc('strategy', 'st4', 2, 'At a regular event, how many TIPS earn POLLINATOR 1?', ['3', '4', '5', '7'], 1, 'POLLINATOR 1 needs 4 TIPS; POLLINATOR 2 needs 7.', { source: 'Table 10-3, p. 89' }),
  tf('strategy', 'st5', 2, 'both ROBOTS LEAVING and AUTO PARKING is enough for SWARM at a regular event.', true, '2 × 3 + 2 × 5 = 16, which meets the 16-point threshold.', 'Table 10-3, p. 89'),
  mc('strategy', 'st6', 2, 'How many RP is a WIN worth?', ['1', '2', '3', '4'], 2, 'A WIN is 3 RP; a TIE is 1.', { source: PTS }),
  mc('strategy', 'st7', 3, 'At the end, 5 elements sit in your up CELL and 3 POLLEN in your GARDEN. Points?', ['8', '13', '16', '25'], 1, 'CELL: 5 × 2 = 10. GARDEN: 3 × 1 = 3. Total 13.', { source: PTS }),
  mc('strategy', 'st8', 3, 'What is the Bottom NECTAR Bonus worth?', ['2', '5', '10', '20'], 1, 'The ALLIANCE with the bottom-most scored NECTAR of its color in a FLOWER gets 5.', { source: PTS }),
];

// Wiring: port ids match the hub drawings in src/electrical.js.
const w = (id, difficulty, hub, device, prompt, ports, choices, answer, explain) =>
  mc('wiring', id, difficulty, prompt, choices, answer, explain, { hub, device, ports });
const wiring = [
  w('w1', 1, 'controlHub', 'motor', 'The "shooter" motor is configured on Control Hub motor port 2. Where does its power cable go?', ['m2'], ['Motor 1', 'Motor 2', 'Encoder 2', 'Servo 2'], 1, 'Motor port 2 powers the motor configured on port 2.'),
  w('w2', 2, 'controlHub', 'motor', 'The "lift" motor is on Control Hub motor port 3 and uses RUN_TO_POSITION. Where does its encoder go?', ['e3'], ['Encoder 2', 'Encoder 3', 'Motor 3', 'I²C bus 3'], 1, 'Encoders go in the port that matches their motor.'),
  w('w3', 1, 'expansionHub', 'servo', 'The "wrist" servo is configured on Expansion Hub servo port 4. Where does it plug in?', ['s4'], ['Servo 3', 'Servo 4', 'Servo 5', 'Motor 0'], 1, 'That 3-pin port is the one the configuration calls servo 4.'),
  w('w4', 2, 'controlHub', 'digitalSensor', 'Which Control Hub port can a limit switch plug into?', ['d01', 'd23', 'd45', 'd67'], ['Digital 2-3', 'Analog 0-1', 'I²C bus 2', 'Servo 1'], 0, 'A limit switch is on or off: any digital port works.'),
  w('w5', 2, 'expansionHub', 'i2cSensor', 'Which Expansion Hub port can a color sensor plug into?', ['i2c0', 'i2c1', 'i2c2', 'i2c3'], ['Digital 4-5', 'I²C bus 1', 'Analog 2-3', 'Encoder 1'], 1, 'Color sensors talk over I²C.'),
  w('w6', 2, 'controlHub', 'analogSensor', 'Which Control Hub port reads a potentiometer?', ['a01', 'a23'], ['Analog 2-3', 'Digital 0-1', 'I²C bus 0', 'Servo 0'], 0, 'Potentiometers give a voltage, which only the analog ports read.'),
  w('w7', 1, 'controlHub', 'camera', 'Where does a webcam plug into the Control Hub?', ['usb'], ['RS485', 'USB', 'I²C bus 0', 'XT30 power'], 1, 'Webcams use the USB port.'),
  w('w8', 2, 'expansionHub', 'controlHub', 'Which Expansion Hub port takes the data cable from the Control Hub?', ['rs485'], ['XT30 power', 'RS485', 'I²C bus 0', 'Digital 0-1'], 1, 'The hubs talk over RS485.'),
];

const s = (id, difficulty, subject, scene, choices, answer, explain, fix, source) =>
  mc('spot', id, difficulty, `${subject}: tap the problem.`, choices, answer, explain, { scene, fix, ...(source ? { source } : {}) });
const spot = [
  s('s1', 1, 'Intake roller', 'An intake roller on a REX shaft. One end of the shaft runs in a bearing; the other end has no bearing and rubs a bare hole. Also visible: the roller, the motor and a shaft collar.', ['Shaft in a bare hole', 'Roller', 'Motor', 'Shaft collar'], 0, 'Steel rubbing aluminum wears the hole and adds friction.', 'Press a bearing into the hole.'),
  s('s2', 1, 'Battery', 'A battery sitting loose in the chassis with nothing holding it in. Also visible: its cable, the power switch and the frame.', ['Power switch', 'Battery with no strap', 'Frame', 'Cable'], 1, 'A loose battery slides around and can pull its connector out in a hit.', 'Strap the battery into a holder.'),
  s('s3', 2, 'Drive gears', 'Two drive gears mounted so far apart that only the tips of the teeth touch. Also visible: the motor, the slotted mount and a bearing.', ['Motor', 'Bearing', 'Gap between the teeth', 'Slotted mount'], 2, 'Gears that barely mesh skip and strip under load.', 'Slide the motor in its slots until the gears mesh fully.'),
  s('s4', 2, 'Arm cable', 'A servo cable stretched across the teeth of the arm gear. Also visible: the servo, a zip tie and the hub.', ['Servo', 'Zip tie', 'Hub', 'Cable over the gear teeth'], 3, 'The gear will cut the cable as the arm moves.', 'Route the cable away from the gear and tie it to the frame.'),
  s('s5', 2, 'Hub ports', 'A Control Hub with a REV Touch Sensor plugged into an I²C port. Also visible: the motor cables, the servo ports and the empty digital ports.', ['Touch sensor in an I²C port', 'Motor cables', 'Servo ports', 'Digital ports'], 0, 'A touch sensor is digital, so it belongs on a digital port.', 'Move it to a digital port.'),
  s('s6', 3, 'Chain drive', 'A chain hanging loose between its sprockets, sagging onto the frame rail. Also visible: both sprockets and the master link.', ['Master link', 'Sagging chain', 'Small sprocket', 'Big sprocket'], 1, 'A loose chain jumps teeth or comes off.', 'Tension it with a tensioner or by moving a sprocket.'),
  s('s7', 3, 'Main power', 'The battery plugs straight into the Control Hub, with no switch in between. Also visible: the hub, the Expansion Hub link and an empty switch bracket.', ['Expansion Hub link', 'Battery straight to the hub', 'Hub', 'Switch bracket'], 1, 'The robot needs one main power switch between the battery and the hubs.', 'Wire the battery to the power switch, then the switch to the hub.', 'R603'),
];

const bug = (id, difficulty, lang, task, lines, bugLine, fixed, explain) => ({
  id: `demo-${id}`,
  bank: 'code',
  kind: 'bug',
  lang,
  difficulty,
  prompt: `${task} One line has a bug: which one?`,
  lines,
  bugLine,
  fixed,
  explain,
  demo: true,
});
const code = [
  bug('c1', 1, 'java', 'Hold A to run the intake forward.', ['while (opModeIsActive()) {', '    if (gamepad1.a) {', '        intake.setPower(1.0);', '    } else {', '        intake.setPower(1.0);', '    }', '}'], 4, '        intake.setPower(0.0);', 'The else branch should stop the intake; it runs it again instead.'),
  bug('c2', 1, 'java', 'Drive forward for one second, then stop.', ['leftDrive.setPower(0.5);', 'rightDrive.setPower(0.5);', 'sleep(1);', 'leftDrive.setPower(0);', 'rightDrive.setPower(0);'], 2, 'sleep(1000);', 'sleep() takes milliseconds: sleep(1) waits one thousandth of a second.'),
  bug('c3', 2, 'java', 'Move the shoulder joint to encoder position 800.', ['shoulder.setTargetPosition(800);', 'shoulder.setPower(0.6);', 'shoulder.setMode(DcMotor.RunMode.RUN_USING_ENCODER);', 'while (opModeIsActive() && shoulder.isBusy()) {', '    idle();', '}'], 2, 'shoulder.setMode(DcMotor.RunMode.RUN_TO_POSITION);', 'To go to a target the mode must be RUN_TO_POSITION.'),
  bug('c4', 2, 'java', 'Show the slide position on the Driver Station.', ['int ticks = slide.getCurrentPosition();', 'telemetry.addData("Slide", ticks);', 'telemetry.addData("Moving", slide.isBusy());', 'telemetry.update;'], 3, 'telemetry.update();', 'update is a method: it needs ().'),
  bug('c5', 2, 'java', 'Open the claw with B, close it with X.', ['if (gamepad1.b) {', '    claw.setPosition(0.9);', '} else if (gamepad1.b) {', '    claw.setPosition(0.1);', '}'], 2, '} else if (gamepad1.x) {', 'The second check reads B again, so X does nothing.'),
  bug('c6', 3, 'java', 'Get the motor named "flywheel" from the configuration.', ['DcMotor flywheel;', 'flywheel = hardwareMap.get(DcMotor.class, "flyWheel");', 'flywheel.setDirection(DcMotor.Direction.REVERSE);', 'waitForStart();'], 1, 'flywheel = hardwareMap.get(DcMotor.class, "flywheel");', 'Names must match the configuration exactly, capitals included.'),
  bug('c7', 1, 'blocks', 'Run the intake while the right bumper is held.', ['to runOpMode', '  call waitForStart', '  repeat while call opModeIsActive', '    if gamepad1.RightBumper', '      set intake.Power to 1', '    else', '      set intake.Power to 1'], 6, '      set intake.Power to 0', 'The else should stop the intake (power 0).'),
  bug('c8', 2, 'blocks', 'Point the servo at the middle of its range.', ['to runOpMode', '  call waitForStart', '  set kicker.Position to 50'], 2, '  set kicker.Position to 0.5', 'Servo positions go from 0 to 1, so the middle is 0.5.'),
];

const g = (id, difficulty, prompt, choices, answer, explain) => mc('gear', `g-${id}`, difficulty, prompt, choices, answer, explain);
const gear = [
  g('teeth-1', 1, 'A 300 RPM motor turns a 20-tooth gear that drives a 40-tooth gear. How fast does the 40-tooth gear turn?', ['75 RPM', '150 RPM', '300 RPM', '600 RPM'], 1, '300 × 20/40 = 150 RPM.'),
  g('teeth-2', 2, 'A 600 RPM motor turns a 15-tooth gear that drives a 45-tooth gear. How fast does the 45-tooth gear turn?', ['100 RPM', '200 RPM', '300 RPM', '1800 RPM'], 1, '600 × 15/45 = 200 RPM.'),
  g('reduce-1', 1, '500 RPM through a 5:1 reduction: what is the output speed?', ['50 RPM', '100 RPM', '250 RPM', '2500 RPM'], 1, '500 / 5 = 100 RPM.'),
  g('two-stage-1', 2, 'A 1200 RPM motor goes through a 3:1 stage, then a 4:1 stage. Output speed?', ['100 RPM', '300 RPM', '400 RPM', '1200 RPM'], 0, '3 × 4 = 12:1 overall; 1200 / 12 = 100 RPM.'),
  g('torque-1', 2, 'A motor’s stall torque is 10 kg-cm. Through a 3:1 reduction, ignoring losses, what is the output stall torque?', ['3.3 kg-cm', '10 kg-cm', '13 kg-cm', '30 kg-cm'], 3, 'A reduction multiplies torque: 10 × 3 = 30 kg-cm.'),
  g('wheel-1', 3, 'A 300 RPM motor drives a 100 mm wheel, direct drive. Top (free) speed of the wheel’s edge, in inches per second?', ['20.6 in/s', '39.4 in/s', '61.8 in/s', '123.7 in/s'], 2, '300 × π × 100 / 25.4 / 60 = 61.8 in/s.'),
  g('wheel-2', 3, 'A 600 RPM motor drives a 100 mm wheel through a 2:1 reduction. Top (free) speed of the wheel’s edge, in inches per second?', ['30.9 in/s', '61.8 in/s', '123.7 in/s', '247.4 in/s'], 1, 'Wheel RPM 300; 300 × π × 100 / 25.4 / 60 = 61.8 in/s.'),
  g('reduce-2', 2, '1000 RPM through a 4:1 reduction: what is the output speed?', ['125 RPM', '250 RPM', '400 RPM', '4000 RPM'], 1, '1000 / 4 = 250 RPM.'),
];

export const DEMO_BANKS = { parts, rules, strategy, wiring, spot, code, gear };
export const DEMO_ALL = Object.values(DEMO_BANKS).flat();
