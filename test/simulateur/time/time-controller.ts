import { setTimeout as sleep } from 'node:timers/promises';
import type { TimeMode } from '../config';

export class TimeController {
  private cursorMs: number;

  constructor(
    private readonly mode: TimeMode,
    private readonly scale: number,
    startIso: string,
  ) {
    this.cursorMs = new Date(startIso).getTime();
  }

  now(): Date {
    return new Date(this.cursorMs);
  }

  async waitUntil(targetIso: string): Promise<void> {
    const targetMs = new Date(targetIso).getTime();
    if (targetMs <= this.cursorMs) return;

    if (this.mode === 'immediate') {
      this.cursorMs = targetMs;
      return;
    }

    if (this.mode === 'accelerated') {
      const delta = targetMs - this.cursorMs;
      const waitMs = Math.max(1, Math.floor(delta / Math.max(this.scale, 1)));
      await sleep(waitMs);
      this.cursorMs = targetMs;
      return;
    }

    const realNow = Date.now();
    const waitMs = Math.max(0, targetMs - realNow);
    if (waitMs > 0) await sleep(waitMs);
    this.cursorMs = targetMs;
  }

  async waitMinutes(minutes: number): Promise<void> {
    const target = new Date(this.cursorMs + minutes * 60_000).toISOString();
    await this.waitUntil(target);
  }
}

