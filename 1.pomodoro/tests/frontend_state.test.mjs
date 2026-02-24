import assert from "assert";
import { createTimerStateMachine, TimerStatus } from "../static/timer_state.js";

const machine = createTimerStateMachine({ workSeconds: 1500, breakSeconds: 300 });

let state = machine.snapshot();
assert.strictEqual(state.status, TimerStatus.IDLE);
assert.strictEqual(state.remainingSeconds, 1500);

machine.start();
state = machine.snapshot();
assert.strictEqual(state.status, TimerStatus.RUNNING);

machine.pause();
state = machine.snapshot();
assert.strictEqual(state.status, TimerStatus.PAUSED);

machine.reset();
state = machine.snapshot();
assert.strictEqual(state.status, TimerStatus.IDLE);
assert.strictEqual(state.remainingSeconds, 1500);

machine.setMode("break");
state = machine.snapshot();
assert.strictEqual(state.mode, "break");
assert.strictEqual(state.remainingSeconds, 300);

machine.start();
machine.complete();
state = machine.snapshot();
assert.strictEqual(state.status, TimerStatus.COMPLETED);
assert.strictEqual(state.remainingSeconds, 0);

console.log("frontend_state.test.mjs passed");
