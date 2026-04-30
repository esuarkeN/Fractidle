import { CORE_DEFINITIONS } from "./coreDefinitions";
import { CORE_LAYERS } from "./coreLayers";
import type { CoreDefinition, CoreLayerId } from "./coreTypes";
import { formulas, getFormula } from "./formulas";
import { RESEARCH_NODES } from "./research";
import { calculateCollapseRequirement, calculateStableMutationsGain } from "./simulation";
import type { Formula, GameStateSnapshot } from "./types";
import { formatNumber } from "./selectors";
import { getEssenceReachedThisRun, getPatternsReachedThisRun } from "./progression";

type RequirementLine = {
  label: string;
  current: number;
  target: number;
};

export type LabDirective = {
  title: string;
  description: string;
  progressCurrent: number;
  progressTarget: number;
  actionHint: string;
  tone: "growth" | "research" | "collapse" | "chamber";
};

export function getCoreRequirementLines(definition: CoreDefinition, state: GameStateSnapshot): RequirementLine[] {
  const requirement = definition.unlockRequirement;
  if (!requirement) return [];
  const essenceReached = getEssenceReachedThisRun(state);
  const patternsReached = getPatternsReachedThisRun(state);
  return [
    requirement.essence === undefined ? undefined : { label: "Run Essence reached", current: essenceReached, target: requirement.essence },
    requirement.patterns === undefined ? undefined : { label: "Genetic Patterns reached", current: patternsReached, target: requirement.patterns },
    requirement.ownedCores === undefined ? undefined : { label: "Specimens", current: state.coreInstances.length, target: requirement.ownedCores },
    requirement.axioms === undefined ? undefined : { label: "Stable Mutations", current: state.resources.axioms, target: requirement.axioms },
    requirement.unlockedLayers === undefined ? undefined : { label: "Chambers", current: state.unlockedLayerIds.length, target: requirement.unlockedLayers },
  ].filter((line): line is RequirementLine => Boolean(line));
}

export function getCoreUnlockRequirementText(definitionId: string, state: GameStateSnapshot): string {
  const definition = CORE_DEFINITIONS[definitionId as keyof typeof CORE_DEFINITIONS];
  if (!definition) return "Unknown strain.";
  const lines = getCoreRequirementLines(definition, state);
  if (!lines.length) return "Available from the start.";
  return `Requires ${lines.map((line) => `${formatNumber(line.current)} / ${formatNumber(line.target)} ${line.label}`).join(", ")}.`;
}

export function getLayerUnlockRequirementText(layerId: Exclude<CoreLayerId, "all">, state: GameStateSnapshot): string {
  const layer = CORE_LAYERS.find((item) => item.id === layerId);
  const firstDefinitionId = layer?.coreDefinitionIds[0];
  if (!firstDefinitionId) return layer?.unlockHint ?? "Dormant chamber.";
  return getCoreUnlockRequirementText(firstDefinitionId, state);
}

export function getFormulaRequirementText(formula: Formula, state: GameStateSnapshot): string {
  const requirements = formula.unlockRequires;
  const lines = [
    requirements?.nodes === undefined ? undefined : `${formatNumber(state.nodes)} / ${formatNumber(requirements.nodes)} Genome Complexity`,
    requirements?.essenceEarned === undefined ? undefined : `${formatNumber(state.totalEssenceEarned)} / ${formatNumber(requirements.essenceEarned)} lifetime Essence`,
    requirements?.patternsEarned === undefined ? undefined : `${formatNumber(state.totalPatternsEarned)} / ${formatNumber(requirements.patternsEarned)} Genetic Patterns earned`,
    requirements?.axioms === undefined ? undefined : `${formatNumber(state.resources.axioms)} / ${formatNumber(requirements.axioms)} Stable Mutations`,
  ].filter(Boolean);
  return lines.length ? `Requires ${lines.join(", ")}.` : "Available from the start.";
}

export function getNextDirective(state: GameStateSnapshot): LabDirective {
  const collapseRequirement = calculateCollapseRequirement(state);
  const collapseGain = calculateStableMutationsGain(state);
  if (collapseGain > 0) {
    return {
      title: "Controlled Collapse recommended",
      description: `Condense this run for ${collapseGain} Stable Mutation${collapseGain === 1 ? "" : "s"}.`,
      progressCurrent: state.currentRunLifetimeEssence,
      progressTarget: collapseRequirement,
      actionHint: "Open the collapse panel and authorize the procedure.",
      tone: "collapse",
    };
  }

  const lockedLayer = CORE_LAYERS.find((layer) => !state.unlockedLayerIds.includes(layer.id));
  if (lockedLayer?.coreDefinitionIds[0]) {
    const definition = CORE_DEFINITIONS[lockedLayer.coreDefinitionIds[0]];
    const lines = getCoreRequirementLines(definition, state);
    const blocker = lines.find((line) => line.current < line.target);
    if (blocker) {
      return {
        title: `Authorize ${lockedLayer.name}`,
        description: `${blocker.label}: ${formatNumber(blocker.current)} / ${formatNumber(blocker.target)}.`,
        progressCurrent: blocker.current,
        progressTarget: blocker.target,
        actionHint: blocker.label === "Specimens" ? "Clone more cultures in the current chamber." : "Extract and invest until the chamber unlocks.",
        tone: "chamber",
      };
    }
  }

  const affordableResearch = RESEARCH_NODES.find((node) => !state.researchPurchasedIds.includes(node.id) && state.resources.patterns < node.cost);
  if (affordableResearch) {
    return {
      title: `Research: ${affordableResearch.name}`,
      description: `Collect ${formatNumber(affordableResearch.cost)} Genetic Patterns.`,
      progressCurrent: state.resources.patterns,
      progressTarget: affordableResearch.cost,
      actionHint: "Run Memory, Mycelium, or Pattern genes to increase Pattern flow.",
      tone: "research",
    };
  }

  const nextGene = formulas.find((formula) => !state.unlockedFormulaIds.includes(formula.id) && getFormula(formula.id));
  if (nextGene) {
    return {
      title: `Discover gene: ${nextGene.name}`,
      description: getFormulaRequirementText(nextGene, state),
      progressCurrent: Math.min(state.resources.essence, nextGene.unlockCost),
      progressTarget: nextGene.unlockCost,
      actionHint: "Extract enough Essence, then unlock the gene sample.",
      tone: "growth",
    };
  }

  return {
    title: "Push deeper growth",
    description: `Controlled Collapse requires ${formatNumber(collapseRequirement)} run Essence.`,
    progressCurrent: state.currentRunLifetimeEssence,
    progressTarget: collapseRequirement,
    actionHint: "Sequence Genome, clone specimens, and splice synergies.",
    tone: "growth",
  };
}
