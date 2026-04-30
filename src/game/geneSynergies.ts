import { getFormula } from "./formulas";
import type { Formula, FormulaTag } from "./types";

export type ActiveGeneSynergy = {
  id: string;
  name: string;
  description: string;
  tags: FormulaTag[];
  growthMultiplier: number;
  extractionMultiplier: number;
  patternMultiplier: number;
  mutationMultiplier: number;
};

const SYNERGY_RULES: ActiveGeneSynergy[] = [
  {
    id: "branch-pair",
    name: "Branch Pair",
    description: "2 Branch genes: Root cultures grow faster.",
    tags: ["branch", "branch"],
    growthMultiplier: 0.15,
    extractionMultiplier: 0,
    patternMultiplier: 0,
    mutationMultiplier: 0,
  },
  {
    id: "symmetry-triad",
    name: "Symmetry Triad",
    description: "3 Symmetry genes: Crystal extraction surges.",
    tags: ["symmetry", "symmetry", "symmetry"],
    growthMultiplier: 0,
    extractionMultiplier: 0.4,
    patternMultiplier: 0,
    mutationMultiplier: 0,
  },
  {
    id: "storm-helix",
    name: "Storm Helix",
    description: "Spiral + mutation: chain arcs curve through cultures.",
    tags: ["spiral", "spiral"],
    growthMultiplier: 0.1,
    extractionMultiplier: 0.08,
    patternMultiplier: 0,
    mutationMultiplier: 0.08,
  },
  {
    id: "echo-recursion",
    name: "Echo Recursion",
    description: "Pattern + Recursive: repeated sub-cultures generate Genetic Patterns.",
    tags: ["pattern", "nested"],
    growthMultiplier: 0,
    extractionMultiplier: 0.08,
    patternMultiplier: 0.28,
    mutationMultiplier: 0,
  },
  {
    id: "stable-mutation",
    name: "Stable Mutation",
    description: "Collapse + Pattern: instability becomes more productive.",
    tags: ["collapse", "pattern"],
    growthMultiplier: 0,
    extractionMultiplier: 0.1,
    patternMultiplier: 0.1,
    mutationMultiplier: 0.15,
  },
  {
    id: "core-choir-synergy",
    name: "Core Choir",
    description: "Core + Nested: varied lab cultures resonate.",
    tags: ["core", "nested"],
    growthMultiplier: 0.06,
    extractionMultiplier: 0.12,
    patternMultiplier: 0,
    mutationMultiplier: 0,
  },
];

function activeFormulas(equippedFormulaIds: Array<string | null>): Formula[] {
  return equippedFormulaIds.map((id) => (id ? getFormula(id) : undefined)).filter((formula): formula is Formula => Boolean(formula));
}

export function getActiveGeneSynergies(equippedFormulaIds: Array<string | null>): ActiveGeneSynergy[] {
  const counts = activeFormulas(equippedFormulaIds).reduce<Record<string, number>>((record, formula) => {
    record[formula.tag] = (record[formula.tag] ?? 0) + 1;
    return record;
  }, {});

  return SYNERGY_RULES.filter((rule) => {
    const required = rule.tags.reduce<Record<string, number>>((record, tag) => {
      record[tag] = (record[tag] ?? 0) + 1;
      return record;
    }, {});
    return Object.entries(required).every(([tag, count]) => (counts[tag] ?? 0) >= count);
  });
}

export function getGeneSynergyBonuses(equippedFormulaIds: Array<string | null>) {
  return getActiveGeneSynergies(equippedFormulaIds).reduce(
    (bonus, synergy) => ({
      growthMultiplier: bonus.growthMultiplier + synergy.growthMultiplier,
      extractionMultiplier: bonus.extractionMultiplier + synergy.extractionMultiplier,
      patternMultiplier: bonus.patternMultiplier + synergy.patternMultiplier,
      mutationMultiplier: bonus.mutationMultiplier + synergy.mutationMultiplier,
    }),
    { growthMultiplier: 0, extractionMultiplier: 0, patternMultiplier: 0, mutationMultiplier: 0 },
  );
}
