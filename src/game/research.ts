import type { GameStateSnapshot, ResearchEffect, ResearchNode } from "./types";
import type { CoreLayerId } from "./coreTypes";

export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: "basic-sequencing",
    name: "Basic Sequencing",
    description: "Authorizes gene library indexing and improves Genetic Pattern handling.",
    category: "genes",
    cost: 8,
    icon: "dna",
    effect: { patternMultiplier: 0.08 },
  },
  {
    id: "parallel-culturing",
    name: "Parallel Culturing",
    description: "Adds one Active Genome slot for broader organism builds.",
    category: "culture",
    cost: 22,
    prerequisites: ["basic-sequencing"],
    icon: "panel",
    effect: { extraGeneSlots: 1 },
  },
  {
    id: "growth-medium-1",
    name: "Growth Medium I",
    description: "Improved nutrient medium increases global Growth Rate.",
    category: "culture",
    cost: 18,
    icon: "flask",
    effect: { growthMultiplier: 0.1 },
  },
  {
    id: "growth-medium-2",
    name: "Growth Medium II",
    description: "Stabilized medium keeps dense cultures moving.",
    category: "culture",
    cost: 90,
    prerequisites: ["growth-medium-1"],
    icon: "flask",
    effect: { growthMultiplier: 0.16 },
  },
  {
    id: "extraction-refinement-1",
    name: "Extraction Refinement I",
    description: "Scanner-guided extraction raises global Essence yield.",
    category: "extraction",
    cost: 28,
    icon: "gauge",
    effect: { extractionMultiplier: 0.12 },
  },
  {
    id: "extraction-refinement-2",
    name: "Extraction Refinement II",
    description: "Cleaner extraction chambers reduce wasted Essence.",
    category: "extraction",
    cost: 120,
    prerequisites: ["extraction-refinement-1"],
    icon: "gauge",
    effect: { extractionMultiplier: 0.2 },
  },
  {
    id: "clone-stabilization",
    name: "Clone Stabilization",
    description: "Culture vats accept cloned specimens with less cost escalation.",
    category: "culture",
    cost: 55,
    prerequisites: ["growth-medium-1"],
    icon: "copy",
    effect: { cloneCostReduction: 0.08 },
  },
  {
    id: "pattern-archival",
    name: "Pattern Archival",
    description: "Genetic Patterns become a stronger long-term production substrate.",
    category: "genes",
    cost: 70,
    prerequisites: ["basic-sequencing"],
    icon: "archive",
    effect: { patternMultiplier: 0.18, extractionMultiplier: 0.06 },
  },
  {
    id: "chamber-expansion",
    name: "Chamber Expansion",
    description: "Authorizes advanced chamber routing and unlock previews.",
    category: "chambers",
    cost: 110,
    prerequisites: ["clone-stabilization"],
    icon: "door",
    effect: { unlockChamberIds: ["verdant-plane"] },
  },
  {
    id: "recursive-observation",
    name: "Recursive Observation",
    description: "Opens the procedures needed to study nested organisms.",
    category: "recursive",
    cost: 260,
    prerequisites: ["pattern-archival", "chamber-expansion"],
    icon: "microscope",
    effect: { unlockChamberIds: ["inner-worlds"], growthMultiplier: 0.08 },
  },
  {
    id: "mutation-containment",
    name: "Mutation Containment",
    description: "Instability becomes more profitable and less disruptive.",
    category: "mutation",
    cost: 180,
    prerequisites: ["extraction-refinement-1"],
    icon: "biohazard",
    effect: { instabilityBonus: 0.25, unlockChamberIds: ["entropy-rift"] },
  },
  {
    id: "offline-incubation",
    name: "Offline Incubation",
    description: "Extends unattended culture extraction logs.",
    category: "automation",
    cost: 140,
    prerequisites: ["basic-sequencing"],
    icon: "clock",
    effect: { offlineCapMultiplier: 0.5 },
  },
  {
    id: "automated-culturing",
    name: "Automated Culturing",
    description: "Lab automation improves baseline growth and clone handling.",
    category: "automation",
    cost: 320,
    prerequisites: ["offline-incubation", "clone-stabilization"],
    icon: "bot",
    effect: { growthMultiplier: 0.12, cloneCostReduction: 0.06 },
  },
  {
    id: "stable-mutation-theory",
    name: "Stable Mutation Theory",
    description: "Controlled Collapse condenses more Stable Mutations.",
    category: "stable",
    cost: 420,
    prerequisites: ["recursive-observation"],
    icon: "atom",
    effect: { collapseRewardMultiplier: 0.22 },
  },
  {
    id: "boundary-signal",
    name: "Boundary Signal",
    description: "A late theorem pointing toward Boundary Research.",
    category: "recursive",
    cost: 900,
    prerequisites: ["stable-mutation-theory"],
    icon: "orbit",
    effect: { unlockChamberIds: ["infinite-boundary"], extractionMultiplier: 0.18 },
  },
];

export function getResearchNode(id: string): ResearchNode | undefined {
  return RESEARCH_NODES.find((node) => node.id === id);
}

export function canPurchaseResearch(state: GameStateSnapshot, id: string): boolean {
  const node = getResearchNode(id);
  if (!node || state.researchPurchasedIds.includes(id)) return false;
  const prerequisitesMet = node.prerequisites?.every((required) => state.researchPurchasedIds.includes(required)) ?? true;
  return prerequisitesMet && state.resources.patterns >= node.cost;
}

export function getResearchEffects(purchasedIds: string[]): Required<Omit<ResearchEffect, "unlockChamberIds">> & { unlockChamberIds: CoreLayerId[]; extraGeneSlots: number } {
  const purchased = new Set(purchasedIds);
  return RESEARCH_NODES.reduce(
    (effects, node) => {
      if (!purchased.has(node.id)) return effects;
      effects.growthMultiplier += node.effect.growthMultiplier ?? 0;
      effects.extractionMultiplier += node.effect.extractionMultiplier ?? 0;
      effects.patternMultiplier += node.effect.patternMultiplier ?? 0;
      effects.cloneCostReduction += node.effect.cloneCostReduction ?? 0;
      effects.extraGeneSlots += node.effect.extraGeneSlots ?? 0;
      effects.offlineCapMultiplier += node.effect.offlineCapMultiplier ?? 0;
      effects.collapseRewardMultiplier += node.effect.collapseRewardMultiplier ?? 0;
      effects.instabilityBonus += node.effect.instabilityBonus ?? 0;
      effects.unlockChamberIds.push(...(node.effect.unlockChamberIds ?? []));
      return effects;
    },
    {
      growthMultiplier: 0,
      extractionMultiplier: 0,
      patternMultiplier: 0,
      cloneCostReduction: 0,
      extraGeneSlots: 0,
      offlineCapMultiplier: 0,
      collapseRewardMultiplier: 0,
      instabilityBonus: 0,
      unlockChamberIds: [] as CoreLayerId[],
    },
  );
}
