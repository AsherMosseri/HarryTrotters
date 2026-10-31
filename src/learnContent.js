// What /java, /explain and /tip say. Code is for the FTC SDK (Java, the
// current robotcontroller API: DcMotorEx, IMU, ElapsedTime…); tips are
// plain, checked advice, with the manual rule cited where there is one.

// /java <topic>: [title, code, a line about it]
export const JAVA = {
  motor: [
    'Set up a motor',
    `DcMotorEx lift = hardwareMap.get(DcMotorEx.class, "lift");
lift.setDirection(DcMotorSimple.Direction.REVERSE);
lift.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
lift.setPower(0.5); // -1.0 to 1.0`,
    'The name in quotes must match the robot configuration exactly.',
  ],
  encoder: [
    'Read an encoder',
    `lift.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
lift.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER); // or RUN_USING_ENCODER
int ticks = lift.getCurrentPosition();
double ticksPerSec = lift.getVelocity(); // DcMotorEx`,
    'Ticks per output turn depend on the motor: try /ticks 312.',
  ],
  runtoposition: [
    'Move to a position (RUN_TO_POSITION)',
    `lift.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
lift.setTargetPosition(1200);              // set the target first
lift.setMode(DcMotor.RunMode.RUN_TO_POSITION);
lift.setPower(0.8);                        // the top speed on the way there
while (opModeIsActive() && lift.isBusy()) {
    telemetry.addData("lift", lift.getCurrentPosition());
    telemetry.update();
}`,
    'Switching to RUN_TO_POSITION before a target is set throws an error.',
  ],
  velocity: [
    'Hold a speed (velocity control)',
    `flywheel.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
flywheel.setVelocity(2000); // ticks per second
telemetry.addData("rpm", flywheel.getVelocity() / 28 * 60); // bare 28-tick motor`,
    'setVelocity needs DcMotorEx and an encoder plugged in.',
  ],
  servo: [
    'Move a servo',
    `Servo claw = hardwareMap.get(Servo.class, "claw");
claw.scaleRange(0.2, 0.8);  // optional: limit the travel
claw.setPosition(0.0);      // 0.0 to 1.0
claw.setPosition(1.0);`,
    'A Servo goes to a position; it can’t tell you where it really is.',
  ],
  crservo: [
    'Spin a continuous servo',
    `CRServo intake = hardwareMap.get(CRServo.class, "intake");
intake.setPower(1.0);  // -1.0 to 1.0
intake.setPower(0);`,
    'Configure the port as a Continuous Rotation Servo.',
  ],
  imu: [
    'Read the heading (IMU)',
    `IMU imu = hardwareMap.get(IMU.class, "imu");
imu.initialize(new IMU.Parameters(new RevHubOrientationOnRobot(
        RevHubOrientationOnRobot.LogoFacingDirection.UP,
        RevHubOrientationOnRobot.UsbFacingDirection.FORWARD)));
imu.resetYaw();
double heading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES);`,
    'Set the two directions to how your hub is mounted, or the heading will be wrong.',
  ],
  telemetry: [
    'Show numbers on the Driver Station',
    `telemetry.addData("Heading", "%.1f", heading);
telemetry.addData("Lift", lift.getCurrentPosition());
telemetry.update(); // nothing shows until update()`,
    'Telemetry is the fastest way to see what the robot thinks.',
  ],
  gamepad: [
    'Read the gamepad',
    `double drive = -gamepad1.left_stick_y; // pushing up is negative
double turn = gamepad1.right_stick_x;
if (gamepad1.a) claw.setPosition(1.0);
if (gamepad2.right_trigger > 0.5) intake.setPower(1);`,
    'Sticks go from -1 to 1; triggers from 0 to 1.',
  ],
  teleop: [
    'A TeleOp OpMode',
    `@TeleOp(name = "Drive")
public class Drive extends LinearOpMode {
    @Override
    public void runOpMode() {
        DcMotor left = hardwareMap.get(DcMotor.class, "left");
        DcMotor right = hardwareMap.get(DcMotor.class, "right");
        right.setDirection(DcMotorSimple.Direction.REVERSE);
        waitForStart();
        while (opModeIsActive()) {
            double drive = -gamepad1.left_stick_y;
            double turn = gamepad1.right_stick_x;
            left.setPower(drive + turn);
            right.setPower(drive - turn);
            telemetry.update();
        }
    }
}`,
    'Use @Autonomous instead of @TeleOp for an auto.',
  ],
  mecanum: [
    'Mecanum drive',
    `double y = -gamepad1.left_stick_y;
double x = gamepad1.left_stick_x * 1.1; // makes up for weaker strafing
double rx = gamepad1.right_stick_x;
double d = Math.max(Math.abs(y) + Math.abs(x) + Math.abs(rx), 1);
frontLeft.setPower((y + x + rx) / d);
backLeft.setPower((y - x + rx) / d);
frontRight.setPower((y - x - rx) / d);
backRight.setPower((y + x - rx) / d);`,
    'Reverse the left motors (or the right, depending on how they’re mounted) so forward is forward.',
  ],
  timer: [
    'Time something (ElapsedTime)',
    `ElapsedTime timer = new ElapsedTime();
timer.reset();
while (opModeIsActive() && timer.seconds() < 1.5) {
    // keep doing this for 1.5 seconds
}`,
    'Better than sleep(): the loop keeps running and Stop still works.',
  ],
  sensors: [
    'Distance, color and touch sensors',
    `DistanceSensor dist = hardwareMap.get(DistanceSensor.class, "dist");
double cm = dist.getDistance(DistanceUnit.CM);

NormalizedColorSensor color = hardwareMap.get(NormalizedColorSensor.class, "color");
NormalizedRGBA c = color.getNormalizedColors();

TouchSensor touch = hardwareMap.get(TouchSensor.class, "touch");
boolean pressed = touch.isPressed();`,
    'A REV Color Sensor V3 can be read as both a color and a distance sensor.',
  ],
  bulk: [
    'Faster loops (bulk reads)',
    `List<LynxModule> hubs = hardwareMap.getAll(LynxModule.class);
for (LynxModule hub : hubs) {
    hub.setBulkCachingMode(LynxModule.BulkCachingMode.AUTO);
}`,
    'Reads all of a hub’s encoders and inputs in one go instead of one call each.',
  ],
  pid: [
    'Hold an arm with a P loop',
    `double kP = 0.004;
int target = 800;
while (opModeIsActive()) {
    int error = target - arm.getCurrentPosition();
    arm.setPower(Math.max(-0.6, Math.min(0.6, kP * error)));
    telemetry.addData("error", error);
    telemetry.update();
}`,
    'Start with only P; add D if it overshoots, and a small constant (feedforward) if gravity pulls it down.',
  ],
};
export const JAVA_ALIASES = { rtp: 'runtoposition', 'run-to-position': 'runtoposition', drive: 'mecanum', opmode: 'teleop', linear: 'teleop', sensor: 'sensors', color: 'sensors', distance: 'sensors', touch: 'sensors', heading: 'imu', gyro: 'imu', cr: 'crservo', flywheel: 'velocity', loop: 'bulk' };

// /explain <thing>: [title, explanation]
export const EXPLAIN = {
  run_to_position: [
    'RUN_TO_POSITION',
    'The motor drives itself to setTargetPosition() using its encoder, at up to the power you give it with setPower(), then holds there. Set the target before switching to this mode. isBusy() is true until it gets close to the target. Great for lifts and arms; for drive, a path follower usually does better.',
  ],
  run_using_encoder: [
    'RUN_USING_ENCODER',
    'setPower() becomes a target speed: the hub uses the encoder to keep the motor at that fraction of its top speed, even as the battery drops or the load changes. Needs an encoder plugged in.',
  ],
  run_without_encoder: [
    'RUN_WITHOUT_ENCODER',
    'setPower() is just how much voltage the motor gets. No speed control, but the encoder still counts, so you can still read getCurrentPosition(). Most teams drive in this mode.',
  ],
  stop_and_reset_encoder: [
    'STOP_AND_RESET_ENCODER',
    'Stops the motor and sets its encoder count back to 0. Switch to another mode afterward, or the motor won’t move.',
  ],
  brake: [
    'BRAKE vs FLOAT',
    'setZeroPowerBehavior(BRAKE) shorts the motor when power is 0, so it stops quickly and resists being pushed. FLOAT lets it coast. Drive motors and arms usually use BRAKE.',
  ],
  pid: [
    'PID',
    'A way to reach a target smoothly. P pushes harder the farther away you are, I adds up error over time to fix a small steady miss, and D slows you down as you approach to stop overshoot. Tune P first, then D; most FTC mechanisms need little or no I.',
  ],
  feedforward: [
    'Feedforward',
    'Power you add because you already know you’ll need it, like a small constant to hold an arm against gravity or kV × speed for a flywheel. PID then only fixes what’s left.',
  ],
  imu: [
    'IMU',
    'The Control Hub’s built-in sensor that measures rotation. Its yaw tells you which way the robot is facing, which is what field-centric drive and accurate turns use. It drifts slowly and can be reset with resetYaw().',
  ],
  odometry: [
    'Odometry (dead wheels)',
    'Small unpowered wheels with encoders that roll on the floor. Because they don’t slip like drive wheels, adding up their movement tells you where the robot is on the field. Two wheels plus the IMU, or three wheels, is the usual setup.',
  ],
  mecanum: [
    'Mecanum wheels',
    'Wheels with rollers at 45°. Spinning the four wheels in different combinations lets the robot drive forward, sideways (strafe) or turn, all at once. Strafing is weaker than driving forward because of roller friction.',
  ],
  servo: [
    'Servo vs continuous servo',
    'A standard servo goes to a position (0.0–1.0) and holds it. A continuous rotation servo spins like a small motor, with setPower() from -1 to 1. Many servos (goBILDA Dual Mode, REV Smart Robot Servo) can be switched between the two.',
  ],
  opmode: [
    'LinearOpMode vs OpMode',
    'LinearOpMode runs runOpMode() from top to bottom: waitForStart(), then your own loop. OpMode (iterative) calls your init() and loop() methods over and over for you. Both work; LinearOpMode is easier to read for autos.',
  ],
  waitforstart: [
    'waitForStart()',
    'Pauses your OpMode after INIT until the driver presses start. Put setup (hardwareMap, IMU, resetting encoders) before it; anything that moves the robot goes after it.',
  ],
  hardwaremap: [
    'hardwareMap',
    'How code finds devices: hardwareMap.get(DcMotor.class, "name") looks up the name from the robot configuration on the Driver Station. A typo or a wrong type is the most common “it crashes at INIT” bug.',
  ],
  encoder: [
    'Encoders and ticks',
    'An encoder counts tiny steps (ticks) as the shaft turns. A goBILDA 312 RPM motor gives 537.7 ticks per output turn; divide by the wheel’s circumference to get ticks per inch. Try /ticks 312 96mm.',
  ],
  apriltag: [
    'AprilTags',
    'Square black-and-white markers a camera can find, and tell from them exactly where it is relative to the tag. The FTC SDK has an AprilTag processor in VisionPortal.',
  ],
  voltage: [
    'Voltage sag',
    'When motors pull a lot of current, the battery’s voltage drops for a moment. Low voltage makes motors weaker and can reset the hub if it drops too far. Fresh batteries, good connectors and not stalling motors all help.',
  ],
  bulk: [
    'Bulk reads',
    'Every read from a hub takes a few milliseconds. With bulk caching on AUTO, the first read in a loop grabs all of that hub’s encoder and sensor values at once, so loops run much faster.',
  ],
  deadzone: [
    'Stick deadzone',
    'Gamepad sticks rarely rest at exactly 0. Ignore tiny values (say under 0.05) so the robot doesn’t creep when nobody is touching the controller.',
  ],
  'field-centric': [
    'Field-centric drive',
    'The robot moves relative to the field, not to itself: pushing the stick “up” always drives away from the driver, whichever way the robot faces. You rotate the stick inputs by the IMU heading before the mecanum math.',
  ],
};
export const EXPLAIN_ALIASES = {
  rtp: 'run_to_position',
  'run to position': 'run_to_position',
  runtoposition: 'run_to_position',
  'run using encoder': 'run_using_encoder',
  'run without encoder': 'run_without_encoder',
  float: 'brake',
  zeropowerbehavior: 'brake',
  'dead wheels': 'odometry',
  deadwheels: 'odometry',
  'cr servo': 'servo',
  crservo: 'servo',
  linearopmode: 'opmode',
  ticks: 'encoder',
  gyro: 'imu',
  fieldcentric: 'field-centric',
  'field centric': 'field-centric',
  ff: 'feedforward',
};

// /tip [area]: [area, tip]
export const TIPS = [
  ['wiring', 'Label both ends of every cable. When something stops working in the pit, you’ll know which port it goes to in seconds.'],
  ['wiring', 'Tug-test every connector before a match. A loose JST on an encoder is the classic “auto worked yesterday” bug.'],
  ['wiring', 'Main power wires are 18 AWG or bigger, servo and LED wires 22 AWG or bigger, signal wires 28 AWG or bigger (R609, p. 134).'],
  ['wiring', 'The 12V and 5V power wires must be color-coded: red, yellow, white, brown or black-with-stripe for +, black or blue for − (R610, p. 135).'],
  ['wiring', 'Strain-relieve power cables near the hub so a bump pulls on a zip tie, not on the connector.'],
  ['wiring', 'Keep wires away from anything that moves. Run them along the frame and through cable chain on lifts.'],
  ['wiring', 'Never replace a fuse with a bigger one or a self-resetting one (R604, p. 133).'],
  ['code', 'In a LinearOpMode loop, always check opModeIsActive() so Stop works right away.'],
  ['code', 'Use ElapsedTime instead of sleep() in TeleOp: sleep() freezes your whole loop, including driving.'],
  ['code', 'Turn on bulk reads (LynxModule.BulkCachingMode.AUTO) and your loop can run several times faster. /java bulk'],
  ['code', 'Put telemetry for every sensor you rely on. Most “mystery” bugs are a value that isn’t what you thought.'],
  ['code', 'Commit your code (with a message) before every competition, so you can always get back to what worked.'],
  ['code', 'Reset encoders at the start of auto, not in TeleOp, so TeleOp can keep using positions from auto.'],
  ['code', 'Name hardware in code exactly as in the configuration; one typo crashes the OpMode at INIT.'],
  ['code', 'Tune with the battery you’ll compete with. A tired battery makes everything look slower.'],
  ['build', 'Put blue (removable) threadlocker on set screws and screws that vibrate loose.'],
  ['build', 'Tighten set screws onto the flat of a D-shaft, and check them after every few matches.'],
  ['build', 'Support shafts at both ends. A shaft held on one side bends and eats bearings.'],
  ['build', 'Keep the center of mass low and centered: the robot tips less and turns more predictably.'],
  ['build', 'The starting size is an 18 in. cube (R102, p. 119). Check it with a sizing box before inspection, not at it.'],
  ['build', 'After the start, the robot must stay inside 18 × 24 × 29 in. tall, limited by hardware, not software (R105, p. 120).'],
  ['build', 'Measure twice, cut once. Then deburr the edge.'],
  ['driving', 'Practice full matches with a timer: 30 s AUTO, 8 s transition, 2:00 TELEOP (Section 10.4, p. 83).'],
  ['driving', 'Split the controls: driver on gamepad1, mechanisms on gamepad2. Two people are faster than one.'],
  ['driving', 'Know the fouls: a MINOR FOUL gives the other alliance 5 points, a MAJOR FOUL 20 (Table 10-4, p. 90).'],
  ['driving', 'Robots can’t CONTROL more than 4 SCORING ELEMENTS at once (G407, p. 106). Practice not picking up a 5th.'],
  ['driving', 'Pins last at most 3 seconds (G421). Back off and count.'],
  ['portfolio', 'Write in the portfolio as you go: date, goal, what you tried, what happened, what’s next.'],
  ['portfolio', 'The portfolio is a cover page plus at most 15 pages, US Letter or A4, under 15 MB (A201, p. 46).'],
  ['portfolio', 'Use first names and last initials only in the portfolio (A201, p. 46).'],
  ['portfolio', 'Judges like evidence: test results, graphs, before-and-after photos, and why you chose a design.'],
  ['portfolio', 'Judges won’t click links or watch videos in a portfolio (A201), so put what matters on the page.'],
  ['competition', 'Bring every battery charged, labeled and numbered, and rotate them so none sits unused.'],
  ['competition', 'Pack a pit kit: spare servos, motors, wheels, zip ties, hex keys, threadlocker, extension cables and a phone charger.'],
  ['competition', 'Safety glasses are required in specified areas at events (E101, p. 30). Bring extras for visitors.'],
  ['competition', 'Have a default AUTO OpMode ready; every team must select and INIT an OpMode before a match (G305, p. 103).'],
  ['competition', 'Robots need at least two ROBOT SIGNS showing your team number and alliance color (R401-R403, pp. 126-127).'],
  ['competition', 'Before queueing: battery in and charged, OpMode selected, robot sized, signs on the right color.'],
  ['safety', 'Unplug the battery before working on wiring or reaching into a mechanism.'],
  ['safety', 'Wear safety glasses whenever someone is cutting, drilling or testing a launcher.'],
  ['safety', 'Keep fingers out of pinch points when the robot is powered: gears, chains, slides and claws.'],
];
export const TIP_AREAS = [...new Set(TIPS.map(([a]) => a))];
