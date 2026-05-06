import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CollapseRitual } from "./components/CollapseRitual";
import { ObservationChamber } from "./components/chambers/ObservationChamber";
import { CoreShop } from "./components/CoreShop";
import { FormulaPanel } from "./components/FormulaPanel";
import { FormulaSlot } from "./components/FormulaSlot";
import { FractalCanvas } from "./components/FractalCanvas";
import { GameHud } from "./components/GameHud";
import { LayerTabs } from "./components/LayerTabs";
import { OfflineProgressModal } from "./components/OfflineProgressModal";
import { CORE_DEFINITIONS } from "./game/coreDefinitions";
import { getCoreLayer } from "./game/coreLayers";
import { getTotalEssencePerSecond } from "./game/coreSimulation";
import { getAxiomSpeedMultiplier, getEffectiveAxioms, getRuntimeProductionBonuses } from "./game/coreRuntime";
import { getActiveGeneSynergies } from "./game/geneSynergies";
import { formatNumber } from "./game/selectors";
import { calculateCollapseRequirement } from "./game/simulation";
import { startGameEngine } from "./game/engine";
import { ResourceIcons, SystemIcons } from "./ui/icons";
import { useGameStore } from "./store/gameStore";
import { Toaster, toast } from "react-hot-toast";

const ResearchTerminal = lazy(() => import("./components/ResearchTerminal").then((module) => ({ default: module.ResearchTerminal })));
const StrainMasteryPanel = lazy(() => import("./components/StrainMasteryPanel").then((module) => ({ default: module.StrainMasteryPanel })));
const UI_REFRESH_MS = 250;

export default function App() {
  const [state, setState] = useState(() => useGameStore.getState());
  const [stagePulse, setStagePulse] = useState("");
  const [collapseReward, setCollapseReward] = useState(0);
  const [floatingEssence, setFloatingEssence] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [eventFeed, setEventFeed] = useState<string[]>(["Lab systems online."]);
  const lastNodePulse = useRef(state.feedback.nodePulse);
  const lastFormulaPulse = useRef(state.feedback.formulaPulse);
  const lastCollapsePulse = useRef(state.feedback.collapsePulse);
  const lastFloatAt = useRef(0);
  const lastLayerCount = useRef(state.unlockedLayerIds.length);
  const sawFirstHarvest = useRef(state.feedback.harvestPulse > 0);
  const shownMilestones = useRef(new Set<string>());
  const lastResearchCount = useRef(state.researchPurchasedIds.length);
  const lastMutationCount = useRef(state.mutationEvents.length);

  useEffect(() => {
    return startGameEngine();
  }, []);

  useEffect(() => {
    let timeout = 0;
    let lastUpdateAt = 0;
    const flush = () => {
      timeout = 0;
      lastUpdateAt = performance.now();
      setState(useGameStore.getState());
    };
    const unsubscribe = useGameStore.subscribe((next, previous) => {
      const now = performance.now();
      const importantChange =
        next.selectedLayerId !== previous.selectedLayerId ||
        next.feedback.harvestPulse !== previous.feedback.harvestPulse ||
        next.feedback.formulaPulse !== previous.feedback.formulaPulse ||
        next.feedback.collapsePulse !== previous.feedback.collapsePulse ||
        next.unlockedFormulaIds.length !== previous.unlockedFormulaIds.length ||
        next.researchPurchasedIds.length !== previous.researchPurchasedIds.length ||
        next.equippedFormulaIds.length !== previous.equippedFormulaIds.length ||
        next.offlineNotice !== previous.offlineNotice;

      if (importantChange || now - lastUpdateAt >= UI_REFRESH_MS) {
        if (timeout) {
          window.clearTimeout(timeout);
          timeout = 0;
        }
        flush();
        return;
      }

      if (!timeout) {
        timeout = window.setTimeout(flush, UI_REFRESH_MS - (now - lastUpdateAt));
      }
    });

    flush();
    return () => {
      unsubscribe();
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const now = performance.now();
    const firstCore = state.coreInstances[0];
    if (now - lastFloatAt.current > 3200 && firstCore) {
      lastFloatAt.current = now;
      setFloatingEssence(`+${formatNumber(Math.max(1, state.feedback.lastGrowthCount * 8))} Essence`);
      const timeout = window.setTimeout(() => setFloatingEssence(null), 1400);
      return () => window.clearTimeout(timeout);
    }
  }, [state.feedback.harvestPulse, state.coreInstances, state.feedback.lastGrowthCount]);

  useEffect(() => {
    let nextMilestone: string | null = null;
    if (!sawFirstHarvest.current && state.feedback.harvestPulse > 0) {
      sawFirstHarvest.current = true;
      nextMilestone = "Essence extraction complete.";
    } else if (state.unlockedLayerIds.length > lastLayerCount.current) {
      lastLayerCount.current = state.unlockedLayerIds.length;
      nextMilestone = "Containment chamber unlocked.";
    } else if (state.nodes >= 25) {
      nextMilestone = "Genome Complexity 25.";
    } else if (state.resources.axioms > 0) {
      nextMilestone = "Mutation stabilized.";
    }
    if (!nextMilestone || shownMilestones.current.has(nextMilestone)) return;
    shownMilestones.current.add(nextMilestone);
    setMilestone(nextMilestone);
    const timeout = window.setTimeout(() => setMilestone(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [state.feedback.harvestPulse, state.unlockedLayerIds.length, state.nodes, state.resources.axioms]);

  useEffect(() => {
    if (state.researchPurchasedIds.length > lastResearchCount.current) {
      lastResearchCount.current = state.researchPurchasedIds.length;
      toast.success("Genome sequence accepted.");
      setEventFeed((current) => ["Research complete.", ...current].slice(0, 5));
    }
    if (state.mutationEvents.length > lastMutationCount.current) {
      lastMutationCount.current = state.mutationEvents.length;
      const event = state.mutationEvents[state.mutationEvents.length - 1];
      if (event) toast(event.message, { icon: "!" });
      if (event) setEventFeed((current) => [event.message, ...current].slice(0, 5));
    }
  }, [state.researchPurchasedIds.length, state.mutationEvents]);

  useEffect(() => {
    if (state.feedback.nodePulse !== lastNodePulse.current) {
      lastNodePulse.current = state.feedback.nodePulse;
      setStagePulse("pulse-node");
    }
    if (state.feedback.formulaPulse !== lastFormulaPulse.current) {
      lastFormulaPulse.current = state.feedback.formulaPulse;
      setStagePulse("pulse-formula");
      setEventFeed((current) => ["Genome sequence accepted.", ...current].slice(0, 5));
    }
    if (state.feedback.collapsePulse !== lastCollapsePulse.current) {
      lastCollapsePulse.current = state.feedback.collapsePulse;
      setCollapseReward(state.feedback.lastCollapseReward);
      setStagePulse("pulse-collapse");
      setEventFeed((current) => ["Stable Mutation formed.", ...current].slice(0, 5));
    }

    if (!stagePulse) return;
    const timeout = window.setTimeout(() => setStagePulse(""), 720);
    return () => window.clearTimeout(timeout);
  }, [state.feedback.nodePulse, state.feedback.formulaPulse, state.feedback.collapsePulse, state.feedback.lastCollapseReward, stagePulse]);

  const resetSave = () => {
    if (window.confirm("Purge all Recursive Bloom lab records?")) {
      useGameStore.getState().reset();
    }
  };
  const activeChamber = getCoreLayer(state.selectedLayerId);
  const activeSynergies = getActiveGeneSynergies(state.equippedFormulaIds);
  const visibleSpecimens = state.coreInstances.filter((instance) => CORE_DEFINITIONS[instance.definitionId].layerId === state.selectedLayerId);
  const chamberExtraction = getTotalEssencePerSecond(
    visibleSpecimens,
    state.coreUpgrades,
    state.equippedFormulaIds,
    getEffectiveAxioms(state),
    getAxiomSpeedMultiplier(state),
    getRuntimeProductionBonuses(state),
  );
  const collapseReady = state.currentRunLifetimeEssence >= calculateCollapseRequirement(state);
  const chamberStatus = collapseReady ? "COLLAPSE READY" : state.mutationEvents.length > 0 ? "MUTATING" : visibleSpecimens.some((instance) => instance.currentState === "building") ? "GROWING" : "STABLE";

  return (
    <div className="app-shell">
      <Toaster position="top-center" toastOptions={{ className: "hot-toast" }} />
      <GameHud state={state} onSave={state.save} onReset={resetSave} />
      <main className="game-board">
        <aside className="left-rail">
          <LayerTabs state={state} onSelect={state.setSelectedLayer} />
          <FormulaPanel state={state} />
        </aside>
        <ObservationChamber
          className={stagePulse}
          title={activeChamber?.name ?? "All Chambers"}
          description={activeChamber?.description ?? "Full lab extraction overview."}
          specimenCount={visibleSpecimens.length}
          extractionPerSecond={formatNumber(chamberExtraction)}
          status={chamberStatus}
          overlays={(
            <>
              {milestone && <div className="milestone-toast">{milestone}</div>}
              {floatingEssence && <div className="floating-essence">{floatingEssence}</div>}
              {collapseReward > 0 && stagePulse === "pulse-collapse" && (
                <div className="collapse-burst">
                  <span>Controlled Collapse Complete</span>
                  <strong>+{collapseReward} Stable Mutation{collapseReward === 1 ? "" : "s"}</strong>
                </div>
              )}
            </>
          )}
        >
          <FractalCanvas />
        </ObservationChamber>
        <aside className="right-rail">
          <CoreShop state={state} />
          <section className="event-feed lab-panel">
            <header className="lab-panel-header">
              <span><ResourceIcons.instability size={15} /> Lab Feed</span>
            </header>
            {eventFeed.map((event, index) => <p key={`${event}-${index}`}>{event}</p>)}
          </section>
        </aside>
      </main>
      <section className="bottom-rune-bar">
        <div className="equipped-glyphs" aria-label="Active Genome">
          <div className="genome-heading">
            <span><SystemIcons.activeGenome size={15} /> Active Genome</span>
            <strong>{state.equippedFormulaIds.filter(Boolean).length}/{state.equippedFormulaIds.length} spliced</strong>
          </div>
          {state.equippedFormulaIds.map((formulaId, index) => (
            <FormulaSlot key={index} formulaId={formulaId} index={index} onUnequip={state.unequipFormula} />
          ))}
          <div className="synergy-readout">
            <span>Active Synergies</span>
            {activeSynergies.length ? activeSynergies.map((synergy) => <strong key={synergy.id}>{synergy.name}</strong>) : <strong>No gene set active</strong>}
          </div>
          <div className="terminal-actions">
            <Suspense fallback={<button className="lab-terminal-button">Loading terminal...</button>}>
              <ResearchTerminal state={state} />
              <StrainMasteryPanel state={state} />
            </Suspense>
          </div>
        </div>
        <CollapseRitual state={state} />
      </section>
      {state.offlineNotice && state.offlineNotice.seconds > 0 && (
        <OfflineProgressModal gain={state.offlineNotice} onDismiss={state.dismissOfflineNotice} />
      )}
    </div>
  );
}
