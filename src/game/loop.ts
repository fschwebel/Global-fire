import { TICK_MS } from '../sim/balance';
import type { Command, GameEvent, GameState } from '../sim/state';
import { step } from '../sim/step';

/** Fixed-timestep accumulator loop: sim at 2 Hz, render at display rate. */
export class GameLoop {
  speed = 1; // 0 = paused, 1, 2
  private acc = 0;
  private last = 0;
  private queue: Command[] = [];

  constructor(
    private state: GameState,
    private onEvents: (events: GameEvent[]) => void,
    private onFrame: () => void,
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
      this.onFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
