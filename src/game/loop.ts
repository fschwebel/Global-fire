import { TICK_MS } from '../sim/balance';
import type { Command, GameEvent, GameState } from '../sim/state';
import { step } from '../sim/step';

/**
 * Fixed-timestep accumulator loop: sim at 2 Hz, render at display rate.
 * Each frame receives alpha ∈ [0,1] — progress through the current tick —
 * so the renderer can interpolate sprite motion between sim states.
 */
export class GameLoop {
  speed = 1; // 0 = paused, 1 = playing
  private acc = 0;
  private last = 0;
  private queue: Command[] = [];

  constructor(
    private state: GameState,
    private onEvents: (events: GameEvent[]) => void,
    private onFrame: (alpha: number) => void,
  ) {}

  setState(state: GameState): void {
    this.state = state;
    this.acc = 0;
    this.queue = [];
  }

  enqueue(cmd: Command): void {
    this.queue.push(cmd);
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.acc += (now - this.last) * this.speed;
      this.last = now;
      let guard = 0;
      while (this.acc >= TICK_MS && guard++ < 8) {
        const events = step(this.state, this.queue.splice(0));
        if (events.length > 0) this.onEvents(events);
        this.acc -= TICK_MS;
      }
      if (this.acc > TICK_MS * 8) this.acc = 0;
      this.onFrame(Math.min(1, this.acc / TICK_MS));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
