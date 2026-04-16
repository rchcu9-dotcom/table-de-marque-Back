import type { SimulatorConfig } from '../config';
import type { DryRunWriter } from '../persistence/dryrun-writer';
import type { EventJournal } from '../log/event-journal';
import type { PlannedAction, SimEvent, SimMatch } from '../types';
import { SeededRandom } from './random';

type GoalDraft = {
  goalAt: string;
  scorer: 1 | 2;
  index: number;
};

type GoalTimelineItem = {
  goalAt: string;
  scorerTeam: string;
  scoreA: number;
  scoreB: number;
};

function normalizeScore(score: unknown): number {
  const parsed = Number(score);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function buildSortedGoals(match: SimMatch, random: SeededRandom, matchDurationMin: number): GoalDraft[] {
  const goals = random.int(0, 6);
  const drafts: GoalDraft[] = [];
  for (let i = 0; i < goals; i += 1) {
    const minute = random.int(1, Math.max(1, matchDurationMin - 1));
    drafts.push({
      goalAt: new Date(new Date(match.dateTime).getTime() + minute * 60_000).toISOString(),
      scorer: random.int(1, 2) as 1 | 2,
      index: i,
    });
  }

  return drafts.sort((a, b) => {
    const ta = new Date(a.goalAt).getTime();
    const tb = new Date(b.goalAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.index - b.index;
  });
}

function buildGoalTimeline(match: SimMatch, drafts: GoalDraft[]): GoalTimelineItem[] {
  let runningA = 0;
  let runningB = 0;

  const out: GoalTimelineItem[] = [];
  for (const d of drafts) {
    if (d.scorer === 1) runningA += 1;
    else runningB += 1;

    out.push({
      goalAt: d.goalAt,
      scorerTeam: d.scorer === 1 ? match.teamA : match.teamB,
      scoreA: runningA,
      scoreB: runningB,
    });
  }

  return out;
}

function assertGoalTimelineInvariant(match: SimMatch, timeline: GoalTimelineItem[], finishAt: string): void {
  let prevA = 0;
  let prevB = 0;
  const finishMs = new Date(finishAt).getTime();

  for (let i = 0; i < timeline.length; i += 1) {
    const g = timeline[i];
    const goalMs = new Date(g.goalAt).getTime();

    if (goalMs > finishMs) {
      throw new Error(`Invariant violation match=${match.id}: GOAL after MATCH_FINISHED`);
    }
    if (g.scoreA < prevA || g.scoreB < prevB) {
      throw new Error(`Invariant violation match=${match.id}: score regression at GOAL#${i + 1}`);
    }

    const deltaA = g.scoreA - prevA;
    const deltaB = g.scoreB - prevB;
    if (!((deltaA === 1 && deltaB === 0) || (deltaA === 0 && deltaB === 1))) {
      throw new Error(`Invariant violation match=${match.id}: invalid score delta at GOAL#${i + 1}`);
    }

    prevA = g.scoreA;
    prevB = g.scoreB;
  }
}

export function planFiveVFiveActions(params: {
  matches: SimMatch[];
  config: SimulatorConfig;
  random: SeededRandom;
  events: SimEvent[];
  journal: EventJournal;
  writer: DryRunWriter;
}): PlannedAction[] {
  const { matches, config, random, events, journal, writer } = params;
  const actions: PlannedAction[] = [];

  for (const match of matches) {
    const drafts = buildSortedGoals(match, random, config.matchDurationMin);
    const timeline = buildGoalTimeline(match, drafts);
    const finishAt = new Date(new Date(match.dateTime).getTime() + config.matchDurationMin * 60_000).toISOString();

    if (match.day === 'J3' && match.forcedWinnerAIfDraw) {
      const last = timeline[timeline.length - 1];
      const scoreA = last ? last.scoreA : 0;
      const scoreB = last ? last.scoreB : 0;
      if (scoreA === scoreB) {
        timeline.push({
          goalAt: finishAt,
          scorerTeam: match.teamA,
          scoreA: scoreA + 1,
          scoreB,
        });
      }
    }

    assertGoalTimelineInvariant(match, timeline, finishAt);

    actions.push({
      id: `${match.id}-start`,
      at: match.dateTime,
      type: 'MATCH_STARTED',
      payload: { matchId: match.id },
      execute: () => {
        match.scoreA = normalizeScore(match.scoreA);
        match.scoreB = normalizeScore(match.scoreB);
        match.status = 'ongoing';
        journal.push(events, {
          type: 'MATCH_STARTED',
          at: match.dateTime,
          payload: {
            matchId: match.id,
            day: match.day,
            phase: match.phase,
            group: match.group,
            teamA: match.teamA,
            teamB: match.teamB,
          },
        });
        writer.push({
          table: 'ta_matchs',
          action: 'update',
          at: match.dateTime,
          where: `ID='${match.id}'`,
          values: { ETAT: 'c', SCORE_EQUIPE1: match.scoreA, SCORE_EQUIPE2: match.scoreB },
        });
      },
    });

    timeline.forEach((goal, idx) => {
      actions.push({
        id: `${match.id}-goal-${idx + 1}`,
        at: goal.goalAt,
        type: 'GOAL',
        payload: { matchId: match.id, scoreA: goal.scoreA, scoreB: goal.scoreB },
        execute: () => {
          match.scoreA = goal.scoreA;
          match.scoreB = goal.scoreB;
          journal.push(events, {
            type: 'GOAL',
            at: goal.goalAt,
            payload: {
              matchId: match.id,
              scorerTeam: goal.scorerTeam,
              scoreA: match.scoreA,
              scoreB: match.scoreB,
            },
          });
          writer.push({
            table: 'ta_matchs',
            action: 'update',
            at: goal.goalAt,
            where: `ID='${match.id}'`,
            values: { SCORE_EQUIPE1: match.scoreA, SCORE_EQUIPE2: match.scoreB },
          });
        },
      });
    });

    actions.push({
      id: `${match.id}-finished`,
      at: finishAt,
      type: 'MATCH_FINISHED',
      payload: { matchId: match.id },
      execute: () => {
        const last = timeline[timeline.length - 1];
        const finalA = last ? last.scoreA : 0;
        const finalB = last ? last.scoreB : 0;
        if (match.scoreA !== finalA || match.scoreB !== finalB) {
          throw new Error(
            `Invariant violation match=${match.id}: MATCH_FINISHED score differs from last GOAL (current=${match.scoreA}-${match.scoreB} expected=${finalA}-${finalB})`,
          );
        }

        match.status = 'finished';
        journal.push(events, {
          type: 'MATCH_FINISHED',
          at: finishAt,
          payload: { matchId: match.id, scoreA: match.scoreA, scoreB: match.scoreB },
        });
        writer.push({
          table: 'ta_matchs',
          action: 'update',
          at: finishAt,
          where: `ID='${match.id}'`,
          values: { ETAT: 'x', SCORE_EQUIPE1: match.scoreA, SCORE_EQUIPE2: match.scoreB },
        });
      },
    });

    actions.push({
      id: `${match.id}-break-start`,
      at: finishAt,
      type: 'INTER_MATCH_BREAK_STARTED',
      payload: { matchId: match.id },
      execute: () => {
        journal.push(events, {
          type: 'INTER_MATCH_BREAK_STARTED',
          at: finishAt,
          payload: { matchId: match.id, breakMinutes: config.interMatchBreakMin },
        });
      },
    });

    const breakEndAt = new Date(new Date(finishAt).getTime() + config.interMatchBreakMin * 60_000).toISOString();
    actions.push({
      id: `${match.id}-break-end`,
      at: breakEndAt,
      type: 'INTER_MATCH_BREAK_FINISHED',
      payload: { matchId: match.id },
      execute: () => {
        journal.push(events, {
          type: 'INTER_MATCH_BREAK_FINISHED',
          at: breakEndAt,
          payload: { matchId: match.id },
        });
      },
    });
  }

  return actions;
}
