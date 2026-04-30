import * as Tooltip from "@radix-ui/react-tooltip";
import type { ComponentType } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import {
  getComplexityUpgradeCost,
  getCoreInstanceCost,
  getCoreOutputTierMultiplier,
  getOwnedCoreCount,
  getSpeedUpgradeCost,
  getYieldUpgradeCost,
} from "../game/coreBalancing";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { CORE_LAYERS, getCoreLayer } from "../game/coreLayers";
import { isCoreDefinitionAvailable } from "../game/coreSimulation";
import type { CoreDefinitionId } from "../game/coreTypes";
import { getResearchEffects } from "../game/research";
import { getStrainMasteryLevel } from "../game/strainMastery";
import { formatNumber } from "../game/selectors";
import { getCoreUnlockRequirementText } from "../game/unlocks";
import { getEssenceReachedThisRun, getPatternsReachedThisRun } from "../game/progression";
import type { GameStore } from "../store/gameStore";
import { ActionIcons, StrainIcons } from "../ui/icons";

type Props = {
  state: GameStore;
};

export function CoreShop({ state }: Props) {
  const selectedLayer = getCoreLayer(state.selectedLayerId) ?? CORE_LAYERS[0];
  const definitionIds = selectedLayer.coreDefinitionIds;
  const ownedInLayer = state.coreInstances.filter((instance) => CORE_DEFINITIONS[instance.definitionId].layerId === selectedLayer.id).length;
  const researchEffects = getResearchEffects(state.researchPurchasedIds);
  const essenceReached = getEssenceReachedThisRun(state);
  const patternsReached = getPatternsReachedThisRun(state);

  return (
    <aside className="growth-actions core-shop">
      <div className="growth-heading">
        <span>Culture Controls</span>
        <strong>{ownedInLayer} Specimens</strong>
      </div>
      <p className="bias-readout">{selectedLayer.mood}</p>
      <div className="core-list">
        {definitionIds.length === 0 && <p className="locked-hint">{selectedLayer.unlockHint}</p>}
        {definitionIds.map((definitionId) => {
          const definition = CORE_DEFINITIONS[definitionId];
          const owned = getOwnedCoreCount(state.coreInstances, definitionId);
          const buyCost = Math.floor(getCoreInstanceCost(state.coreInstances, definitionId) * (1 - Math.min(0.25, researchEffects.cloneCostReduction)));
          const upgrade = state.coreUpgrades.find((item) => item.definitionId === definitionId);
          const complexityCost = upgrade ? getComplexityUpgradeCost(upgrade, definitionId) : Infinity;
          const yieldCost = upgrade ? getYieldUpgradeCost(upgrade, definitionId) : Infinity;
          const speedCost = upgrade ? getSpeedUpgradeCost(upgrade, definitionId) : Infinity;
          const available = isCoreDefinitionAvailable(
            definitionId,
            essenceReached,
            patternsReached,
            state.coreInstances.length,
            state.unlockedLayerIds.length,
            state.resources.axioms,
          );
          const masteryLevel = getStrainMasteryLevel(state.strainMastery[definitionId]);
          const Icon = StrainIcons[definition.fractalType];

          return (
            <motion.article className={clsx("core-card culture-card", owned > 0 ? "unlocked" : "locked")} key={definitionId} whileHover={{ y: -2 }} whileTap={{ scale: 0.995 }}>
              <div className="core-card-main">
                <h3><Icon size={17} /> {definition.name}</h3>
                <span>
                  {owned} specimens | tier {definition.outputTier} | x{getCoreOutputTierMultiplier(definition.outputTier).toFixed(2)} base | mastery {masteryLevel}/5
                </span>
                <p title={definition.description}>{definition.description}</p>
                {!available && <small>{getCoreUnlockRequirementText(definitionId, state)}</small>}
              </div>
              <div className="core-card-actions">
                <ShopButton icon={owned > 0 ? ActionIcons.clone : ActionIcons.start} label={owned > 0 ? "Clone" : "Start"} cost={buyCost} disabled={!available || state.resources.essence < buyCost} tooltip={owned > 0 ? "Clone another specimen vat" : "Start this culture strain"} onClick={() => state.buyCoreInstance(definitionId)} />
                <ShopButton icon={ActionIcons.sequence} label="Genome" cost={complexityCost} disabled={owned <= 0 || state.resources.essence < complexityCost} tooltip="Increase Genome Complexity" onClick={() => state.increaseCoreComplexity(definitionId)} />
                <ShopButton icon={ActionIcons.extraction} label="Yield" cost={yieldCost} disabled={owned <= 0 || state.resources.essence < yieldCost} tooltip="Refine Essence extraction yield" onClick={() => state.upgradeCoreYield(definitionId)} />
                <ShopButton icon={ActionIcons.growth} label="Growth" cost={speedCost} disabled={owned <= 0 || state.resources.essence < speedCost} tooltip="Accelerate culture growth rate" onClick={() => state.upgradeCoreSpeed(definitionId)} />
              </div>
            </motion.article>
          );
        })}
      </div>
    </aside>
  );
}

function ShopButton({ icon: Icon, label, cost, disabled, tooltip, onClick }: { icon: ComponentType<{ size?: number }>; label: string; cost: number; disabled: boolean; tooltip: string; onClick: () => void }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className="upgrade-button" disabled={disabled} onClick={onClick}>
            <Icon size={15} />
            <span>{label}</span>
            <strong>{formatNumber(cost)}</strong>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="lab-tooltip">
            {tooltip}
            <Tooltip.Arrow className="lab-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function definitionLayerLabel(definitionId: CoreDefinitionId): string {
  return getCoreLayer(CORE_DEFINITIONS[definitionId].layerId)?.name ?? "Unknown";
}
