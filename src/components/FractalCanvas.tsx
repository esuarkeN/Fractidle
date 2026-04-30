import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { getCoreLayer } from "../game/coreLayers";
import type { CoreInstance, CoreLayerId, CoreTypeUpgrade } from "../game/coreTypes";
import { generateInstanceFractal, type GeneratedFractal, type RenderBranch } from "../game/fractalGenerators";
import { SAVE_KEY } from "../game/save";

type Props = {
  instances: CoreInstance[];
  upgrades: CoreTypeUpgrade[];
  selectedLayerId: CoreLayerId;
  equippedFormulaIds: Array<string | null>;
  harvestPulse: number;
  formulaPulse: number;
  collapsePulse: number;
};

type Anchor = {
  x: number;
  y: number;
  radius: number;
};

type RenderProps = Pick<Props, "instances" | "upgrades" | "selectedLayerId" | "equippedFormulaIds">;

type Particle = {
  start: number;
  x: number;
  y: number;
  color: number;
};

type CollapseEvent = {
  start: number;
};

type LodLevel = 0 | 1 | 2 | 3;

type SpecimenRuntime = {
  instanceId: string;
  container: Container;
  branchGraphics: Graphics;
  branchKey: string;
  visibleBranchCount: number;
  lastSeen: number;
  redrawsSinceRecycle: number;
};

type RendererRuntime = {
  root: Container;
  overlay: Graphics;
  specimenLayer: Container;
  dynamic: Graphics;
  specimens: Map<string, SpecimenRuntime>;
  sizeKey: string;
  graphicsCreated: number;
  graphicsDestroyed: number;
  containersCreated: number;
  containersDestroyed: number;
  lastCleanupDestroyed: number;
  lodDistribution: [number, number, number, number];
  tickerCallbacksRegistered: number;
  activeTickerCallbacks: number;
  animationLoopsActive: number;
};

type RenderDiagnostics = {
  totalCultures: number;
  visibleSpecimens: number;
  hiddenCulturesSimulated: number;
  rendererRuntimesCount: number;
  runtimeCount: number;
  stageChildren: number;
  containers: number;
  graphics: number;
  activeParticles: number;
  activeBranchData: number;
  activeBloomEffects: number;
  lodLevel: LodLevel;
  lodDistribution: string;
  selectedChamber: CoreLayerId;
  lastCleanupDestroyed: number;
  tickerCallbacksRegistered: number;
  activeTickerCallbacks: number;
  animationLoopsActive: number;
  saveBytes: number;
  memoryMB: number | null;
};

const HARVEST_MS = 1050;
const COLLAPSE_MS = 1200;
const MAX_PARTICLES_TOTAL = 300;
const LOD_BRANCH_CAPS = [80, 45, 16, 0] as const;
const LOD_PARTICLE_COUNTS = [8, 5, 2, 0] as const;
const MAX_BRANCH_REDRAWS_BEFORE_RECYCLE = 72;

function isDevBuild(): boolean {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}

function visibleInstances(props: RenderProps): CoreInstance[] {
  if (props.selectedLayerId === "all") return [];
  return props.instances.filter((instance) => CORE_DEFINITIONS[instance.definitionId].layerId === props.selectedLayerId);
}

function computeAnchors(instances: CoreInstance[], width: number, height: number): Map<string, Anchor> {
  const anchors = new Map<string, Anchor>();
  if (instances.length === 0) return anchors;
  const count = instances.length;
  const usableWidth = width * 0.82;
  const usableHeight = height * 0.78;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(28, Math.min(usableWidth, usableHeight) / (count <= 1 ? 3.3 : count <= 4 ? 5.2 : count <= 8 ? 7.1 : 9.4));

  if (count === 1) {
    anchors.set(instances[0].id, { x: centerX, y: centerY, radius: radius * 1.2 });
    return anchors;
  }

  if (count <= 4) {
    const orbit = Math.min(usableWidth, usableHeight) * 0.27;
    instances.forEach((instance, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
      anchors.set(instance.id, {
        x: centerX + Math.cos(angle) * orbit,
        y: centerY + Math.sin(angle) * orbit,
        radius,
      });
    });
    return anchors;
  }

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  instances.forEach((instance, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    anchors.set(instance.id, {
      x: centerX - usableWidth / 2 + usableWidth * ((column + 0.5) / columns),
      y: centerY - usableHeight / 2 + usableHeight * ((row + 0.5) / rows),
      radius,
    });
  });
  return anchors;
}

function palette(branch: RenderBranch): number {
  if (branch.type === "root") return 0x78ffb7;
  if (branch.type === "spiral") return 0xd69aff;
  if (branch.type === "lattice") return 0xcffcff;
  if (branch.type === "echo") return 0xffd36e;
  if (branch.type === "mutation") return 0xfff38a;
  return 0x9eb7ff;
}

function easeOut(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function getLodLevel(visibleCount: number, radius: number): LodLevel {
  if (visibleCount > 50 || radius < 24) return 3;
  if (visibleCount > 20 || radius < 38) return 2;
  if (visibleCount > 8 || radius < 52) return 1;
  return 0;
}

function getUpgradeKey(upgrades: CoreTypeUpgrade[], definitionId: string): string {
  const upgrade = upgrades.find((item) => item.definitionId === definitionId);
  return upgrade ? `${upgrade.complexityBonus}:${upgrade.speedLevel}:${upgrade.yieldLevel}` : "0:0:0";
}

function getVisibleBranchCount(instance: CoreInstance, lod: LodLevel): number {
  return Math.min(instance.currentBuiltBranches, LOD_BRANCH_CAPS[lod]);
}

function makeBranchKey(instance: CoreInstance, props: RenderProps, lod: LodLevel, anchor: Anchor): string {
  return [
    instance.definitionId,
    instance.currentSeed,
    getVisibleBranchCount(instance, lod),
    lod,
    Math.round(anchor.radius),
    getUpgradeKey(props.upgrades, instance.definitionId),
    props.equippedFormulaIds.join(","),
  ].join("|");
}

function destroyPixiContainer(container: Container): void {
  container.parent?.removeChild(container);
  const children = container.removeChildren();
  for (const child of children) {
    if (child instanceof Container) {
      destroyPixiContainer(child);
    } else {
      (child as { destroy?: (...args: unknown[]) => void }).destroy?.({ children: true });
    }
  }
  try {
    container.destroy({ children: true });
  } catch {
    try {
      container.destroy(true);
    } catch {
      container.destroy();
    }
  }
}

function createRendererRuntime(app: Application): RendererRuntime {
  const root = new Container();
  const overlay = new Graphics();
  const specimenLayer = new Container();
  const dynamic = new Graphics();
  root.addChild(overlay, specimenLayer, dynamic);
  app.stage.addChild(root);
  return {
    root,
    overlay,
    specimenLayer,
    dynamic,
    specimens: new Map(),
    sizeKey: "",
    graphicsCreated: 2,
    graphicsDestroyed: 0,
    containersCreated: 2,
    containersDestroyed: 0,
    lastCleanupDestroyed: 0,
    lodDistribution: [0, 0, 0, 0],
    tickerCallbacksRegistered: 0,
    activeTickerCallbacks: 0,
    animationLoopsActive: 1,
  };
}

function createSpecimenRuntime(runtime: RendererRuntime, instanceId: string): SpecimenRuntime {
  const container = new Container();
  const branchGraphics = new Graphics();
  container.addChild(branchGraphics);
  runtime.specimenLayer.addChild(container);
  runtime.graphicsCreated += 1;
  runtime.containersCreated += 1;
  return {
    instanceId,
    container,
    branchGraphics,
    branchKey: "",
    visibleBranchCount: 0,
    lastSeen: 0,
    redrawsSinceRecycle: 0,
  };
}

function destroySpecimenRuntime(runtime: RendererRuntime, specimen: SpecimenRuntime): void {
  destroyPixiContainer(specimen.container);
  runtime.graphicsDestroyed += 1;
  runtime.containersDestroyed += 1;
}

function recycleBranchGraphics(runtime: RendererRuntime, specimen: SpecimenRuntime): void {
  const old = specimen.branchGraphics;
  const index = specimen.container.getChildIndex(old);
  const next = new Graphics();
  specimen.container.addChildAt(next, index);
  specimen.container.removeChild(old);
  old.destroy();
  specimen.branchGraphics = next;
  specimen.redrawsSinceRecycle = 0;
  runtime.graphicsCreated += 1;
  runtime.graphicsDestroyed += 1;
}

function clearRendererRuntime(runtime: RendererRuntime): void {
  const destroyed = runtime.specimens.size;
  for (const specimen of runtime.specimens.values()) {
    destroySpecimenRuntime(runtime, specimen);
  }
  runtime.specimens.clear();
  runtime.dynamic.clear();
  runtime.overlay.clear();
  runtime.sizeKey = "";
  runtime.lastCleanupDestroyed = destroyed;
}

function drawStaticOverlay(graphics: Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.rect(18, 18, width - 36, height - 36);
  graphics.stroke({ color: 0x7bf7c8, width: 1, alpha: 0.12 });
  graphics.rect(30, 30, width - 60, height - 60);
  graphics.stroke({ color: 0xcffcff, width: 0.7, alpha: 0.08 });
  for (let x = 48; x < width; x += 48) {
    graphics.moveTo(x, 34);
    graphics.lineTo(x, height - 34);
    graphics.stroke({ color: 0x7bf7c8, width: 0.4, alpha: 0.025 });
  }
  for (let y = 48; y < height; y += 48) {
    graphics.moveTo(34, y);
    graphics.lineTo(width - 34, y);
    graphics.stroke({ color: 0x7bf7c8, width: 0.4, alpha: 0.025 });
  }
}

function drawSpecimenStaticBranches(graphics: Graphics, instance: CoreInstance, fractal: GeneratedFractal, anchor: Anchor, lod: LodLevel): void {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const branches = fractal.branches;
  const bounds = fractal.bounds;
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
  const scale = (anchor.radius * 1.42) / Math.max(boundsWidth, boundsHeight, 70);

  graphics.clear();
  graphics.circle(0, 0, anchor.radius * 0.96);
  graphics.stroke({ color: definition.visualTheme.secondary, width: 1.2, alpha: 0.16 });
  graphics.circle(0, 0, anchor.radius * 0.72);
  graphics.stroke({ color: definition.visualTheme.primary, width: 0.8, alpha: 0.13 });
  graphics.moveTo(-anchor.radius * 0.62, 0);
  graphics.lineTo(anchor.radius * 0.62, 0);
  graphics.stroke({ color: 0x7bf7c8, width: 0.7, alpha: 0.08 });
  graphics.moveTo(0, -anchor.radius * 0.62);
  graphics.lineTo(0, anchor.radius * 0.62);
  graphics.stroke({ color: 0x7bf7c8, width: 0.7, alpha: 0.08 });

  if (definition.fractalType === "crystal" || definition.fractalType === "boundary") {
    graphics.rect(-anchor.radius * 0.78, -anchor.radius * 0.78, anchor.radius * 1.56, anchor.radius * 1.56);
    graphics.stroke({ color: definition.visualTheme.secondary, width: 0.8, alpha: 0.1 });
  }

  if (lod >= 3) return;

  for (const branch of branches) {
    const startX = (branch.startX - boundsCenterX) * scale;
    const startY = (branch.startY - boundsCenterY) * scale;
    const endX = (branch.endX - boundsCenterX) * scale;
    const endY = (branch.endY - boundsCenterY) * scale;
    const alpha = (0.46 + branch.depth * 0.012) * (branches.length > 80 ? 0.78 : 1);

    if (branch.type !== "root") {
      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
      graphics.stroke({
        color: branch.mirrored ? definition.visualTheme.secondary : palette(branch),
        width: Math.max(1, branch.thickness * scale * 6.4),
        alpha: branch.mirrored ? alpha * 0.55 : alpha,
      });
    }

    if (lod <= 1 && anchor.radius >= 42) {
      const cellSize = definition.fractalType === "cell" ? Math.max(2.4, 6 - branch.depth * 0.1) : Math.max(1.5, 4.2 - branch.depth * 0.18);
      graphics.circle(endX, endY, cellSize);
      graphics.fill({ color: palette(branch), alpha: Math.min(1, alpha + 0.18) });
    }
  }
}

function drawSpecimenDynamic(graphics: Graphics, instance: CoreInstance, anchor: Anchor, time: number, collapseAmount: number, lod: LodLevel): void {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const harvestGlow = instance.currentState === "harvesting" ? Math.sin(instance.stateProgress * Math.PI) : 0;
  const unstableJitter = definition.fractalType === "lightning" ? Math.sin(time * 19 + instance.instanceIndex) * 1.8 : 0;
  const vatX = anchor.x + unstableJitter;
  const vatY = anchor.y + unstableJitter * 0.35;
  const collapsedRadius = anchor.radius * (1 - collapseAmount * 0.78);

  graphics.circle(vatX, vatY, 8 + Math.sin(time * 4 + instance.instanceIndex) * 1.1 + harvestGlow * 9);
  graphics.fill({ color: definition.visualTheme.primary, alpha: 0.88 });
  graphics.circle(vatX, vatY, collapsedRadius * 0.92);
  graphics.stroke({ color: definition.visualTheme.primary, width: 1, alpha: 0.08 + harvestGlow * 0.2 });

  if (definition.fractalType === "spiral" || definition.fractalType === "boundary") {
    graphics.arc(vatX, vatY, collapsedRadius * 0.82, time % 6.28, (time % 6.28) + Math.PI * 0.7);
    graphics.stroke({ color: definition.visualTheme.primary, width: 1.2, alpha: 0.2 });
  }

  if (lod >= 3) {
    const progress = Math.min(1, instance.currentBuiltBranches / Math.max(1, instance.complexity));
    graphics.arc(vatX, vatY, collapsedRadius * 0.5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    graphics.stroke({ color: definition.visualTheme.primary, width: 2, alpha: 0.38 + harvestGlow * 0.32 });
  }

  if (instance.currentState === "harvesting") {
    graphics.circle(vatX, vatY, collapsedRadius * (0.22 + instance.stateProgress * 0.75));
    graphics.stroke({ color: 0xffda7a, width: 2, alpha: (1 - instance.stateProgress) * 0.82 });
    graphics.rect(vatX - collapsedRadius * 0.45, vatY - collapsedRadius * 0.45, collapsedRadius * 0.9, collapsedRadius * 0.9);
    graphics.stroke({ color: 0xffda7a, width: 1, alpha: (1 - instance.stateProgress) * 0.35 });
  }
}

function drawParticles(graphics: Graphics, particles: Particle[], now: number): void {
  for (const particle of particles) {
    if (now < particle.start) continue;
    const t = Math.min(1, (now - particle.start) / HARVEST_MS);
    const x = particle.x + (92 - particle.x) * easeOut(t);
    const y = particle.y + (42 - particle.y) * easeOut(t) - Math.sin(t * Math.PI) * 34;
    graphics.circle(x, y, 4 * (1 - t));
    graphics.fill({ color: particle.color, alpha: 0.9 * (1 - t) });
  }
}

function compactParticles(particles: Particle[], now: number): void {
  let write = 0;
  for (let read = 0; read < particles.length; read += 1) {
    const particle = particles[read];
    if (now - particle.start >= HARVEST_MS) continue;
    particles[write] = particle;
    write += 1;
  }
  particles.length = write;
}

function capParticles(particles: Particle[]): void {
  if (particles.length <= MAX_PARTICLES_TOTAL) return;
  particles.splice(0, particles.length - MAX_PARTICLES_TOTAL);
}

function countDisplayObjects(container: Container): { containers: number; graphics: number } {
  let containers = 1;
  let graphics = container instanceof Graphics ? 1 : 0;
  for (const child of container.children) {
    if (child instanceof Graphics) graphics += 1;
    if (child instanceof Container) {
      const childCounts = countDisplayObjects(child);
      containers += childCounts.containers;
      graphics += childCounts.graphics;
    }
  }
  return { containers, graphics };
}

function getMemoryMB(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize / 1024 / 1024 : null;
}

function buildDiagnostics(app: Application, runtime: RendererRuntime, props: RenderProps, particles: Particle[], highestLod: LodLevel): RenderDiagnostics {
  const counts = countDisplayObjects(app.stage);
  const activeBranchData = [...runtime.specimens.values()].reduce((total, specimen) => total + specimen.visibleBranchCount, 0);
  const visibleCount = visibleInstances(props).length;
  return {
    totalCultures: props.instances.length,
    visibleSpecimens: visibleCount,
    hiddenCulturesSimulated: Math.max(0, props.instances.length - visibleCount),
    rendererRuntimesCount: runtime.root.destroyed ? 0 : 1,
    runtimeCount: runtime.specimens.size,
    stageChildren: app.stage.children.length,
    containers: counts.containers,
    graphics: counts.graphics,
    activeParticles: particles.length,
    activeBloomEffects: 0,
    activeBranchData,
    selectedChamber: props.selectedLayerId,
    lodLevel: highestLod,
    lodDistribution: runtime.lodDistribution.map((count, index) => `L${index}:${count}`).join(" "),
    lastCleanupDestroyed: runtime.lastCleanupDestroyed,
    tickerCallbacksRegistered: runtime.tickerCallbacksRegistered,
    activeTickerCallbacks: runtime.activeTickerCallbacks,
    animationLoopsActive: runtime.animationLoopsActive,
    saveBytes: localStorage.getItem(SAVE_KEY)?.length ?? 0,
    memoryMB: getMemoryMB(),
  };
}

function renderFrame(
  app: Application,
  runtime: RendererRuntime,
  props: RenderProps,
  particles: Particle[],
  collapse: CollapseEvent | null,
  now: number,
): LodLevel {
  const width = app.renderer.width / app.renderer.resolution;
  const height = app.renderer.height / app.renderer.resolution;
  const sizeKey = `${Math.round(width)}x${Math.round(height)}`;
  if (runtime.sizeKey !== sizeKey) {
    runtime.sizeKey = sizeKey;
    drawStaticOverlay(runtime.overlay, width, height);
    for (const specimen of runtime.specimens.values()) specimen.branchKey = "";
  }

  const time = now / 1000;
  const collapseAmount = collapse ? Math.min(1, (now - collapse.start) / COLLAPSE_MS) : 0;
  const instances = visibleInstances(props);
  const anchors = computeAnchors(instances, width, height);
  const visibleIds = new Set<string>();
  let highestLod: LodLevel = 0;
  runtime.lodDistribution = [0, 0, 0, 0];

  runtime.dynamic.clear();

  for (const instance of instances) {
    const anchor = anchors.get(instance.id);
    if (!anchor) continue;
    visibleIds.add(instance.id);
    const lod = getLodLevel(instances.length, anchor.radius);
    runtime.lodDistribution[lod] += 1;
    highestLod = Math.max(highestLod, lod) as LodLevel;
    const definition = CORE_DEFINITIONS[instance.definitionId];
    const jitter = definition.fractalType === "lightning" ? Math.sin(time * 19 + instance.instanceIndex) * 1.8 : 0;
    let specimen = runtime.specimens.get(instance.id);
    if (!specimen) {
      specimen = createSpecimenRuntime(runtime, instance.id);
      runtime.specimens.set(instance.id, specimen);
    }

    specimen.lastSeen = now;
    specimen.container.position.set(anchor.x + jitter, anchor.y + jitter * 0.35);
    specimen.container.alpha = (instance.currentState === "fading" ? 1 - instance.stateProgress : 1) * (1 - collapseAmount * 0.58);

    const branchKey = makeBranchKey(instance, props, lod, anchor);
    if (specimen.branchKey !== branchKey) {
      if (specimen.redrawsSinceRecycle >= MAX_BRANCH_REDRAWS_BEFORE_RECYCLE) recycleBranchGraphics(runtime, specimen);
      const fractal = generateInstanceFractal(instance, props.upgrades, props.equippedFormulaIds, { maxBranches: LOD_BRANCH_CAPS[lod] });
      drawSpecimenStaticBranches(specimen.branchGraphics, instance, fractal, anchor, lod);
      specimen.branchKey = branchKey;
      specimen.visibleBranchCount = fractal.branches.length;
      specimen.redrawsSinceRecycle += 1;
    }

    drawSpecimenDynamic(runtime.dynamic, instance, anchor, time, collapseAmount, lod);
  }

  for (const [id, specimen] of runtime.specimens) {
    if (!visibleIds.has(id)) {
      destroySpecimenRuntime(runtime, specimen);
      runtime.specimens.delete(id);
    }
  }

  drawParticles(runtime.dynamic, particles, now);

  if (collapse && collapseAmount < 1) {
    runtime.dynamic.circle(width / 2, height / 2, Math.min(width, height) * (0.42 - collapseAmount * 0.3));
    runtime.dynamic.stroke({ color: 0xffffff, width: 2.5, alpha: Math.sin(collapseAmount * Math.PI) * 0.7 });
    runtime.dynamic.circle(width / 2, height / 2, 10 + collapseAmount * 20);
    runtime.dynamic.fill({ color: 0xffda7a, alpha: Math.sin(collapseAmount * Math.PI) * 0.55 });
  }

  return highestLod;
}

export function FractalCanvas({ instances, upgrades, selectedLayerId, equippedFormulaIds, harvestPulse, formulaPulse, collapsePulse }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const runtimeRef = useRef<RendererRuntime | null>(null);
  const propsRef = useRef<RenderProps>({ instances, upgrades, selectedLayerId, equippedFormulaIds });
  const particlesRef = useRef<Particle[]>([]);
  const collapseRef = useRef<CollapseEvent | null>(null);
  const previousHarvestRef = useRef(harvestPulse);
  const previousFormulaRef = useRef(formulaPulse);
  const previousCollapseRef = useRef(collapsePulse);
  const previousLayerRef = useRef(selectedLayerId);
  const showDiagnosticsRef = useRef(false);
  const lastDiagnosticsAtRef = useRef(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RenderDiagnostics | null>(null);
  const layer = useMemo(() => getCoreLayer(selectedLayerId), [selectedLayerId]);

  useEffect(() => {
    propsRef.current = { instances, upgrades, selectedLayerId, equippedFormulaIds };
  }, [instances, upgrades, selectedLayerId, equippedFormulaIds]);

  useEffect(() => {
    showDiagnosticsRef.current = showDiagnostics;
  }, [showDiagnostics]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      setShowDiagnostics((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (selectedLayerId !== previousLayerRef.current) {
      particlesRef.current.length = 0;
      if (runtime) clearRendererRuntime(runtime);
      previousLayerRef.current = selectedLayerId;
    }

    if (harvestPulse !== previousHarvestRef.current) {
      const now = Date.now();
      const host = hostRef.current;
      const width = host?.clientWidth ?? 800;
      const height = host?.clientHeight ?? 600;
      const visible = visibleInstances({ instances, upgrades, selectedLayerId, equippedFormulaIds });
      const anchors = computeAnchors(visible, width, height);
      for (const instance of visible) {
        if (instance.currentState !== "harvesting") continue;
        const anchor = anchors.get(instance.id);
        if (!anchor) continue;
        const color = CORE_DEFINITIONS[instance.definitionId].visualTheme.primary;
        const particleCount = LOD_PARTICLE_COUNTS[getLodLevel(visible.length, anchor.radius)];
        for (let index = 0; index < particleCount; index += 1) {
          const angle = (Math.PI * 2 * index) / Math.max(1, particleCount);
          particlesRef.current.push({
            start: now + index * 24,
            x: anchor.x + Math.cos(angle) * anchor.radius * 0.4,
            y: anchor.y + Math.sin(angle) * anchor.radius * 0.4,
            color,
          });
        }
      }
      capParticles(particlesRef.current);
      previousHarvestRef.current = harvestPulse;
    }

    if (formulaPulse !== previousFormulaRef.current) {
      if (runtime) for (const specimen of runtime.specimens.values()) specimen.branchKey = "";
      previousFormulaRef.current = formulaPulse;
    }

    if (collapsePulse !== previousCollapseRef.current) {
      collapseRef.current = { start: Date.now() };
      particlesRef.current.length = 0;
      if (runtime) clearRendererRuntime(runtime);
      previousCollapseRef.current = collapsePulse;
    }
  }, [harvestPulse, formulaPulse, collapsePulse, instances, upgrades, selectedLayerId, equippedFormulaIds]);

  useEffect(() => {
    let destroyed = false;
    let initialized = false;
    let animationFrame = 0;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    appRef.current = app;

    void app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 1.25),
      autoDensity: true,
    }).then(() => {
      initialized = true;
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }

      host.appendChild(app.canvas);
      const runtime = createRendererRuntime(app);
      runtimeRef.current = runtime;

      const render = () => {
        if (destroyed || !runtimeRef.current) return;
        const now = Date.now();
        compactParticles(particlesRef.current, now);
        if (collapseRef.current && now - collapseRef.current.start >= COLLAPSE_MS) collapseRef.current = null;
        const highestLod = renderFrame(app, runtimeRef.current, propsRef.current, particlesRef.current, collapseRef.current, now);

        if (isDevBuild()) {
          const stats = buildDiagnostics(app, runtimeRef.current, propsRef.current, particlesRef.current, highestLod);
          (globalThis as typeof globalThis & { __recursiveBloomRenderStats?: RenderDiagnostics }).__recursiveBloomRenderStats = stats;
          if (showDiagnosticsRef.current && now - lastDiagnosticsAtRef.current > 500) {
            lastDiagnosticsAtRef.current = now;
            setDiagnostics(stats);
          }
        }

        animationFrame = requestAnimationFrame(render);
      };

      animationFrame = requestAnimationFrame(render);
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      particlesRef.current.length = 0;
      if (runtimeRef.current) {
        runtimeRef.current.animationLoopsActive = 0;
        clearRendererRuntime(runtimeRef.current);
        destroyPixiContainer(runtimeRef.current.root);
      }
      runtimeRef.current = null;
      if (initialized) app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  return (
    <div className={`fractal-canvas layer-${layer?.backgroundTheme ?? "all"}`} ref={hostRef}>
      {showDiagnostics && diagnostics && (
        <div className="render-diagnostics">
          <strong>Render Diagnostics</strong>
          <span>Chamber: {diagnostics.selectedChamber}</span>
          <span>Cultures: {diagnostics.totalCultures} total | {diagnostics.hiddenCulturesSimulated} hidden math-only</span>
          <span>Rendered: {diagnostics.visibleSpecimens} | specimen runtimes {diagnostics.runtimeCount} | chamber runtimes {diagnostics.rendererRuntimesCount}</span>
          <span>Stage children: {diagnostics.stageChildren}</span>
          <span>Containers: {diagnostics.containers} | Graphics: {diagnostics.graphics}</span>
          <span>Branches: {diagnostics.activeBranchData} | Particles: {diagnostics.activeParticles}</span>
          <span>Bloom: {diagnostics.activeBloomEffects} | LOD: {diagnostics.lodLevel} | {diagnostics.lodDistribution}</span>
          <span>Last cleanup destroyed: {diagnostics.lastCleanupDestroyed}</span>
          <span>Tickers: {diagnostics.activeTickerCallbacks}/{diagnostics.tickerCallbacksRegistered} | RAF: {diagnostics.animationLoopsActive}</span>
          <span>Save: {(diagnostics.saveBytes / 1024).toFixed(1)}KB</span>
          <span>Heap: {diagnostics.memoryMB === null ? "n/a" : `${diagnostics.memoryMB.toFixed(1)}MB`}</span>
        </div>
      )}
    </div>
  );
}
