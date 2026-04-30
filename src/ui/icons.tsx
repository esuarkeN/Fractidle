import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpCircle,
  Atom,
  Biohazard,
  Bot,
  Boxes,
  BrainCircuit,
  CircuitBoard,
  CircleDotDashed,
  CopyPlus,
  Diamond,
  Dna,
  Droplets,
  Fingerprint,
  FlaskConical,
  Gauge,
  GitBranch,
  GitBranchPlus,
  Grid3X3,
  HelpCircle,
  Leaf,
  Lock,
  LockOpen,
  Microscope,
  Orbit,
  Radiation,
  Repeat2,
  RotateCw,
  RotateCcw,
  Save,
  ScanLine,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  TestTube,
  TrendingUp,
  TriangleAlert,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import type { CoreFractalType, CoreLayerId } from "../game/coreTypes";
import type { FormulaTag } from "../game/types";

export const ResourceIcons = {
  essence: FlaskConical,
  extraction: Activity,
  patterns: Dna,
  mutations: Atom,
  chamber: Grid3X3,
  instability: TriangleAlert,
} satisfies Record<string, LucideIcon>;

export const StatusIcons = {
  stable: ShieldCheck,
  growing: Activity,
  mutating: Biohazard,
  locked: Lock,
  new: Sparkles,
  warning: TriangleAlert,
  complete: ShieldCheck,
} satisfies Record<string, LucideIcon>;

export const SystemIcons = {
  geneLibrary: Dna,
  activeGenome: Workflow,
  cultures: TestTube,
  chambers: Boxes,
  research: Microscope,
  stableMutations: ShieldCheck,
  collapse: CircleDotDashed,
  settings: SlidersHorizontal,
  save: Save,
  reset: RotateCcw,
  help: HelpCircle,
} satisfies Record<string, LucideIcon>;

export const ActionIcons = {
  clone: CopyPlus,
  start: FlaskConical,
  sequence: Dna,
  growth: Gauge,
  extraction: TrendingUp,
  stabilize: Shield,
  mutation: Biohazard,
  splice: GitBranchPlus,
  remove: XCircle,
  unlock: LockOpen,
  locked: Lock,
  upgrade: ArrowUpCircle,
} satisfies Record<string, LucideIcon>;

export const GeneIcons: Record<FormulaTag, LucideIcon> = {
  cell: Sprout,
  branch: GitBranch,
  pattern: Fingerprint,
  symmetry: ScanLine,
  spiral: RotateCw,
  nested: Repeat2,
  mirror: CircuitBoard,
  core: FlaskConical,
  collapse: Orbit,
};

export const ChamberIcons: Record<Exclude<CoreLayerId, "all">, LucideIcon> = {
  "root-grove": Sprout,
  spiralarium: Dna,
  "crystal-lattice": Diamond,
  "echo-field": BrainCircuit,
  "verdant-plane": Leaf,
  "storm-plane": Zap,
  "inner-worlds": Repeat2,
  "entropy-rift": Biohazard,
  "infinite-boundary": Orbit,
};

export const StrainIcons: Record<CoreFractalType, LucideIcon> = {
  root: Sprout,
  cell: CircleDotDashed,
  mycelium: GitBranch,
  spiral: RotateCw,
  crystal: Diamond,
  echo: BrainCircuit,
  fern: Leaf,
  lightning: Zap,
  recursive: Repeat2,
  mutation: Radiation,
  boundary: Orbit,
};

export function iconForResearch(category: string): LucideIcon {
  if (category === "culture") return TestTube;
  if (category === "genes") return Dna;
  if (category === "extraction") return Droplets;
  if (category === "chambers") return Boxes;
  if (category === "recursive") return Repeat2;
  if (category === "mutation") return Biohazard;
  if (category === "automation") return Bot;
  return ShieldCheck;
}
