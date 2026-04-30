import { getCollapseProgress } from "../game/balancing";
import { getDerivedState, formatNumber } from "../game/selectors";
import type { GameStore } from "../store/gameStore";

type Props = {
  state: GameStore;
};

export function CollapsePanel({ state }: Props) {
  const { collapseReward, collapseRequirement } = getDerivedState(state);
  const progress = getCollapseProgress(state.currentRunLifetimeEssence, collapseRequirement);

  return (
    <footer className="collapse-panel">
      <div className="collapse-copy">
        <span>Controlled Collapse Threshold</span>
        <strong>{formatNumber(state.currentRunLifetimeEssence)} / {formatNumber(collapseRequirement)} Run Essence</strong>
      </div>
      <div className="progress-track" aria-label="Collapse progress">
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      <button className="collapse-button" disabled={collapseReward <= 0} onClick={state.collapse}>
        Condense for {collapseReward} Stable Mutation{collapseReward === 1 ? "" : "s"}
      </button>
    </footer>
  );
}
