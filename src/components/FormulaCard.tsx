import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "motion/react";
import { clsx } from "clsx";
import type { Formula } from "../game/types";
import { formatNumber } from "../game/selectors";
import { ActionIcons, GeneIcons } from "../ui/icons";

type Props = {
  formula: Formula;
  unlocked: boolean;
  equipped: boolean;
  canUnlock: boolean;
  isNew: boolean;
  requirementText?: string;
  onUnlock: () => void;
  onEquip: () => void;
};

export function FormulaCard({ formula, unlocked, equipped, canUnlock, isNew, requirementText, onUnlock, onEquip }: Props) {
  const Icon = GeneIcons[formula.tag];
  return (
    <motion.article
      className={clsx("formula-relic gene-card", `tag-${formula.tag}`, unlocked ? "unlocked" : "locked", equipped && "equipped", isNew && "new-discovery")}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="relic-topline">
        <span className="gene-icon"><Icon size={16} /></span>
        <h3>{formula.name}</h3>
        <span>{formula.tag}</span>
      </div>
      {isNew && <b className="new-badge">NEW</b>}
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <p>{formula.shortEffect ?? formula.description}</p>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="lab-tooltip">
              {formula.description}
              <Tooltip.Arrow className="lab-tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <div className="gene-chips">
        {formula.effect.synergyTags?.map((tag) => <small key={tag}>{tag}</small>) ?? <small>{formula.tag}</small>}
      </div>
      {!unlocked && requirementText && <small className="locked-requirement">{requirementText}</small>}
      {unlocked ? (
        <button className="gene-action" disabled={equipped} onClick={onEquip}>
          {equipped ? <ActionIcons.unlock size={15} /> : <ActionIcons.splice size={15} />}
          {equipped ? "In Genome" : "Splice"}
        </button>
      ) : (
        <button className="gene-action" disabled={!canUnlock} onClick={onUnlock}>
          {canUnlock ? <ActionIcons.unlock size={15} /> : <ActionIcons.locked size={15} />}
          {formatNumber(formula.unlockCost)}
        </button>
      )}
    </motion.article>
  );
}
