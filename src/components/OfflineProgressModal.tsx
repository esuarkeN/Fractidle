import { formatNumber } from "../game/selectors";
import type { OfflineGain } from "../game/types";

type Props = {
  gain: OfflineGain;
  onDismiss: () => void;
};

export function OfflineProgressModal({ gain, onDismiss }: Props) {
  const minutes = Math.max(1, Math.floor(gain.seconds / 60));

  return (
    <div className="modal-backdrop">
      <section className="offline-modal">
        <span className="modal-kicker">Incubation log resolved</span>
        <h2>{formatNumber(gain.essence)} Essence gained</h2>
        <p>Your cultures extracted Essence for {minutes} minute{minutes === 1 ? "" : "s"} while the lab was idle.</p>
        <button onClick={onDismiss}>Archive Log</button>
      </section>
    </div>
  );
}
