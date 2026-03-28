export function eventTypePriority(type: string): number {
  if (type === 'MATCH_STARTED') return 0;
  if (type === 'GOAL') return 1;
  if (type === 'MATCH_FINISHED') return 2;
  if (type === 'STANDINGS_RECALCULATED') return 3;
  if (type === 'CHALLENGE_TEAM_WINDOW_STARTED') return 4;
  if (type === 'CHALLENGE_PLAYER_PASSED') return 5;
  if (type === 'CHALLENGE_TEAM_WINDOW_FINISHED') return 6;
  if (type === 'CHALLENGE_VITESSE_QF_QUALIFIED') return 7;
  if (type === 'CHALLENGE_VITESSE_QF_FINISHED') return 7;
  if (type === 'CHALLENGE_VITESSE_DF_FINISHED') return 7;
  if (type === 'SIM_SQL_APPLIED') return 8;
  if (type.startsWith('SIM')) return 9;
  return 10;
}
