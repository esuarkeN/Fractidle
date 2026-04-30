export type GrowthMode = "branch" | "pattern" | "stabilize";

export type FractalNodeType = "root" | "branch" | "spiral" | "lattice" | "echo" | "mutation";

export type FractalBranch = {
  id: string;
  parentId: string | null;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  depth: number;
  thickness: number;
  type: FractalNodeType;
  createdAt: number;
  growthProgress: number;
  mirrored: boolean;
  patternGroup?: string;
};

export type FractalState = {
  branches: FractalBranch[];
  seed: number;
  growthCharge: number;
  growthBias: GrowthMode;
  lastAutoGrownAt: number;
};
