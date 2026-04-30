import * as Tooltip from "@radix-ui/react-tooltip";
import { getFormula } from "../game/formulas";
import { ActionIcons, GeneIcons } from "../ui/icons";

type Props = {
  formulaId: string | null;
  index: number;
  onUnequip: (index: number) => void;
};

export function FormulaSlot({ formulaId, index, onUnequip }: Props) {
  const formula = formulaId ? getFormula(formulaId) : undefined;
  const Icon = formula ? GeneIcons[formula.tag] : ActionIcons.splice;

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className={`formula-slot glyph-slot active-genome-slot ${formula ? `tag-${formula.tag}` : ""}`} aria-label={formula ? `Remove ${formula.name}` : `Empty genome slot ${index + 1}`} onClick={() => formula && onUnequip(index)}>
            <span>Slot {String.fromCharCode(65 + index)}</span>
            <strong><Icon size={16} /> {formula?.name ?? "Empty Sequence"}</strong>
            <small>{formula ? formula.shortEffect ?? "Remove Sequence" : "Awaiting gene"}</small>
            {formula && <ActionIcons.remove className="slot-remove-icon" size={15} />}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="lab-tooltip">
            {formula ? `${formula.description} Click to remove sequence.` : "Unlock or splice a gene into this slot."}
            <Tooltip.Arrow className="lab-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
