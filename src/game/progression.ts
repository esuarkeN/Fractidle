import type { GameStateSnapshot } from "./types";

type RunProgressState = Pick<GameStateSnapshot, "resources" | "currentRunLifetimeEssence">;

export function getEssenceReachedThisRun(state: RunProgressState): number {
  return Math.max(state.resources.essence, state.currentRunLifetimeEssence);
}

export function getPatternsReachedThisRun(state: Pick<GameStateSnapshot, "resources">): number {
  return state.resources.patterns;
}
