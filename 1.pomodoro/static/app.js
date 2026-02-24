import { createTimerStateMachine, TimerStatus } from "./timer_state.js";

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const RING_LENGTH = 540;

const stateMachine = createTimerStateMachine({
  workSeconds: WORK_SECONDS,
  breakSeconds: BREAK_SECONDS,
});

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const timeText = document.getElementById("timeText");
const statusText = document.getElementById("statusText");
const modeText = document.getElementById("modeText");
const notifyText = document.getElementById("notifyText");
const sessionsCount = document.getElementById("sessionsCount");
const focusMinutes = document.getElementById("focusMinutes");
const ringProgress = document.querySelector(".ring-progress");
const modeButtons = document.querySelectorAll(".chip");

let timerId = null;
let endTimestamp = null;
let sessionStart = null;
let audioContext = null;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function updateRing(remainingSeconds, totalSeconds) {
  const progress = remainingSeconds / totalSeconds;
  const offset = RING_LENGTH * (1 - progress);
  ringProgress.style.strokeDashoffset = `${offset}`;
}

function updateUI() {
  const snapshot = stateMachine.snapshot();
  timeText.textContent = formatTime(snapshot.remainingSeconds);
  statusText.textContent = snapshot.status;
  modeText.textContent = snapshot.mode === "work" ? "Work mode" : "Break mode";
  updateRing(snapshot.remainingSeconds, snapshot.totalSeconds);
  pauseBtn.disabled = snapshot.status !== TimerStatus.RUNNING;
  startBtn.disabled = snapshot.status === TimerStatus.RUNNING;
  startBtn.textContent =
    snapshot.status === TimerStatus.PAUSED ? "Resume" : "Start";
}

function syncModeButtons(mode) {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function requestNotifications() {
  if (!("Notification" in window)) {
    notifyText.textContent = "Notifications not supported";
    return;
  }
  if (Notification.permission === "granted") {
    notifyText.textContent = "Notifications on";
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      notifyText.textContent =
        permission === "granted" ? "Notifications on" : "Notifications off";
    });
  }
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playBeep() {
  if (!audioContext) {
    return;
  }
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 640;
  gainNode.gain.value = 0.001;
  gainNode.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.35);
}

function startTimer() {
  const previous = stateMachine.snapshot();
  const snapshot = stateMachine.start();
  const now = Date.now();
  if (
    !sessionStart ||
    previous.status === TimerStatus.COMPLETED ||
    previous.status === TimerStatus.IDLE
  ) {
    sessionStart = new Date(now);
  }
  endTimestamp = now + snapshot.remainingSeconds * 1000;
  clearInterval(timerId);
  timerId = setInterval(tick, 250);
  updateUI();
}

function pauseTimer() {
  const snapshot = stateMachine.pause();
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (endTimestamp) {
    const remainingSeconds = Math.max(
      0,
      Math.round((endTimestamp - Date.now()) / 1000)
    );
    stateMachine.setRemaining(remainingSeconds);
  }
  updateUI();
}

function resetTimer() {
  stateMachine.reset();
  sessionStart = null;
  endTimestamp = null;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  updateUI();
}

function completeTimer() {
  stateMachine.complete();
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  updateUI();
  notifyCompletion();
  saveSession().then(() => fetchStats());
}

function tick() {
  const remainingSeconds = Math.max(
    0,
    Math.round((endTimestamp - Date.now()) / 1000)
  );
  stateMachine.setRemaining(remainingSeconds);
  updateUI();
  if (remainingSeconds <= 0) {
    completeTimer();
  }
}

function notifyCompletion() {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Pomodoro complete", {
      body: "Nice work. Take a short break.",
    });
  }
  playBeep();
}

function saveSession() {
  const snapshot = stateMachine.snapshot();
  if (!sessionStart) {
    return Promise.resolve();
  }
  const endTime = new Date();
  const payload = {
    start_time: sessionStart.toISOString(),
    end_time: endTime.toISOString(),
    duration_sec: snapshot.totalSeconds,
    type: snapshot.mode,
  };
  sessionStart = null;
  return fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function fetchStats() {
  const today = new Date();
  const dateString = today.toISOString().slice(0, 10);
  fetch(`/api/stats?date=${dateString}`)
    .then((response) => response.json())
    .then((data) => {
      sessionsCount.textContent = data.completed_sessions ?? 0;
      focusMinutes.textContent = data.focus_minutes ?? 0;
    })
    .catch(() => {});
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    stateMachine.setMode(mode);
    syncModeButtons(mode);
    resetTimer();
    updateUI();
  });
});

startBtn.addEventListener("click", () => {
  ensureAudioContext();
  requestNotifications();
  startTimer();
});

pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);

updateUI();
fetchStats();
