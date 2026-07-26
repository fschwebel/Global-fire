import { truck as T } from '../sim/balance';
import type { GameState, TileType, Truck } from '../sim/state';
import { idx } from '../sim/state';

export const TILE = 20;

/**
 * Pixel position of an engine, interpolated along the tiles it traversed
 * during the current tick — engines drive corner-by-corner instead of teleporting.
 */
function truckPixelPos(t: Truck, alpha: number): { px: number; py: number } {
  const trail = t.trail;
  if (!trail || trail.length <= 1) return { px: t.x * TILE, py: t.y * TILE };
  const segs = trail.length - 1;
  const d = Math.min(alpha, 1) * segs;
  const i = Math.min(Math.floor(d), segs - 1);
  const f = d - i;
  const a = trail[i]!;
  const b = trail[i + 1]!;
  return { px: (a.x + (b.x - a.x) * f) * TILE, py: (a.y + (b.y - a.y) * f) * TILE };
}

const TERRAIN: Record<TileType, string> = {
  dense: '#1b5e20',
  sparse: '#3f8a3f',
  grass: '#9ccc65',
  water: '#4a90d9',
  road: '#b0a08a',
  house: '#c98a4b',
  firebreak: '#8d6e63',
  rock: '#8f948d',
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private terrainDirty = true;
  /** First-seen times for burning/burnt cells — drives short fade-ins. */
  private seenBurning = new Map<number, number>();
  private seenBurnt = new Map<number, number>();
  /** Smoothed opacity of the rain overlay (fades showers in and out). */
  private rainAlpha = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private state: GameState,
  ) {
    canvas.width = state.w * TILE;
    canvas.height = state.h * TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.terrain = document.createElement('canvas');
    this.terrain.width = canvas.width;
    this.terrain.height = canvas.height;
  }

  setState(state: GameState): void {
    this.state = state;
    this.terrainDirty = true;
    this.seenBurning.clear();
    this.seenBurnt.clear();
  }

  /** Bake all static tiles once; only dynamic cells draw per frame. */
  private bakeTerrain(): void {
    const tctx = this.terrain.getContext('2d');
    if (!tctx) return;
    const s = this.state;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const c = s.grid[idx(s, x, y)]!;
        tctx.fillStyle = TERRAIN[c.type];
        tctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (c.type === 'house') {
          tctx.fillStyle = '#8a5a2b';
          tctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 10);
        }
      }
    // Station marker.
    tctx.fillStyle = '#c62828';
    tctx.fillRect(s.station.x * TILE + 4, s.station.y * TILE + 4, TILE - 8, TILE - 8);
    tctx.fillStyle = '#fff';
    tctx.fillRect(s.station.x * TILE + 8, s.station.y * TILE + 6, 4, TILE - 12);
    this.terrainDirty = false;
  }

  draw(selectedTruckId: number | null, alpha = 1): void {
    if (this.terrainDirty) this.bakeTerrain();
    const s = this.state;
    const ctx = this.ctx;
    const now = performance.now();
    const frame = Math.floor(now / 130); // per-frame flicker clock, independent of sim ticks
    ctx.drawImage(this.terrain, 0, 0);

    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const i = idx(s, x, y);
        const c = s.grid[i]!;
        const px = x * TILE;
        const py = y * TILE;
        if (c.state !== 'burning') this.seenBurning.delete(i);
        if (c.state !== 'burnt') this.seenBurnt.delete(i);
        if (c.state === 'burnt') {
          let t0 = this.seenBurnt.get(i);
          if (t0 === undefined) {
            t0 = now;
            this.seenBurnt.set(i, now);
          }
          ctx.globalAlpha = Math.min(1, (now - t0) / 600);
          ctx.fillStyle = 'rgba(30, 22, 18, 0.88)';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = 'rgba(80, 60, 50, 0.5)';
          ctx.beginPath();
          ctx.moveTo(px + 2, py + 2);
          ctx.lineTo(px + TILE - 2, py + TILE - 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (c.state === 'burning') {
          let t0 = this.seenBurning.get(i);
          if (t0 === undefined) {
            t0 = now;
            this.seenBurning.set(i, now);
          }
          ctx.globalAlpha = Math.min(1, (now - t0) / 350);
          if (c.detected) {
            const t = Math.min(c.intensity / 9, 1);
            const r = Math.round(211 + t * 44);
            const g = Math.round(120 - t * 70);
            ctx.fillStyle = `rgb(${r}, ${g}, 20)`;
            ctx.fillRect(px, py, TILE, TILE);
            // Flame flicker core, animated at render rate.
            ctx.fillStyle = 'rgba(255, 220, 100, 0.8)';
            const wob = ((x * 7 + y * 13 + frame) % 3) - 1;
            ctx.fillRect(px + 6 + wob, py + 4, TILE - 12, TILE - 8);
          } else {
            // Undetected: only a faint smoke hint over normal terrain.
            ctx.fillStyle = 'rgba(120, 120, 120, 0.45)';
            ctx.beginPath();
            ctx.arc(px + TILE / 2, py + TILE / 2, 5 + ((frame + x) % 3), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (c.wetTimer > 0 && c.state === 'unburnt') {
          ctx.fillStyle = 'rgba(80, 140, 220, 0.3)';
          ctx.fillRect(px, py, TILE, TILE);
        }
      }

    // Destination flags for engines en route.
    for (const t of s.trucks) {
      if (!t.target) continue;
      const fx = t.target.x * TILE;
      const fy = t.target.y * TILE;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx + 6, fy + TILE - 4);
      ctx.lineTo(fx + 6, fy + 4);
      ctx.lineTo(fx + TILE - 5, fy + 7);
      ctx.lineTo(fx + 6, fy + 10);
      ctx.stroke();
    }

    const seen = new Set<string>();
    for (const t of s.trucks) {
      const pos = truckPixelPos(t, alpha);
      // Offset stacked engines so both stay visible and clickable.
      const key = `${Math.round(pos.px)},${Math.round(pos.py)}`;
      const stacked = seen.has(key);
      seen.add(key);
      const px = pos.px + (stacked ? 5 : 0);
      const py = pos.py + (stacked ? 5 : 0);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(px + 3, py + 5, TILE - 6, TILE - 10);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 5, py + 8, TILE - 10, 3);
      if (t.id === selectedTruckId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      }
      // Water bar.
      ctx.fillStyle = '#222';
      ctx.fillRect(px + 3, py + TILE - 4, TILE - 6, 3);
      ctx.fillStyle = '#4a90d9';
      ctx.fillRect(px + 3, py + TILE - 4, (TILE - 6) * (t.water / T.waterCapacity), 3);
    }

    this.rainAlpha += ((s.rainTicks > 0 ? 1 : 0) - this.rainAlpha) * 0.06;
    if (this.rainAlpha > 0.02) this.drawRain(now);
  }

  /**
   * Oblique rain: streaks fall along their velocity vector (gravity + wind),
   * so they lean with the wind's horizontal component; two depth layers.
   */
  private drawRain(now: number): void {
    const ctx = this.ctx;
    const s = this.state;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.globalAlpha = this.rainAlpha;

    // Cool grey wash while the shower passes.
    ctx.fillStyle = 'rgba(90, 110, 140, 0.16)';
    ctx.fillRect(0, 0, W, H);

    const windX = Math.cos(s.wind.dir) * (5 + s.wind.str * 14);
    const layers = [
      { count: 90, len: 15, speed: 0.6, width: 1.3, alpha: 0.5 },
      { count: 90, len: 9, speed: 0.38, width: 1, alpha: 0.28 },
    ];
    const span = W + 160;
    for (const layer of layers) {
      const slant = windX * (layer.len / 15);
      ctx.strokeStyle = `rgba(200, 215, 235, ${layer.alpha})`;
      ctx.lineWidth = layer.width;
      ctx.beginPath();
      for (let i = 0; i < layer.count; i++) {
        const a = (((i * 2654435761) >>> 0) % 100000) / 100000;
        const b = (((i * 40503 + 12345) >>> 0) % 100000) / 100000;
        const period = H + 80;
        const y = ((b * period + now * layer.speed * (0.8 + a * 0.4)) % period) - 60;
        // Horizontal drift follows the fall so the whole streak field leans coherently.
        const drift = ((y + 60) / layer.len) * slant;
        const x = ((((a * span + drift) % span) + span) % span) - 80;
        ctx.moveTo(x, y);
        ctx.lineTo(x + slant, y + layer.len);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
