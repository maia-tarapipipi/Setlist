const DEFAULT_SECONDS = 90;
const TIMER_STEP_SECONDS = 15;
const MAX_SECONDS = 900;

export function createTimerController({ onUpdate, onComplete }) {
  const timer = {
    remaining: DEFAULT_SECONDS,
    total: DEFAULT_SECONDS,
    active: false,
    interval: null,
    endAt: 0,
  };

  function update() {
    onUpdate(timer);
  }

  function stop() {
    timer.active = false;
    if (timer.interval) clearInterval(timer.interval);
    timer.interval = null;
    update();
  }

  function start(seconds = timer.remaining || DEFAULT_SECONDS) {
    stop();
    timer.total = Math.max(0, seconds);
    timer.remaining = timer.total;
    if (!timer.remaining) {
      update();
      return;
    }

    timer.active = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.interval = setInterval(() => {
      timer.remaining = Math.max(
        0,
        Math.ceil((timer.endAt - Date.now()) / 1000),
      );
      if (timer.remaining <= 0) {
        stop();
        onComplete();
      }
      update();
    }, 250);
    update();
  }

  function set(seconds) {
    stop();
    timer.total = Math.max(0, seconds);
    timer.remaining = timer.total;
    update();
  }

  function toggle() {
    if (timer.active) {
      timer.remaining = Math.max(
        0,
        Math.ceil((timer.endAt - Date.now()) / 1000),
      );
      stop();
    } else {
      start();
    }
  }

  return {
    timer,
    start,
    stop,
    set,
    toggle,
    decrease: () => set(Math.max(0, timer.remaining - TIMER_STEP_SECONDS)),
    increase: () =>
      set(Math.min(MAX_SECONDS, timer.remaining + TIMER_STEP_SECONDS)),
  };
}
