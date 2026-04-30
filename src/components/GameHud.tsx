import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getCoreLayer } from "../game/coreLayers";
import { getDerivedState, formatNumber } from "../game/selectors";
import { getNextDirective } from "../game/unlocks";
import type { GameStore } from "../store/gameStore";
import { ResourceIcons, SystemIcons } from "../ui/icons";

type Props = {
  state: GameStore;
  onSave: () => void;
  onReset: () => void;
};

export function GameHud({ state, onSave, onReset }: Props) {
  const { production } = getDerivedState(state);
  const chamber = getCoreLayer(state.selectedLayerId);
  const directive = getNextDirective(state);
  const directiveProgress = Math.min(1, directive.progressCurrent / Math.max(1, directive.progressTarget));
  const [pulse, setPulse] = useState(false);
  const lastHarvestPulse = useRef(state.feedback.harvestPulse);

  useEffect(() => {
    if (state.feedback.harvestPulse === lastHarvestPulse.current) return;
    lastHarvestPulse.current = state.feedback.harvestPulse;
    setPulse(true);
    const timeout = window.setTimeout(() => setPulse(false), 420);
    return () => window.clearTimeout(timeout);
  }, [state.feedback.harvestPulse]);

  return (
    <header className="game-hud">
      <div className="hud-title">
        <span className="hud-sigil" />
        <div>
          <h1>Recursive Bloom</h1>
          <span>Fractal Biology Console</span>
        </div>
      </div>
      <div className="hud-resources">
        <HudPill icon={ResourceIcons.essence} label="Essence" value={formatNumber(state.resources.essence)} pulse={pulse} />
        <HudPill icon={ResourceIcons.extraction} label="Extraction" value={`${formatNumber(production.essencePerSecond)}/s`} />
        <HudPill icon={ResourceIcons.patterns} label="Patterns" value={formatNumber(state.resources.patterns)} />
        <HudPill icon={ResourceIcons.mutations} label="Stable" value={formatNumber(state.resources.axioms)} />
        <HudPill icon={ResourceIcons.chamber} label="Chamber" value={chamber?.name ?? "All Chambers"} />
      </div>
      <div className={`lab-directive directive-${directive.tone}`}>
        <span>Lab Directive</span>
        <strong>{directive.title}</strong>
        <small>{directive.description}</small>
        <div className="directive-progress" aria-label="Directive progress">
          <i style={{ width: `${directiveProgress * 100}%` }} />
        </div>
      </div>
      <div className="hud-actions">
        <Tooltip.Provider>
          <LabManual />
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className="icon-button" aria-label="Save lab record" onClick={onSave}><SystemIcons.save size={17} /></button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className="lab-tooltip">Save lab record<Tooltip.Arrow className="lab-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className="icon-button danger" aria-label="Purge lab records" onClick={onReset}><SystemIcons.reset size={17} /></button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className="lab-tooltip">Purge records<Tooltip.Arrow className="lab-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    </header>
  );
}

function LabManual() {
  const HelpIcon = SystemIcons.help;
  const tabs = [
    ["basics", "Basics", "Cultures grow fractal organisms in cycles. When a specimen finishes growth, it extracts Essence and starts another cycle."],
    ["cultures", "Cultures", "Clone cultures to create more simultaneous extraction machines. More specimens improve output, but clone costs now scale with both strain count and total lab density."],
    ["complexity", "Genome Complexity", "Genome Complexity controls how large each fractal grows before extraction. Higher complexity improves harvest size but lengthens each cycle."],
    ["genes", "Genes", "Genes are spliced into the Active Genome. They modify growth, extraction, Pattern generation, visuals, and synergies."],
    ["chambers", "Chambers", "Chambers contain specialized strains. Locked chambers show their requirements on the chamber tab and strain cards."],
    ["research", "Research", "Research spends Genetic Patterns to unlock protocols, chambers, gene slots, and long-term lab improvements."],
    ["patterns", "Patterns", "Genetic Patterns come from memory, mycelium, recursive, and Pattern-focused systems. They unlock research and some genes."],
    ["collapse", "Collapse", "Controlled Collapse resets most active run progress and converts the run into Stable Mutations. Each collapse makes the next requirement much higher."],
    ["mutations", "Stable Mutations", "Stable Mutations persist. Spend them on upgrades that improve future runs or retain chambers, genes, research, Patterns, and starter cultures."],
    ["tips", "Scaling Tips", "Use multiple multiplier buckets: culture upgrades, genes, research, synergies, chamber bonuses, and Stable Mutations. Push until collapse reward is worth the reset."],
  ] as const;

  return (
    <Dialog.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Dialog.Trigger className="icon-button" aria-label="Open Lab Manual"><HelpIcon size={17} /></Dialog.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content className="lab-tooltip">Lab Manual<Tooltip.Arrow className="lab-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="research-dialog lab-manual">
          <Dialog.Title>Lab Manual</Dialog.Title>
          <Dialog.Description>Quick reference for Recursive Bloom systems.</Dialog.Description>
          <Tabs.Root defaultValue="basics" className="manual-tabs">
            <Tabs.List className="gene-filter-tabs manual-tab-list" aria-label="Lab manual topics">
              {tabs.map(([id, label]) => <Tabs.Trigger key={id} value={id}>{label}</Tabs.Trigger>)}
            </Tabs.List>
            {tabs.map(([id, label, copy]) => (
              <Tabs.Content key={id} value={id} className="manual-page">
                <h3>{label}</h3>
                <p>{copy}</p>
              </Tabs.Content>
            ))}
          </Tabs.Root>
          <Dialog.Close className="dialog-close">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HudPill({ icon: Icon, label, value, pulse = false }: { icon: ComponentType<{ size?: number }>; label: string; value: string; pulse?: boolean }) {
  return (
    <div className="hud-pill">
      <span className="hud-pill-icon"><Icon size={17} /></span>
      <span>{label}</span>
      <strong className={pulse ? "resource-pop" : ""}>{value}</strong>
    </div>
  );
}
