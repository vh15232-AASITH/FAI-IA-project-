/**
 * Combinatorial Game Theory Engine for Nim (Normal & Misère Play, Unlimited & Bounded Subtraction).
 * Implements Charles Leonard Bouton's (1901) binary XOR Nim-sum theorem and Sprague-Grundy values.
 */

export type PlayConvention = 'normal' | 'misere';
export type OpponentMode = 'grandmaster' | 'tactician' | 'novice' | 'pass_and_play';

export interface NimVariantPreset {
  id: string;
  name: string;
  origin: string;
  heaps: number[];
  convention: PlayConvention;
  maxTake: number | null; // null = unlimited from a single heap
  description: string;
}

export interface NimMove {
  heapIndex: number;
  count: number;
}

export interface AnalyzedMove extends NimMove {
  resultingHeaps: number[];
  resultingNimSum: number;
  isOptimal: boolean;
  reason: string;
}

export interface HeapBinaryRow {
  heapIndex: number;
  label: string;
  stones: number;
  grundy: number;
  bits: [number, number, number, number]; // [8, 4, 2, 1]
}

export interface PositionAnalysis {
  heaps: number[];
  totalStones: number;
  nimSum: number;
  nimSumBits: [number, number, number, number];
  isNPosition: boolean; // True if the player to move has a forced winning strategy
  statusLabel: string;
  mathematicalSummary: string;
  rows: HeapBinaryRow[];
  optimalMoves: AnalyzedMove[];
  isMisereEndgamePhase: boolean;
}

export interface NimPuzzle {
  id: string;
  title: string;
  difficulty: 'Fundamental' | 'Intermediate' | 'Master';
  heaps: number[];
  convention: PlayConvention;
  maxTake: number | null;
  prompt: string;
  hint: string;
}

export const NIM_PRESETS: NimVariantPreset[] = [
  {
    id: 'marienbad',
    name: 'Marienbad Classic',
    origin: '1 · 3 · 5 · 7 Heaps',
    heaps: [1, 3, 5, 7],
    convention: 'normal',
    maxTake: null,
    description:
      'The iconic four-row pyramid of 16 stones immortalized in European parlor play. Starts at a balanced Nim-sum of 0 (P-position), rewarding the second player unless the first player lures an error.',
  },
  {
    id: 'marienbad_misere',
    name: 'Marienbad Misère',
    origin: '1 · 3 · 5 · 7 · Last Stone Loses',
    heaps: [1, 3, 5, 7],
    convention: 'misere',
    maxTake: null,
    description:
      'Strict Marienbad parlor rules where the player forced to take the final stone loses. Identical to normal Nim until the critical endgame transition when only one heap exceeds size 1.',
  },
  {
    id: 'bouton_triad',
    name: "Bouton's Triad",
    origin: '3 · 4 · 5 Heaps',
    heaps: [3, 4, 5],
    convention: 'normal',
    maxTake: null,
    description:
      'Charles Leonard Bouton’s 1901 Harvard monograph benchmark. Begins with a non-zero Nim-sum of 2 (N-position), giving the opening player an immediate forced win by taking 2 from Heap A.',
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Sequence',
    origin: '2 · 3 · 5 · 8 Heaps',
    heaps: [2, 3, 5, 8],
    convention: 'normal',
    maxTake: null,
    description:
      'Four consecutive Fibonacci heaps totaling 18 stones. Opens with a high Nim-sum of 12 (binary 1100), offering deep tactical exchanges across the 8-stone and 5-stone rows.',
  },
  {
    id: 'binary_powers',
    name: 'Binary Powers',
    origin: '1 · 2 · 4 · 8 Heaps',
    heaps: [1, 2, 4, 8],
    convention: 'normal',
    maxTake: null,
    description:
      'Each heap represents a distinct power of two ($2^0, 2^1, 2^2, 2^3$). Because no binary bit is shared initially, the opening Nim-sum is 15 (1111₂)—requiring a multi-heap strategic collapse.',
  },
  {
    id: 'bounded_subtraction',
    name: 'Bounded Subtraction (Max 3)',
    origin: '5 · 7 · 9 Heaps · Take 1–3',
    heaps: [5, 7, 9],
    convention: 'normal',
    maxTake: 3,
    description:
      'Sprague-Grundy subtraction variant where a player may remove at most 3 stones in a single turn. Each heap’s effective Grundy value becomes $s_i \\bmod 4$.',
  },
];

export const NIM_PUZZLES: NimPuzzle[] = [
  {
    id: 'puzzle-1',
    title: '01. The Opening Equilibrium',
    difficulty: 'Fundamental',
    heaps: [3, 4, 5],
    convention: 'normal',
    maxTake: null,
    prompt: 'Normal Play (Last Stone Wins). Find the unique move that leaves a zero Nim-sum (0000₂) for your opponent.',
    hint: 'The current binary values are 0011₂ (3), 0100₂ (4), and 0101₂ (5). Their XOR sum is 0010₂ (2). Reduce the heap that consists solely of the 2-bit and 1-bit.',
  },
  {
    id: 'puzzle-2',
    title: '02. Asymmetric Collapse',
    difficulty: 'Fundamental',
    heaps: [2, 5, 7, 9],
    convention: 'normal',
    maxTake: null,
    prompt: 'Normal Play. Four active heaps create a Nim-sum of 9 (1001₂). Find the single move that balances all four binary columns.',
    hint: 'Only Heap D (9 = 1001₂) contains the 8-bit (1000₂). Calculate 9 ⊕ 9 to see how many stones should remain in Heap D.',
  },
  {
    id: 'puzzle-3',
    title: '03. The Misère Pivot',
    difficulty: 'Intermediate',
    heaps: [1, 1, 4, 1],
    convention: 'misere',
    maxTake: null,
    prompt: 'Misère Play (Last Stone Loses). Only Heap C has more than 1 stone. Execute the endgame inversion to trap your opponent.',
    hint: 'In Misère Play, when reducing the last large heap, you must leave an ODD number of size-1 heaps—not a zero Nim-sum! Since there are already three 1-heaps, how many stones should remain in Heap C?',
  },
  {
    id: 'puzzle-4',
    title: '04. Even-Parity Misère Trap',
    difficulty: 'Intermediate',
    heaps: [1, 6, 1],
    convention: 'misere',
    maxTake: null,
    prompt: 'Misère Play (Last Stone Loses). Two unit heaps flank a 6-stone center heap. Leave your opponent with an inescapable odd count of singletons.',
    hint: 'There are currently two heaps of size 1. To leave an odd total of size-1 heaps (three of them), reduce Heap B down to 1 stone.',
  },
  {
    id: 'puzzle-5',
    title: '05. Fibonacci High-Bit Strike',
    difficulty: 'Master',
    heaps: [3, 5, 8, 11],
    convention: 'normal',
    maxTake: null,
    prompt: 'Normal Play. Both Heap C (8) and Heap D (11) hold the 8-bit, so the highest unbalanced bit is the 4-bit. Find a winning move.',
    hint: 'Compute the Nim-sum: 3 ⊕ 5 ⊕ 8 ⊕ 11 = 6 ⊕ 3 = 5 (0101₂). Look for a heap with the 4-bit set (Heap B = 5) and reduce it to 5 ⊕ 5 = 0.',
  },
  {
    id: 'puzzle-6',
    title: '06. Modulo-4 Sprague-Grundy Lock',
    difficulty: 'Master',
    heaps: [4, 6, 7],
    convention: 'normal',
    maxTake: 3,
    prompt: 'Normal Play · Max 3 Stones per Turn. Using Grundy values (s mod 4), zero out the position in one move.',
    hint: 'Modulo 4, the heaps have Grundy values 4 mod 4 = 0, 6 mod 4 = 2, and 7 mod 4 = 3. The XOR sum is 0 ⊕ 2 ⊕ 3 = 1. Reduce the 7-stone heap so its remainder mod 4 becomes 2.',
  },
];

export function getHeapLabel(index: number): string {
  return `Heap ${String.fromCharCode(65 + index)}`;
}

export function toFourBits(val: number): [number, number, number, number] {
  const v = Math.max(0, Math.floor(val));
  return [(v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1];
}

export function computeGrundy(stones: number, maxTake: number | null): number {
  if (stones <= 0) return 0;
  if (!maxTake || maxTake <= 0) return stones;
  return stones % (maxTake + 1);
}

/**
 * Evaluates a Nim board configuration and returns full binary XOR telemetry and optimal winning moves.
 */
export function analyzePosition(
  heaps: number[],
  convention: PlayConvention = 'normal',
  maxTake: number | null = null
): PositionAnalysis {
  const totalStones = heaps.reduce((acc, s) => acc + s, 0);
  const rows: HeapBinaryRow[] = heaps.map((stones, idx) => {
    const grundy = computeGrundy(stones, maxTake);
    return {
      heapIndex: idx,
      label: getHeapLabel(idx),
      stones,
      grundy,
      bits: toFourBits(grundy),
    };
  });

  const nimSum = rows.reduce((xor, r) => xor ^ r.grundy, 0);
  const nimSumBits = toFourBits(nimSum);

  // Check if Misère endgame rule applies (only relevant when maxTake is null or >= largest heap)
  const heapsGreaterThanOne = heaps.filter((s) => s > 1).length;
  const isMisereEndgamePhase = convention === 'misere' && (!maxTake || maxTake >= Math.max(...heaps, 1)) && heapsGreaterThanOne <= 1;

  // Determine whether the current position is Winning (N-Position) or Losing (P-Position)
  let isNPosition = false;
  if (totalStones === 0) {
    isNPosition = false;
  } else if (isMisereEndgamePhase) {
    if (heapsGreaterThanOne === 1) {
      // With exactly one heap > 1, current player can always choose to leave either 0 or 1 stone in that heap,
      // flipping the parity of size-1 heaps to an odd number! (Unless maxTake restricts reaching 0 or 1).
      isNPosition = true;
    } else {
      // All remaining non-empty heaps have size 1. Current player wins iff there is an EVEN number of 1-heaps.
      const onesCount = heaps.filter((s) => s === 1).length;
      isNPosition = onesCount % 2 === 0;
    }
  } else {
    isNPosition = nimSum !== 0;
  }

  // Enumerate all legal moves and identify which ones leave a P-Position for the opponent
  const optimalMoves: AnalyzedMove[] = [];

  for (let i = 0; i < heaps.length; i++) {
    const currentStones = heaps[i];
    if (currentStones <= 0) continue;
    const limit = maxTake ? Math.min(currentStones, maxTake) : currentStones;

    for (let take = 1; take <= limit; take++) {
      const nextHeaps = [...heaps];
      nextHeaps[i] = currentStones - take;

      const nextTotal = totalStones - take;
      const nextGrundyXor = nextHeaps.reduce((acc, s) => acc ^ computeGrundy(s, maxTake), 0);
      const nextGreaterThanOne = nextHeaps.filter((s) => s > 1).length;
      const nextOnes = nextHeaps.filter((s) => s === 1).length;

      let leavesOpponentInPPosition = false;
      let reason = '';

      if (nextTotal === 0) {
        // Immediate terminal move
        if (convention === 'normal') {
          leavesOpponentInPPosition = true;
          reason = `Takes the final ${take} stone${take > 1 ? 's' : ''} from ${getHeapLabel(i)} to claim immediate victory.`;
        } else {
          leavesOpponentInPPosition = false;
        }
      } else if (convention === 'misere' && (!maxTake || maxTake >= Math.max(...nextHeaps, 1)) && nextGreaterThanOne === 0) {
        // Move transitions into (or stays in) all-ones Misère endgame: win iff opponent faces an ODD number of 1-heaps
        if (nextOnes % 2 === 1) {
          leavesOpponentInPPosition = true;
          reason = `Misère Endgame Inversion: Reduces ${getHeapLabel(i)} by ${take}, leaving an odd parity (${nextOnes}) of unit heaps so the opponent must take the last stone.`;
        }
      } else if (nextGreaterThanOne > 0 || convention === 'normal') {
        if (nextGrundyXor === 0) {
          leavesOpponentInPPosition = true;
          reason = maxTake
            ? `Balances the modulo-${maxTake + 1} Sprague-Grundy XOR sum to 0 by taking ${take} from ${getHeapLabel(i)}.`
            : `Zeroes out the binary Nim-sum (0000₂) by removing ${take} stone${take > 1 ? 's' : ''} from ${getHeapLabel(i)} (${currentStones} → ${currentStones - take}).`;
        }
      }

      if (leavesOpponentInPPosition) {
        optimalMoves.push({
          heapIndex: i,
          count: take,
          resultingHeaps: nextHeaps,
          resultingNimSum: nextGrundyXor,
          isOptimal: true,
          reason,
        });
      }
    }
  }

  // Fallback if optimalMoves is empty despite isNPosition (e.g., bounded maxTake in Misère)
  if (optimalMoves.length === 0) {
    isNPosition = false;
  }

  const statusLabel =
    totalStones === 0
      ? 'Board Cleared'
      : isNPosition
      ? 'N-Position · Winning Advantage'
      : 'P-Position · Balanced Zero-Sum';

  let mathematicalSummary = '';
  if (totalStones === 0) {
    mathematicalSummary = 'All heaps are empty. The match has concluded.';
  } else if (isMisereEndgamePhase) {
    const onesCount = heaps.filter((s) => s === 1).length;
    if (heapsGreaterThanOne === 1) {
      mathematicalSummary = `Misère Endgame Alert: Only one heap exceeds size 1. Ignore standard zero Nim-sum and reduce the large heap to leave an odd number of size-1 heaps.`;
    } else {
      mathematicalSummary = `All remaining heaps have 1 stone (${onesCount} remaining). Parity is ${onesCount % 2 === 0 ? 'even (winning for current player)' : 'odd (winning for previous player)'}.`;
    }
  } else if (isNPosition) {
    const best = optimalMoves[0];
    mathematicalSummary = `Current Nim-sum is ${nimSum} (${nimSumBits.join('')}₂ ≠ 0). Optimal strategy: remove ${best.count} from ${getHeapLabel(best.heapIndex)} to lock the board into a zero-sum P-Position.`;
  } else {
    mathematicalSummary = `Current Nim-sum is 0 (0000₂). Every legal move disrupts the binary equilibrium and hands an N-Position to the opponent if they play optimally.`;
  }

  return {
    heaps,
    totalStones,
    nimSum,
    nimSumBits,
    isNPosition,
    statusLabel,
    mathematicalSummary,
    rows,
    optimalMoves,
    isMisereEndgamePhase,
  };
}

/**
 * Selects a move for the AI bot according to difficulty tier.
 */
export function chooseBotMove(
  heaps: number[],
  convention: PlayConvention,
  maxTake: number | null,
  difficulty: OpponentMode
): AnalyzedMove {
  const analysis = analyzePosition(heaps, convention, maxTake);

  // Enumerate all legal moves for fallback or non-optimal choice
  const allLegalMoves: AnalyzedMove[] = [];
  heaps.forEach((stones, idx) => {
    if (stones <= 0) return;
    const limit = maxTake ? Math.min(stones, maxTake) : stones;
    for (let take = 1; take <= limit; take++) {
      const next = [...heaps];
      next[idx] = stones - take;
      const nextSum = next.reduce((acc, s) => acc ^ computeGrundy(s, maxTake), 0);
      allLegalMoves.push({
        heapIndex: idx,
        count: take,
        resultingHeaps: next,
        resultingNimSum: nextSum,
        isOptimal: false,
        reason: `Removed ${take} stone${take > 1 ? 's' : ''} from ${getHeapLabel(idx)} to maintain tempo.`,
      });
    }
  });

  if (allLegalMoves.length === 0) {
    return {
      heapIndex: 0,
      count: 0,
      resultingHeaps: heaps,
      resultingNimSum: 0,
      isOptimal: false,
      reason: 'No legal moves remain.',
    };
  }

  // Grandmaster always plays an optimal move if one exists; when in a losing P-position, removes 1 stone from the largest heap to maximize opponent error opportunities
  if (difficulty === 'grandmaster') {
    if (analysis.optimalMoves.length > 0) {
      return analysis.optimalMoves[0];
    }
    // In a P-position, take 1 stone from the largest non-empty heap to prolong the game and invite a human calculation mistake
    let maxIdx = 0;
    for (let i = 1; i < heaps.length; i++) {
      if (heaps[i] > heaps[maxIdx]) maxIdx = i;
    }
    const fallback = allLegalMoves.find((m) => m.heapIndex === maxIdx && m.count === 1) || allLegalMoves[0];
    return {
      ...fallback,
      reason: `Facing a balanced zero Nim-sum (P-position), removed 1 stone from ${getHeapLabel(fallback.heapIndex)} to maximize board complexity.`,
    };
  }

  // Tactician plays optimally 65% of the time
  if (difficulty === 'tactician') {
    if (analysis.optimalMoves.length > 0 && Math.random() < 0.65) {
      return analysis.optimalMoves[0];
    }
    const randomMove = allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
    return randomMove;
  }

  // Novice makes a random legal move (unless a single-move win is obvious on 1 remaining heap)
  const nonEmptyHeaps = heaps.filter((s) => s > 0).length;
  if (nonEmptyHeaps === 1 && analysis.optimalMoves.length > 0) {
    return analysis.optimalMoves[0];
  }
  return allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
}
