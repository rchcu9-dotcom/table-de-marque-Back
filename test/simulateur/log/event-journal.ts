import fs from 'node:fs';
import path from 'node:path';
import type { SimEvent } from '../types';
import { eventTypePriority } from './event-priority';
import { normalizeUtcIso } from '../utils/tournament-datetime';

export class EventJournal {
  private seq = 0;
  private readonly seen = new Set<string>();

  constructor(private readonly reportDir: string) {}

  hydrate(events: SimEvent[]): void {
    let maxSeq = 0;
    for (const event of events) {
      this.seen.add(event.id);
      if (event.sequence > maxSeq) maxSeq = event.sequence;
    }
    this.seq = maxSeq;
  }

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq.toString().padStart(6, '0')}`;
  }

  currentSequence(): number {
    return this.seq;
  }

  push(events: SimEvent[], event: Omit<SimEvent, 'id' | 'sequence'>): SimEvent {
    const id = this.nextId(event.type);
    const full: SimEvent = {
      ...event,
      at: normalizeUtcIso(event.at),
      id,
      sequence: this.currentSequence(),
    };
    if (this.seen.has(id)) return full;
    this.seen.add(id);
    events.push(full);
    return full;
  }

  ordered(events: SimEvent[]): SimEvent[] {
    return [...events].sort((a, b) => {
      const ta = new Date(a.at).getTime();
      const tb = new Date(b.at).getTime();
      if (ta !== tb) return ta - tb;
      const pa = eventTypePriority(a.type);
      const pb = eventTypePriority(b.type);
      if (pa !== pb) return pa - pb;
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return a.id.localeCompare(b.id);
    });
  }

  writeLog(events: SimEvent[]): string {
    const file = path.join(this.reportDir, 'simulation.log');
    const ordered = this.ordered(events);
    const lines = ordered.map(
      (e) => `${e.at} [${e.type}] [seq=${e.sequence}] [id=${e.id}] ${JSON.stringify(e.payload)}`,
    );
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    return file;
  }
}
