import { getFormula } from "./formulas";
import type { FormulaVisualTag } from "./types";

export type VisualInfluence = {
  branchPower: number;
  symmetryPower: number;
  spiralPower: number;
  patternPower: number;
  recursivePower: number;
  mutationPower: number;
  stabilityPower: number;
  activeTags: Set<FormulaVisualTag>;
};

export function getVisualInfluence(equippedFormulaIds: Array<string | null>): VisualInfluence {
  const tags = equippedFormulaIds
    .map((id) => (id ? getFormula(id) : undefined))
    .flatMap((formula) => formula?.visualTags ?? []);
  const activeTags = new Set(tags);

  return {
    branchPower: tags.filter((tag) => tag === "branch").length,
    symmetryPower: tags.filter((tag) => tag === "symmetry").length,
    spiralPower: tags.filter((tag) => tag === "spiral").length,
    patternPower: tags.filter((tag) => tag === "pattern").length,
    recursivePower: tags.filter((tag) => tag === "recursive").length,
    mutationPower: tags.filter((tag) => tag === "mutation").length,
    stabilityPower: tags.filter((tag) => tag === "stability").length,
    activeTags,
  };
}
