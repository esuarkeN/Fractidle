export type FractalWasmKernel = {
  nextSeed(seed: number): number;
  seedToUnit(seed: number): number;
  projectX(startX: number, angle: number, length: number): number;
  projectY(startY: number, angle: number, length: number): number;
};

const BYTES = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 23, 4, 96, 1, 124, 1, 124, 96, 1, 127, 1, 127, 96, 3, 124, 124, 124,
  1, 124, 96, 1, 127, 1, 124, 2, 21, 2, 3, 101, 110, 118, 3, 99, 111, 115, 0, 0, 3, 101, 110, 118, 3,
  115, 105, 110, 0, 0, 3, 5, 4, 1, 2, 2, 3, 7, 47, 4, 8, 110, 101, 120, 116, 83, 101, 101, 100, 0, 2,
  8, 112, 114, 111, 106, 101, 99, 116, 88, 0, 3, 8, 112, 114, 111, 106, 101, 99, 116, 89, 0, 4, 10,
  115, 101, 101, 100, 84, 111, 85, 110, 105, 116, 0, 5, 10, 60, 4, 16, 0, 32, 0, 65, 141, 204, 101, 108,
  65, 223, 230, 187, 227, 3, 106, 11, 12, 0, 32, 0, 32, 1, 16, 0, 32, 2, 162, 160, 11, 12, 0, 32, 0,
  32, 1, 16, 1, 32, 2, 162, 160, 11, 15, 0, 32, 0, 184, 68, 0, 0, 0, 0, 0, 0, 240, 65, 163, 11,
]);

let cachedKernel: FractalWasmKernel | null | undefined;

function createFallbackKernel(): FractalWasmKernel {
  return {
    nextSeed: (seed) => (seed * 1664525 + 1013904223) >>> 0,
    seedToUnit: (seed) => (seed >>> 0) / 4294967296,
    projectX: (startX, angle, length) => startX + Math.cos(angle) * length,
    projectY: (startY, angle, length) => startY + Math.sin(angle) * length,
  };
}

function createWasmKernel(): FractalWasmKernel | null {
  if (typeof WebAssembly === "undefined") return null;
  try {
    const module = new WebAssembly.Module(BYTES);
    const instance = new WebAssembly.Instance(module, { env: { cos: Math.cos, sin: Math.sin } });
    const exports = instance.exports as unknown as FractalWasmKernel;
    return {
      nextSeed: (seed) => exports.nextSeed(seed) >>> 0,
      seedToUnit: (seed) => exports.seedToUnit(seed),
      projectX: exports.projectX,
      projectY: exports.projectY,
    };
  } catch {
    return null;
  }
}

export function getFractalWasmKernel(): FractalWasmKernel {
  cachedKernel ??= createWasmKernel() ?? createFallbackKernel();
  return cachedKernel;
}
