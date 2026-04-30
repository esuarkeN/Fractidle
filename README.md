# Recursive Bloom

An MVP idle game about a living fractal that grows through equipped formulas.

## Setup

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Notes

- Saves are stored in `localStorage` under `recursive-bloom-save-v1`.
- Game balance lives in `src/game/balancing.ts`.
- Formula content lives in `src/game/formulas.ts`.
- Production and prestige math lives in `src/game/simulation.ts`.
