import * as Tooltip from "@radix-ui/react-tooltip";
import { clsx } from "clsx";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { CORE_LAYERS } from "../game/coreLayers";
import { getTotalEssencePerSecond } from "../game/coreSimulation";
import { getAxiomSpeedMultiplier, getEffectiveAxioms, getRuntimeProductionBonuses } from "../game/coreRuntime";
import type { CoreLayerId } from "../game/coreTypes";
import { formatNumber } from "../game/selectors";
import { getLayerUnlockRequirementText } from "../game/unlocks";
import type { GameStore } from "../store/gameStore";
import { ActionIcons, ChamberIcons } from "../ui/icons";

type Props = {
  state: GameStore;
  onSelect: (layerId: CoreLayerId) => void;
};

export function LayerTabs({ state, onSelect }: Props) {
  return (
    <nav className="layer-tabs">
      {CORE_LAYERS.map((layer) => {
        const unlocked = state.unlockedLayerIds.includes(layer.id);
        const instances = state.coreInstances.filter((instance) => CORE_DEFINITIONS[instance.definitionId].layerId === layer.id);
        const eps = getTotalEssencePerSecond(
          instances,
          state.coreUpgrades,
          state.equippedFormulaIds,
          getEffectiveAxioms(state),
          getAxiomSpeedMultiplier(state),
          getRuntimeProductionBonuses(state),
        );
        const Icon = ChamberIcons[layer.id];
        return (
          <Tooltip.Provider key={layer.id}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  disabled={!unlocked}
                  className={clsx("chamber-tab", state.selectedLayerId === layer.id && "active", !unlocked && "locked")}
                  onClick={() => onSelect(layer.id)}
                >
                  <span className="chamber-icon">{unlocked ? <Icon size={18} /> : <ActionIcons.locked size={18} />}</span>
                  <span className="chamber-copy">
                    <strong>{layer.name}</strong>
                  <small>{unlocked ? `${instances.length} | ${formatNumber(eps)}/s` : getLayerUnlockRequirementText(layer.id, state)}</small>
                  </span>
                  {state.selectedLayerId === layer.id && <em>OBS</em>}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="lab-tooltip" side="bottom">
                  {unlocked ? `${instances.length} specimens, ${formatNumber(eps)} Essence extraction/sec` : getLayerUnlockRequirementText(layer.id, state)}
                  <Tooltip.Arrow className="lab-tooltip-arrow" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      })}
    </nav>
  );
}
