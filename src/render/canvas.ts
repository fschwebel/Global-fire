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

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private terrainDirty = true;

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

  draw(selectedTruckId: number | null): void {
    if (this.terrainDirty) this.bakeTerrain();
    const s = this.state;
    const ctx = this.ctx;
    ctx.drawImage(this.terrain, 0, 0);

    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const c = s.grid[idx(s, x, y)]!;
        const px = x * TILE;
        const py = y * TILE;
        if (c.state === 'burnt') {
          ctx.fillStyle = 'rgba(30, 22, 18, 0.88)';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = 'rgba(80, 60, 50, 0.5)';
          ctx.beginPath();
          ctx.moveTo(px + 2, py + 2);
          ctx.lineTo(px + TILE - 2, py + TILE - 2);
          ctx.stroke();
        } else if (c.state === 'burning') {
          if (c.detected) {
            const t = Math.min(c.intensity / 9, 1);
            const r = Math.round(211 + t * 44);
            const g = Math.round(120 - t * 70);
            ctx.fillStyle = `rgb(${r}, ${g}, 20)`;
            ctx.fillRect(px, py, TILE, TILE);
            // Flame flicker core.
            ctx.fillStyle = 'rgba(255, 220, 100, 0.8)';
            const wob = ((x * 7 + y * 13 + s.tick) % 3) - 1;
            ctx.fillRect(px + 6 + wob, py + 4, TILE - 12, TILE - 8);
          } else {
            // Undetected: only a faint smoke hint over normal terrain.
            ctx.fillStyle = 'rgba(120, 120, 120, 0.45)';
            ctx.beginPath();
            ctx.arc(px + TILE / 2, py + TILE / 2, 5 + ((s.tick + x) % 3), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (c.wetTimer > 0 && c.state === 'unburnt') {
          ctx.fillStyle = 'rgba(80, 140, 220, 0.3)';
          ctx.fillRect(px, py, TILE, TILE);
        }
      }

    for (const t of s.trucks) {
      const px = t.x * TILE;
      const py = t.y * TILE;
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
      ctx.fillRect(px + 3, py + TILE - 4, (TILE - 6) * (t.water / 24), 3);
    }
  }
}
