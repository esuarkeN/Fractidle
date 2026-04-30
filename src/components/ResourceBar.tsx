import { getDerivedState, formatNumber } from "../game/selectors";
import type { GameStore } from "../store/gameStore";

type Props = {
  state: GameStore;
  onSave: () => void;
  onReset: () => void;
};

export function ResourceBar({ state, onSave, onReset }: Props) {
  const { production } = getDerivedState(state);

  return (
    <header className="resource-bar">
      <div className="brand">
        <span className="brand-mark" />
        <div>
          <h1>Recursive Bloom</h1>
          <p>Fractal biology lab console</p>
        </div>
      </div>
      <div className="resource-grid">
        <div className="resource-pill">
          <span>Essence</span>
          <strong>{formatNumber(state.resources.essence)}</strong>
        </div>
        <div className="resource-pill">
          <span>Extraction/sec</span>
          <strong>{formatNumber(production.essencePerSecond)}</strong>
        </div>
        <div className="resource-pill">
          <span>Genetic Patterns</span>
          <strong>{formatNumber(state.resources.patterns)}</strong>
        </div>
        <div className="resource-pill axiom">
          <span>Stable Mutations</span>
          <strong>{formatNumber(state.resources.axioms)}</strong>
        </div>
      </div>
      <div className="save-actions">
        <button className="ghost-button" onClick={onSave}>Save</button>
        <button className="danger-button" onClick={onReset}>Purge Records</button>
      </div>
    </header>
  );
}
