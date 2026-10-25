/**
 * Runs the latest task per key at most once every `intervalMs`: the first
 * call runs at once, calls during the pause replace each other and the last
 * one runs when the pause ends. So a moving fader sends ~30 values a second
 * and its final value always gets through.
 */
export class Throttle {
  private readonly pausing = new Map<string, { pending?: () => void }>();

  constructor(private readonly intervalMs: number) {}

  run(key: string, task: () => void): void {
    const slot = this.pausing.get(key);
    if (slot !== undefined) {
      slot.pending = task;
      return;
    }
    this.start(key, task);
  }

  private start(key: string, task: () => void): void {
    const slot: { pending?: () => void } = {};
    this.pausing.set(key, slot);
    task();
    setTimeout(() => {
      this.pausing.delete(key);
      if (slot.pending !== undefined) this.start(key, slot.pending);
    }, this.intervalMs);
  }
}
