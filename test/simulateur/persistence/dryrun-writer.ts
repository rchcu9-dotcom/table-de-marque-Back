import fs from 'node:fs';
import path from 'node:path';
import type { WriteAction } from '../types';
import { normalizeUtcIso } from '../utils/tournament-datetime';

type BufferedWrite = WriteAction & { _seq: number };

export class DryRunWriter {
  private writes: BufferedWrite[] = [];

  private seq = 0;

  push(action: WriteAction): void {
    this.seq += 1;
    this.writes.push({
      ...action,
      at: action.at ? normalizeUtcIso(action.at) : undefined,
      _seq: this.seq,
    });
  }

  loadExisting(writes: WriteAction[]): void {
    for (const write of writes) {
      this.push(write);
    }
  }

  all(): WriteAction[] {
    return this.writes.map(({ _seq: _unused, ...write }) => write);
  }

  count(): number {
    return this.writes.length;
  }

  sliceFrom(startIndex: number): WriteAction[] {
    return this.writes.slice(startIndex).map(({ _seq: _unused, ...write }) => write);
  }

  private orderedWrites(): BufferedWrite[] {
    return [...this.writes].sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.at ? new Date(b.at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a._seq - b._seq;
    });
  }

  writeSqlTrace(reportDir: string): string {
    const lines = this.orderedWrites().map((w) => {
      const values = Object.entries(w.values)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      const at = w.at ? ` at=${w.at}` : '';
      return `-- ${w.action.toUpperCase()} ${w.table}${at} ${w.where ?? ''}\n${w.action.toUpperCase()} ${w.table} SET ${values};`;
    });
    const file = path.join(reportDir, 'writes.sql.txt');
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    return file;
  }
}
