import { getCoreComplexity } from "./coreBalancing";
import { CORE_DEFINITIONS } from "./coreDefinitions";
import type { CoreFractalType, CoreInstance, CoreTypeUpgrade } from "./coreTypes";
import type { FractalNodeType } from "./fractalTypes";
import { getCoreFormulaInfluence } from "./formulaInfluences";
import { getFractalWasmKernel } from "./fractalWasmKernel";

export type RenderBranch = {
  id: string;
  instanceId: string;
  parentId: string | null;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
  depth: number;
  thickness: number;
  type: FractalNodeType;
  mirrored: boolean;
};

export type RenderBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type GeneratedFractal = {
  branches: RenderBranch[];
  bounds: RenderBounds;
};

export type FractalGenerationOptions = {
  maxBranches?: number;
};

type FormulaInfluence = ReturnType<typeof getCoreFormulaInfluence>;

type FractalRuleContext = {
  fractalType: CoreFractalType;
  index: number;
  count: number;
  rollValue: number;
  jitterValue: number;
  baseAngle: number;
  influence: FormulaInfluence;
};

type FractalRuleResult = {
  angle: number;
  type: FractalNodeType;
  anchor?: "root";
  length?: number;
  continueAfterAdd?: boolean;
};

type ExtraBranchContext = {
  fractalType: CoreFractalType;
  index: number;
  rollValue: number;
  lengthBase: number;
  influence: FormulaInfluence;
};

type ExtraBranchSpec = {
  angleOffset: number;
  lengthMultiplier: number;
  type: FractalNodeType;
  mirrored?: boolean;
};

const BRANCH_CAP_BY_TYPE: Record<CoreFractalType, number> = {
  boundary: 170,
  cell: 130,
  crystal: 130,
  echo: 130,
  fern: 130,
  lightning: 80,
  mutation: 130,
  mycelium: 130,
  recursive: 150,
  root: 130,
  spiral: 130,
};

const FRACTAL_RULES: Record<CoreFractalType, (context: FractalRuleContext) => FractalRuleResult> = {
  boundary: ({ index, count }) => {
    const orbit = index / Math.max(1, count);
    return {
      angle: index * 0.31 + orbit * Math.PI * 2,
      type: index % 4 === 0 ? "lattice" : "echo",
      anchor: "root",
      length: 18 + orbit * 110,
      continueAfterAdd: true,
    };
  },
  cell: ({ index }) => ({
    angle: (index * 2.399963) % (Math.PI * 2),
    type: "root",
    anchor: "root",
    length: 8 + Math.ceil(Math.sqrt(index)) * 8,
    continueAfterAdd: true,
  }),
  crystal: ({ index, influence }) => {
    const spokes = 6 + Math.min(2, influence.crystalMirrorBonus);
    return {
      angle: (index % spokes) * (Math.PI * 2 / spokes) - Math.PI / 2 + Math.floor(index / spokes) * 0.08,
      type: "lattice",
    };
  },
  echo: ({ index, baseAngle }) => ({ angle: baseAngle + Math.sin(index * 1.7) * 0.28, type: "echo" }),
  fern: ({ index, baseAngle }) => ({ angle: baseAngle + (index % 3 - 1) * 0.38 + 0.12, type: "branch" }),
  lightning: ({ jitterValue, baseAngle }) => ({ angle: baseAngle + (jitterValue - 0.5) * 1.3, type: "mutation" }),
  mutation: ({ index, rollValue, baseAngle }) => ({
    angle: baseAngle + Math.sin(index * 3.7 + rollValue) * 0.95,
    type: index % 3 === 0 ? "mutation" : "branch",
  }),
  mycelium: ({ index, baseAngle }) => ({
    angle: baseAngle + Math.sin(index * 1.13) * 0.65,
    type: index % 5 === 0 ? "echo" : "branch",
  }),
  recursive: ({ index, baseAngle }) => ({
    angle: baseAngle + Math.sin(index * 0.7) * 0.42,
    type: index % 6 === 0 ? "echo" : index % 4 === 0 ? "lattice" : "branch",
  }),
  root: ({ baseAngle }) => ({ angle: baseAngle, type: "branch" }),
  spiral: ({ index, influence }) => ({
    angle: -Math.PI / 2 + index * (0.39 + influence.mutationPower * 0.025) + (index % 3) * 0.42,
    type: "spiral",
  }),
};

const EXTRA_BRANCH_RULES: Array<(context: ExtraBranchContext) => ExtraBranchSpec[]> = [
  ({ fractalType, index, influence }) =>
    (fractalType === "crystal" || influence.crystalMirrorBonus > 0) && index % 3 === 0
      ? [{ angleOffset: Number.NaN, lengthMultiplier: 0.82, type: "lattice", mirrored: true }]
      : [],
  ({ index, lengthBase, influence }) =>
    influence.recursiveMiniBranches > 0 && index % 7 === 0
      ? [
          { angleOffset: 1.9, lengthMultiplier: 0.28, type: "echo" },
          { angleOffset: -1.9, lengthMultiplier: 0.28, type: "echo" },
        ]
      : [],
  ({ fractalType, index }) => (fractalType === "echo" && index % 5 === 0 ? [{ angleOffset: 0.55, lengthMultiplier: 0.5, type: "echo", mirrored: true }] : []),
  ({ fractalType, index }) =>
    fractalType === "fern" && index % 4 === 0
      ? [
          { angleOffset: 0.72, lengthMultiplier: 0.42, type: "branch", mirrored: true },
          { angleOffset: -0.72, lengthMultiplier: 0.42, type: "branch", mirrored: true },
        ]
      : [],
  ({ fractalType, index }) =>
    fractalType === "recursive" && index % 6 === 0
      ? [
          { angleOffset: 1.15, lengthMultiplier: 0.35, type: "echo" },
          { angleOffset: -1.15, lengthMultiplier: 0.35, type: "lattice" },
        ]
      : [],
  ({ fractalType, index }) => (fractalType === "mycelium" && index % 6 === 0 ? [{ angleOffset: 2.3, lengthMultiplier: 0.22, type: "echo", mirrored: true }] : []),
  ({ fractalType, index, rollValue }) =>
    fractalType === "mutation" && index % 5 === 0
      ? [{ angleOffset: rollValue > 0.5 ? 2.7 : -2.7, lengthMultiplier: 0.48, type: "mutation", mirrored: true }]
      : [],
];

function rand(seed: number): { value: number; seed: number } {
  const kernel = getFractalWasmKernel();
  const next = kernel.nextSeed(seed);
  return { value: kernel.seedToUnit(next), seed: next };
}

function addBranch(
  branches: RenderBranch[],
  instance: CoreInstance,
  parent: RenderBranch,
  index: number,
  angle: number,
  length: number,
  type: FractalNodeType,
  mirrored = false,
) {
  const kernel = getFractalWasmKernel();
  branches.push({
    id: `${instance.id}-${index}${mirrored ? "-m" : ""}`,
    instanceId: instance.id,
    parentId: parent.id,
    startX: parent.endX,
    startY: parent.endY,
    endX: kernel.projectX(parent.endX, angle, length),
    endY: kernel.projectY(parent.endY, angle, length),
    angle,
    depth: parent.depth + 1,
    thickness: Math.max(1.1, parent.thickness * 0.76),
    type,
    mirrored,
  });
}

function getRenderBounds(branches: RenderBranch[]): RenderBounds {
  const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (const branch of branches) {
    bounds.minX = Math.min(bounds.minX, branch.startX, branch.endX);
    bounds.minY = Math.min(bounds.minY, branch.startY, branch.endY);
    bounds.maxX = Math.max(bounds.maxX, branch.startX, branch.endX);
    bounds.maxY = Math.max(bounds.maxY, branch.startY, branch.endY);
  }
  return bounds;
}

function chooseParent(branches: RenderBranch[], root: RenderBranch, rollValue: number): RenderBranch {
  if (branches.length <= 1) return root;
  const start = Math.min(branches.length - 1, Math.floor(Math.pow(rollValue, 0.45) * branches.length));
  for (let offset = 0; offset < branches.length; offset += 1) {
    const candidate = branches[(start + offset) % branches.length];
    if (candidate.depth < 8) return candidate;
  }
  return root;
}

function addExtraBranches(
  branches: RenderBranch[],
  instance: CoreInstance,
  root: RenderBranch,
  index: number,
  context: ExtraBranchContext,
): void {
  for (const rule of EXTRA_BRANCH_RULES) {
    const source = branches[branches.length - 1];
    for (const extra of rule(context)) {
      const angle = Number.isNaN(extra.angleOffset) ? Math.PI - source.angle : source.angle + extra.angleOffset;
      const parent = Number.isNaN(extra.angleOffset) ? root : source;
      addBranch(branches, instance, parent, index, angle, context.lengthBase * extra.lengthMultiplier, extra.type, extra.mirrored);
    }
  }
}

export function generateInstanceFractal(
  instance: CoreInstance,
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
  options: FractalGenerationOptions = {},
): GeneratedFractal {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const influence = getCoreFormulaInfluence(equippedFormulaIds);
  const complexity = getCoreComplexity(instance, upgrades);
  const defaultBranchCap = BRANCH_CAP_BY_TYPE[definition.fractalType];
  const branchCap = Math.min(defaultBranchCap, options.maxBranches ?? defaultBranchCap);
  const count = Math.max(0, Math.min(complexity, instance.currentBuiltBranches, branchCap));
  const root: RenderBranch = {
    id: `${instance.id}-root`,
    instanceId: instance.id,
    parentId: null,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    angle: -Math.PI / 2,
    depth: 0,
    thickness: 9,
    type: "root",
    mirrored: false,
  };
  const branches = [root];
  let seed = instance.currentSeed || 1;

  for (let index = 1; index <= count; index += 1) {
    const roll = rand(seed);
    seed = roll.seed;
    const parent = chooseParent(branches, root, roll.value);
    const lengthBase = 20 + Math.max(0, 7 - parent.depth) * 3.4;
    const jitterRoll = rand(seed);
    seed = jitterRoll.seed;
    const baseAngle = parent.angle + (index % 2 === 0 ? 1 : -1) * (0.36 + roll.value * 0.56) + (jitterRoll.value - 0.5) * 0.55;
    const rule = FRACTAL_RULES[definition.fractalType]({
      fractalType: definition.fractalType,
      index,
      count,
      rollValue: roll.value,
      jitterValue: jitterRoll.value,
      baseAngle,
      influence,
    });

    const branchParent = rule.anchor === "root" ? root : parent;
    addBranch(branches, instance, branchParent, index, rule.angle, rule.length ?? lengthBase, rule.type);
    if (rule.continueAfterAdd) continue;

    addExtraBranches(branches, instance, root, index, {
      fractalType: definition.fractalType,
      index,
      rollValue: roll.value,
      lengthBase,
      influence,
    });
  }

  return { branches, bounds: getRenderBounds(branches) };
}

export function generateInstanceBranches(
  instance: CoreInstance,
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
): RenderBranch[] {
  return generateInstanceFractal(instance, upgrades, equippedFormulaIds).branches;
}
