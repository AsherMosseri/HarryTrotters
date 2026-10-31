// Fix the bug (G5), Java: short FTC SDK snippets. Each base snippet is
// correct for its task; each bug swaps exactly one line for a broken one.
// A bug names its line by a piece of text that appears on exactly one line.
// [find, broken line, why it is wrong, difficulty]

export const JAVA = [
  {
    key: 'drive-tank',
    task: 'Tank drive: each stick drives its own side, pushing a stick forward drives that side forward.',
    code: `waitForStart();
while (opModeIsActive()) {
    double left = -gamepad1.left_stick_y;
    double right = -gamepad1.right_stick_y;
    leftDrive.setPower(left);
    rightDrive.setPower(right);
    telemetry.addData("Left", left);
    telemetry.update();
}`,
    bugs: [
      ['double left =', 'double left = gamepad1.left_stick_y;', 'A gamepad stick\'s Y value is negative when pushed forward, so it must be negated or that side drives backward.', 1],
      ['rightDrive.setPower', 'rightDrive.setPower(left);', 'The right side is set from the left stick, so the right stick does nothing.', 1],
      ['while (opModeIsActive())', 'while (opModeIsActive()); {', 'The semicolon makes an empty loop that spins forever; the block below runs only once, after stop.', 2],
      ['telemetry.update', 'telemetry.update;', 'update is a method: without () this does not compile.', 1],
    ],
  },
  {
    key: 'arcade',
    task: 'Arcade drive: left stick Y drives forward and back, right stick X turns.',
    code: `double drive = -gamepad1.left_stick_y;
double turn = gamepad1.right_stick_x;
double leftPower = drive + turn;
double rightPower = drive - turn;
leftPower = Range.clip(leftPower, -1.0, 1.0);
rightPower = Range.clip(rightPower, -1.0, 1.0);
leftDrive.setPower(leftPower);
rightDrive.setPower(rightPower);`,
    bugs: [
      ['double rightPower', 'double rightPower = drive + turn;', 'Both sides get drive + turn, so the robot can\'t turn. The right side needs drive - turn.', 1],
      ['leftPower = Range.clip', 'leftPower = Range.clip(leftPower, 0.0, 1.0);', 'Clipping to 0..1 throws away negative power, so the left side can never drive backward.', 2],
      ['double turn', 'double turn = gamepad1.right_stick_y;', 'Turning should come from the right stick\'s X (side to side), not its Y.', 1],
      ['rightPower = Range.clip', 'rightPower = Range.clip(rightPower, -1, 1)', 'Missing semicolon at the end of the statement: it won\'t compile.', 1],
    ],
  },
  {
    key: 'mecanum',
    task: 'Robot-centric mecanum: y = forward, x = strafe, rx = turn, scaled so no wheel goes past 1.',
    code: `double y = -gamepad1.left_stick_y;
double x = gamepad1.left_stick_x;
double rx = gamepad1.right_stick_x;
double denominator = Math.max(Math.abs(y) + Math.abs(x) + Math.abs(rx), 1);
frontLeft.setPower((y + x + rx) / denominator);
backLeft.setPower((y - x + rx) / denominator);
frontRight.setPower((y - x - rx) / denominator);
backRight.setPower((y + x - rx) / denominator);`,
    bugs: [
      ['backLeft.setPower', 'backLeft.setPower((y + x + rx) / denominator);', 'On a mecanum drive the back left wheel uses y - x + rx; with + x the robot can\'t strafe straight.', 2],
      ['double denominator', 'double denominator = Math.max(y + x + rx, 1);', 'Without Math.abs, negative stick values shrink the sum and powers can go past 1 (or the scale is wrong).', 2],
      ['backRight.setPower', 'backRight.setPower((y + x + rx) / denominator);', 'The right side subtracts rx to turn; back right must be y + x - rx.', 2],
      ['double x =', 'double x = gamepad1.left_stick_x * 0;', 'Multiplying by 0 turns strafing off completely.', 1],
    ],
  },
  {
    key: 'rtp-arm',
    task: 'Move the arm motor to encoder position 1000 at half power, wait until it gets there, then stop.',
    code: `arm.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
arm.setTargetPosition(1000);
arm.setMode(DcMotor.RunMode.RUN_TO_POSITION);
arm.setPower(0.5);
while (opModeIsActive() && arm.isBusy()) {
    telemetry.addData("Arm", arm.getCurrentPosition());
    telemetry.update();
}
arm.setPower(0);`,
    bugs: [
      ['arm.setPower(0.5)', 'arm.setPower(0.0);', 'In RUN_TO_POSITION the motor only moves with power; at 0 it never goes anywhere.', 2],
      ['while (opModeIsActive()', 'while (opModeIsActive() || arm.isBusy()) {', 'With || the loop keeps going while the OpMode is active even after the arm arrives (and can\'t stop when the OpMode ends while busy). Use &&.', 2],
      ['arm.setTargetPosition', 'arm.setTargetPosition(1000.0);', 'setTargetPosition takes an int; 1000.0 is a double and won\'t compile.', 2],
      ['arm.setMode(DcMotor.RunMode.RUN_TO_POSITION)', 'arm.setMode(DcMotor.RunMode.RUN_USING_ENCODER);', 'RUN_USING_ENCODER ignores the target position; the arm just runs at half power forever.', 2],
    ],
  },
  {
    key: 'rtp-order',
    task: 'Lift: drive to the top position (2200 ticks) at full power.',
    code: `final int TOP = 2200;
lift.setTargetPosition(TOP);
lift.setMode(DcMotor.RunMode.RUN_TO_POSITION);
lift.setPower(1.0);
while (opModeIsActive() && lift.isBusy()) {
    idle();
}`,
    bugs: [
      ['lift.setPower', 'lift.setPower(100);', 'Motor power is a fraction from -1 to 1, not a percent.', 1],
      ['final int TOP', 'final int TOP = 2200.5;', 'An int can\'t hold 2200.5: it won\'t compile.', 1],
      ['lift.setMode', 'lift.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);', 'STOP_AND_RESET_ENCODER stops the motor and zeroes the encoder; it never runs to the target.', 2],
    ],
  },
  {
    key: 'encoder-drive',
    task: 'Drive straight forward 24 inches with encoders. goBILDA 312 RPM motor (537.7 ticks per output turn), 96 mm wheels.',
    code: `final double TICKS_PER_REV = 537.7;
final double WHEEL_DIAMETER_IN = 96 / 25.4;
final double TICKS_PER_INCH = TICKS_PER_REV / (WHEEL_DIAMETER_IN * Math.PI);
int target = (int) (24 * TICKS_PER_INCH);
leftDrive.setTargetPosition(target);
rightDrive.setTargetPosition(target);
leftDrive.setMode(DcMotor.RunMode.RUN_TO_POSITION);
rightDrive.setMode(DcMotor.RunMode.RUN_TO_POSITION);`,
    bugs: [
      ['final double TICKS_PER_INCH', 'final double TICKS_PER_INCH = TICKS_PER_REV / WHEEL_DIAMETER_IN;', 'One wheel turn travels the circumference, diameter x pi. Dividing by the diameter alone overshoots by about 3x.', 2],
      ['final double WHEEL_DIAMETER_IN', 'final double WHEEL_DIAMETER_IN = 96 * 25.4;', 'There are 25.4 mm in an inch, so mm to inches divides by 25.4.', 2],
      ['int target', 'int target = 24 * TICKS_PER_INCH;', '24 * a double is a double; assigning it to an int needs a cast, so this won\'t compile.', 2],
      ['final double TICKS_PER_REV', 'final double TICKS_PER_REV = 28;', '28 is the bare motor\'s count. At the 312 RPM gearbox output it is 537.7 ticks per turn.', 3],
    ],
  },
  {
    key: 'servo-claw',
    task: 'Claw: A opens it (servo position 0.8), B closes it (position 0.2).',
    code: `Servo claw = hardwareMap.get(Servo.class, "claw");
waitForStart();
while (opModeIsActive()) {
    if (gamepad1.a) {
        claw.setPosition(0.8);
    } else if (gamepad1.b) {
        claw.setPosition(0.2);
    }
}`,
    bugs: [
      ['claw.setPosition(0.8)', 'claw.setPosition(80);', 'Servo positions run from 0.0 to 1.0, not degrees or percent.', 1],
      ['Servo claw =', 'Servo claw = hardwareMap.get(DcMotor.class, "claw");', 'Asking hardwareMap for a DcMotor and storing it in a Servo doesn\'t compile; use Servo.class.', 1],
      ['if (gamepad1.a)', 'if (gamepad1.a = true) {', 'A single = assigns true, so the claw always opens. Compare with == or just use gamepad1.a.', 2],
      ['} else if (gamepad1.b)', '} else if (gamepad1.a) {', 'This checks A again, so B never closes the claw.', 1],
    ],
  },
  {
    key: 'crservo',
    task: 'Intake on a continuous rotation servo: hold right bumper to spin in, left bumper to spin out, otherwise stop.',
    code: `CRServo intake = hardwareMap.get(CRServo.class, "intake");
waitForStart();
while (opModeIsActive()) {
    if (gamepad1.right_bumper) {
        intake.setPower(1.0);
    } else if (gamepad1.left_bumper) {
        intake.setPower(-1.0);
    } else {
        intake.setPower(0);
    }
}`,
    bugs: [
      ['intake.setPower(1.0)', 'intake.setPosition(1.0);', 'A CRServo has no setPosition; continuous servos are driven with setPower.', 2],
      ['intake.setPower(0)', 'intake.setPower(0.5);', 'With no bumper held the intake should stop (power 0), not keep spinning.', 1],
      ['intake.setPower(-1.0)', 'intake.setPower(0.0);', 'Spinning out needs the opposite direction, -1.0; 0.0 just stops the intake.', 1],
    ],
  },
  {
    key: 'imu-init',
    task: 'Set up the Control Hub IMU (logo facing up, USB facing forward) and show the heading in degrees.',
    code: `IMU imu = hardwareMap.get(IMU.class, "imu");
RevHubOrientationOnRobot orientation = new RevHubOrientationOnRobot(
        RevHubOrientationOnRobot.LogoFacingDirection.UP,
        RevHubOrientationOnRobot.UsbFacingDirection.FORWARD);
imu.initialize(new IMU.Parameters(orientation));
waitForStart();
while (opModeIsActive()) {
    double heading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES);
    telemetry.addData("Heading", heading);
    telemetry.update();
}`,
    bugs: [
      ['double heading', 'double heading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.RADIANS);', 'The task wants degrees; RADIANS shows about 1.57 for a 90 degree turn.', 1],
      ['RevHubOrientationOnRobot.UsbFacingDirection.FORWARD', 'RevHubOrientationOnRobot.UsbFacingDirection.UP);', 'The logo and USB port can\'t both face up; the hub orientation is impossible and the IMU rejects it.', 3],
      ['imu.initialize', 'imu.initialize(orientation);', 'initialize takes IMU.Parameters, not the orientation itself, so this won\'t compile.', 2],
      ['IMU imu =', 'IMU imu = hardwareMap.get(IMU.class, "IMU");', 'Configuration names are case sensitive; the Control Hub\'s IMU is configured as "imu".', 2],
    ],
  },
  {
    key: 'turn-imu2',
    task: 'Turn in place to 90 degrees using the IMU, stopping within 2 degrees.',
    code: `double target = 90;
double error = target - getHeading();
while (opModeIsActive() && Math.abs(error) > 2) {
    double power = 0.02 * error;
    leftDrive.setPower(-power);
    rightDrive.setPower(power);
    error = target - getHeading();
}
leftDrive.setPower(0);
rightDrive.setPower(0);`,
    bugs: [
      ['while (opModeIsActive() && Math.abs', 'while (opModeIsActive() && error > 2) {', 'Without Math.abs, an overshoot makes the error negative and the loop quits early, or never runs for a left turn.', 2],
      ['double power =', 'double power = 0.02 * target;', 'Power should shrink as the robot gets close, so it comes from the error, not the fixed target.', 2],
      ['rightDrive.setPower(power);', 'rightDrive.setPower(-power);', 'Both sides get the same sign, so the robot drives straight instead of turning.', 1],
      ['    error = target', '    error = target - 90;', 'The error must be re-read from the heading each loop; target - 90 is always 0, so the loop stops at once.', 2],
    ],
  },
  {
    key: 'angle-wrap',
    task: 'Wrap a heading error into the range -180 to 180 degrees.',
    code: `double error = target - heading;
while (error > 180) {
    error -= 360;
}
while (error <= -180) {
    error += 360;
}
return error;`,
    bugs: [
      ['error -= 360', 'error -= 180;', 'A full turn is 360. Subtracting 180 gives the wrong angle: 270 becomes 90 instead of -90.', 2],
      ['while (error <= -180)', 'while (error <= 180) {', 'This loop runs for every normal error and keeps adding 360 forever.', 2],
      ['double error', 'double error = heading - target;', 'Error is target minus current heading; flipping it turns the robot the wrong way.', 2],
    ],
  },
  {
    key: 'toggle',
    task: 'Toggle the claw open/closed each time A is pressed (once per press, not every loop).',
    code: `boolean lastA = false;
boolean open = false;
while (opModeIsActive()) {
    if (gamepad1.a && !lastA) {
        open = !open;
    }
    lastA = gamepad1.a;
    claw.setPosition(open ? 0.8 : 0.2);
}`,
    bugs: [
      ['if (gamepad1.a && !lastA)', 'if (gamepad1.a && lastA) {', 'This fires while A is held, every loop after the first; the edge check needs !lastA.', 2],
      ['lastA = gamepad1.a', 'lastA = true;', 'lastA must follow the button; stuck at true, the toggle only works once.', 2],
      ['open = !open', 'open = true;', 'Setting true only opens; a toggle flips the value.', 1],
      ['boolean open', 'boolean open = 0;', 'A boolean can\'t be 0 in Java: it won\'t compile.', 1],
    ],
  },
  {
    key: 'timer-drive',
    task: 'Drive forward at 0.5 power for 2 seconds, then stop.',
    code: `ElapsedTime timer = new ElapsedTime();
waitForStart();
timer.reset();
while (opModeIsActive() && timer.seconds() < 2.0) {
    leftDrive.setPower(0.5);
    rightDrive.setPower(0.5);
}
leftDrive.setPower(0);
rightDrive.setPower(0);`,
    bugs: [
      ['timer.seconds()', 'while (opModeIsActive() && timer.milliseconds() < 2.0) {', 'milliseconds() < 2.0 is only 2 ms: the robot barely moves.', 1],
      ['rightDrive.setPower(0);', 'rightDrive.setPower(0.5);', 'The right side keeps driving after the loop, so the robot spins.', 1],
      ['timer.reset()', 'timer.seconds();', 'The timer has been running since init; without reset() the drive time is cut short.', 2],
    ],
  },
  {
    key: 'sleep-drive',
    task: 'Autonomous: drive forward for 1.5 seconds, stop, then wait half a second.',
    code: `leftDrive.setPower(0.6);
rightDrive.setPower(0.6);
sleep(1500);
leftDrive.setPower(0);
rightDrive.setPower(0);
sleep(500);`,
    bugs: [
      ['sleep(1500)', 'sleep(1.5);', 'sleep takes whole milliseconds (a long), so 1.5 doesn\'t compile; 1.5 s is 1500.', 1],
      ['leftDrive.setPower(0);', 'leftDrive.setPower(-0.6);', 'Stopping means power 0; -0.6 drives the left side backward.', 1],
      ['rightDrive.setPower(0.6)', 'rightDrive.setPower(6);', 'Power is from -1 to 1.', 1],
    ],
  },
  {
    key: 'opmode-class',
    task: 'A complete linear TeleOp that shows up in the TeleOp list as "Drive".',
    code: `@TeleOp(name = "Drive")
public class Drive extends LinearOpMode {
    @Override
    public void runOpMode() {
        waitForStart();
        while (opModeIsActive()) {
            telemetry.addData("Status", "Running");
            telemetry.update();
        }
    }
}`,
    bugs: [
      ['public class Drive', 'public class Drive extends OpMode {', 'runOpMode, waitForStart and opModeIsActive belong to LinearOpMode; with OpMode this doesn\'t compile.', 2],
      ['@TeleOp', '@Autonomous(name = "Drive")', 'The task wants it in the TeleOp list; @Autonomous puts it under Autonomous.', 1],
      ['public void runOpMode', 'public int runOpMode() {', 'runOpMode returns void; changing the return type breaks the override.', 2],
    ],
  },
  {
    key: 'iterative',
    task: 'Iterative OpMode: map the motor in init, drive it from the left stick in loop.',
    code: `@TeleOp(name = "Spin")
public class Spin extends OpMode {
    private DcMotor motor;
    @Override
    public void init() {
        motor = hardwareMap.get(DcMotor.class, "motor");
    }
    @Override
    public void loop() {
        motor.setPower(-gamepad1.left_stick_y);
    }
}`,
    bugs: [
      ['public void loop()', 'public void runOpMode() {', 'An iterative OpMode must implement loop(); runOpMode is for LinearOpMode, so this won\'t compile.', 2],
      ['motor = hardwareMap', 'DcMotor motor = hardwareMap.get(DcMotor.class, "motor");', 'This makes a new local variable; the field stays null and loop() crashes.', 3],
      ['motor.setPower(-gamepad1', 'motor.setPower(-gamepad1.left_stick_y)', 'Missing semicolon: it won\'t compile.', 1],
    ],
  },
  {
    key: 'direction',
    task: 'Set up a two-motor drive: the left motor is mounted mirrored, so it is reversed; both brake at zero power.',
    code: `leftDrive = hardwareMap.get(DcMotor.class, "left_drive");
rightDrive = hardwareMap.get(DcMotor.class, "right_drive");
leftDrive.setDirection(DcMotor.Direction.REVERSE);
rightDrive.setDirection(DcMotor.Direction.FORWARD);
leftDrive.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
rightDrive.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);`,
    bugs: [
      ['leftDrive.setDirection', 'leftDrive.setDirection(DcMotor.Direction.FORWARD);', 'With both FORWARD the mirrored left side spins backward and the robot spins in place.', 1],
      ['rightDrive.setZeroPowerBehavior', 'rightDrive.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.FLOAT);', 'The task wants both to brake; FLOAT lets the right side coast.', 1],
      ['rightDrive = hardwareMap', 'rightDrive = hardwareMap.get(DcMotor.class, "left_drive");', 'Both variables point at the same left motor, so the right motor never moves.', 1],
    ],
  },
  {
    key: 'telemetry',
    task: 'Show the arm position and target on the Driver Station every loop.',
    code: `while (opModeIsActive()) {
    int pos = arm.getCurrentPosition();
    telemetry.addData("Arm position", pos);
    telemetry.addData("Arm target", arm.getTargetPosition());
    telemetry.update();
}`,
    bugs: [
      ['int pos', 'double pos = arm.getCurrentPosition;', 'getCurrentPosition is a method and needs (); this won\'t compile.', 1],
      ['telemetry.update()', 'telemetry.clear();', 'Without update() nothing is ever sent to the Driver Station.', 2],
      ['"Arm target"', 'telemetry.addData("Arm target", arm.getTargetPosition);', 'getTargetPosition needs (): it won\'t compile.', 1],
    ],
  },
  {
    key: 'touch-digital',
    task: 'Lower the lift until the REV Touch Sensor (DigitalChannel; getState() is true when NOT pressed) is pressed.',
    code: `DigitalChannel touch = hardwareMap.get(DigitalChannel.class, "touch");
touch.setMode(DigitalChannel.Mode.INPUT);
waitForStart();
while (opModeIsActive() && touch.getState()) {
    lift.setPower(-0.4);
}
lift.setPower(0);`,
    bugs: [
      ['while (opModeIsActive() && touch', 'while (opModeIsActive() && !touch.getState()) {', 'getState() is true until pressed; with ! the loop never runs, so the lift never lowers.', 3],
      ['touch.setMode', 'touch.setMode(DigitalChannel.Mode.OUTPUT);', 'A sensor must be read as an INPUT.', 2],
      ['lift.setPower(-0.4)', 'lift.setPower(0.4);', 'Lowering needs negative power here; +0.4 raises the lift and it never reaches the sensor.', 1],
    ],
  },
  {
    key: 'touch-sensor',
    task: 'Stop the intake when the TouchSensor is pressed.',
    code: `TouchSensor stop = hardwareMap.get(TouchSensor.class, "stop");
waitForStart();
while (opModeIsActive()) {
    if (stop.isPressed()) {
        intake.setPower(0);
    } else {
        intake.setPower(1);
    }
}`,
    bugs: [
      ['if (stop.isPressed())', 'if (stop.isPressed) {', 'isPressed is a method: it needs ().', 1],
      ['intake.setPower(0)', 'intake.setPower(0.5);', 'When the sensor is pressed the intake should stop; 0.5 keeps it running.', 1],
      ['TouchSensor stop =', 'TouchSensor stop = hardwareMap.get(TouchSensor.class, stop);', 'The device name must be a String, "stop"; passing the variable itself won\'t compile.', 2],
    ],
  },
  {
    key: 'distance',
    task: 'Drive forward until the distance sensor reads less than 10 cm, then stop.',
    code: `DistanceSensor dist = hardwareMap.get(DistanceSensor.class, "dist");
waitForStart();
while (opModeIsActive() && dist.getDistance(DistanceUnit.CM) > 10) {
    leftDrive.setPower(0.3);
    rightDrive.setPower(0.3);
}
leftDrive.setPower(0);
rightDrive.setPower(0);`,
    bugs: [
      ['dist.getDistance', 'while (opModeIsActive() && dist.getDistance(DistanceUnit.CM) < 10) {', 'With < the loop only runs when already close, so the robot never drives.', 1],
      ['DistanceSensor dist =', 'DistanceSensor dist = hardwareMap.get(DistanceSensor.class, "dist")', 'Missing semicolon: it won\'t compile.', 1],
      ['rightDrive.setPower(0.3)', 'rightDrive.setPower(-0.3);', 'The right side drives backward, so the robot spins instead of driving forward.', 1],
    ],
  },
  {
    key: 'color',
    task: 'Read the color sensor and report "red" when there is more red than blue.',
    code: `ColorSensor color = hardwareMap.get(ColorSensor.class, "color");
waitForStart();
while (opModeIsActive()) {
    String seen = color.red() > color.blue() ? "red" : "blue";
    telemetry.addData("Seen", seen);
    telemetry.update();
}`,
    bugs: [
      ['String seen', 'String seen = color.red() > color.red() ? "red" : "blue";', 'It compares red with red, which is never greater, so it always says blue.', 1],
      ['ColorSensor color', 'ColorSensor color = hardwareMap.get(ColorSensor, "color");', 'get needs the class: ColorSensor.class. This won\'t compile.', 2],
      ['telemetry.addData("Seen"', 'telemetry.addData("Seen", "seen");', 'This prints the word "seen", not the variable.', 1],
    ],
  },
  {
    key: 'string-eq',
    task: 'Pick the AUTO path by the alliance chosen in init ("red" or "blue").',
    code: `String alliance = "red";
if (gamepad1.x) {
    alliance = "blue";
}
waitForStart();
if (alliance.equals("red")) {
    runRedPath();
} else {
    runBluePath();
}`,
    bugs: [
      ['if (alliance.equals', 'if (alliance == "red") {', 'Strings must be compared with .equals(); == compares object identity and can fail.', 2],
      ['alliance = "blue"', 'alliance == "blue";', 'That compares instead of assigning, and isn\'t a statement: it won\'t compile.', 2],
      ['String alliance', 'string alliance = "red";', 'Java is case sensitive: the type is String with a capital S.', 1],
    ],
  },
  {
    key: 'int-div',
    task: 'Run the intake at half power.',
    code: `double half = 1.0 / 2;
intake.setPower(half);
telemetry.addData("Intake power", half);
telemetry.update();`,
    bugs: [
      ['double half', 'double half = 1 / 2;', '1 / 2 is integer division and equals 0, so the intake doesn\'t run.', 2],
      ['intake.setPower', 'intake.setPower("half");', 'setPower takes a number, not a String: it won\'t compile.', 1],
      ['telemetry.update', 'telemetry.update()', 'Missing semicolon: it won\'t compile.', 1],
    ],
  },
  {
    key: 'motor-array',
    task: 'Set all four drive motors to brake, using an array.',
    code: `DcMotor[] drive = {frontLeft, frontRight, backLeft, backRight};
for (int i = 0; i < drive.length; i++) {
    drive[i].setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
    drive[i].setPower(0);
}`,
    bugs: [
      ['for (int i', 'for (int i = 0; i <= drive.length; i++) {', 'i reaches 4, past the last index (3): ArrayIndexOutOfBoundsException.', 2],
      ['drive[i].setZeroPowerBehavior', 'drive[0].setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);', 'Only the first motor is set, four times; the others keep their default.', 1],
      ['for (int i', 'for (int i = 1; i < drive.length; i++) {', 'Starting at 1 skips the front left motor.', 1],
    ],
  },
  {
    key: 'p-control',
    task: 'Hold the arm at a target with a simple P controller (kP = 0.01), power limited to -0.6..0.6.',
    code: `int target = 800;
while (opModeIsActive()) {
    int error = target - arm.getCurrentPosition();
    double power = 0.01 * error;
    power = Range.clip(power, -0.6, 0.6);
    arm.setPower(power);
}`,
    bugs: [
      ['int error', 'int error = arm.getCurrentPosition() - target;', 'Flipped error pushes the arm away from the target.', 2],
      ['power = Range.clip', 'power = Range.clip(power, 0.6, -0.6);', 'clip(value, min, max): min must come first; with them swapped the result is wrong.', 2],
      ['double power', 'double power = 0.01 * target;', 'Power must depend on the error, or the arm never settles.', 2],
    ],
  },
  {
    key: 'lift-limits',
    task: 'Driver controls the lift with the right stick, but it must not go above 3000 ticks or below 0.',
    code: `double power = -gamepad2.right_stick_y;
int pos = lift.getCurrentPosition();
if (pos >= 3000 && power > 0) {
    power = 0;
}
if (pos <= 0 && power < 0) {
    power = 0;
}
lift.setPower(power);`,
    bugs: [
      ['if (pos >= 3000', 'if (pos >= 3000 && power < 0) {', 'At the top it should block upward (positive) power; this blocks going down instead.', 2],
      ['if (pos <= 0', 'if (pos <= 0 || power < 0) {', 'With || the lift can never go down at all.', 2],
      ['double power', 'double power = gamepad2.right_stick_y;', 'Stick Y is negative when pushed up; without the minus the controls are upside down.', 1],
    ],
  },
  {
    key: 'field-centric',
    task: 'Field-centric mecanum: rotate the stick input by the robot heading (from the IMU) before driving.',
    code: `double botHeading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.RADIANS);
double rotX = x * Math.cos(-botHeading) - y * Math.sin(-botHeading);
double rotY = x * Math.sin(-botHeading) + y * Math.cos(-botHeading);
double denominator = Math.max(Math.abs(rotY) + Math.abs(rotX) + Math.abs(rx), 1);
frontLeft.setPower((rotY + rotX + rx) / denominator);
frontRight.setPower((rotY - rotX - rx) / denominator);`,
    bugs: [
      ['double botHeading', 'double botHeading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES);', 'Math.cos and Math.sin take radians; degrees give nonsense rotation.', 3],
      ['double rotY', 'double rotY = x * Math.sin(-botHeading) - y * Math.cos(-botHeading);', 'The rotation formula adds y * cos; subtracting flips forward and back.', 3],
      ['frontLeft.setPower', 'frontLeft.setPower((rotY + rotX + rx) * denominator);', 'Dividing by the denominator scales powers down; multiplying can push them past 1.', 2],
    ],
  },
  {
    key: 'velocity',
    task: 'Spin the flywheel at 1800 ticks per second using DcMotorEx velocity control.',
    code: `DcMotorEx flywheel = hardwareMap.get(DcMotorEx.class, "flywheel");
flywheel.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
waitForStart();
while (opModeIsActive()) {
    flywheel.setVelocity(1800);
    telemetry.addData("Velocity", flywheel.getVelocity());
    telemetry.update();
}`,
    bugs: [
      ['DcMotorEx flywheel', 'DcMotor flywheel = hardwareMap.get(DcMotor.class, "flywheel");', 'setVelocity and getVelocity are on DcMotorEx; a plain DcMotor doesn\'t have them, so it won\'t compile.', 2],
      ['flywheel.setMode', 'flywheel.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);', 'Left in STOP_AND_RESET_ENCODER the motor stays stopped; velocity control needs RUN_USING_ENCODER.', 3],
      ['flywheel.setVelocity', 'flywheel.setPower(1800);', 'setPower is -1 to 1; the velocity in ticks per second goes to setVelocity.', 2],
    ],
  },
  {
    key: 'reset-encoders',
    task: 'Zero the drive encoder at the start of AUTO, then run it with encoder speed control.',
    code: `leftDrive.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
leftDrive.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
waitForStart();
leftDrive.setPower(0.5);
sleep(1000);
leftDrive.setPower(0);
telemetry.addData("Ticks", leftDrive.getCurrentPosition());
telemetry.update();`,
    bugs: [
      ['RUN_USING_ENCODER', 'leftDrive.setMode(DcMotor.RunMode.RUN_TO_POSITION);', 'RUN_TO_POSITION needs a target position set first; switching to it without one throws an error.', 2],
      ['sleep(1000)', 'sleep(-1000);', 'A negative sleep doesn\'t wait at all, so the motor stops right away.', 1],
      ['leftDrive.setPower(0.5)', 'leftDrive.setPower(0.5)', 'Missing semicolon.', 1],
    ],
  },
  {
    key: 'wait-start',
    task: 'Init sets the claw closed; after start, drive forward. The robot must not move during init.',
    code: `claw.setPosition(0.2);
telemetry.addData("Status", "Ready");
telemetry.update();
waitForStart();
leftDrive.setPower(0.5);
rightDrive.setPower(0.5);`,
    bugs: [
      ['waitForStart()', 'sleep(1000);', 'Without waitForStart() the robot drives one second after INIT, before the MATCH starts.', 2],
      ['telemetry.addData', 'telemetry.addData(Status, "Ready");', 'Status isn\'t a variable; the caption must be a String: "Status". Won\'t compile.', 1],
      ['claw.setPosition', 'claw.setPosition(-0.2);', 'Servo positions are 0.0 to 1.0; -0.2 is out of range.', 1],
    ],
  },
  {
    key: 'gamepad-trigger',
    task: 'Run the intake at the right trigger\'s strength (0 to 1).',
    code: `while (opModeIsActive()) {
    double speed = gamepad1.right_trigger;
    intake.setPower(speed);
    telemetry.addData("Speed", speed);
    telemetry.update();
}`,
    bugs: [
      ['double speed', 'boolean speed = gamepad1.right_trigger;', 'right_trigger is a float from 0 to 1, not a boolean: it won\'t compile.', 1],
      ['intake.setPower', 'intake.setPower(-speed * 0);', 'Multiplying by 0 means the intake never runs.', 1],
      ['double speed', 'double speed = gamepad1.left_trigger;', 'The task uses the right trigger.', 1],
    ],
  },
  {
    key: 'dpad-servo',
    task: 'D-pad up raises the wrist servo 0.01 per loop and d-pad down lowers it, kept between 0 and 1.',
    code: `double wrist = 0.5;
while (opModeIsActive()) {
    if (gamepad2.dpad_up) wrist += 0.01;
    if (gamepad2.dpad_down) wrist -= 0.01;
    wrist = Range.clip(wrist, 0.0, 1.0);
    wristServo.setPosition(wrist);
}`,
    bugs: [
      ['if (gamepad2.dpad_down)', 'if (gamepad2.dpad_down) wrist += 0.01;', 'Down also adds, so the wrist can only go up.', 1],
      ['wrist = Range.clip', 'wrist = Range.clip(wrist, 0.0, 100.0);', 'Servo positions stop at 1.0; a 100 limit lets it pass the range.', 1],
      ['double wrist', 'int wrist = 0.5;', 'An int can\'t hold 0.5 (or small steps): it won\'t compile.', 1],
    ],
  },
  {
    key: 'slow-mode',
    task: 'Hold left bumper for slow mode: drive power is multiplied by 0.4.',
    code: `double scale = 1.0;
if (gamepad1.left_bumper) {
    scale = 0.4;
}
leftDrive.setPower(-gamepad1.left_stick_y * scale);
rightDrive.setPower(-gamepad1.right_stick_y * scale);`,
    bugs: [
      ['scale = 0.4', 'scale = 4;', 'Multiplying by 4 makes it faster (and past the power range), not slower.', 1],
      ['rightDrive.setPower', 'rightDrive.setPower(-gamepad1.right_stick_y);', 'The right side ignores slow mode, so the robot curves in slow mode.', 1],
      ['if (gamepad1.left_bumper)', 'if (gamepad1.left_bumper == 0.4) {', 'left_bumper is a boolean; comparing it to 0.4 won\'t compile.', 1],
    ],
  },
  {
    key: 'state-machine2',
    task: 'Auto state machine: DRIVE until 1000 ticks, then TURN to 90 degrees, then DONE.',
    code: `switch (state) {
    case DRIVE:
        if (leftDrive.getCurrentPosition() >= 1000) {
            state = State.TURN;
        }
        break;
    case TURN:
        if (Math.abs(getHeading() - 90) < 2) {
            state = State.DONE;
        }
        break;
}`,
    bugs: [
      ['state = State.TURN', 'state = State.DRIVE;', 'It stays in DRIVE forever and never turns.', 1],
      ['if (leftDrive.getCurrentPosition()', 'if (leftDrive.getCurrentPosition() <= 1000) {', 'It leaves DRIVE right away (position starts at 0, which is <= 1000).', 2],
      ['if (Math.abs', 'if (Math.abs(getHeading() - 90) > 2) {', 'It finishes the turn when it is far from 90, and never while it is close.', 2],
    ],
  },
  {
    key: 'battery',
    task: 'Show the battery voltage from the first voltage sensor.',
    code: `VoltageSensor battery = hardwareMap.voltageSensor.iterator().next();
waitForStart();
while (opModeIsActive()) {
    telemetry.addData("Battery", "%.2f V", battery.getVoltage());
    telemetry.update();
}`,
    bugs: [
      ['telemetry.addData("Battery"', 'telemetry.addData("Battery", "%d V", battery.getVoltage());', 'getVoltage() returns a double; %d is for whole numbers and throws a format error. Use %.2f.', 3],
      ['VoltageSensor battery', 'VoltageSensor battery = hardwareMap.voltageSensor.iterator();', 'iterator() returns an Iterator, not a VoltageSensor; it needs .next(). Won\'t compile.', 2],
      ['while (opModeIsActive())', 'while (!opModeIsActive()) {', 'After start opModeIsActive() is true, so this loop never runs.', 1],
    ],
  },
  {
    key: 'ticks-per-degree',
    task: 'Turn the arm to 45 degrees. goBILDA 117 RPM motor (1425.1 ticks per output turn), direct drive.',
    code: `final double TICKS_PER_REV = 1425.1;
final double TICKS_PER_DEGREE = TICKS_PER_REV / 360.0;
int target = (int) (45 * TICKS_PER_DEGREE);
arm.setTargetPosition(target);
arm.setMode(DcMotor.RunMode.RUN_TO_POSITION);
arm.setPower(0.4);`,
    bugs: [
      ['final double TICKS_PER_DEGREE', 'final double TICKS_PER_DEGREE = TICKS_PER_REV * 360.0;', 'Ticks per degree is ticks per turn divided by 360, not times.', 1],
      ['int target', 'int target = (int) 45 * TICKS_PER_DEGREE;', 'The cast only applies to 45, so the result is still a double and won\'t compile into an int.', 3],
      ['final double TICKS_PER_REV', 'final double TICKS_PER_REV = 537.7;', '537.7 is the 312 RPM motor; the 117 RPM motor has 1425.1 ticks per output turn.', 3],
    ],
  },
  {
    key: 'gear-ticks',
    task: 'Arm on a 312 RPM motor (537.7 ticks per turn) through a 3:1 sprocket reduction: ticks for one arm turn.',
    code: `final double MOTOR_TICKS = 537.7;
final double REDUCTION = 3.0;
final double ARM_TICKS_PER_REV = MOTOR_TICKS * REDUCTION;
int quarterTurn = (int) (ARM_TICKS_PER_REV / 4);
arm.setTargetPosition(quarterTurn);`,
    bugs: [
      ['final double ARM_TICKS_PER_REV', 'final double ARM_TICKS_PER_REV = MOTOR_TICKS / REDUCTION;', 'With a 3:1 reduction the motor turns 3 times per arm turn, so the ticks multiply by 3.', 2],
      ['int quarterTurn', 'int quarterTurn = (int) (ARM_TICKS_PER_REV * 4);', 'A quarter turn is the turn divided by 4.', 1],
      ['final double REDUCTION', 'final double REDUCTION = 1 / 3;', 'Integer division gives 0, and the reduction is 3, not one third.', 2],
    ],
  },
  {
    key: 'imu-reset',
    task: 'Press Y to reset the IMU heading to zero (for field-centric drive).',
    code: `if (gamepad1.y) {
    imu.resetYaw();
}
double heading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.RADIANS);
telemetry.addData("Heading (rad)", heading);`,
    bugs: [
      ['imu.resetYaw()', 'imu.resetYaw;', 'resetYaw is a method; without () it won\'t compile.', 1],
      ['if (gamepad1.y)', 'if (gamepad1.y == 1) {', 'gamepad1.y is a boolean; comparing to 1 won\'t compile.', 1],
      ['double heading', 'int heading = imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.RADIANS);', 'The yaw is a double; it won\'t fit in an int without a cast (and radians would round to 0-3).', 2],
    ],
  },
  {
    key: 'two-gamepads',
    task: 'Driver 1 drives with the left stick; driver 2 runs the arm with their left stick.',
    code: `double drive = -gamepad1.left_stick_y;
double armPower = -gamepad2.left_stick_y;
leftDrive.setPower(drive);
rightDrive.setPower(drive);
arm.setPower(armPower * 0.5);`,
    bugs: [
      ['double armPower', 'double armPower = -gamepad1.left_stick_y;', 'The arm should come from gamepad2; now driving also moves the arm.', 1],
      ['arm.setPower', 'arm.setPower(drive * 0.5);', 'The arm is driven by the drive value, not the arm stick.', 1],
      ['double drive', 'double drive = -gamepad2.left_stick_y;', 'Driver 1 drives; this hands driving to gamepad2.', 1],
    ],
  },
  {
    key: 'run-without',
    task: 'Run the intake motor by power only (no encoder plugged in).',
    code: `intake = hardwareMap.get(DcMotor.class, "intake");
intake.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
waitForStart();
while (opModeIsActive()) {
    intake.setPower(gamepad1.a ? 1.0 : 0.0);
}`,
    bugs: [
      ['intake.setMode', 'intake.setMode(DcMotor.RunMode.RUN_TO_POSITION);', 'RUN_TO_POSITION needs a target and an encoder; with no encoder the motor won\'t run properly.', 2],
      ['intake.setPower', 'intake.setPower(gamepad1.a ? 1.0 : 0.0)', 'Missing semicolon.', 1],
      ['intake = hardwareMap', 'intake = hardwareMap.get(Servo.class, "intake");', 'The intake is a DcMotor; a Servo can\'t be stored in it, so it won\'t compile.', 1],
    ],
  },
  {
    key: 'auto-path',
    task: 'AUTO: drive forward 1000 ticks with RUN_TO_POSITION, then raise the arm.',
    code: `leftDrive.setTargetPosition(1000);
rightDrive.setTargetPosition(1000);
leftDrive.setMode(DcMotor.RunMode.RUN_TO_POSITION);
rightDrive.setMode(DcMotor.RunMode.RUN_TO_POSITION);
leftDrive.setPower(0.5);
rightDrive.setPower(0.5);
while (opModeIsActive() && (leftDrive.isBusy() || rightDrive.isBusy())) {
    idle();
}
raiseArm();`,
    bugs: [
      ['rightDrive.setTargetPosition', 'rightDrive.setTargetPosition(-1000);', 'The right side drives backward to -1000, so the robot turns instead of driving straight.', 1],
      ['while (opModeIsActive() && (', 'while (opModeIsActive() && (leftDrive.isBusy() && !rightDrive.isBusy())) {', 'This waits only while the left is busy and the right is done; it usually quits at once.', 3],
      ['rightDrive.setMode', 'rightDrive.setMode(DcMotor.RunMode.RUN_USING_ENCODER);', 'The right motor ignores its target and runs forever.', 2],
    ],
  },
  {
    key: 'hold-servo-init',
    task: 'During init, close the claw so the robot fits in its STARTING CONFIGURATION, then wait for start.',
    code: `claw = hardwareMap.get(Servo.class, "claw");
claw.setPosition(0.2);
while (opModeInInit()) {
    telemetry.addData("Status", "Holding claw closed");
    telemetry.update();
}
driveForward();`,
    bugs: [
      ['while (opModeInInit())', 'while (opModeIsActive()) {', 'During init opModeIsActive() is false, so the loop is skipped and the robot drives at once without waiting for start.', 3],
      ['claw.setPosition', 'claw.setPosition(2);', 'Servo positions are 0 to 1.', 1],
      ['claw = hardwareMap', 'claw = hardwareMap.get(Servo.class, "Claw ");', 'The name has the wrong case and a trailing space, so it won\'t match "claw" in the configuration.', 2],
    ],
  },
  {
    key: 'deadzone',
    task: 'Ignore tiny stick drift: power is 0 when the stick is within 0.05 of center.',
    code: `double raw = -gamepad1.left_stick_y;
double power = raw;
if (Math.abs(raw) < 0.05) {
    power = 0;
}
leftDrive.setPower(power);`,
    bugs: [
      ['if (Math.abs(raw)', 'if (raw < 0.05) {', 'Without Math.abs every backward push counts as drift and the robot can\'t reverse.', 2],
      ['power = 0;', 'power = 0.05;', 'Inside the deadzone the motor should be off, not creeping at 0.05.', 1],
      ['leftDrive.setPower', 'leftDrive.setPower(raw);', 'It uses the raw value, so the deadzone does nothing.', 1],
    ],
  },
  {
    key: 'average-enc',
    task: 'Average the left and right drive encoders to track distance driven.',
    code: `int left = leftDrive.getCurrentPosition();
int right = rightDrive.getCurrentPosition();
double average = (left + right) / 2.0;
telemetry.addData("Average ticks", average);
telemetry.update();`,
    bugs: [
      ['double average', 'double average = left + right / 2.0;', 'Order of operations: only right is halved. It needs parentheses.', 2],
      ['int right', 'int right = leftDrive.getCurrentPosition();', 'Reads the left encoder twice.', 1],
      ['double average', 'int average = (left + right) / 2.0;', 'Dividing by 2.0 gives a double; it won\'t go into an int without a cast.', 2],
    ],
  },
  {
    key: 'shooter-ready',
    task: 'Only feed a ball into the launcher when the flywheel is within 50 ticks/s of 1800.',
    code: `double v = flywheel.getVelocity();
boolean ready = Math.abs(v - 1800) < 50;
if (ready && gamepad2.right_bumper) {
    feeder.setPower(1.0);
} else {
    feeder.setPower(0);
}`,
    bugs: [
      ['boolean ready', 'boolean ready = v - 1800 < 50;', 'Without Math.abs any slow speed counts as ready (e.g. 0 - 1800 < 50).', 2],
      ['if (ready &&', 'if (ready || gamepad2.right_bumper) {', 'With || the feeder runs whenever the flywheel is up to speed, without the driver asking.', 2],
      ['feeder.setPower(0)', 'feeder.setPower(-1.0);', 'When not feeding, the feeder should stop; -1.0 runs it backward.', 1],
    ],
  },
  {
    key: 'rumble',
    task: 'Rumble driver 1\'s gamepad once when 20 seconds are left (MATCH timer started at the start of TELEOP, 120 s long).',
    code: `boolean rumbled = false;
ElapsedTime matchTimer = new ElapsedTime();
while (opModeIsActive()) {
    if (!rumbled && matchTimer.seconds() > 100) {
        gamepad1.rumble(500);
        rumbled = true;
    }
}`,
    bugs: [
      ['if (!rumbled', 'if (!rumbled && matchTimer.seconds() > 20) {', '20 seconds LEFT in a 120 s TELEOP is 100 s in, not 20 s in.', 2],
      ['rumbled = true', 'rumbled = false;', 'The flag is never set, so it rumbles every loop after 100 s.', 1],
      ['gamepad1.rumble', 'gamepad1.rumble("500");', 'rumble takes a duration in milliseconds as a number, not a String.', 1],
    ],
  },
  {
    key: 'bulk-read',
    task: 'Turn on automatic bulk reads for every hub to speed up encoder reads.',
    code: `List<LynxModule> hubs = hardwareMap.getAll(LynxModule.class);
for (LynxModule hub : hubs) {
    hub.setBulkCachingMode(LynxModule.BulkCachingMode.AUTO);
}
waitForStart();`,
    bugs: [
      ['for (LynxModule hub', 'for (LynxModule hub : hubs.get(0)) {', 'get(0) is one hub, not a list; you can\'t loop over it. Won\'t compile.', 2],
      ['hub.setBulkCachingMode', 'hub.setBulkCachingMode(LynxModule.BulkCachingMode.OFF);', 'OFF turns bulk caching off, the opposite of the task.', 1],
      ['List<LynxModule> hubs', 'List<LynxModule> hubs = hardwareMap.get(LynxModule.class);', 'get needs a name and returns one device; getAll returns the list.', 2],
    ],
  },
  {
    key: 'servo-range',
    task: 'Move the pivot servo from fully down (0.0) to fully up (1.0) over 1 second in steps.',
    code: `for (int i = 0; i <= 10; i++) {
    pivot.setPosition(i / 10.0);
    sleep(100);
}
telemetry.addData("Pivot", pivot.getPosition());
telemetry.update();`,
    bugs: [
      ['pivot.setPosition', 'pivot.setPosition(i / 10);', 'i / 10 is integer division: 0 until i = 10, so the servo jumps instead of stepping.', 2],
      ['for (int i', 'for (int i = 0; i <= 10; i--) {', 'i-- counts down forever from 0; the loop never ends.', 1],
      ['sleep(100)', 'sleep(100000);', '100000 ms is 100 seconds per step, not 0.1 s.', 1],
    ],
  },
  {
    key: 'hw-names',
    task: 'Map the motors configured on the robot as "fl", "fr", "bl", "br".',
    code: `frontLeft = hardwareMap.get(DcMotor.class, "fl");
frontRight = hardwareMap.get(DcMotor.class, "fr");
backLeft = hardwareMap.get(DcMotor.class, "bl");
backRight = hardwareMap.get(DcMotor.class, "br");`,
    bugs: [
      ['backLeft =', 'backLeft = hardwareMap.get(DcMotor.class, "BL");', 'Names are case sensitive: "BL" doesn\'t match "bl" in the configuration.', 1],
      ['frontRight =', 'frontRight = hardwareMap.get(DcMotor.class, "fl");', 'Front right is mapped to the front left motor.', 1],
      ['backRight =', 'backRight = hardwareMap.get(DcMotor.class, br);', 'The name must be a String in quotes; br isn\'t a variable here.', 1],
    ],
  },
  {
    key: 'power-ramp',
    task: 'Ramp the drive power up from 0.1 to 0.8 in steps of 0.1, 50 ms apart.',
    code: `for (int step = 1; step <= 8; step++) {
    double power = step / 10.0;
    leftDrive.setPower(power);
    rightDrive.setPower(power);
    sleep(50);
}`,
    bugs: [
      ['double power', 'double power = step / 10;', 'step / 10 is integer division: 0 for every step, so the robot never moves.', 2],
      ['for (int step', 'for (int step = 1; step <= 8; step--) {', 'step-- counts down from 1 and never passes 8, so the loop never ends.', 1],
      ['leftDrive.setPower(power)', 'leftDrive.setPower(0.1);', 'The left side stays at 0.1 while the right ramps, so the robot turns.', 1],
    ],
  },
  {
    key: 'webcam',
    task: 'Build an AprilTag processor and a VisionPortal on the webcam named "Webcam 1".',
    code: `AprilTagProcessor tags = AprilTagProcessor.easyCreateWithDefaults();
VisionPortal portal = VisionPortal.easyCreateWithDefaults(
        hardwareMap.get(WebcamName.class, "Webcam 1"), tags);
waitForStart();
List<AprilTagDetection> seen = tags.getDetections();
telemetry.addData("Tags seen", seen.size());
telemetry.update();`,
    bugs: [
      ['hardwareMap.get(WebcamName.class', 'hardwareMap.get(WebcamName.class, "webcam 1"), tags);', 'The name must match the configuration exactly: "Webcam 1" with a capital W.', 1],
      ['telemetry.addData("Tags seen"', 'telemetry.addData("Tags seen", seen.length);', 'A List uses size(); .length is for arrays and won\'t compile.', 2],
      ['List<AprilTagDetection> seen', 'AprilTagDetection seen = tags.getDetections();', 'getDetections returns a list, not one detection: it won\'t compile.', 2],
    ],
  },
  {
    key: 'apriltag-id',
    task: 'Report whether AprilTag 34 is visible.',
    code: `boolean found = false;
for (AprilTagDetection d : tags.getDetections()) {
    if (d.id == 34) {
        found = true;
    }
}
telemetry.addData("Tag 34", found ? "visible" : "not visible");`,
    bugs: [
      ['if (d.id == 34)', 'if (d.id = 34) {', 'A single = assigns; an int isn\'t a boolean, so it won\'t compile.', 1],
      ['found = true', 'found = false;', 'found never becomes true.', 1],
      ['boolean found', 'boolean found = true;', 'Starting at true says "visible" even when no tag is seen.', 1],
    ],
  },
  {
    key: 'clip-servo-cmd',
    task: 'Map the left stick X (-1..1) to a turret servo position (0..1).',
    code: `double stick = gamepad2.left_stick_x;
double position = (stick + 1) / 2;
turret.setPosition(position);
telemetry.addData("Turret", position);`,
    bugs: [
      ['double position', 'double position = stick + 1 / 2;', 'Without parentheses this is stick + 0 (integer division), from -1 to 1, and goes out of range.', 2],
      ['double position', 'double position = (stick + 1) * 2;', 'Times 2 gives 0 to 4, past the servo range.', 1],
      ['turret.setPosition', 'turret.setPosition(stick);', 'The raw stick goes from -1 to 1; the servo needs 0 to 1.', 1],
    ],
  },
  {
    key: 'try-sleep',
    task: 'In an iterative OpMode, run the feeder only for 300 ms after the button is tapped, without blocking loop().',
    code: `if (gamepad2.a && feedTimer.milliseconds() > 300) {
    feedTimer.reset();
}
if (feedTimer.milliseconds() < 300) {
    feeder.setPower(1.0);
} else {
    feeder.setPower(0);
}`,
    bugs: [
      ['if (feedTimer.milliseconds() < 300)', 'if (feedTimer.milliseconds() > 300) {', 'The feeder runs whenever it has NOT been tapped recently: backwards.', 1],
      ['feedTimer.reset()', 'feedTimer.milliseconds();', 'Reading the time doesn\'t restart it; the tap never starts a new feed.', 2],
      ['feeder.setPower(0)', 'feeder.setPower(-1.0);', 'After 300 ms it should stop, not run backward.', 1],
    ],
  },
  {
    key: 'odometry',
    task: 'Dead wheel: a 2000-tick-per-turn encoder on a 48 mm wheel. Convert ticks to inches.',
    code: `final double TICKS_PER_REV = 2000;
final double WHEEL_DIAMETER_MM = 48;
final double MM_PER_TICK = (WHEEL_DIAMETER_MM * Math.PI) / TICKS_PER_REV;
double inches = podTicks * MM_PER_TICK / 25.4;
telemetry.addData("Inches", inches);`,
    bugs: [
      ['final double MM_PER_TICK', 'final double MM_PER_TICK = TICKS_PER_REV / (WHEEL_DIAMETER_MM * Math.PI);', 'That is ticks per mm, the inverse; multiplying by it gives a huge number.', 2],
      ['double inches', 'double inches = podTicks * MM_PER_TICK * 25.4;', 'mm to inches divides by 25.4.', 1],
      ['final double MM_PER_TICK', 'final double MM_PER_TICK = (WHEEL_DIAMETER_MM * 3) / TICKS_PER_REV;', 'Using 3 instead of pi is about 5% short over a whole field.', 2],
    ],
  },
  {
    key: 'current-alert',
    task: 'Warn on telemetry if the lift motor draws more than 6 amps (DcMotorEx).',
    code: `double amps = lift.getCurrent(CurrentUnit.AMPS);
if (amps > 6.0) {
    telemetry.addLine("Lift is straining!");
}
telemetry.addData("Lift amps", amps);
telemetry.update();`,
    bugs: [
      ['double amps', 'double amps = lift.getCurrent(CurrentUnit.MILLIAMPS);', 'In milliamps the number is 1000x bigger, so it warns almost all the time.', 2],
      ['if (amps > 6.0)', 'if (amps < 6.0) {', 'Warns when the current is normal and stays quiet when it is high.', 1],
      ['telemetry.addLine', 'telemetry.addLine(Lift is straining!);', 'Text must be in quotes; this won\'t compile.', 1],
    ],
  },
  {
    key: 'zero-power-float',
    task: 'Let the intake coast when stopped, but hold the arm in place when stopped.',
    code: `intake.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.FLOAT);
arm.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
intake.setPower(0);
arm.setPower(0);`,
    bugs: [
      ['arm.setZeroPowerBehavior', 'arm.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.FLOAT);', 'FLOAT lets the arm fall; BRAKE resists motion when power is 0.', 1],
      ['intake.setZeroPowerBehavior', 'intake.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.HOLD);', 'There is no HOLD behavior; the choices are BRAKE and FLOAT. Won\'t compile.', 2],
      ['arm.setPower(0)', 'arm.setPower(null);', 'setPower takes a double; null won\'t compile.', 1],
    ],
  },
  {
    key: 'selector',
    task: 'In init, press dpad left/right to pick the starting spot 1-3, shown on telemetry.',
    code: `int spot = 1;
while (opModeInInit()) {
    if (gamepad1.dpad_right && spot < 3) spot++;
    if (gamepad1.dpad_left && spot > 1) spot--;
    telemetry.addData("Start spot", spot);
    telemetry.update();
    sleep(150);
}`,
    bugs: [
      ['if (gamepad1.dpad_right', 'if (gamepad1.dpad_right && spot <= 3) spot++;', 'With <= it can go to 4, past the last spot.', 2],
      ['if (gamepad1.dpad_left', 'if (gamepad1.dpad_left && spot > 1) spot++;', 'Left also counts up.', 1],
      ['while (opModeInInit())', 'while (opModeIsActive()) {', 'opModeIsActive() is false during init, so the picker never shows before start.', 2],
    ],
  },
  {
    key: 'pid-integral2',
    task: 'PI control for the arm: kP = 0.01, kI = 0.0005, with the integral built up each loop.',
    code: `double integral = 0;
while (opModeIsActive()) {
    double error = target - arm.getCurrentPosition();
    integral += error;
    double power = 0.01 * error + 0.0005 * integral;
    arm.setPower(Range.clip(power, -1, 1));
}`,
    bugs: [
      ['integral += error', 'integral += 1;', 'The integral must add up the error, not count loops.', 2],
      ['double power', 'double power = 0.01 * error + 0.0005 * error;', 'The I term uses the error, not the integral, so this is just a P controller.', 2],
      ['arm.setPower', 'arm.setPower(Range.clip(power, -1, 0));', 'Clipping the top to 0 means the arm can only drive one way.', 2],
    ],
  },
];
