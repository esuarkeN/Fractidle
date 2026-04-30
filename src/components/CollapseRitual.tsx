import { lazy, Suspense, useState, type CSSProperties } from "react";
import { getAxiomUpgradeCost, getCollapseProgress } from "../game/balancing";
import { getDerivedState, formatNumber } from "../game/selectors";
import type { GameStore } from "../store/gameStore";
import { ResourceIcons, SystemIcons } from "../ui/icons";

const ControlledCollapseDialog = lazy(() => import("./ControlledCollapseDialog").then((module) => ({ default: module.ControlledCollapseDialog })));

type Props = {
  state: GameStore;
};

export function CollapseRitual({ state }: Props) {
  const { collapseReward, collapseRequirement } = getDerivedState(state);
  const progress = getCollapseProgress(state.currentRunLifetimeEssence, collapseRequirement);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const CollapseIcon = SystemIcons.collapse;
  const MutationIcon = ResourceIcons.mutations;
  const upgrades = [
    ["growth", "Growth Catalyst", "Global growth rate"] as const,
    ["form", "Structural Memory", "Extraction power"] as const,
    ["memory", "Genetic Recall", "Retain Genome Complexity"] as const,
    ["multiplicity", "Parallel Cultures", "Chamber starter cultures"] as const,
    ["recursion", "Recursive Tissue", "Recursive Cell Vault"] as const,
    ["chamberMemory", "Chamber Memory", "Retain chamber access"] as const,
    ["patternImprint", "Pattern Imprint", "Start with Genetic Patterns"] as const,
    ["containment", "Containment Protocol", "Improve instability events"] as const,
    ["genomeArchive", "Genome Archive", "Retain research protocols"] as const,
    ["deepCulture", "Deep Culture", "Cheaper Genome sequencing"] as const,
  ];

  return (
    <section className="collapse-ritual">
      <div>
        <span><CollapseIcon size={15} /> Controlled Collapse</span>
        <strong>{formatNumber(state.currentRunLifetimeEssence)} / {formatNumber(collapseRequirement)}</strong>
      </div>
      <p className="collapse-rule">Condenses this run into Stable Mutations. Most active cultures, upgrades, genes, research, and chamber access reset unless retained by Stable Mutation upgrades.</p>
      <div className="collapse-meter radix-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress * 100)}>
        <span className="radix-progress-fill" style={{ transform: `translateX(-${100 - progress * 100}%)` }} />
      </div>
      <div className="ritual-ring" style={{ "--progress": `${progress * 100}%` } as CSSProperties}>
        <span>{Math.floor(progress * 100)}%</span>
      </div>
      <button disabled={collapseReward <= 0} onClick={() => setConfirmOpen(true)}>
        <MutationIcon size={15} />
        Condense for {collapseReward} Stable Mutation{collapseReward === 1 ? "" : "s"}
      </button>
      {confirmOpen && (
        <Suspense fallback={null}>
          <ControlledCollapseDialog open={confirmOpen} reward={collapseReward} requirement={formatNumber(collapseRequirement)} onOpenChange={setConfirmOpen} onConfirm={state.collapse} />
        </Suspense>
      )}
      <div className="axiom-upgrades">
        {upgrades.map(([id, label, help]) => {
          const level = state.axiomUpgrades[id];
          const cost = getAxiomUpgradeCost(level);
          return (
            <button key={id} disabled={state.resources.axioms < cost} title={help} onClick={() => state.buyAxiomUpgrade(id)}>
              <MutationIcon size={13} />
              <span>{label}</span>
              <strong>{level} | {cost}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
