/**
 * Pure tournament logic: draws, schedules, score validation and standings.
 * No database access, so it can be unit tested in isolation.
 */

export interface ScoringRules {
  /** Sets needed to win the match (1 = one set, 2 = best of three). */
  setsToWin: number;
  gamesPerSet: number;
  /** Deciding set played as a super tie-break to 10 (win by 2). */
  superTiebreak: boolean;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface MatchOutcome {
  winner: 'A' | 'B';
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
}

/**
 * Standard bracket order for `size` slots (power of two): seed 1 and 2 can only meet in the
 * final, 1–4 in the semis, etc. Example for 8: [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function seedPositions(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((seed) => [seed, n + 1 - seed]);
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Round-robin rounds with the circle method; each team plays at most once per round. */
export function roundRobinRounds<T>(teams: T[]): [T, T][][] {
  const list: (T | null)[] = [...teams];
  if (list.length % 2 === 1) list.push(null); // bye
  const n = list.length;
  const rounds: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home !== null && away !== null)
        pairs.push(r % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(pairs);
    // Keep the first entry fixed, rotate the rest clockwise.
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Distributes seeded teams over groups in snake order (A B C C B A A B C …). */
export function snakeGroups<T>(teams: T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  teams.forEach((team, i) => {
    const lap = Math.floor(i / groupCount);
    const pos = i % groupCount;
    groups[lap % 2 === 0 ? pos : groupCount - 1 - pos].push(team);
  });
  return groups;
}

/** Seeded teams first (by seed), the rest in random order: the draw. */
export function drawOrder<T extends { seed: number | null }>(
  teams: T[],
  shuffle = true,
): T[] {
  const seeded = teams
    .filter((t) => t.seed !== null)
    .sort((x, y) => x.seed! - y.seed!);
  const rest = teams.filter((t) => t.seed === null);
  if (shuffle) {
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
  }
  return [...seeded, ...rest];
}

/**
 * Seeds for a knockout built from group standings: all group winners, then runners-up, …
 * Runners-up are ordered so that (with standard seeding) a winner never meets the runner-up
 * of its own group in the first round: A1–B2, B1–C2, …, last group winner–A2.
 */
export function qualifierSeeds<T>(
  standingsByGroup: T[][],
  advancePerGroup: number,
): T[] {
  const g = standingsByGroup.length;
  const seeds: T[] = [];
  for (let place = 0; place < advancePerGroup; place++) {
    const atPlace = standingsByGroup
      .map((rows) => rows[place])
      .filter((x): x is T => x !== undefined);
    if (place === 1 && atPlace.length === g && g > 1) {
      // Seed (g + k) plays seed (g + 1 - k) … pairing i with 2g+1-i means runner-up slot
      // (g + 1 - i) faces winner i; put the runner-up of group (i mod g) + 1 there.
      const ordered: T[] = Array.from({ length: g });
      for (let i = 1; i <= g; i++) ordered[g - i] = atPlace[i % g];
      seeds.push(...ordered);
    } else {
      seeds.push(...atPlace);
    }
  }
  return seeds;
}

function validSet(a: number, b: number, games: number): boolean {
  const [w, l] = a > b ? [a, b] : [b, a];
  if (w === games) return l <= games - 2;
  if (w === games + 1) return l === games - 1 || l === games; // 7-5 or 7-6 (tie-break)
  return false;
}

function validSuperTiebreak(a: number, b: number): boolean {
  const [w, l] = a > b ? [a, b] : [b, a];
  return w === 10 ? l <= 8 : w > 10 && w - l === 2;
}

/** Validates a padel score against the rules and returns the winner; throws with a reason. */
export function evaluateSets(
  sets: SetScore[],
  rules: ScoringRules,
): MatchOutcome {
  const maxSets = rules.setsToWin * 2 - 1;
  if (sets.length === 0 || sets.length > maxSets) {
    throw new Error(`A match has 1 to ${maxSets} sets`);
  }
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  sets.forEach(({ a, b }, i) => {
    if (setsA === rules.setsToWin || setsB === rules.setsToWin) {
      throw new Error('The match was already decided before this set');
    }
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a === b
    ) {
      throw new Error(`Set ${i + 1} must have a winner`);
    }
    const deciding =
      rules.setsToWin > 1 &&
      setsA === rules.setsToWin - 1 &&
      setsB === rules.setsToWin - 1;
    if (deciding && rules.superTiebreak) {
      if (!validSuperTiebreak(a, b))
        throw new Error(
          `Set ${i + 1} (super tie-break) must end 10-8 or better, win by 2`,
        );
    } else if (!validSet(a, b, rules.gamesPerSet)) {
      throw new Error(
        `Set ${i + 1} score ${a}-${b} is not a valid set to ${rules.gamesPerSet}`,
      );
    }
    if (a > b) setsA++;
    else setsB++;
    // A super tie-break counts as one game for the game difference.
    if (deciding && rules.superTiebreak) {
      if (a > b) gamesA++;
      else gamesB++;
    } else {
      gamesA += a;
      gamesB += b;
    }
  });
  if (setsA !== rules.setsToWin && setsB !== rules.setsToWin) {
    throw new Error('The match is not finished yet');
  }
  return { winner: setsA > setsB ? 'A' : 'B', setsA, setsB, gamesA, gamesB };
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  /** 1 point per win. */
  points: number;
}

export interface FinishedMatch {
  teamAId: string;
  teamBId: string;
  winnerId: string;
  /** null for a walkover: counted as won 2-0 / 6-0 per set for the winner. */
  outcome: MatchOutcome | null;
}

/** Group table ordered by points, set difference, game difference, head-to-head, games won. */
export function computeStandings(
  teamIds: string[],
  matches: FinishedMatch[],
  rules: ScoringRules,
  seedOf: (teamId: string) => number | null = () => null,
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [
      id,
      {
        teamId: id,
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0,
      },
    ]),
  );
  for (const m of matches) {
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;
    const o: MatchOutcome =
      m.outcome ??
      (m.winnerId === m.teamAId
        ? {
            winner: 'A',
            setsA: rules.setsToWin,
            setsB: 0,
            gamesA: rules.setsToWin * rules.gamesPerSet,
            gamesB: 0,
          }
        : {
            winner: 'B',
            setsA: 0,
            setsB: rules.setsToWin,
            gamesA: 0,
            gamesB: rules.setsToWin * rules.gamesPerSet,
          });
    for (const [row, won, sw, sl, gw, gl] of [
      [a, o.winner === 'A', o.setsA, o.setsB, o.gamesA, o.gamesB],
      [b, o.winner === 'B', o.setsB, o.setsA, o.gamesB, o.gamesA],
    ] as const) {
      row.played++;
      if (won) {
        row.won++;
        row.points++;
      } else {
        row.lost++;
      }
      row.setsWon += sw;
      row.setsLost += sl;
      row.gamesWon += gw;
      row.gamesLost += gl;
    }
  }
  const headToHead = (x: string, y: string) => {
    const m = matches.find(
      (mm) =>
        (mm.teamAId === x && mm.teamBId === y) ||
        (mm.teamAId === y && mm.teamBId === x),
    );
    if (!m) return 0;
    return m.winnerId === x ? -1 : 1;
  };
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
      y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) ||
      headToHead(x.teamId, y.teamId) ||
      y.gamesWon - x.gamesWon ||
      (seedOf(x.teamId) ?? 999) - (seedOf(y.teamId) ?? 999),
  );
}
