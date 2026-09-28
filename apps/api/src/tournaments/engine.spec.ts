import {
  computeStandings,
  evaluateSets,
  qualifierSeeds,
  roundRobinRounds,
  seedPositions,
  snakeGroups,
  type ScoringRules,
} from './engine.js';

const bestOf3: ScoringRules = {
  setsToWin: 2,
  gamesPerSet: 6,
  superTiebreak: true,
};

describe('seedPositions', () => {
  it('keeps top seeds apart until the final', () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const p16 = seedPositions(16);
    expect(p16.indexOf(1) < 8).not.toBe(p16.indexOf(2) < 8); // different halves
  });
});

describe('roundRobinRounds', () => {
  it.each([4, 5, 6])(
    '%i teams: everyone meets everyone once, at most once per round',
    (n) => {
      const teams = Array.from({ length: n }, (_, i) => i);
      const rounds = roundRobinRounds(teams);
      const pairs = rounds
        .flat()
        .map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-'));
      expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      for (const round of rounds) {
        const inRound = round.flat();
        expect(new Set(inRound).size).toBe(inRound.length);
      }
    },
  );
});

describe('snakeGroups', () => {
  it('spreads seeds snake-wise', () => {
    expect(snakeGroups([1, 2, 3, 4, 5, 6, 7, 8], 2)).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ]);
  });
});

describe('qualifierSeeds', () => {
  it('never pairs a group winner with its own runner-up (standard seeding)', () => {
    for (const g of [2, 3, 4]) {
      const groups = Array.from({ length: g }, (_, i) => [
        `${i}-1`,
        `${i}-2`,
        `${i}-3`,
      ]);
      const seeds = qualifierSeeds(groups, 2);
      const size = 2 * g;
      // seed i meets seed size+1-i when size is a power of two
      if ((size & (size - 1)) === 0) {
        for (let i = 1; i <= g; i++) {
          const opponent = seeds[size - i];
          expect(opponent.split('-')[0]).not.toBe(seeds[i - 1].split('-')[0]);
        }
      }
      expect(seeds.slice(0, g)).toEqual(groups.map((x) => x[0]));
    }
  });
});

describe('evaluateSets', () => {
  it('accepts valid padel scores', () => {
    expect(
      evaluateSets(
        [
          { a: 6, b: 4 },
          { a: 7, b: 5 },
        ],
        bestOf3,
      ),
    ).toMatchObject({ winner: 'A', setsA: 2, setsB: 0 });
    expect(
      evaluateSets(
        [
          { a: 6, b: 7 },
          { a: 6, b: 3 },
          { a: 8, b: 10 },
        ],
        bestOf3,
      ),
    ).toMatchObject({
      winner: 'B',
      gamesA: 12,
      gamesB: 11, // super tie-break counts as one game
    });
    expect(
      evaluateSets(
        [
          { a: 4, b: 6 },
          { a: 7, b: 6 },
          { a: 12, b: 10 },
        ],
        bestOf3,
      ).winner,
    ).toBe('A');
    const fullThird = { ...bestOf3, superTiebreak: false };
    expect(
      evaluateSets(
        [
          { a: 6, b: 4 },
          { a: 4, b: 6 },
          { a: 7, b: 5 },
        ],
        fullThird,
      ).winner,
    ).toBe('A');
    expect(
      evaluateSets([{ a: 9, b: 7 }], {
        setsToWin: 1,
        gamesPerSet: 9,
        superTiebreak: false,
      }).winner,
    ).toBe('A');
  });

  it.each([
    [
      [
        { a: 6, b: 5 },
        { a: 6, b: 0 },
      ],
      /not a valid set/,
    ],
    [
      [
        { a: 8, b: 6 },
        { a: 6, b: 0 },
      ],
      /not a valid set/,
    ],
    [[{ a: 6, b: 6 }], /must have a winner/],
    [[{ a: 6, b: 0 }], /not finished/],
    [
      [
        { a: 6, b: 0 },
        { a: 6, b: 0 },
        { a: 6, b: 0 },
      ],
      /already decided/,
    ],
    [
      [
        { a: 6, b: 0 },
        { a: 0, b: 6 },
        { a: 10, b: 9 },
      ],
      /super tie-break/,
    ],
    [
      [
        { a: 6, b: 0 },
        { a: 0, b: 6 },
        { a: 6, b: 4 },
      ],
      /super tie-break/,
    ],
  ])('rejects %j', (sets, reason) => {
    expect(() => evaluateSets(sets, bestOf3)).toThrow(reason);
  });
});

describe('computeStandings', () => {
  it('ranks by points, then set and game difference', () => {
    const o = (sets: { a: number; b: number }[]) => evaluateSets(sets, bestOf3);
    const table = computeStandings(
      ['x', 'y', 'z'],
      [
        {
          teamAId: 'x',
          teamBId: 'y',
          winnerId: 'x',
          outcome: o([
            { a: 6, b: 0 },
            { a: 6, b: 0 },
          ]),
        },
        {
          teamAId: 'y',
          teamBId: 'z',
          winnerId: 'y',
          outcome: o([
            { a: 6, b: 0 },
            { a: 6, b: 0 },
          ]),
        },
        {
          teamAId: 'z',
          teamBId: 'x',
          winnerId: 'z',
          outcome: o([
            { a: 6, b: 4 },
            { a: 3, b: 6 },
            { a: 10, b: 8 },
          ]),
        },
      ],
      bestOf3,
    );
    // All 1 win; x: sets 3-2, y: 2-2, z: 2-3.
    expect(table.map((r) => r.teamId)).toEqual(['x', 'y', 'z']);
    expect(table[0]).toMatchObject({
      played: 2,
      won: 1,
      lost: 1,
      points: 1,
      setsWon: 3,
      setsLost: 2,
    });
  });

  it('counts a walkover as a clean win', () => {
    const [first] = computeStandings(
      ['x', 'y'],
      [{ teamAId: 'x', teamBId: 'y', winnerId: 'y', outcome: null }],
      bestOf3,
    );
    expect(first).toMatchObject({
      teamId: 'y',
      won: 1,
      setsWon: 2,
      gamesWon: 12,
    });
  });
});
