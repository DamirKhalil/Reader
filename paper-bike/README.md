# Paper Bike — cut-paper bicycle commercial

Remotion composition `PaperBikeCommercial`: 3840×2160, 60 fps, 1200 frames (20 s), full-frame and opaque.

| Scene | Frames | What happens |
|---|---|---|
| 1 · The Build | 0–299 | Bike parts fly onto a taped kraft cutting mat and press into place; "PIECE BY PIECE" in paper letter chips |
| 2 · The Ride | 300–659 | Rider pedals through a parallax paper landscape (hung clouds, mountains, hills, trees, road, flowers); hanging banner |
| 3 · The Details | 660–959 | Three close-ups that slide in like new sheets: chainring + chain, tyre tread, hand-brazed frame |
| 4 · Get Out and Ride | 960–1199 | Rider brakes in on a sunburst, "GET OUT AND RIDE." chips, FOLDWORKS lockup, confetti |

Torn paper sheets wipe across each cut.

## The paper look
Everything is SVG drawn in a 1920×1080 design space and scaled to 4K (`src/paper/paper.tsx`):
- `#paper` / `#lift` filters: turbulence-displaced edges (scissor-cut) + offset soft shadows (pieces on the table vs. floating above it)
- `#grain`: paper fibre and tooth multiplied over the whole frame, plus a lamp vignette
- Stop-motion cadence: poses held for 4 frames (15 poses/s) via `usePaperFrame()`, with per-pose hand-placement `jitter()` and exposure flicker

## Commands
```
npm i
npx remotion studio                                   # preview
npx remotion render PaperBikeCommercial out/paper-bike-4k.mp4
```
Fonts (Archivo Black, Patrick Hand; SIL OFL) are bundled in `public/fonts`, so rendering needs no network.
