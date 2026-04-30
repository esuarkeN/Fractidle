import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Microscope, X } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { RESEARCH_NODES, canPurchaseResearch } from "../game/research";
import { formatNumber } from "../game/selectors";
import type { GameStore } from "../store/gameStore";
import { ResourceIcons, iconForResearch } from "../ui/icons";

type Props = {
  state: GameStore;
};

function categoryLabel(category: string): string {
  return category.replace("-", " ").toUpperCase();
}

export function ResearchTerminal({ state }: Props) {
  const purchased = new Set(state.researchPurchasedIds);
  const progress = RESEARCH_NODES.length === 0 ? 0 : (state.researchPurchasedIds.length / RESEARCH_NODES.length) * 100;
  const [category, setCategory] = useState("all");
  const categories = ["all", "culture", "genes", "extraction", "chambers", "recursive", "mutation", "automation", "stable"];
  const PatternIcon = ResourceIcons.patterns;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="lab-terminal-button">
          <Microscope size={16} />
          Research Terminal
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="research-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Research Terminal</Dialog.Title>
              <Dialog.Description>Spend Genetic Patterns on permanent lab protocols.</Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close research terminal">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="research-progress">
            <span>{state.researchPurchasedIds.length}/{RESEARCH_NODES.length} protocols authorized</span>
            <Progress.Root className="radix-progress" value={progress}>
              <Progress.Indicator className="radix-progress-fill" style={{ transform: `translateX(-${100 - progress}%)` }} />
            </Progress.Root>
          </div>
          <Tabs.Root value={category} onValueChange={setCategory}>
            <Tabs.List className="gene-filter-tabs research-tabs" aria-label="Research category filters">
              {categories.map((item) => {
                const Icon = item === "all" ? Microscope : iconForResearch(item);
                return <Tabs.Trigger key={item} value={item}><Icon size={13} /> {item}</Tabs.Trigger>;
              })}
            </Tabs.List>
          </Tabs.Root>
          <div className="research-grid">
            {RESEARCH_NODES.filter((node) => category === "all" || node.category === category).map((node) => {
              const owned = purchased.has(node.id);
              const missingPrereqs = node.prerequisites?.filter((id) => !purchased.has(id)) ?? [];
              const prereqsMet = missingPrereqs.length === 0;
              const affordable = canPurchaseResearch(state, node.id);
              const NodeIcon = iconForResearch(node.category);
              return (
                <Tooltip.Provider key={node.id}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <motion.article
                        className={clsx("research-node", owned && "owned", !prereqsMet && "blocked")}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="research-node-top">
                          <NodeIcon size={16} />
                          <span>{categoryLabel(node.category)}</span>
                        </div>
                        <h3>{node.name}</h3>
                        <p>{node.description}</p>
                        {!owned && <small className="locked-requirement">{prereqsMet ? `${formatNumber(state.resources.patterns)} / ${formatNumber(node.cost)} Genetic Patterns` : `Requires: ${missingPrereqs.join(", ")}`}</small>}
                        <button disabled={owned || !affordable} onClick={() => state.purchaseResearch(node.id)}>
                          <PatternIcon size={14} />
                          {owned ? "Authorized" : `Authorize ${formatNumber(node.cost)}`}
                        </button>
                      </motion.article>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content className="lab-tooltip" side="top">
                        {prereqsMet ? `${formatNumber(state.resources.patterns)} / ${formatNumber(node.cost)} Genetic Patterns banked.` : `Requires: ${missingPrereqs.join(", ")}`}
                        <Tooltip.Arrow className="lab-tooltip-arrow" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
