import type { FractalBranch, FractalState, FractalNodeType, GrowthMode } from "./fractalTypes";
import { getVisualInfluence } from "./visualInfluences";

function random(seed: number): { value: number; seed: number } {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { value: next / 4294967296, seed: next };
}

function randomBetween(seed: number, min: number, max: number): { value: number; seed: number } {
  const result = random(seed);
  return { value: min + (max - min) * result.value, seed: result.seed };
}

export function createInitialFractal(seed = 91357, now = Date.now()): FractalState {
  return {
    seed,
    growthCharge: 1.6,
    growthBias: "branch",
    lastAutoGrownAt: now,
    branches: [
      {
        id: "root",
        parentId: null,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        x: 0,
        y: 0,
        angle: -Math.PI / 2,
        length: 0,
        depth: 0,
        thickness: 9,
        type: "root",
        createdAt: now,
        growthProgress: 1,
        mirrored: false,
        patternGroup: "origin",
      },
    ],
  };
}

function chooseParent(branches: FractalBranch[], seed: number): { parent: FractalBranch; seed: number } {
  const candidates = branches.filter((branch) => branch.depth < 9 && branch.id !== "root");
  const pool = candidates.length > 0 ? candidates : branches;
  const roll = random(seed);
  const index = Math.floor(Math.pow(roll.value, 0.45) * pool.length);
  return { parent: pool[Math.min(pool.length - 1, index)], seed: roll.seed };
}

function branchType(mode: GrowthMode, influence: ReturnType<typeof getVisualInfluence>, seed: number): { type: FractalNodeType; seed: number } {
  let currentSeed = seed;
  const roll = random(currentSeed);
  currentSeed = roll.seed;
  if (mode === "pattern" || (influence.patternPower > 0 && roll.value < 0.18)) return { type: "echo", seed: currentSeed };
  if (mode === "stabilize" || (influence.symmetryPower > 0 && roll.value < 0.3)) return { type: "lattice", seed: currentSeed };
  if (influence.spiralPower > 0 && roll.value < 0.48) return { type: "spiral", seed: currentSeed };
  if (influence.mutationPower > 0 && roll.value < 0.34) return { type: "mutation", seed: currentSeed };
  return { type: "branch", seed: currentSeed };
}

function makeBranch(
  parent: FractalBranch,
  id: string,
  angle: number,
  length: number,
  type: FractalNodeType,
  now: number,
  mirror = false,
): FractalBranch {
  const finalAngle = mirror ? Math.PI - angle : angle;
  const startX = mirror ? -parent.endX : parent.endX;
  const startY = parent.endY;
  const x = startX + Math.cos(finalAngle) * length;
  const y = startY + Math.sin(finalAngle) * length;
  return {
    id,
    parentId: parent.id,
    startX,
    startY,
    endX: x,
    endY: y,
    x,
    y,
    angle: finalAngle,
    length,
    depth: parent.depth + 1,
    thickness: Math.max(1.3, parent.thickness * 0.78),
    type,
    createdAt: now,
    growthProgress: 0,
    mirrored: mirror,
    patternGroup: type === "echo" ? parent.patternGroup ?? parent.id : undefined,
  };
}

export function growFractal(
  fractal: FractalState,
  equippedFormulaIds: Array<string | null>,
  mode: GrowthMode = "branch",
  now = Date.now(),
): FractalState {
  const influence = getVisualInfluence(equippedFormulaIds);
  let seed = fractal.seed;
  const branches = [...fractal.branches];
  const { parent, seed: parentSeed } = chooseParent(branches, seed);
  seed = parentSeed;

  const childCount = mode === "branch" && influence.branchPower > 0 ? Math.min(3, 1 + influence.branchPower) : 1;
  const made: FractalBranch[] = [];

  for (let index = 0; index < childCount; index += 1) {
    const angleJitter = randomBetween(seed, -0.78, 0.78);
    seed = angleJitter.seed;
    const lengthRoll = randomBetween(seed, 28, 58);
    seed = lengthRoll.seed;
    const typeRoll = branchType(mode, influence, seed);
    seed = typeRoll.seed;
    const branchSpread = childCount > 1 ? (index - (childCount - 1) / 2) * 0.46 : 0;
    const spiralBend = influence.spiralPower > 0 ? 0.22 * influence.spiralPower + branches.length * 0.018 : 0;
    const patternEcho = typeRoll.type === "echo" ? Math.sin(parent.depth + branches.length) * 0.34 : 0;
    const mutationJitter = typeRoll.type === "mutation" ? angleJitter.value * 1.15 : angleJitter.value;
    const angle = parent.angle + branchSpread + mutationJitter + spiralBend + patternEcho;
    const length = lengthRoll.value * (typeRoll.type === "lattice" ? 0.9 : typeRoll.type === "spiral" ? 1.08 : 1);

    made.push(makeBranch(parent, `${now}-${branches.length}-${index}`, angle, length, typeRoll.type, now + index * 18));
  }

  branches.push(...made);

  if (influence.symmetryPower > 0 && made.length > 0) {
    const mirrorRoll = random(seed);
    seed = mirrorRoll.seed;
    if (mirrorRoll.value < 0.45 + influence.symmetryPower * 0.16) {
      const source = made[0];
      const mirrorParent = parent.id === "root" ? parent : { ...parent, x: -parent.x };
      branches.push(makeBranch(mirrorParent, `${source.id}-mirror`, source.angle, source.length, "lattice", now + 44, true));
    }
  }

  if (influence.recursivePower > 0 && made.length > 0 && branches.length < 240) {
    const source = made[made.length - 1];
    for (let index = 0; index < Math.min(3, influence.recursivePower + 1); index += 1) {
      const angle = source.angle + (Math.PI * 2 * index) / 3 + 0.28;
      branches.push(makeBranch(source, `${source.id}-mini-${index}`, angle, source.length * 0.28, "echo", now + 80 + index * 16));
    }
  }

  return { ...fractal, seed, branches: branches.slice(-240), lastAutoGrownAt: now };
}

export function collapseFractal(axioms: number, now = Date.now()): FractalState {
  const state = createInitialFractal(91357 + axioms * 7919, now);
  let result = state;
  for (let index = 0; index < Math.min(4, axioms); index += 1) {
    result = growFractal(result, ["axiom-seed"], "stabilize", now + index * 20);
  }
  return result;
}

export function repairFractalForNodeCount(fractal: FractalState, nodes: number, equippedFormulaIds: Array<string | null>): FractalState {
  let repaired = normalizeFractal(fractal);
  while (repaired.branches.length < Math.max(1, nodes)) {
    repaired = growFractal(repaired, equippedFormulaIds, "branch", Date.now());
  }
  return repaired;
}

export function normalizeFractal(fractal: FractalState | undefined): FractalState {
  const initial = createInitialFractal();
  if (!fractal?.branches?.length) return initial;

  return {
    seed: fractal.seed ?? initial.seed,
    growthCharge: fractal.growthCharge ?? initial.growthCharge,
    growthBias: fractal.growthBias ?? initial.growthBias,
    lastAutoGrownAt: fractal.lastAutoGrownAt ?? Date.now(),
    branches: fractal.branches.map((branch) => ({
      ...branch,
      startX: branch.startX ?? 0,
      startY: branch.startY ?? 0,
      endX: branch.endX ?? branch.x ?? 0,
      endY: branch.endY ?? branch.y ?? 0,
      x: branch.x ?? branch.endX ?? 0,
      y: branch.y ?? branch.endY ?? 0,
      growthProgress: branch.growthProgress ?? 1,
      mirrored: branch.mirrored ?? false,
    })),
  };
}
