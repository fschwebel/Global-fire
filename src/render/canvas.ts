import { bomber as B, regrowth as RG, truck as T, tower as TW } from '../sim/balance';
import type { GameState, TileType } from '../sim/state';
import { idx } from '../sim/state';

export const TILE = 20;

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

/**
 * Pixel position of a ground unit in world space, interpolated along the tiles
 * it traversed during the current tick — units drive instead of teleporting.
 */
function truckPixelPos(
  t: { x: number; y: number; trail: { x: number; y: number }[] },
  alpha: number,
): { px: number; py: number } {
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

/** Renders the active sector crop of the world grid. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private terrainDirty = true;
  /** First-seen times for burning/burnt cells — drives short fade-ins. */
  private seenBurning = new Map<number, number>();
  private seenBurnt = new Map<number, number>();
  /** Smoothed opacity of the rain overlay (fades showers in and out). */
  private rainAlpha = 0;
  /** Animation clock: advances only while the sim runs, so pause freezes the scene. */
  private animTime = 0;
  private lastDrawAt = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    private state: GameState,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.terrain = document.createElement('canvas');
    this.resize();
  }

  /** Sector width/height in pixels (the canvas size). */
  private resize(): void {
    const b = this.state.bounds;
    this.canvas.width = (b.x1 - b.x0) * TILE;
    this.canvas.height = (b.y1 - b.y0) * TILE;
    this.terrain.width = this.canvas.width;
    this.terrain.height = this.canvas.height;
    this.terrainDirty = true;
  }

  setState(state: GameState): void {
    this.state = state;
    this.resize();
    this.seenBurning.clear();
    this.seenBurnt.clear();
  }

  /** Bake all static tiles once; only dynamic cells draw per frame. */
  private bakeTerrain(): void {
    const tctx = this.terrain.getContext('2d');
    if (!tctx) return;
    const s = this.state;
    const b = s.bounds;
    for (let y = b.y0; y < b.y1; y++)
      for (let x = b.x0; x < b.x1; x++) {
        const c = s.grid[idx(s, x, y)]!;
        const px = (x - b.x0) * TILE;
        const py = (y - b.y0) * TILE;
        tctx.fillStyle = TERRAIN[c.type];
        tctx.fillRect(px, py, TILE, TILE);
        if (c.type === 'house') {
          tctx.fillStyle = '#8a5a2b';
          tctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 10);
        }
        // Old burn scars: ash-grey shadow that fades over the years.
        if (c.burntYear > 0 && s.seasonYear - c.burntYear <= RG.scarVisibleYears) {
          const age = s.seasonYear - c.burntYear;
          tctx.fillStyle = `rgba(40, 32, 28, ${Math.max(0.08, 0.3 - age * 0.028)})`;
          tctx.fillRect(px, py, TILE, TILE);
        }
      }
    // Station marker.
    const sx = (s.station.x - b.x0) * TILE;
    const sy = (s.station.y - b.y0) * TILE;
    tctx.fillStyle = '#c62828';
    tctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
    tctx.fillStyle = '#fff';
    tctx.fillRect(sx + 8, sy + 6, 4, TILE - 12);
    this.terrainDirty = false;
  }

  draw(selectedTruckId: number | null, alpha = 1, running = true): void {
    if (this.terrainDirty) this.bakeTerrain();
    const s = this.state;
    const b = s.bounds;
    const ox = b.x0 * TILE;
    const oy = b.y0 * TILE;
    const ctx = this.ctx;
    const realNow = performance.now();
    if (running) this.animTime += Math.min(realNow - this.lastDrawAt, 100);
    this.lastDrawAt = realNow;
    const now = this.animTime;
    const frame = Math.floor(now / 130); // flicker clock, independent of sim ticks, frozen on pause
    ctx.drawImage(this.terrain, 0, 0);

    for (let y = b.y0; y < b.y1; y++)
      for (let x = b.x0; x < b.x1; x++) {
        const i = idx(s, x, y);
        const c = s.grid[i]!;
        const px = (x - b.x0) * TILE;
        const py = (y - b.y0) * TILE;
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
      const fx = t.target.x * TILE - ox;
      const fy = t.target.y * TILE - oy;
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
      const px = pos.px - ox + (stacked ? 5 : 0);
      const py = pos.py - oy + (stacked ? 5 : 0);
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

    // Evacuations: a ring around the village — amber while moving, grey once clear.
    for (const v of s.villages) {
      if (v.evac === 'none') continue;
      const vx = (v.x + 0.5) * TILE - ox;
      const vy = (v.y + 0.5) * TILE - oy;
      const pulsing = v.evac === 'inProgress';
      ctx.strokeStyle = pulsing
        ? `rgba(255, 179, 0, ${0.55 + 0.35 * Math.sin(now / 220)})`
        : 'rgba(220, 220, 220, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(vx, vy, 4.2 * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Watch towers: mast + a faint ring showing the detection radius.
    for (const tw of s.towers) {
      const px = tw.x * TILE - ox;
      const py = tw.y * TILE - oy;
      ctx.strokeStyle = 'rgba(232, 228, 218, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, TW.radius * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#4e5d6b';
      ctx.fillRect(px + 7, py + 4, 6, TILE - 6);
      ctx.fillStyle = '#dce6f0';
      ctx.fillRect(px + 5, py + 3, 10, 5);
    }

    // Fire crews: hi-vis ground unit + markers on the queued cut line.
    for (const c of s.crews) {
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.6)';
      ctx.lineWidth = 1.5;
      for (const job of c.jobs) {
        const jx = job.x * TILE - ox;
        const jy = job.y * TILE - oy;
        ctx.strokeRect(jx + 5, jy + 5, TILE - 10, TILE - 10);
      }
      const pos = truckPixelPos(c, alpha);
      const px = pos.px - ox;
      const py = pos.py - oy;
      ctx.fillStyle = '#fdd835';
      ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
    }

    // Water bombers: airborne between station and target; water sheet on the drop.
    for (const b of s.bombers) {
      if (b.state === 'ready' || b.state === 'reloading') continue; // at the airbase
      if (b.state === 'dropping' && b.target) {
        const tx = (b.target.x + 0.5) * TILE - ox;
        const ty = (b.target.y + 0.5) * TILE - oy;
        ctx.fillStyle = 'rgba(80, 150, 230, 0.35)';
        ctx.beginPath();
        ctx.arc(tx, ty, B.dropRadius * TILE, 0, Math.PI * 2);
        ctx.fill();
      }
      const fx = (b.px + (b.x - b.px) * alpha + 0.5) * TILE - ox;
      const fy = (b.py + (b.y - b.py) * alpha + 0.5) * TILE - oy;
      const to = b.state === 'returning' ? s.station : (b.target ?? s.station);
      const ang = Math.atan2(to.y - b.y, to.x - b.x);
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(ang);
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-3, -10, 5, 20); // wings
      ctx.fillStyle = '#c62828';
      ctx.fillRect(-8, -3, 4, 6); // tail
      ctx.restore();
      // Shadow hint so the plane reads as airborne.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(fx + 6, fy + 10, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (running) this.rainAlpha += ((s.rainTicks > 0 ? 1 : 0) - this.rainAlpha) * 0.06;
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
