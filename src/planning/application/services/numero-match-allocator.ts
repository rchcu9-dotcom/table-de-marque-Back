/** Alloue les NUM_MATCH générés en respectant la convention CLAUDE.md (>100 → 3v3, ≤100 → 5v5). */
export class NumeroMatchAllocator {
  private next5v5: number;
  private next3v3: number;

  constructor(max5v5Existant: number, max3v3Existant: number) {
    this.next5v5 = Math.max(1, max5v5Existant + 1);
    this.next3v3 = Math.max(101, max3v3Existant + 1);
  }

  suivant(is3v3: boolean): number {
    if (is3v3) {
      return this.next3v3++;
    }
    return this.next5v5++;
  }
}
