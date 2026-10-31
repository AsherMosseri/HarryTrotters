// Fix the bug (G5), Blocks: FTC Blocks programs written out as text, one
// block per line, indented the way they nest. Same format as code-java.js:
// [find, broken line, why it is wrong, difficulty].

export const BLOCKS = [
  {
    key: 'b-tank',
    task: 'Tank drive: each stick drives its own side; pushing forward drives forward.',
    code: `to runOpMode
  set leftDrive.Direction to REVERSE
  call waitForStart
  repeat while call opModeIsActive
    set leftDrive.Power to ( - gamepad1.LeftStickY )
    set rightDrive.Power to ( - gamepad1.RightStickY )
    call telemetry.update`,
    bugs: [
      ['set rightDrive.Power', 'set rightDrive.Power to ( - gamepad1.LeftStickY )', 'The right side reads the left stick, so the right stick does nothing.', 1],
      ['set leftDrive.Power', 'set leftDrive.Power to ( gamepad1.LeftStickY )', 'Stick Y is negative when pushed forward; without the minus the left side drives backward.', 1],
      ['repeat while', 'repeat while not call opModeIsActive', 'After start opModeIsActive is true, so "not" skips the loop and nothing drives.', 2],
      ['set leftDrive.Direction', 'set leftDrive.Direction to FORWARD', 'The mirrored left motor needs REVERSE, or the robot spins when both sticks go forward.', 2],
    ],
  },
  {
    key: 'b-servo',
    task: 'A opens the claw (position 0.8), B closes it (position 0.2).',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    if gamepad1.A
      set claw.Position to 0.8
    else if gamepad1.B
      set claw.Position to 0.2`,
    bugs: [
      ['set claw.Position to 0.8', 'set claw.Position to 80', 'Servo positions are 0 to 1, not percent or degrees.', 1],
      ['else if gamepad1.B', 'else if gamepad1.A', 'This checks A again, so B never closes the claw.', 1],
      ['set claw.Position to 0.2', 'set claw.Power to 0.2', 'A standard servo uses Position; Power is for continuous rotation servos and motors.', 2],
    ],
  },
  {
    key: 'b-rtp',
    task: 'Move the arm to encoder position 1000 at half power and wait until it arrives.',
    code: `to runOpMode
  set arm.Mode to STOP_AND_RESET_ENCODER
  call waitForStart
  set arm.TargetPosition to 1000
  set arm.Mode to RUN_TO_POSITION
  set arm.Power to 0.5
  repeat while ( call opModeIsActive and call arm.isBusy )
    call telemetry.update`,
    bugs: [
      ['set arm.Power', 'set arm.Power to 0', 'In RUN_TO_POSITION the motor needs power to move; at 0 it sits still.', 2],
      ['set arm.Mode to RUN_TO_POSITION', 'set arm.Mode to RUN_WITHOUT_ENCODER', 'RUN_WITHOUT_ENCODER ignores the target and just runs at half power.', 2],
      ['repeat while', 'repeat while ( call opModeIsActive or call arm.isBusy )', 'With "or" the loop never ends while the OpMode runs, even after the arm arrives.', 2],
      ['set arm.TargetPosition', 'set arm.TargetPosition to 0', 'The target is 0, where the arm already is, so it doesn\'t move.', 1],
    ],
  },
  {
    key: 'b-timer2',
    task: 'Drive forward at 0.5 for 2 seconds, then stop both motors.',
    code: `to runOpMode
  call waitForStart
  call timer.reset
  repeat while ( call opModeIsActive and timer.Seconds < 2 )
    set leftDrive.Power to 0.5
    set rightDrive.Power to 0.5
  set leftDrive.Power to 0
  set rightDrive.Power to 0`,
    bugs: [
      ['repeat while', 'repeat while ( call opModeIsActive and timer.Milliseconds < 2 )', '2 milliseconds is almost no time; the robot barely moves.', 1],
      ['set rightDrive.Power to 0.5', 'set rightDrive.Power to -0.5', 'The right side drives backward, so the robot spins.', 1],
      ['call timer.reset', 'call telemetry.update', 'Without resetting, the timer has counted since init, so the drive is cut short.', 2],
    ],
  },
  {
    key: 'b-imu',
    task: 'Initialize the IMU (logo UP, USB FORWARD) and show the heading in degrees.',
    code: `to runOpMode
  call imu.initialize ( new IMU.Parameters ( new RevHubOrientationOnRobot ( LogoFacingDirection UP, UsbFacingDirection FORWARD ) ) )
  call waitForStart
  repeat while call opModeIsActive
    set heading to call YawPitchRollAngles.getYaw ( call imu.getRobotYawPitchRollAngles, AngleUnit DEGREES )
    call telemetry.addData ( "Heading", heading )
    call telemetry.update`,
    bugs: [
      ['set heading', 'set heading to call YawPitchRollAngles.getYaw ( call imu.getRobotYawPitchRollAngles, AngleUnit RADIANS )', 'The task wants degrees; radians show about 1.57 for a quarter turn.', 1],
      ['call imu.initialize', 'call imu.initialize ( new IMU.Parameters ( new RevHubOrientationOnRobot ( LogoFacingDirection UP, UsbFacingDirection UP ) ) )', 'The logo and USB port can\'t both face up; that orientation is impossible.', 3],
      ['call telemetry.addData', 'call telemetry.addData ( "Heading", "heading" )', 'This prints the word "heading" instead of the variable.', 1],
    ],
  },
  {
    key: 'b-touch',
    task: 'Run the intake until the touch sensor is pressed (TouchSensor IsPressed).',
    code: `to runOpMode
  call waitForStart
  repeat while ( call opModeIsActive and not touch.IsPressed )
    set intake.Power to 1
  set intake.Power to 0`,
    bugs: [
      ['repeat while', 'repeat while ( call opModeIsActive and touch.IsPressed )', 'Without "not" the intake only runs while the sensor IS pressed.', 1],
      ['set intake.Power to 0', 'set intake.Power to 1', 'After the sensor is pressed the intake should stop, not keep running.', 1],
      ['set intake.Power to 1', 'set intake.Power to 100', 'Power is -1 to 1.', 1],
    ],
  },
  {
    key: 'b-distance2',
    task: 'Drive forward until the distance sensor reads under 10 cm, then stop.',
    code: `to runOpMode
  call waitForStart
  repeat while ( call opModeIsActive and call dist.getDistance ( DistanceUnit CM ) > 10 )
    set leftDrive.Power to 0.3
    set rightDrive.Power to 0.3
  set leftDrive.Power to 0
  set rightDrive.Power to 0`,
    bugs: [
      ['repeat while', 'repeat while ( call opModeIsActive and call dist.getDistance ( DistanceUnit CM ) < 10 )', 'With < it only drives when already close, so it never moves.', 1],
      ['set leftDrive.Power to 0.3', 'set leftDrive.Power to -0.3', 'The left side drives backward, so the robot spins.', 1],
      ['repeat while', 'repeat while ( call opModeIsActive and call dist.getDistance ( DistanceUnit MM ) > 10 )', 'In millimeters it stops at 1 cm, not 10 cm, and likely hits the wall.', 2],
    ],
  },
  {
    key: 'b-toggle',
    task: 'Toggle the claw each time A is pressed (once per press).',
    code: `to runOpMode
  set lastA to false
  set open to false
  call waitForStart
  repeat while call opModeIsActive
    if ( gamepad1.A and not lastA )
      set open to not open
    set lastA to gamepad1.A
    if open
      set claw.Position to 0.8
    else
      set claw.Position to 0.2`,
    bugs: [
      ['if ( gamepad1.A', 'if ( gamepad1.A and lastA )', 'This fires every loop while A is held after the first; the edge check needs "not lastA".', 2],
      ['set lastA to gamepad1.A', 'set lastA to true', 'lastA must follow the button, or the toggle only works once.', 2],
      ['set open to not open', 'set open to true', 'That only opens; a toggle flips the value.', 1],
    ],
  },
  {
    key: 'b-mecanum',
    task: 'Mecanum: y forward, x strafe, rx turn (no scaling).',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    set y to ( - gamepad1.LeftStickY )
    set x to gamepad1.LeftStickX
    set rx to gamepad1.RightStickX
    set frontLeft.Power to ( y + x + rx )
    set backLeft.Power to ( y - x + rx )
    set frontRight.Power to ( y - x - rx )
    set backRight.Power to ( y + x - rx )`,
    bugs: [
      ['set frontRight.Power', 'set frontRight.Power to ( y + x - rx )', 'Front right uses y - x - rx; with + x the robot can\'t strafe straight.', 2],
      ['set rx to', 'set rx to gamepad1.RightStickY', 'Turning comes from the right stick X, not Y.', 1],
      ['set backLeft.Power', 'set backLeft.Power to ( y - x - rx )', 'The left side adds rx to turn; back left must be y - x + rx.', 2],
    ],
  },
  {
    key: 'b-slow',
    task: 'Hold the left bumper for slow mode (40% power).',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    set scale to 1
    if gamepad1.LeftBumper
      set scale to 0.4
    set leftDrive.Power to ( - gamepad1.LeftStickY * scale )
    set rightDrive.Power to ( - gamepad1.RightStickY * scale )`,
    bugs: [
      ['set scale to 0.4', 'set scale to 4', 'Times 4 is faster, not slower.', 1],
      ['set rightDrive.Power', 'set rightDrive.Power to ( - gamepad1.RightStickY )', 'The right side ignores slow mode, so the robot curves.', 1],
      ['if gamepad1.LeftBumper', 'if gamepad1.RightBumper', 'The task uses the left bumper.', 1],
    ],
  },
  {
    key: 'b-encoder',
    task: 'Drive forward 2000 ticks with RUN_TO_POSITION, then stop.',
    code: `to runOpMode
  set leftDrive.Mode to STOP_AND_RESET_ENCODER
  set rightDrive.Mode to STOP_AND_RESET_ENCODER
  call waitForStart
  set leftDrive.TargetPosition to 2000
  set rightDrive.TargetPosition to 2000
  set leftDrive.Mode to RUN_TO_POSITION
  set rightDrive.Mode to RUN_TO_POSITION
  set leftDrive.Power to 0.5
  set rightDrive.Power to 0.5`,
    bugs: [
      ['set rightDrive.TargetPosition', 'set rightDrive.TargetPosition to -2000', 'The right side drives backward, so the robot turns.', 1],
      ['set rightDrive.Mode to RUN_TO_POSITION', 'set rightDrive.Mode to RUN_USING_ENCODER', 'The right motor ignores the target and runs forever.', 2],
      ['set leftDrive.Power', 'set leftDrive.Power to 0', 'With no power the left motor never moves to its target.', 2],
    ],
  },
  {
    key: 'b-telemetry',
    task: 'Show the arm position on the Driver Station every loop.',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    call telemetry.addData ( "Arm", arm.CurrentPosition )
    call telemetry.update`,
    bugs: [
      ['call telemetry.update', 'call telemetry.clear', 'Without telemetry.update nothing is sent to the Driver Station.', 2],
      ['call telemetry.addData', 'call telemetry.addData ( "Arm", arm.TargetPosition )', 'This shows the target, not where the arm is.', 1],
      ['call waitForStart', 'call sleep ( 1000 )', 'Without waitForStart the loop starts during init, and opModeIsActive is false then, so it exits at once.', 2],
    ],
  },
  {
    key: 'b-crservo',
    task: 'Spin the intake (continuous rotation servo) in with the right bumper, out with the left bumper, else stop.',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    if gamepad1.RightBumper
      set intake.Power to 1
    else if gamepad1.LeftBumper
      set intake.Power to -1
    else
      set intake.Power to 0`,
    bugs: [
      ['set intake.Power to 0', 'set intake.Power to 0.5', 'With no bumper the intake should stop.', 1],
      ['set intake.Power to -1', 'set intake.Power to 0.5', 'Spinning out needs -1; 0.5 spins it in, just slower.', 1],
      ['set intake.Power to 1', 'set intake.Position to 1', 'A continuous rotation servo is driven with Power, not Position.', 2],
    ],
  },
  {
    key: 'b-lift',
    task: 'Lift on gamepad2 right stick Y, never above 3000 ticks.',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    set power to ( - gamepad2.RightStickY )
    if ( lift.CurrentPosition >= 3000 and power > 0 )
      set power to 0
    set lift.Power to power`,
    bugs: [
      ['if ( lift.CurrentPosition', 'if ( lift.CurrentPosition >= 3000 and power < 0 )', 'At the top it should block upward (positive) power, not downward.', 2],
      ['set power to (', 'set power to ( - gamepad1.RightStickY )', 'The lift is on gamepad2.', 1],
      ['set lift.Power', 'set lift.Power to ( - gamepad2.RightStickY )', 'It ignores the limit by reading the stick again instead of using power.', 2],
    ],
  },
  {
    key: 'b-sleep2',
    task: 'Autonomous: drive forward 1.5 seconds at 0.6, then stop both motors.',
    code: `to runOpMode
  call waitForStart
  set leftDrive.Power to 0.6
  set rightDrive.Power to 0.6
  call sleep ( 1500 )
  set leftDrive.Power to 0
  set rightDrive.Power to 0`,
    bugs: [
      ['call sleep', 'call sleep ( 1.5 )', 'sleep is in milliseconds; 1.5 ms is almost nothing.', 1],
      ['set rightDrive.Power to 0.6', 'set rightDrive.Power to 6', 'Power is -1 to 1.', 1],
      ['call waitForStart', 'call telemetry.update', 'Without waitForStart the robot drives as soon as INIT is pressed.', 2],
    ],
  },
  {
    key: 'b-color',
    task: 'Show "red" when the color sensor sees more red than blue, else "blue".',
    code: `to runOpMode
  call waitForStart
  repeat while call opModeIsActive
    if color.Red > color.Blue
      call telemetry.addData ( "Seen", "red" )
    else
      call telemetry.addData ( "Seen", "blue" )
    call telemetry.update`,
    bugs: [
      ['if color.Red', 'if color.Red > color.Red', 'Red is never greater than itself, so it always says blue.', 1],
      ['call telemetry.update', 'call telemetry.speak ( "update" )', 'Without telemetry.update nothing appears on the Driver Station.', 2],
    ],
  },
];
