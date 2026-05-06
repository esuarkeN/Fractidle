import { useGameStore } from "../store/gameStore";

const SIMULATION_STEP_SECONDS = 1 / 10;
const MAX_FRAME_DELTA_SECONDS = 0.25;
const MAX_TICK_DELTA_SECONDS = 0.35;
const AUTOSAVE_MS = 5000;

let started = false;
let hydrated = false;
let animationFrame = 0;
let autosaveInterval = 0;
let consumers = 0;

export function startGameEngine(): () => void {
  consumers += 1;
  if (started) return stopGameEngineConsumer;
  started = true;

  if (!hydrated) {
    useGameStore.getState().hydrate();
    hydrated = true;
  }

  let last = performance.now();
  let accumulator = 0;

  const loop = (now: number) => {
    if (!started) return;
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, (now - last) / 1000);
    last = now;
    accumulator += deltaSeconds;
    if (accumulator >= SIMULATION_STEP_SECONDS) {
      useGameStore.getState().tick(Math.min(MAX_TICK_DELTA_SECONDS, accumulator));
      accumulator = 0;
    }
    animationFrame = requestAnimationFrame(loop);
  };

  animationFrame = requestAnimationFrame(loop);
  autosaveInterval = window.setInterval(() => useGameStore.getState().save(), AUTOSAVE_MS);
  return stopGameEngineConsumer;
}

function stopGameEngineConsumer(): void {
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0 || !started) return;
  started = false;
  cancelAnimationFrame(animationFrame);
  window.clearInterval(autosaveInterval);
  animationFrame = 0;
  autosaveInterval = 0;
}
