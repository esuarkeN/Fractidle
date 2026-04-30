import type { GrowthMode } from "../game/fractalTypes";
import { formatNumber } from "../game/selectors";
import { getGrowthThreshold } from "../game/fractalSimulation";

type Props = {
  cost: number;
  essence: number;
  branches: number;
  growthCharge: number;
  growthBias: GrowthMode;
  onGrow: (mode: GrowthMode) => void;
};

export function GrowthActions({ cost, essence, branches, growthCharge, growthBias, onGrow }: Props) {
  const canGrow = essence >= cost;
  const growthProgress = Math.min(1, growthCharge / getGrowthThreshold(branches));

  return (
    <aside className="growth-actions">
      <div className="growth-heading">
        <span>Living Growth</span>
        <strong>{branches} Branches</strong>
      </div>
      <div className="growth-meter">
        <div style={{ width: `${growthProgress * 100}%` }} />
      </div>
      <p className="bias-readout">Current bias: {growthBias}</p>
      <button className="grow-primary" disabled={!canGrow} onClick={() => onGrow("branch")}>
        <span>Guide Growth</span>
        <strong>{formatNumber(cost)} Essence</strong>
      </button>
      <button className="grow-secondary" disabled={!canGrow} onClick={() => onGrow("pattern")}>
        <span>Pattern Bias</span>
        <strong>{formatNumber(cost)} Essence</strong>
      </button>
      <button className="grow-secondary" disabled={!canGrow} onClick={() => onGrow("stabilize")}>
        <span>Symmetry Bias</span>
        <strong>{formatNumber(cost)} Essence</strong>
      </button>
    </aside>
  );
}
