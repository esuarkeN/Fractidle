import { useEffect, useRef, useState } from "react";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { getCoreLayer } from "../game/coreLayers";
import type { CoreInstance, CoreLayerId, CoreTypeUpgrade } from "../game/coreTypes";
import { generateInstanceFractal, type GeneratedFractal, type RenderBranch } from "../game/fractalGenerators";
import { SAVE_KEY } from "../game/save";
import { useGameStore, type GameStore } from "../store/gameStore";

type Anchor = {
  x: number;
  y: number;
  radius: number;
};

type RenderProps = {
  instances: CoreInstance[];
  upgrades: CoreTypeUpgrade[];
  selectedLayerId: CoreLayerId;
  equippedFormulaIds: Array<string | null>;
};

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

type CachedFractal = {
  key: string;
  branchCount: number;
  fractal: GeneratedFractal;
  bitmap: HTMLCanvasElement;
  bitmapSize: number;
};

type CanvasRuntime = {
  cache: Map<string, CachedFractal>;
  sizeKey: string;
  lastCleanupDestroyed: number;
  lodDistribution: [number, number, number, number];
  animationLoopsActive: number;
  framesRendered: number;
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
  graphicsCreated: number;
  graphicsDestroyed: number;
  dynamicRedrawsSinceRecycle: number;
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
  framesRendered: number;
};

const HARVEST_MS = 1050;
const COLLAPSE_MS = 1200;
const MAX_PARTICLES_TOTAL = 220;
const LOD_BRANCH_CAPS = [80, 45, 16, 0] as const;
const LOD_PARTICLE_COUNTS = [8, 5, 2, 0] as const;
const TARGET_RENDER_FPS = 24;
const TARGET_RENDER_FRAME_MS = 1000 / TARGET_RENDER_FPS;

function getRenderProps(state: GameStore): RenderProps {
  return {
    instances: state.coreInstances,
    upgrades: state.coreUpgrades,
    selectedLayerId: state.selectedLayerId,
    equippedFormulaIds: state.equippedFormulaIds,
  };
}

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

function colorNumberToCss(color: number, alpha = 1): string {
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

function getMemoryMB(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize / 1024 / 1024 : null;
}

function createRuntime(): CanvasRuntime {
  return {
    cache: new Map(),
    sizeKey: "",
    lastCleanupDestroyed: 0,
    lodDistribution: [0, 0, 0, 0],
    animationLoopsActive: 1,
    framesRendered: 0,
  };
}

function clearRuntime(runtime: CanvasRuntime): void {
  runtime.lastCleanupDestroyed = runtime.cache.size;
  for (const cached of runtime.cache.values()) {
    disposeCachedFractal(cached);
  }
  runtime.cache.clear();
  runtime.sizeKey = "";
}

function drawStaticOverlay(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.strokeStyle = colorNumberToCss(0x7bf7c8, 0.12);
  context.lineWidth = 1;
  context.strokeRect(18, 18, width - 36, height - 36);
  context.strokeStyle = colorNumberToCss(0xcffcff, 0.08);
  context.lineWidth = 0.7;
  context.strokeRect(30, 30, width - 60, height - 60);

  context.lineWidth = 0.4;
  context.strokeStyle = colorNumberToCss(0x7bf7c8, 0.025);
  context.beginPath();
  for (let x = 48; x < width; x += 48) {
    context.moveTo(x, 34);
    context.lineTo(x, height - 34);
  }
  for (let y = 48; y < height; y += 48) {
    context.moveTo(34, y);
    context.lineTo(width - 34, y);
  }
  context.stroke();
}

function strokeCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: number, alpha: number, lineWidth: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.strokeStyle = colorNumberToCss(color, alpha);
  context.lineWidth = lineWidth;
  context.stroke();
}

function fillCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: number, alpha: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = colorNumberToCss(color, alpha);
  context.fill();
}

function drawSpecimenStaticBranches(context: CanvasRenderingContext2D, instance: CoreInstance, fractal: GeneratedFractal, anchor: Anchor, lod: LodLevel): void {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const branches = fractal.branches;
  const bounds = fractal.bounds;
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
  const scale = (anchor.radius * 1.42) / Math.max(boundsWidth, boundsHeight, 70);

  strokeCircle(context, 0, 0, anchor.radius * 0.96, definition.visualTheme.secondary, 0.16, 1.2);
  strokeCircle(context, 0, 0, anchor.radius * 0.72, definition.visualTheme.primary, 0.13, 0.8);

  context.beginPath();
  context.moveTo(-anchor.radius * 0.62, 0);
  context.lineTo(anchor.radius * 0.62, 0);
  context.moveTo(0, -anchor.radius * 0.62);
  context.lineTo(0, anchor.radius * 0.62);
  context.strokeStyle = colorNumberToCss(0x7bf7c8, 0.08);
  context.lineWidth = 0.7;
  context.stroke();

  if (definition.fractalType === "crystal" || definition.fractalType === "boundary") {
    context.strokeStyle = colorNumberToCss(definition.visualTheme.secondary, 0.1);
    context.lineWidth = 0.8;
    context.strokeRect(-anchor.radius * 0.78, -anchor.radius * 0.78, anchor.radius * 1.56, anchor.radius * 1.56);
  }

  if (lod >= 3) return;

  for (const branch of branches) {
    const startX = (branch.startX - boundsCenterX) * scale;
    const startY = (branch.startY - boundsCenterY) * scale;
    const endX = (branch.endX - boundsCenterX) * scale;
    const endY = (branch.endY - boundsCenterY) * scale;
    const alpha = (0.46 + branch.depth * 0.012) * (branches.length > 80 ? 0.78 : 1);

    if (branch.type !== "root") {
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.strokeStyle = colorNumberToCss(branch.mirrored ? definition.visualTheme.secondary : palette(branch), branch.mirrored ? alpha * 0.55 : alpha);
      context.lineWidth = Math.max(1, branch.thickness * scale * 6.4);
      context.lineCap = "round";
      context.stroke();
    }

    if (lod <= 1 && anchor.radius >= 42) {
      const cellSize = definition.fractalType === "cell" ? Math.max(2.4, 6 - branch.depth * 0.1) : Math.max(1.5, 4.2 - branch.depth * 0.18);
      fillCircle(context, endX, endY, cellSize, palette(branch), Math.min(1, alpha + 0.18));
    }
  }
}

function drawSpecimenDynamic(context: CanvasRenderingContext2D, instance: CoreInstance, anchor: Anchor, time: number, collapseAmount: number, lod: LodLevel): void {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const harvestGlow = instance.currentState === "harvesting" ? Math.sin(instance.stateProgress * Math.PI) : 0;
  const unstableJitter = definition.fractalType === "lightning" ? Math.sin(time * 19 + instance.instanceIndex) * 1.8 : 0;
  const vatX = anchor.x + unstableJitter;
  const vatY = anchor.y + unstableJitter * 0.35;
  const collapsedRadius = anchor.radius * (1 - collapseAmount * 0.78);

  fillCircle(context, vatX, vatY, 8 + Math.sin(time * 4 + instance.instanceIndex) * 1.1 + harvestGlow * 9, definition.visualTheme.primary, 0.88);
  strokeCircle(context, vatX, vatY, collapsedRadius * 0.92, definition.visualTheme.primary, 0.08 + harvestGlow * 0.2, 1);

  if (definition.fractalType === "spiral" || definition.fractalType === "boundary") {
    context.beginPath();
    context.arc(vatX, vatY, collapsedRadius * 0.82, time % 6.28, (time % 6.28) + Math.PI * 0.7);
    context.strokeStyle = colorNumberToCss(definition.visualTheme.primary, 0.2);
    context.lineWidth = 1.2;
    context.stroke();
  }

  if (lod >= 3) {
    const progress = Math.min(1, instance.currentBuiltBranches / Math.max(1, instance.complexity));
    context.beginPath();
    context.arc(vatX, vatY, collapsedRadius * 0.5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    context.strokeStyle = colorNumberToCss(definition.visualTheme.primary, 0.38 + harvestGlow * 0.32);
    context.lineWidth = 2;
    context.stroke();
  }

  if (instance.currentState === "harvesting") {
    strokeCircle(context, vatX, vatY, collapsedRadius * (0.22 + instance.stateProgress * 0.75), 0xffda7a, (1 - instance.stateProgress) * 0.82, 2);
    context.strokeStyle = colorNumberToCss(0xffda7a, (1 - instance.stateProgress) * 0.35);
    context.lineWidth = 1;
    context.strokeRect(vatX - collapsedRadius * 0.45, vatY - collapsedRadius * 0.45, collapsedRadius * 0.9, collapsedRadius * 0.9);
  }
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[], now: number): void {
  for (const particle of particles) {
    if (now < particle.start) continue;
    const t = Math.min(1, (now - particle.start) / HARVEST_MS);
    const x = particle.x + (92 - particle.x) * easeOut(t);
    const y = particle.y + (42 - particle.y) * easeOut(t) - Math.sin(t * Math.PI) * 34;
    fillCircle(context, x, y, 4 * (1 - t), particle.color, 0.9 * (1 - t));
  }
}

function syncCanvasSize(canvas: HTMLCanvasElement, host: HTMLDivElement): { width: number; height: number; ratio: number; resized: boolean } {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  const pixelWidth = Math.floor(width * ratio);
  const pixelHeight = Math.floor(height * ratio);
  const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
  if (resized) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  return { width, height, ratio, resized };
}

function getCachedFractal(runtime: CanvasRuntime, instance: CoreInstance, props: RenderProps, lod: LodLevel, anchor: Anchor): CachedFractal {
  const key = makeBranchKey(instance, props, lod, anchor);
  const cached = runtime.cache.get(instance.id);
  if (cached?.key === key) return cached;
  if (cached) disposeCachedFractal(cached);
  const fractal = generateInstanceFractal(instance, props.upgrades, props.equippedFormulaIds, { maxBranches: LOD_BRANCH_CAPS[lod] });
  const bitmap = createStaticFractalBitmap(instance, fractal, anchor, lod);
  const next = {
    key,
    branchCount: getVisibleBranchCount(instance, lod),
    fractal,
    bitmap,
    bitmapSize: bitmap.width,
  };
  runtime.cache.set(instance.id, next);
  return next;
}

function disposeCachedFractal(cached: CachedFractal): void {
  cached.bitmap.width = 1;
  cached.bitmap.height = 1;
}

function createStaticFractalBitmap(instance: CoreInstance, fractal: GeneratedFractal, anchor: Anchor, lod: LodLevel): HTMLCanvasElement {
  const size = Math.max(96, Math.ceil(anchor.radius * 3.6));
  const bitmap = document.createElement("canvas");
  bitmap.width = size;
  bitmap.height = size;
  const context = bitmap.getContext("2d");
  if (!context) return bitmap;
  context.translate(size / 2, size / 2);
  drawSpecimenStaticBranches(context, instance, fractal, anchor, lod);
  return bitmap;
}

function buildDiagnostics(runtime: CanvasRuntime, props: RenderProps, particles: Particle[], highestLod: LodLevel): RenderDiagnostics {
  const visibleCount = visibleInstances(props).length;
  const activeBranchData = [...runtime.cache.values()].reduce((total, cached) => total + cached.fractal.branches.length, 0);
  return {
    totalCultures: props.instances.length,
    visibleSpecimens: visibleCount,
    hiddenCulturesSimulated: Math.max(0, props.instances.length - visibleCount),
    rendererRuntimesCount: 1,
    runtimeCount: runtime.cache.size,
    stageChildren: 1,
    containers: 0,
    graphics: 0,
    graphicsCreated: 0,
    graphicsDestroyed: 0,
    dynamicRedrawsSinceRecycle: 0,
    activeParticles: particles.length,
    activeBloomEffects: 0,
    activeBranchData,
    selectedChamber: props.selectedLayerId,
    lodLevel: highestLod,
    lodDistribution: runtime.lodDistribution.map((count, index) => `L${index}:${count}`).join(" "),
    lastCleanupDestroyed: runtime.lastCleanupDestroyed,
    tickerCallbacksRegistered: 0,
    activeTickerCallbacks: 0,
    animationLoopsActive: runtime.animationLoopsActive,
    saveBytes: localStorage.getItem(SAVE_KEY)?.length ?? 0,
    memoryMB: getMemoryMB(),
    framesRendered: runtime.framesRendered,
  };
}

function renderFrame(
  canvas: HTMLCanvasElement,
  host: HTMLDivElement,
  runtime: CanvasRuntime,
  props: RenderProps,
  particles: Particle[],
  collapse: CollapseEvent | null,
  now: number,
): LodLevel {
  const context = canvas.getContext("2d");
  if (!context) return 0;
  const { width, height, ratio, resized } = syncCanvasSize(canvas, host);
  const sizeKey = `${Math.round(width)}x${Math.round(height)}@${ratio}`;
  if (runtime.sizeKey !== sizeKey || resized) {
    runtime.sizeKey = sizeKey;
    runtime.cache.clear();
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  drawStaticOverlay(context, width, height);

  const time = now / 1000;
  const collapseAmount = collapse ? Math.min(1, (now - collapse.start) / COLLAPSE_MS) : 0;
  const instances = visibleInstances(props);
  const anchors = computeAnchors(instances, width, height);
  const visibleIds = new Set<string>();
  let highestLod: LodLevel = 0;
  runtime.lodDistribution = [0, 0, 0, 0];

  for (const instance of instances) {
    const anchor = anchors.get(instance.id);
    if (!anchor) continue;
    visibleIds.add(instance.id);
    const lod = getLodLevel(instances.length, anchor.radius);
    runtime.lodDistribution[lod] += 1;
    highestLod = Math.max(highestLod, lod) as LodLevel;
    const definition = CORE_DEFINITIONS[instance.definitionId];
    const jitter = definition.fractalType === "lightning" ? Math.sin(time * 19 + instance.instanceIndex) * 1.8 : 0;
    const alpha = (instance.currentState === "fading" ? 1 - instance.stateProgress : 1) * (1 - collapseAmount * 0.58);
    const cached = getCachedFractal(runtime, instance, props, lod, anchor);

    context.save();
    context.globalAlpha = alpha;
    context.drawImage(cached.bitmap, anchor.x + jitter - cached.bitmapSize / 2, anchor.y + jitter * 0.35 - cached.bitmapSize / 2);
    context.restore();

    drawSpecimenDynamic(context, instance, anchor, time, collapseAmount, lod);
  }

  for (const [id, cached] of runtime.cache) {
    if (!visibleIds.has(id)) {
      disposeCachedFractal(cached);
      runtime.cache.delete(id);
    }
  }

  drawParticles(context, particles, now);

  if (collapse && collapseAmount < 1) {
    strokeCircle(context, width / 2, height / 2, Math.min(width, height) * (0.42 - collapseAmount * 0.3), 0xffffff, Math.sin(collapseAmount * Math.PI) * 0.7, 2.5);
    fillCircle(context, width / 2, height / 2, 10 + collapseAmount * 20, 0xffda7a, Math.sin(collapseAmount * Math.PI) * 0.55);
  }

  runtime.framesRendered += 1;
  return highestLod;
}

export function FractalCanvas() {
  const initialState = useGameStore.getState();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<CanvasRuntime | null>(null);
  const propsRef = useRef<RenderProps>(getRenderProps(initialState));
  const particlesRef = useRef<Particle[]>([]);
  const collapseRef = useRef<CollapseEvent | null>(null);
  const previousHarvestRef = useRef(initialState.feedback.harvestPulse);
  const previousFormulaRef = useRef(initialState.feedback.formulaPulse);
  const previousCollapseRef = useRef(initialState.feedback.collapsePulse);
  const previousLayerRef = useRef(initialState.selectedLayerId);
  const showDiagnosticsRef = useRef(false);
  const lastDiagnosticsAtRef = useRef(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RenderDiagnostics | null>(null);
  const [layerTheme, setLayerTheme] = useState(() => getCoreLayer(initialState.selectedLayerId)?.backgroundTheme ?? "all");

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
    return useGameStore.subscribe((state) => {
      const runtime = runtimeRef.current;
      propsRef.current = getRenderProps(state);
      if (state.selectedLayerId !== previousLayerRef.current) {
        particlesRef.current.length = 0;
        if (runtime) clearRuntime(runtime);
        previousLayerRef.current = state.selectedLayerId;
        setLayerTheme(getCoreLayer(state.selectedLayerId)?.backgroundTheme ?? "all");
      }

      if (state.feedback.harvestPulse !== previousHarvestRef.current) {
        const now = Date.now();
        const host = hostRef.current;
        const width = host?.clientWidth ?? 800;
        const height = host?.clientHeight ?? 600;
        const visible = visibleInstances(propsRef.current);
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
        previousHarvestRef.current = state.feedback.harvestPulse;
      }

      if (state.feedback.formulaPulse !== previousFormulaRef.current) {
        runtime?.cache.clear();
        previousFormulaRef.current = state.feedback.formulaPulse;
      }

      if (state.feedback.collapsePulse !== previousCollapseRef.current) {
        collapseRef.current = { start: Date.now() };
        particlesRef.current.length = 0;
        if (runtime) clearRuntime(runtime);
        previousCollapseRef.current = state.feedback.collapsePulse;
      }
    });
  }, []);

  useEffect(() => {
    let destroyed = false;
    let animationFrame = 0;
    let lastRenderedAt = 0;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const runtime = createRuntime();
    runtimeRef.current = runtime;

    const render = () => {
      if (destroyed || !runtimeRef.current) return;
      const now = Date.now();
      if (now - lastRenderedAt < TARGET_RENDER_FRAME_MS) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      lastRenderedAt = now;
      compactParticles(particlesRef.current, now);
      if (collapseRef.current && now - collapseRef.current.start >= COLLAPSE_MS) collapseRef.current = null;
      const highestLod = renderFrame(canvas, host, runtimeRef.current, propsRef.current, particlesRef.current, collapseRef.current, now);

      if (isDevBuild() && showDiagnosticsRef.current) {
        const stats = buildDiagnostics(runtimeRef.current, propsRef.current, particlesRef.current, highestLod);
        (globalThis as typeof globalThis & { __recursiveBloomRenderStats?: RenderDiagnostics }).__recursiveBloomRenderStats = stats;
        if (now - lastDiagnosticsAtRef.current > 500) {
          lastDiagnosticsAtRef.current = now;
          setDiagnostics(stats);
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      particlesRef.current.length = 0;
      if (runtimeRef.current) {
        runtimeRef.current.animationLoopsActive = 0;
        clearRuntime(runtimeRef.current);
      }
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
      runtimeRef.current = null;
    };
  }, []);

  return (
    <div className={`fractal-canvas layer-${layerTheme}`} ref={hostRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {isDevBuild() && (
        <button className="render-diagnostics-toggle" type="button" onClick={() => setShowDiagnostics((current) => !current)}>
          PERF
        </button>
      )}
      {showDiagnostics && diagnostics && (
        <div className="render-diagnostics">
          <strong>Render Diagnostics</strong>
          <span>Chamber: {diagnostics.selectedChamber}</span>
          <span>Cultures: {diagnostics.totalCultures} total | {diagnostics.hiddenCulturesSimulated} hidden math-only</span>
          <span>Rendered: {diagnostics.visibleSpecimens} | cached fractals {diagnostics.runtimeCount} | canvas runtimes {diagnostics.rendererRuntimesCount}</span>
          <span>Stage children: {diagnostics.stageChildren}</span>
          <span>Canvas mode: no Pixi containers or Graphics retained</span>
          <span>Branches: {diagnostics.activeBranchData} | Particles: {diagnostics.activeParticles}</span>
          <span>Bloom: {diagnostics.activeBloomEffects} | LOD: {diagnostics.lodLevel} | {diagnostics.lodDistribution}</span>
          <span>Last cleanup destroyed: {diagnostics.lastCleanupDestroyed}</span>
          <span>RAF: {diagnostics.animationLoopsActive} | Frames: {diagnostics.framesRendered}</span>
          <span>Save: {(diagnostics.saveBytes / 1024).toFixed(1)}KB</span>
          <span>Heap: {diagnostics.memoryMB === null ? "n/a" : `${diagnostics.memoryMB.toFixed(1)}MB`}</span>
        </div>
      )}
    </div>
  );
}
