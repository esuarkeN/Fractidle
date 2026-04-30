import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { Activity, X } from "lucide-react";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { getStrainMasteryLevel } from "../game/strainMastery";
import { formatNumber } from "../game/selectors";
import type { GameStore } from "../store/gameStore";

type Props = {
  state: GameStore;
};

function masteryProgress(harvests: number): number {
  if (harvests >= 520) return 100;
  if (harvests >= 260) return 80;
  if (harvests >= 120) return 60;
  if (harvests >= 42) return 40;
  if (harvests >= 12) return 20;
  return Math.min(20, (harvests / 12) * 20);
}

export function StrainMasteryPanel({ state }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="lab-terminal-button secondary">
          <Activity size={16} />
          Strain Mastery
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="research-dialog mastery-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Strain Mastery</Dialog.Title>
              <Dialog.Description>Completed extractions permanently train each culture strain.</Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close strain mastery">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="mastery-list">
            {Object.values(CORE_DEFINITIONS).map((definition) => {
              const mastery = state.strainMastery[definition.id] ?? { harvests: 0, lifetimeEssence: 0, highestComplexity: 0, peakOwned: 0 };
              const level = getStrainMasteryLevel(mastery);
              const progress = masteryProgress(mastery.harvests);
              return (
                <article className="mastery-row" key={definition.id}>
                  <div>
                    <span>{definition.fractalType} strain</span>
                    <strong>{definition.name}</strong>
                  </div>
                  <div>
                    <span>Mastery {level}/5</span>
                    <Progress.Root className="radix-progress" value={progress}>
                      <Progress.Indicator className="radix-progress-fill" style={{ transform: `translateX(-${100 - progress}%)` }} />
                    </Progress.Root>
                  </div>
                  <small>{mastery.harvests} extractions | {formatNumber(mastery.lifetimeEssence)} Essence | peak {mastery.peakOwned}</small>
                </article>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
