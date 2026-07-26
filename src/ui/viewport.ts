const DRAG_THRESHOLD_PX = 8;

/**
 * Pan/zoom for the map canvas inside its clipping container: drag or
 * single-finger pan, pinch or wheel zoom (about the pointer), clamped so the
 * map always covers the container (centered when smaller). Taps are
 * distinguished from drags so panning never fires a dispatch.
 */
export class MapViewport {
  private zoom = 1;
  private tx = 0;
  private ty = 0;
  private fit = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private dragged = false;
  private downDistance = 0;

  private baseW: number;
  private baseH: number;

  constructor(
    private container: HTMLElement,
    private canvas: HTMLCanvasElement,
    baseW: number,
    baseH: number,
  ) {
    this.baseW = baseW;
    this.baseH = baseH;
    canvas.style.transformOrigin = '0 0';
    new ResizeObserver(() => this.refit()).observe(container);
    this.refit();

    container.addEventListener('pointerdown', (e) => {
      container.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.downDistance = 0;
        // A fresh gesture: a stale drag flag (pinch, gutter release) must not
        // swallow this tap if it turns out to be one.
        this.dragged = false;
      }
      if (this.pointers.size === 2) this.pinchDist = this.pinchDistance();
    });
    container.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.downDistance += Math.hypot(dx, dy);
        if (this.downDistance > DRAG_THRESHOLD_PX) this.dragged = true;
        if (this.dragged) {
          this.tx += dx;
          this.ty += dy;
          this.clampAndApply();
        }
      } else if (this.pointers.size === 2) {
        const dist = this.pinchDistance();
        if (this.pinchDist > 0 && dist > 0) {
          const mid = this.pinchMid();
          this.zoomAt(dist / this.pinchDist, mid.x, mid.y);
          this.dragged = true;
        }
        this.pinchDist = dist;
      }
    });
    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
    };
    container.addEventListener('pointerup', release);
    container.addEventListener('pointercancel', release);

    container.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        this.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
      },
      { passive: false },
    );
  }

  /** The map (sector) changed size — reset zoom and refit. */
  setBase(w: number, h: number): void {
    this.baseW = w;
    this.baseH = h;
    this.zoom = 1;
    this.refit();
  }

  /** True (and resets) when the pointer sequence that just ended was a pan/pinch, not a tap. */
  consumeDragged(): boolean {
    const was = this.dragged;
    if (this.pointers.size === 0) this.dragged = false;
    return was;
  }

  private scale(): number {
    return this.fit * this.zoom;
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private pinchMid(): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return { x: rect.width / 2, y: rect.height / 2 };
    return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
  }

  /** Zoom by `factor` keeping the container-space point (cx, cy) fixed. */
  private zoomAt(factor: number, cx: number, cy: number): void {
    const oldScale = this.scale();
    this.zoom = Math.min(4, Math.max(1, this.zoom * factor));
    const newScale = this.scale();
    this.tx = cx - ((cx - this.tx) / oldScale) * newScale;
    this.ty = cy - ((cy - this.ty) / oldScale) * newScale;
    this.clampAndApply();
  }

  private refit(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.fit = Math.min(rect.width / this.baseW, rect.height / this.baseH);
    this.clampAndApply();
  }

  private clampAndApply(): void {
    const rect = this.container.getBoundingClientRect();
    const s = this.scale();
    const mw = this.baseW * s;
    const mh = this.baseH * s;
    this.tx =
      mw <= rect.width ? (rect.width - mw) / 2 : Math.min(0, Math.max(rect.width - mw, this.tx));
    this.ty =
      mh <= rect.height ? (rect.height - mh) / 2 : Math.min(0, Math.max(rect.height - mh, this.ty));
    this.canvas.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${s})`;
  }
}
