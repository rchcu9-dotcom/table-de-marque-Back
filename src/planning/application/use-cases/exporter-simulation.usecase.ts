import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import { SimulationResult } from '../../domain/entities/simulation-result.entity';

// Catalogue ouvert (plus d'enum REPAS/CHALLENGE figé) : palette cyclique par
// activiteId plutôt que deux couleurs fixes, pour rester générique quelle
// que soit l'activité du catalogue.
const PALETTE_ACTIVITES = [
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#eab308',
  '#06b6d4',
];

type LigneGantt = {
  ref: string;
  nom: string;
  fictive: boolean;
  matchs: { debut: string; fin: string; adversaire: string }[];
  activites: {
    debut: string;
    fin: string;
    activiteId: number;
    label: string;
  }[];
};

@Injectable()
export class ExporterSimulationUseCase {
  constructor(private readonly cache: PlanningSimulationCacheService) {}

  execute(editionId: number, simulationId: string): string {
    const simulation = this.cache.getById(editionId, simulationId);
    if (!simulation) {
      throw new NotFoundException(
        `Simulation ${simulationId} introuvable ou remplacée par une simulation plus récente`,
      );
    }
    return this.renderHtml(simulation);
  }

  private renderHtml(simulation: SimulationResult): string {
    const nomParRef = new Map(
      simulation.equipes.map((e) => [
        e.ref,
        { nom: e.nom, fictive: e.fictive },
      ]),
    );
    const lignesParRef = new Map<string, LigneGantt>();

    const ligne = (ref: string, nomFallback: string): LigneGantt => {
      if (!lignesParRef.has(ref)) {
        const info = nomParRef.get(ref);
        lignesParRef.set(ref, {
          ref,
          nom: info?.nom ?? nomFallback,
          fictive: info?.fictive ?? false,
          matchs: [],
          activites: [],
        });
      }
      return lignesParRef.get(ref)!;
    };

    for (const m of simulation.matches) {
      const fin = new Date(m.dateHeure.getTime() + m.dureeMin * 60_000);
      ligne(m.equipe1Ref, m.equipe1Nom).matchs.push({
        debut: this.hhmm(m.dateHeure),
        fin: this.hhmm(fin),
        adversaire: m.equipe2Nom,
      });
      ligne(m.equipe2Ref, m.equipe2Nom).matchs.push({
        debut: this.hhmm(m.dateHeure),
        fin: this.hhmm(fin),
        adversaire: m.equipe1Nom,
      });
    }
    for (const a of simulation.activites) {
      const l = ligne(a.equipeRef, a.equipeNom);
      l.activites.push({
        debut: this.hhmm(a.debut),
        fin: this.hhmm(a.fin),
        activiteId: a.activiteId,
        label: a.activiteLabel,
      });
    }

    const lignes = [...lignesParRef.values()];
    const data = {
      editionId: simulation.editionId,
      generatedAt: simulation.generatedAt.toISOString(),
      score: simulation.score,
      violations: simulation.violations,
      mode: simulation.mode,
      planning: lignes,
    };
    const jsonData = JSON.stringify(data);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Planning tournoi — simulation ${simulation.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1a2e; color: #e0e0e0; font-family: 'Segoe UI', sans-serif; padding: 24px; }
  h1 { font-size: 1.3rem; margin-bottom: 4px; color: #fff; }
  .subtitle { font-size: 0.8rem; color: #888; margin-bottom: 20px; }
  .legend { display: flex; gap: 24px; margin-bottom: 20px; font-size: 0.8rem; }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .legend-box { width: 20px; height: 12px; border-radius: 3px; }
  .lb-match { background: #3b82f6; }
  .violations { margin-top: 16px; font-size: 0.8rem; color: #f87171; }
  .chart-wrap { overflow-x: auto; }
  .tooltip { position: fixed; background: #0f172a; border: 1px solid #334155; padding: 6px 10px;
    border-radius: 6px; font-size: 0.75rem; pointer-events: none; display: none; color: #e2e8f0;
    z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,.5); }
</style>
</head>
<body>
<h1>Planning tournoi — simulation</h1>
<p class="subtitle" id="subtitle"></p>
<div class="legend" id="legend">
  <div class="legend-item"><div class="legend-box lb-match"></div> Match</div>
</div>
<div class="chart-wrap"><svg id="gantt" xmlns="http://www.w3.org/2000/svg"></svg></div>
<div class="violations" id="violations"></div>
<div class="tooltip" id="tooltip"></div>
<script>
const DATA = ${jsonData};
const PALETTE_ACTIVITES = ${JSON.stringify(PALETTE_ACTIVITES)};
function couleurActivite(activiteId) { return PALETTE_ACTIVITES[activiteId % PALETTE_ACTIVITES.length]; }
const activitesVues = new Map();
DATA.planning.forEach(row => row.activites.forEach(a => activitesVues.set(a.activiteId, a.label)));
const legend = document.getElementById('legend');
[...activitesVues.entries()].forEach(([activiteId, label]) => {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.innerHTML = \`<div class="legend-box" style="background:\${couleurActivite(activiteId)}"></div> \${label}\`;
  legend.appendChild(item);
});
const T_START = 8*60, T_END = 22*60, T_RANGE = T_END - T_START;
const LEFT = 130, ROW_H = 44, BAR_H = 22, BAR_Y = (ROW_H-BAR_H)/2;
const CHART_W = 1100, HEADER_H = 36;
const N = DATA.planning.length;
const SVG_W = LEFT + CHART_W + 10, SVG_H = HEADER_H + N * ROW_H + 10;
const svg = document.getElementById('gantt');
svg.setAttribute('width', SVG_W); svg.setAttribute('height', SVG_H);
svg.setAttribute('viewBox', \`0 0 \${SVG_W} \${SVG_H}\`);
document.getElementById('subtitle').textContent =
  \`penalty=\${DATA.score.penalty} · slack=\${DATA.score.slack} · généré le \${new Date(DATA.generatedAt).toLocaleString('fr-FR')}\${DATA.mode.effectifComplete ? ' · équipes fictives présentes' : ''}\`;
if (DATA.violations && DATA.violations.length) {
  const v = document.getElementById('violations');
  v.innerHTML = \`⚠️ \${DATA.violations.length} violation(s) :<br>\` + DATA.violations.map(x => \`&nbsp;&nbsp;• \${x}\`).join('<br>');
}
function toMin(hhmm) { const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function xOf(min) { return LEFT + ((min-T_START)/T_RANGE)*CHART_W; }
function wOf(a,b) { return Math.max(((toMin(b)-toMin(a))/T_RANGE)*CHART_W, 4); }
function el(tag, attrs, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  if (text !== undefined) e.textContent = text; return e;
}
svg.appendChild(el('rect', {x:0,y:0,width:SVG_W,height:SVG_H,fill:'#0f172a'}));
for (let m = T_START; m <= T_END; m += 60) {
  const x = xOf(m), h = String(Math.floor(m/60)).padStart(2,'0');
  svg.appendChild(el('line', {x1:x,y1:HEADER_H,x2:x,y2:SVG_H-10,stroke:'#1e3a5f','stroke-width':1}));
  svg.appendChild(el('text', {x,y:HEADER_H-6,fill:'#64748b','font-size':11,'text-anchor':'middle'}, \`\${h}:00\`));
}
const tooltip = document.getElementById('tooltip');
DATA.planning.forEach((row, i) => {
  const y = HEADER_H + i * ROW_H;
  svg.appendChild(el('rect', {x:0,y,width:SVG_W,height:ROW_H,fill: i%2===0?'#111827':'#0f172a'}));
  const label = row.fictive ? \`\${row.nom} (fictive)\` : row.nom;
  svg.appendChild(el('text', {x:LEFT-8,y:y+ROW_H/2+4,fill: row.fictive ? '#94a3b8' : '#cbd5e1','font-size':12,'text-anchor':'end','font-weight':'500','font-style': row.fictive ? 'italic' : 'normal'}, label));
  svg.appendChild(el('line', {x1:0,y1:y+ROW_H,x2:SVG_W,y2:y+ROW_H,stroke:'#1e293b','stroke-width':1}));
  function bar(debut, fin, color, lettre, tip) {
    const x = xOf(toMin(debut)), w = wOf(debut,fin), g = el('g', {cursor:'pointer'});
    const opacity = row.fictive ? 0.55 : 1;
    g.appendChild(el('rect', {x,y:y+BAR_Y,width:w,height:BAR_H,fill:color,rx:4,opacity, ...(row.fictive ? {'stroke':'#fff','stroke-dasharray':'2,2','stroke-width':1} : {})}));
    if (w > 28) g.appendChild(el('text', {x:x+w/2,y:y+BAR_Y+BAR_H/2+4,fill:'#fff','font-size':10,'text-anchor':'middle','font-weight':'600','pointer-events':'none'}, lettre));
    g.addEventListener('mouseenter', () => { tooltip.style.display='block'; tooltip.innerHTML=tip; });
    g.addEventListener('mousemove', e => { tooltip.style.left=(e.clientX+12)+'px'; tooltip.style.top=(e.clientY-28)+'px'; });
    g.addEventListener('mouseleave', () => { tooltip.style.display='none'; });
    svg.appendChild(g);
  }
  row.matchs.forEach(m => bar(m.debut,m.fin,'#3b82f6','M',\`<strong>Match</strong><br>\${m.debut} – \${m.fin}<br>vs \${m.adversaire}\`));
  row.activites.forEach(a => bar(a.debut,a.fin,couleurActivite(a.activiteId),a.label.slice(0,1).toUpperCase(),\`<strong>\${a.label}</strong><br>\${a.debut} – \${a.fin}\`));
});
svg.appendChild(el('line', {x1:LEFT,y1:HEADER_H,x2:LEFT,y2:SVG_H-10,stroke:'#334155','stroke-width':1}));
</script>
</body>
</html>`;
  }

  private hhmm(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
