export const TimerStatus = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
};

export function createTimerStateMachine({ workSeconds, breakSeconds }) {
  const modes = {
    work: workSeconds,
    break: breakSeconds,
  };

  const state = {
    mode: "work",
    status: TimerStatus.IDLE,
    totalSeconds: modes.work,
    remainingSeconds: modes.work,
  };

  function setMode(mode) {
    if (!modes[mode]) {
      return state;
    }
    state.mode = mode;
    state.totalSeconds = modes[mode];
    state.remainingSeconds = state.totalSeconds;
    state.status = TimerStatus.IDLE;
    return state;
  }

  function start() {
    if (state.status === TimerStatus.COMPLETED) {
      state.remainingSeconds = state.totalSeconds;
    }
    if (state.status !== TimerStatus.RUNNING) {
      state.status = TimerStatus.RUNNING;
    }
    return state;
  }

  function pause() {
    if (state.status === TimerStatus.RUNNING) {
      state.status = TimerStatus.PAUSED;
    }
    return state;
  }

  function reset() {
    state.status = TimerStatus.IDLE;
    state.remainingSeconds = state.totalSeconds;
    return state;
  }

  function complete() {
    state.status = TimerStatus.COMPLETED;
    state.remainingSeconds = 0;
    return state;
  }

  function setRemaining(seconds) {
    const clamped = Math.max(0, Math.min(state.totalSeconds, seconds));
    state.remainingSeconds = clamped;
    return state;
  }

  function snapshot() {
    return { ...state };
  }

  return {
    setMode,
    start,
    pause,
    reset,
    complete,
    setRemaining,
    snapshot,
  };
}
