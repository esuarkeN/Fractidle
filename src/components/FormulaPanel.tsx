import { useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { FormulaCard } from "./FormulaCard";
import { formulas } from "../game/formulas";
import { canUnlockFormula, isFormulaVisible } from "../game/selectors";
import { getFormulaRequirementText } from "../game/unlocks";
import type { GameStore } from "../store/gameStore";
import { GeneIcons, SystemIcons } from "../ui/icons";

type Props = {
  state: GameStore;
};

export function FormulaPanel({ state }: Props) {
  const visibleFormulas = useMemo(
    () => formulas.filter((formula) => isFormulaVisible(state, formula.id)),
    [state.nodes, state.totalEssenceEarned, state.totalPatternsEarned, state.resources.axioms],
  );
  const [newFormulaIds, setNewFormulaIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const seenIdsRef = useRef(new Set(visibleFormulas.map((formula) => formula.id)));

  useEffect(() => {
    const nextIds = visibleFormulas.map((formula) => formula.id);
    const discovered = nextIds.filter((id) => !seenIdsRef.current.has(id));
    if (discovered.length > 0) {
      for (const id of discovered) seenIdsRef.current.add(id);
      setNewFormulaIds((current) => [...new Set([...current, ...discovered])]);
      const formula = formulas.find((item) => item.id === discovered[0]);
      setNotice(formula ? `New gene discovered: ${formula.name}` : "New gene discovered");
      const timeout = window.setTimeout(() => setNotice(null), 2600);
      return () => window.clearTimeout(timeout);
    }
  }, [visibleFormulas]);

  return (
    <aside className="formula-deck">
      <div className="deck-heading">
        <span><SystemIcons.geneLibrary size={15} /> Gene Library</span>
        <strong>{state.unlockedFormulaIds.length}/{formulas.length}</strong>
      </div>
      {notice && <div className="discovery-toast">{notice}</div>}
      <Tabs.Root value={activeFilter} onValueChange={setActiveFilter}>
        <Tabs.List className="gene-filter-tabs" aria-label="Gene category filters">
          {["all", "cell", "branch", "spiral", "symmetry", "pattern", "nested", "collapse"].map((tag) => {
            const Icon = tag === "all" ? SystemIcons.geneLibrary : GeneIcons[tag as keyof typeof GeneIcons];
            return <Tabs.Trigger key={tag} value={tag}><Icon size={13} /> {tag}</Tabs.Trigger>;
          })}
        </Tabs.List>
      </Tabs.Root>
      <div className="formula-scroll">
        {visibleFormulas.filter((formula) => activeFilter === "all" || formula.tag === activeFilter).map((formula) => {
          const unlocked = state.unlockedFormulaIds.includes(formula.id);
          const equipped = state.equippedFormulaIds.includes(formula.id);
          return (
            <FormulaCard
              key={formula.id}
              formula={formula}
              unlocked={unlocked}
              equipped={equipped}
              canUnlock={canUnlockFormula(state, formula.id)}
              isNew={newFormulaIds.includes(formula.id) && !equipped}
              requirementText={getFormulaRequirementText(formula, state)}
              onUnlock={() => state.unlockFormula(formula.id)}
              onEquip={() => {
                state.equipFormula(formula.id);
                setNewFormulaIds((current) => current.filter((id) => id !== formula.id));
              }}
            />
          );
        })}
      </div>
    </aside>
  );
}
