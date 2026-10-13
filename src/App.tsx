/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  Lightbulb,
  Play,
  Sliders,
  Binary,
  BookOpen,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  ArrowRight,
  Cpu,
  Users,
  Sparkles,
} from 'lucide-react';
import {
  NIM_PRESETS,
  NIM_PUZZLES,
  PlayConvention,
  OpponentMode,
  NimVariantPreset,
  NimPuzzle,
  analyzePosition,
  chooseBotMove,
  getHeapLabel,
  computeGrundy,
} from './utils/nimEngine';
import { soundFX } from './utils/sound';
import heroBoardImg from './assets/images/marienbad_board_hero_1791710928690.jpg';
import boutonTokensImg from './assets/images/bouton_xor_tokens_1791710941300.jpg';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';
type ActiveSection = 'arena' | 'variants' | 'analyzer' | 'strategy';
type PlayerTurn = 'player1' | 'player2';

interface MoveRecord {
  moveNumber: number;
  actor: PlayerTurn;
  actorName: string;
  heapIndex: number;
  taken: number;
  heapsBefore: number[];
  heapsAfter: number[];
  nimSumAfter: number;
  wasOptimal: boolean;
  explanation: string;
}

export default function App() {
  // Navigation & Game State Machine
  const [activeSection, setActiveSection] = useState<ActiveSection>('arena');
  const [gameState, setGameState] = useState<GameState>('PLAYING');

  // Game Rules & Preset State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('marienbad');
  const [initialHeaps, setInitialHeaps] = useState<number[]>([1, 3, 5, 7]);
  const [heaps, setHeaps] = useState<number[]>([1, 3, 5, 7]);
  const [convention, setConvention] = useState<PlayConvention>('normal');
  const [maxTake, setMaxTake] = useState<number | null>(null);
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('grandmaster');
  const [startingPlayer, setStartingPlayer] = useState<PlayerTurn>('player1');

  // Active Match State
  const [currentTurn, setCurrentTurn] = useState<PlayerTurn>('player1');
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [winner, setWinner] = useState<PlayerTurn | null>(null);
  const [winReason, setWinReason] = useState<string>('');

  // Interactive Stone Staging / Hover State
  const [stagedMove, setStagedMove] = useState<{ heapIndex: number; count: number } | null>(null);
  const [hoveredMove, setHoveredMove] = useState<{ heapIndex: number; count: number } | null>(null);
  const [botAnimatingMove, setBotAnimatingMove] = useState<{ heapIndex: number; count: number } | null>(null);
  const [activeHint, setActiveHint] = useState<{ heapIndex: number; count: number; reason: string } | null>(null);
  const [showXRayInArena, setShowXRayInArena] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Scoreboard across session
  const [sessionStats, setSessionStats] = useState({
    player1Wins: 0,
    player2Wins: 0,
    matchesPlayed: 0,
  });

  // Custom Builder State (in Variants & Setup)
  const [customHeaps, setCustomHeaps] = useState<number[]>([1, 3, 5, 7]);
  const [customConvention, setCustomConvention] = useState<PlayConvention>('normal');
  const [customMaxTake, setCustomMaxTake] = useState<number | null>(null);

  // Interactive Puzzle State (in Strategy & Puzzles)
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>(NIM_PUZZLES[0].id);
  const [puzzleAttempt, setPuzzleAttempt] = useState<{
    heapIndex: number;
    count: number;
    isCorrect: boolean;
    feedback: string;
  } | null>(null);
  const [showPuzzleHint, setShowPuzzleHint] = useState<boolean>(false);

  // Image error fallback flags
  const [heroImgError, setHeroImgError] = useState(false);
  const [tokensImgError, setTokensImgError] = useState(false);

  const botTimerRef = useRef<number | null>(null);

  // Live Combinatorial Analysis of current board
  const analysis = useMemo(
    () => analyzePosition(heaps, convention, maxTake),
    [heaps, convention, maxTake]
  );

  // Analysis of hypothetical board if staged or hovered move is applied
  const previewMove = hoveredMove || stagedMove;
  const previewAnalysis = useMemo(() => {
    if (!previewMove) return null;
    const nextHeaps = [...heaps];
    nextHeaps[previewMove.heapIndex] = Math.max(0, nextHeaps[previewMove.heapIndex] - previewMove.count);
    return analyzePosition(nextHeaps, convention, maxTake);
  }, [heaps, previewMove, convention, maxTake]);

  const getPlayerLabel = useCallback(
    (turn: PlayerTurn) => {
      if (opponentMode === 'pass_and_play') {
        return turn === 'player1' ? 'Player 1' : 'Player 2';
      }
      if (turn === 'player1') return 'You';
      if (opponentMode === 'grandmaster') return 'Bouton Solver (GM)';
      if (opponentMode === 'tactician') return 'Tactician Bot';
      return 'Novice Bot';
    },
    [opponentMode]
  );

  // Clear pending bot timer on unmount
  useEffect(() => {
    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, []);

  // Start or restart a match with specific parameters
  const startNewMatch = useCallback(
    (
      nextHeaps: number[] = initialHeaps,
      nextConvention: PlayConvention = convention,
      nextMaxTake: number | null = maxTake,
      nextStarter: PlayerTurn = startingPlayer,
      presetId: string = selectedPresetId
    ) => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      const cleanHeaps = nextHeaps.map((h) => Math.max(1, Math.min(15, h)));
      setInitialHeaps(cleanHeaps);
      setHeaps(cleanHeaps);
      setConvention(nextConvention);
      setMaxTake(nextMaxTake);
      setStartingPlayer(nextStarter);
      setSelectedPresetId(presetId);
      setCurrentTurn(nextStarter);
      setMoveHistory([]);
      setWinner(null);
      setWinReason('');
      setStagedMove(null);
      setHoveredMove(null);
      setBotAnimatingMove(null);
      setActiveHint(null);
      setGameState('PLAYING');
    },
    [initialHeaps, convention, maxTake, startingPlayer, selectedPresetId]
  );

  // Execute a validated move on the board
  const executeMove = useCallback(
    (heapIndex: number, count: number, actor: PlayerTurn, botExplanation?: string) => {
      if (gameState !== 'PLAYING') return;
      if (heapIndex < 0 || heapIndex >= heaps.length) return;
      const available = heaps[heapIndex];
      const limit = maxTake ? Math.min(available, maxTake) : available;
      const actualTake = Math.min(Math.max(1, count), limit);
      if (actualTake <= 0 || available <= 0) return;

      // Determine if this move was mathematically optimal
      const currentAnalysis = analyzePosition(heaps, convention, maxTake);
      const matchedOptimal = currentAnalysis.optimalMoves.find(
        (m) => m.heapIndex === heapIndex && m.count === actualTake
      );
      const wasOptimal = Boolean(matchedOptimal);

      const nextHeaps = [...heaps];
      nextHeaps[heapIndex] = available - actualTake;
      const nextTotal = nextHeaps.reduce((acc, s) => acc + s, 0);
      const nextNimSum = nextHeaps.reduce((acc, s) => acc ^ computeGrundy(s, maxTake), 0);

      soundFX.playStoneRemove(actualTake, actor === 'player2' && opponentMode !== 'pass_and_play');

      const record: MoveRecord = {
        moveNumber: moveHistory.length + 1,
        actor,
        actorName: getPlayerLabel(actor),
        heapIndex,
        taken: actualTake,
        heapsBefore: [...heaps],
        heapsAfter: nextHeaps,
        nimSumAfter: nextNimSum,
        wasOptimal,
        explanation:
          botExplanation ||
          (matchedOptimal
            ? matchedOptimal.reason
            : nextNimSum === 0
            ? `Balanced the Nim-sum to 0.`
            : `Removed ${actualTake} from ${getHeapLabel(heapIndex)}, leaving Nim-sum ${nextNimSum}.`),
      };

      setHeaps(nextHeaps);
      setMoveHistory((prev) => [...prev, record]);
      setStagedMove(null);
      setHoveredMove(null);
      setActiveHint(null);
      setBotAnimatingMove(null);

      // Check for Game Over
      if (nextTotal === 0) {
        // Last stone was just taken by `actor`
        const matchWinner: PlayerTurn =
          convention === 'normal' ? actor : actor === 'player1' ? 'player2' : 'player1';
        const reasonText =
          convention === 'normal'
            ? `${getPlayerLabel(actor)} took the final stone from ${getHeapLabel(heapIndex)} to win under Normal Play.`
            : `${getPlayerLabel(actor)} was forced to take the final stone from ${getHeapLabel(heapIndex)}, conceding victory to ${getPlayerLabel(matchWinner)} under Misère Play.`;

        setWinner(matchWinner);
        setWinReason(reasonText);
        setGameState('GAME_OVER');
        setSessionStats((prev) => ({
          player1Wins: prev.player1Wins + (matchWinner === 'player1' ? 1 : 0),
          player2Wins: prev.player2Wins + (matchWinner === 'player2' ? 1 : 0),
          matchesPlayed: prev.matchesPlayed + 1,
        }));
        window.setTimeout(() => {
          soundFX.playGameOver(matchWinner === 'player1');
        }, 180);
      } else {
        setCurrentTurn(actor === 'player1' ? 'player2' : 'player1');
      }
    },
    [gameState, heaps, maxTake, convention, opponentMode, moveHistory.length, getPlayerLabel]
  );

  // Trigger AI Bot turn automatically when it is player2's turn and opponentMode !== 'pass_and_play'
  useEffect(() => {
    if (
      gameState === 'PLAYING' &&
      currentTurn === 'player2' &&
      opponentMode !== 'pass_and_play' &&
      heaps.some((s) => s > 0)
    ) {
      const chosen = chooseBotMove(heaps, convention, maxTake, opponentMode);
      // Highlight the bot's intended stones briefly before removing them
      const highlightTimer = window.setTimeout(() => {
        setBotAnimatingMove({ heapIndex: chosen.heapIndex, count: chosen.count });
        soundFX.playStoneSelect(chosen.count);
      }, 280);

      botTimerRef.current = window.setTimeout(() => {
        executeMove(chosen.heapIndex, chosen.count, 'player2', chosen.reason);
      }, 720);

      return () => {
        window.clearTimeout(highlightTimer);
        if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
      };
    }
  }, [gameState, currentTurn, opponentMode, heaps, convention, maxTake, executeMove]);

  // Keyboard shortcuts for rapid play (Enter to confirm staged move, Esc to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSection !== 'arena' || gameState !== 'PLAYING') return;
      if (currentTurn === 'player2' && opponentMode !== 'pass_and_play') return;

      if (e.key === 'Enter' && stagedMove) {
        e.preventDefault();
        executeMove(stagedMove.heapIndex, stagedMove.count, currentTurn);
      } else if (e.key === 'Escape') {
        setStagedMove(null);
        setActiveHint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, gameState, currentTurn, opponentMode, stagedMove, executeMove]);

  // Undo last move (or last 2 moves if playing against a Bot)
  const handleUndo = () => {
    if (moveHistory.length === 0) return;
    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setBotAnimatingMove(null);

    const stepsBack =
      opponentMode !== 'pass_and_play' && currentTurn === 'player1' && moveHistory.length >= 2
        ? 2
        : 1;
    const targetIndex = Math.max(0, moveHistory.length - stepsBack);
    const targetRecord = moveHistory[targetIndex];

    setHeaps(targetRecord.heapsBefore);
    setCurrentTurn(targetRecord.actor);
    setMoveHistory((prev) => prev.slice(0, targetIndex));
    setWinner(null);
    setWinReason('');
    setStagedMove(null);
    setActiveHint(null);
    setGameState('PLAYING');
    soundFX.playStoneSelect(1);
  };

  // Show optimal mathematical hint
  const handleRequestHint = () => {
    if (gameState !== 'PLAYING' || analysis.totalStones === 0) return;
    if (analysis.optimalMoves.length > 0) {
      const best = analysis.optimalMoves[0];
      setActiveHint({
        heapIndex: best.heapIndex,
        count: best.count,
        reason: best.reason,
      });
      setStagedMove({ heapIndex: best.heapIndex, count: best.count });
      soundFX.playStoneSelect(best.count);
    } else {
      // In a P-position, explain that no move forces a win, suggest taking 1 from largest heap
      let maxIdx = 0;
      for (let i = 1; i < heaps.length; i++) {
        if (heaps[i] > heaps[maxIdx]) maxIdx = i;
      }
      setActiveHint({
        heapIndex: maxIdx,
        count: 1,
        reason:
          'You are currently in a P-Position (Nim-sum = 0). No move guarantees a forced win against perfect play; remove 1 stone from the largest heap to keep maximum complexity on the board.',
      });
      setStagedMove({ heapIndex: maxIdx, count: 1 });
      soundFX.playStoneSelect(1);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.setMuted(next);
  };

  // Load a preset directly into the Arena
  const handleSelectPreset = (preset: NimVariantPreset) => {
    setCustomHeaps([...preset.heaps]);
    setCustomConvention(preset.convention);
    setCustomMaxTake(preset.maxTake);
    startNewMatch(preset.heaps, preset.convention, preset.maxTake, startingPlayer, preset.id);
    setActiveSection('arena');
  };

  // Apply custom board setup from Variants view
  const handleApplyCustomBoard = () => {
    startNewMatch(customHeaps, customConvention, customMaxTake, startingPlayer, 'custom');
    setActiveSection('arena');
  };

  // Load an Endgame Puzzle into the Arena
  const handleLoadPuzzleToArena = (puzzle: NimPuzzle) => {
    startNewMatch(puzzle.heaps, puzzle.convention, puzzle.maxTake, 'player1', `puzzle_${puzzle.id}`);
    setActiveSection('arena');
  };

  // Check user's optimal move rate in the current match
  const playerMoveAccuracy = useMemo(() => {
    const playerMoves = moveHistory.filter((m) => m.actor === 'player1');
    if (playerMoves.length === 0) return 100;
    const optimalCount = playerMoves.filter((m) => m.wasOptimal).length;
    return Math.round((optimalCount / playerMoves.length) * 100);
  }, [moveHistory]);

  const isPlayerTurnInteractive =
    gameState === 'PLAYING' && (opponentMode === 'pass_and_play' || currentTurn === 'player1');

  const matchResultHeadline = useMemo(() => {
    if (!winner) return 'MATCH COMPLETE';
    if (opponentMode === 'pass_and_play') {
      return winner === 'player1' ? 'PLAYER 1 WON THE MATCH' : 'PLAYER 2 WON THE MATCH';
    }
    return winner === 'player1' ? 'YOU WON THE MATCH' : 'OPPONENT WON THE MATCH';
  }, [winner, opponentMode]);

  const activeTurnHeadline = useMemo(() => {
    if (opponentMode === 'pass_and_play') {
      return currentTurn === 'player1' ? "PLAYER 1'S TURN" : "PLAYER 2'S TURN";
    }
    return currentTurn === 'player1' ? 'YOUR TURN' : "OPPONENT'S TURN";
  }, [currentTurn, opponentMode]);

  const currentPresetName = useMemo(() => {
    if (selectedPresetId === 'custom') return 'Custom Configuration';
    if (selectedPresetId.startsWith('puzzle_')) return 'Mastery Puzzle Position';
    return NIM_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Marienbad Classic';
  }, [selectedPresetId]);

  const activePuzzle: NimPuzzle = useMemo(
    () => NIM_PUZZLES.find((p) => p.id === selectedPuzzleId) || NIM_PUZZLES[0],
    [selectedPuzzleId]
  );

  const activePuzzleAnalysis = useMemo(
    () => analyzePosition(activePuzzle.heaps, activePuzzle.convention, activePuzzle.maxTake),
    [activePuzzle]
  );

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 lg:px-10 py-4 bg-[#0b1120]/95 backdrop-blur-md border-b border-slate-800/80">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#arena"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('arena');
          }}
          className="font-display text-xl font-semibold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          Marienbad
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#arena"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('arena');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'arena'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            Arena
          </a>
          <a
            href="#variants"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('variants');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'variants'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            Variants &amp; Setup
          </a>
          <a
            href="#analyzer"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('analyzer');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'analyzer'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            Nim-Sum Analyzer
          </a>
          <a
            href="#strategy"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('strategy');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'strategy'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            Strategy &amp; Puzzles
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              startNewMatch();
              setActiveSection('arena');
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            New Match
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip (visible only below md) */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'arena', label: 'Arena' },
            { id: 'variants', label: 'Variants' },
            { id: 'analyzer', label: 'Analyzer' },
            { id: 'strategy', label: 'Puzzles & Guide' },
          ] as { id: ActiveSection; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
              activeSection === tab.id
                ? 'bg-slate-800 text-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MAIN VIEWPORT CONTAINER (1440px Desktop Presence) */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        {/* =====================================================================
            VIEW 1: PLAYABLE ARENA (DEFAULT)
            ===================================================================== */}
        {activeSection === 'arena' && (
          <div className="space-y-6">
            {/* Workspace Control Bar (Below Top Bar) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-200 font-medium">{currentPresetName}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {convention === 'normal'
                      ? 'Normal Play (Last Stone Wins)'
                      : 'Misère Play (Last Stone Loses)'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{maxTake ? `Max ${maxTake} Stones / Turn` : 'Unlimited Take per Heap'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-slate-300">
                    {analysis.totalStones} Stones Remaining
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                  The Marienbad Stone Table
                </h1>
              </div>

              {/* Interactive Segmented Mode Controls & Utility Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Opponent Selector */}
                <div
                  role="group"
                  aria-label="Opponent Mode"
                  className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg"
                >
                  {(
                    [
                      { id: 'grandmaster', label: 'Grandmaster' },
                      { id: 'tactician', label: 'Tactician' },
                      { id: 'novice', label: 'Novice' },
                      { id: 'pass_and_play', label: '2P Local' },
                    ] as { id: OpponentMode; label: string }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setOpponentMode(mode.id);
                        startNewMatch(initialHeaps, convention, maxTake, startingPlayer, selectedPresetId);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        opponentMode === mode.id
                          ? 'bg-slate-800 text-amber-400 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Rule Convention Quick Toggle */}
                <div
                  role="group"
                  aria-label="Win Convention"
                  className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() =>
                      startNewMatch(initialHeaps, 'normal', maxTake, startingPlayer, selectedPresetId)
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      convention === 'normal'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Normal Play
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startNewMatch(initialHeaps, 'misere', maxTake, startingPlayer, selectedPresetId)
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      convention === 'misere'
                        ? 'bg-slate-800 text-amber-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Misère Play
                  </button>
                </div>

                {/* X-Ray & Audio Controls */}
                <button
                  type="button"
                  onClick={() => setShowXRayInArena((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showXRayInArena
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Binary className="w-3.5 h-3.5" />
                  <span>{showXRayInArena ? 'XOR Telemetry: On' : 'XOR Telemetry: Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isMuted ? 'Muted' : 'Sound'}</span>
                </button>
              </div>
            </div>

            {/* 12-COLUMN ARENA GRID: 8 Cols Tactile Board + 4 Cols Telemetry & Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 8 COLS: THE NIM BOARD (FOCAL ANCHOR) */}
              <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                {/* Dual-Player Turn & Match Result Tracker */}
                <div className="space-y-4 pb-5 border-b border-slate-800">
                  {/* Player 1 vs Player 2 / Opponent Turn Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {/* Player 1 Card */}
                    <div
                      className={`p-3.5 sm:p-4 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                        gameState === 'GAME_OVER'
                          ? winner === 'player1'
                            ? 'bg-emerald-950/50 border-emerald-500/70 text-white'
                            : 'bg-slate-950/50 border-slate-800/70 text-slate-400 opacity-75'
                          : currentTurn === 'player1'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] font-medium text-slate-400">
                          {opponentMode === 'pass_and_play' ? 'Player 1' : 'Human Challenger'}
                          {' · '}
                          <span className="font-mono-tabular">Wins: {sessionStats.player1Wins}</span>
                        </div>
                        <div className="font-display text-sm sm:text-base font-semibold truncate">
                          {opponentMode === 'pass_and_play' ? 'Player 1' : 'You'}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {gameState === 'GAME_OVER' ? (
                          winner === 'player1' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <Trophy className="w-3.5 h-3.5" />
                              <span>Winner</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Defeated</span>
                          )
                        ) : currentTurn === 'player1' ? (
                          <span className="text-xs font-semibold text-amber-400">
                            {opponentMode === 'pass_and_play' ? "PLAYER 1'S TURN" : 'YOUR TURN'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Waiting</span>
                        )}
                      </div>
                    </div>

                    {/* Player 2 / Opponent Card */}
                    <div
                      className={`p-3.5 sm:p-4 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                        gameState === 'GAME_OVER'
                          ? winner === 'player2'
                            ? 'bg-emerald-950/50 border-emerald-500/70 text-white'
                            : 'bg-slate-950/50 border-slate-800/70 text-slate-400 opacity-75'
                          : currentTurn === 'player2'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] font-medium text-slate-400">
                          {opponentMode === 'pass_and_play' ? 'Player 2' : getPlayerLabel('player2')}
                          {' · '}
                          <span className="font-mono-tabular">Wins: {sessionStats.player2Wins}</span>
                        </div>
                        <div className="font-display text-sm sm:text-base font-semibold truncate">
                          {opponentMode === 'pass_and_play' ? 'Player 2' : 'Opponent'}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {gameState === 'GAME_OVER' ? (
                          winner === 'player2' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <Trophy className="w-3.5 h-3.5" />
                              <span>Winner</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Defeated</span>
                          )
                        ) : currentTurn === 'player2' ? (
                          <span className="text-xs font-semibold text-amber-400">
                            {opponentMode === 'pass_and_play' ? "PLAYER 2'S TURN" : "OPPONENT'S TURN"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Waiting</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Turn Instruction OR Prominent Post-Game Result Announcement */}
                  {gameState === 'GAME_OVER' ? (
                    <div
                      role="status"
                      aria-live="assertive"
                      className={`p-5 sm:p-6 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        winner === 'player1' || opponentMode === 'pass_and_play'
                          ? 'bg-emerald-950/40 border-emerald-500/60'
                          : 'bg-rose-950/40 border-rose-500/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                          <Trophy className="w-4 h-4 shrink-0" />
                          <span>Final Match Result · {moveHistory.length} Moves Played</span>
                        </div>
                        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                          {matchResultHeadline}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl">
                          {winReason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            startNewMatch(
                              initialHeaps,
                              convention,
                              maxTake,
                              startingPlayer === 'player1' ? 'player2' : 'player1',
                              selectedPresetId
                            )
                          }
                          className="px-3.5 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Swap Starter &amp; Rematch
                        </button>
                        <button
                          type="button"
                          onClick={() => startNewMatch()}
                          className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Play Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          {currentTurn === 'player2' && opponentMode !== 'pass_and_play' ? (
                            <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span className="text-amber-300">{activeTurnHeadline}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {currentTurn === 'player2' && opponentMode !== 'pass_and_play'
                              ? `${getPlayerLabel('player2')} is calculating its move...`
                              : `${getPlayerLabel(currentTurn)} — Select stones from any single heap`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Click any stone in a row to stage removing it and all stones to its right, or use the row quick-take buttons.
                        </p>
                      </div>

                      {/* Quick Turn Order & Undo Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {moveHistory.length === 0 && gameState === 'PLAYING' && (
                          <button
                            type="button"
                            onClick={() =>
                              startNewMatch(
                                initialHeaps,
                                convention,
                                maxTake,
                                currentTurn === 'player1' ? 'player2' : 'player1',
                                selectedPresetId
                              )
                            }
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {opponentMode === 'pass_and_play'
                              ? `Start with ${currentTurn === 'player1' ? 'Player 2' : 'Player 1'}`
                              : 'Let Opponent Move First'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleUndo}
                          disabled={moveHistory.length === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Undo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startNewMatch()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Hint Coaching Banner (if requested) */}
                {activeHint && gameState === 'PLAYING' && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                        <Lightbulb className="w-4 h-4 shrink-0" />
                        <span>
                          Suggested Move: Take {activeHint.count} Stone{activeHint.count > 1 ? 's' : ''} from{' '}
                          {getHeapLabel(activeHint.heapIndex)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{activeHint.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        executeMove(activeHint.heapIndex, activeHint.count, currentTurn)
                      }
                      className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Play Hint Move
                    </button>
                  </div>
                )}

                {/* HEAP ROWS TABLE */}
                <div className="space-y-3.5" role="region" aria-label="Nim Stone Heaps">
                  {heaps.map((stoneCount, heapIdx) => {
                    const initialCount = Math.max(initialHeaps[heapIdx] || stoneCount, stoneCount, 1);
                    const isStagedHeap = stagedMove?.heapIndex === heapIdx;
                    const isHoveredHeap = hoveredMove?.heapIndex === heapIdx;
                    const isBotTargetHeap = botAnimatingMove?.heapIndex === heapIdx;
                    const isHintHeap = activeHint?.heapIndex === heapIdx;

                    // How many stones from the right edge of this heap are highlighted for removal?
                    let highlightedRemoveCount = 0;
                    if (isBotTargetHeap && botAnimatingMove) {
                      highlightedRemoveCount = botAnimatingMove.count;
                    } else if (isHoveredHeap && hoveredMove) {
                      highlightedRemoveCount = hoveredMove.count;
                    } else if (isStagedHeap && stagedMove) {
                      highlightedRemoveCount = stagedMove.count;
                    }

                    const remainingAfterPreview = Math.max(0, stoneCount - highlightedRemoveCount);
                    const grundyVal = computeGrundy(stoneCount, maxTake);
                    const binaryStr = grundyVal.toString(2).padStart(4, '0');

                    return (
                      <div
                        key={heapIdx}
                        onMouseLeave={() => {
                          if (hoveredMove?.heapIndex === heapIdx) {
                            setHoveredMove(null);
                          }
                        }}
                        className={`p-4 rounded-xl border transition-colors ${
                          isStagedHeap || isHintHeap
                            ? 'bg-slate-800/90 border-amber-500/50'
                            : stoneCount === 0
                            ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                            : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Row Header: Heap Label + Count + Binary */}
                          <div className="flex items-center justify-between sm:justify-start gap-4 sm:w-44 shrink-0">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-display text-base font-semibold text-white whitespace-nowrap">
                                  {getHeapLabel(heapIdx)}
                                </span>
                                {showXRayInArena && (
                                  <span className="font-mono-tabular text-xs text-slate-400">
                                    {binaryStr}₂
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono-tabular">
                                {stoneCount === 0 ? (
                                  <span>Cleared</span>
                                ) : highlightedRemoveCount > 0 ? (
                                  <span className="text-amber-300 font-medium">
                                    {stoneCount} → {remainingAfterPreview} (−{highlightedRemoveCount})
                                  </span>
                                ) : (
                                  <span>
                                    {stoneCount} {stoneCount === 1 ? 'stone' : 'stones'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Tactile Stone Tokens */}
                          <div className="flex-1 flex flex-wrap items-center gap-2.5 min-h-[48px] py-1">
                            {Array.from({ length: initialCount }).map((_, stoneIdx) => {
                              const isPresent = stoneIdx < stoneCount;
                              if (!isPresent) {
                                // Empty recessed socket on the slate board where a stone used to sit
                                return (
                                  <div
                                    key={stoneIdx}
                                    aria-hidden="true"
                                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-dashed border-slate-800/80 bg-slate-950/40 flex items-center justify-center"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                                  </div>
                                );
                              }

                              // Clicking stone `stoneIdx` removes from `stoneIdx` to `stoneCount - 1`
                              // capped by `maxTake` if bounded subtraction is active
                              const rawCountFromHere = stoneCount - stoneIdx;
                              const effectiveTakeCount = maxTake
                                ? Math.min(rawCountFromHere, maxTake)
                                : rawCountFromHere;
                              const isMarkedForRemoval =
                                stoneIdx >= stoneCount - highlightedRemoveCount;
                              const isWarmIvory = (heapIdx + stoneIdx) % 2 === 0;

                              return (
                                <button
                                  key={stoneIdx}
                                  type="button"
                                  disabled={!isPlayerTurnInteractive}
                                  aria-label={`Remove ${effectiveTakeCount} stone${
                                    effectiveTakeCount > 1 ? 's' : ''
                                  } from ${getHeapLabel(heapIdx)}`}
                                  onMouseEnter={() => {
                                    if (!isPlayerTurnInteractive) return;
                                    setHoveredMove({
                                      heapIndex: heapIdx,
                                      count: effectiveTakeCount,
                                    });
                                  }}
                                  onClick={() => {
                                    if (!isPlayerTurnInteractive) return;
                                    soundFX.playStoneSelect(effectiveTakeCount);
                                    if (
                                      stagedMove &&
                                      stagedMove.heapIndex === heapIdx &&
                                      stagedMove.count === effectiveTakeCount
                                    ) {
                                      // Clicking already-staged stones confirms immediately
                                      executeMove(heapIdx, effectiveTakeCount, currentTurn);
                                    } else {
                                      setStagedMove({
                                        heapIndex: heapIdx,
                                        count: effectiveTakeCount,
                                      });
                                    }
                                  }}
                                  className={`group relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                                    isMarkedForRemoval
                                      ? '-translate-y-1.5 scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20'
                                      : 'hover:-translate-y-0.5'
                                  }`}
                                >
                                  {/* Crafted SVG Go / Marienbad Stone */}
                                  <svg
                                    viewBox="0 0 44 44"
                                    className="w-full h-full overflow-visible"
                                    aria-hidden="true"
                                  >
                                    <defs>
                                      <radialGradient
                                        id={`stone-grad-${heapIdx}-${stoneIdx}`}
                                        cx="34%"
                                        cy="30%"
                                        r="68%"
                                      >
                                        {isMarkedForRemoval ? (
                                          <>
                                            <stop offset="0%" stopColor="#fde68a" />
                                            <stop offset="55%" stopColor="#f59e0b" />
                                            <stop offset="100%" stopColor="#b45309" />
                                          </>
                                        ) : isWarmIvory ? (
                                          <>
                                            <stop offset="0%" stopColor="#ffffff" />
                                            <stop offset="60%" stopColor="#e2e8f0" />
                                            <stop offset="100%" stopColor="#94a3b8" />
                                          </>
                                        ) : (
                                          <>
                                            <stop offset="0%" stopColor="#475569" />
                                            <stop offset="55%" stopColor="#1e293b" />
                                            <stop offset="100%" stopColor="#090d16" />
                                          </>
                                        )}
                                      </radialGradient>
                                    </defs>
                                    <circle
                                      cx="22"
                                      cy="23"
                                      r="19"
                                      fill="rgba(0,0,0,0.45)"
                                    />
                                    <circle
                                      cx="22"
                                      cy="21"
                                      r="18.5"
                                      fill={`url(#stone-grad-${heapIdx}-${stoneIdx})`}
                                      stroke={
                                        isMarkedForRemoval
                                          ? '#fef3c7'
                                          : isWarmIvory
                                          ? '#cbd5e1'
                                          : '#334155'
                                      }
                                      strokeWidth="1"
                                    />
                                    {/* Specular highlight */}
                                    <ellipse
                                      cx="16"
                                      cy="15"
                                      rx="5"
                                      ry="2.8"
                                      transform="rotate(-25 16 15)"
                                      fill={
                                        isMarkedForRemoval || isWarmIvory
                                          ? 'rgba(255,255,255,0.65)'
                                          : 'rgba(255,255,255,0.22)'
                                      }
                                    />
                                  </svg>
                                  <span
                                    className={`absolute inset-0 flex items-center justify-center font-mono-tabular text-[11px] font-semibold select-none ${
                                      isMarkedForRemoval
                                        ? 'text-slate-950'
                                        : isWarmIvory
                                        ? 'text-slate-800'
                                        : 'text-slate-200'
                                    }`}
                                  >
                                    {stoneIdx + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Row Quick-Take Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {[1, 2, 3].map((amt) => {
                              const allowed =
                                stoneCount >= amt && (!maxTake || amt <= maxTake);
                              const isSelectedQuick =
                                stagedMove?.heapIndex === heapIdx && stagedMove?.count === amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  disabled={!isPlayerTurnInteractive || !allowed}
                                  onClick={() => {
                                    soundFX.playStoneSelect(amt);
                                    if (isSelectedQuick) {
                                      executeMove(heapIdx, amt, currentTurn);
                                    } else {
                                      setStagedMove({ heapIndex: heapIdx, count: amt });
                                    }
                                  }}
                                  className={`px-2.5 py-1.5 text-xs font-mono-tabular font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                    isSelectedQuick
                                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none'
                                  }`}
                                >
                                  −{amt}
                                </button>
                              );
                            })}
                            {(!maxTake || stoneCount <= maxTake) && stoneCount > 0 && (
                              <button
                                type="button"
                                disabled={!isPlayerTurnInteractive}
                                onClick={() => {
                                  soundFX.playStoneSelect(stoneCount);
                                  if (
                                    stagedMove?.heapIndex === heapIdx &&
                                    stagedMove?.count === stoneCount
                                  ) {
                                    executeMove(heapIdx, stoneCount, currentTurn);
                                  } else {
                                    setStagedMove({ heapIndex: heapIdx, count: stoneCount });
                                  }
                                }}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  stagedMove?.heapIndex === heapIdx &&
                                  stagedMove?.count === stoneCount
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none'
                                }`}
                              >
                                All
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Action Confirmation Bar OR Victory Summary Panel */}
                {gameState === 'GAME_OVER' ? (
                  <div className="p-6 rounded-xl bg-slate-950 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                        <span>Match Concluded</span>
                        <span aria-hidden="true">·</span>
                        <span>{moveHistory.length} Total Moves</span>
                        <span aria-hidden="true">·</span>
                        <span>Player 1 Optimal Move Rate: {playerMoveAccuracy}%</span>
                      </div>
                      <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                        {matchResultHeadline}
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                        {winReason}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Step Back
                      </button>
                      <button
                        type="button"
                        onClick={() => startNewMatch()}
                        className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Play Again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!isPlayerTurnInteractive}
                        onClick={handleRequestHint}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Hint / Best Move</span>
                      </button>
                      {stagedMove ? (
                        <span className="text-xs text-slate-300">
                          Staged:{' '}
                          <strong className="text-amber-300 font-semibold">
                            Remove {stagedMove.count} stone{stagedMove.count > 1 ? 's' : ''} from{' '}
                            {getHeapLabel(stagedMove.heapIndex)}
                          </strong>{' '}
                          (click again or press Enter)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Tip: Double-click any stone to remove it and all stones to its right immediately.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {stagedMove && (
                        <button
                          type="button"
                          onClick={() => setStagedMove(null)}
                          className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!stagedMove || !isPlayerTurnInteractive}
                        onClick={() => {
                          if (stagedMove) {
                            executeMove(stagedMove.heapIndex, stagedMove.count, currentTurn);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>
                          {stagedMove
                            ? `Take ${stagedMove.count} from ${getHeapLabel(stagedMove.heapIndex)}`
                            : 'Select Stones to Move'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT 4 COLS: LIVE NIM-SUM (XOR) ANALYZER & MOVE LOG */}
              <div className="lg:col-span-4 space-y-6">
                {/* Live Binary XOR Telemetry Panel */}
                <section
                  aria-label="Nim-Sum Binary Analyzer"
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-white">
                        Binary Nim-Sum (XOR)
                      </h2>
                      <p className="text-xs text-slate-400">
                        {previewAnalysis
                          ? `Previewing after removing ${previewMove?.count} from ${getHeapLabel(
                              previewMove?.heapIndex || 0
                            )}`
                          : 'Live Sprague-Grundy bit decomposition'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('analyzer')}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 underline-offset-4 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Full X-Ray
                    </button>
                  </div>

                  {showXRayInArena ? (
                    <>
                      {/* Explicit Non-Hue-Only State Evaluation */}
                      <div
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          (previewAnalysis || analysis).isNPosition
                            ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {(previewAnalysis || analysis).isNPosition ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <span>{(previewAnalysis || analysis).statusLabel}</span>
                        </div>
                        <span className="font-mono-tabular text-xs font-semibold">
                          ⊕ = {(previewAnalysis || analysis).nimSum}
                        </span>
                      </div>

                      {/* Binary Decomposition Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-mono-tabular text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 pr-2 font-sans font-medium">Heap</th>
                              <th className="py-2 px-2 text-right">Count</th>
                              <th className="py-2 px-2 text-center">8</th>
                              <th className="py-2 px-2 text-center">4</th>
                              <th className="py-2 px-2 text-center">2</th>
                              <th className="py-2 pl-2 text-center">1</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {(previewAnalysis || analysis).rows.map((row) => (
                              <tr key={row.heapIndex} className="text-slate-200">
                                <td className="py-2 pr-2 font-sans font-medium text-slate-300">
                                  {row.label}
                                </td>
                                <td className="py-2 px-2 text-right text-slate-400">
                                  {row.stones}
                                  {maxTake ? ` (g=${row.grundy})` : ''}
                                </td>
                                {row.bits.map((bit, bIdx) => (
                                  <td
                                    key={bIdx}
                                    className={`py-2 px-2 text-center font-semibold ${
                                      bit === 1 ? 'text-amber-400' : 'text-slate-600'
                                    }`}
                                  >
                                    {bit}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-700 font-semibold text-white">
                              <td className="pt-2.5 pr-2 font-sans text-xs text-slate-300">
                                Nim-Sum (⊕)
                              </td>
                              <td className="pt-2.5 px-2 text-right text-amber-400">
                                {(previewAnalysis || analysis).nimSum}
                              </td>
                              {(previewAnalysis || analysis).nimSumBits.map((bit, bIdx) => (
                                <td
                                  key={bIdx}
                                  className={`pt-2.5 px-2 text-center ${
                                    bit === 1 ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {bit}
                                </td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {(previewAnalysis || analysis).mathematicalSummary}
                      </p>
                    </>
                  ) : (
                    <div className="py-6 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        XOR Telemetry is hidden for pure competitive parlor play.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowXRayInArena(true)}
                        className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        Reveal Binary Nim-Sum Table
                      </button>
                    </div>
                  )}
                </section>

                {/* Session Score & Algebraic Move History */}
                <section
                  aria-label="Move History and Session Score"
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <h2 className="font-display text-lg font-semibold text-white">
                      Move Log &amp; Tally
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                      <span>
                        {getPlayerLabel('player1')}: {sessionStats.player1Wins}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {getPlayerLabel('player2')}: {sessionStats.player2Wins}
                      </span>
                    </div>
                  </div>

                  {moveHistory.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No moves recorded yet. Select stones on the board to begin the match.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                      {moveHistory.map((m) => (
                        <div
                          key={m.moveNumber}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-tabular font-semibold text-slate-200">
                              {m.moveNumber}. {m.actorName} · {getHeapLabel(m.heapIndex)} (−{m.taken})
                            </span>
                            <span className="font-mono-tabular text-slate-400">
                              [{m.heapsAfter.join(', ')}] · ⊕={m.nimSumAfter}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {m.wasOptimal ? 'Optimal · ' : ''}
                            {m.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 2: VARIANTS & CUSTOM BOARD BUILDER
            ===================================================================== */}
        {activeSection === 'variants' && (
          <div className="space-y-10">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Rule Presets</span>
                <span aria-hidden="true">·</span>
                <span>Custom Heap Architect</span>
              </div>
              <h1 className="font-display text-3xl font-semibold text-white">
                Historical Variants &amp; Custom Heaps
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Select a classic combinatorial preset or engineer your own multi-heap configuration with Normal Play, Misère Play, or Sprague-Grundy bounded subtraction.
              </p>
            </div>

            {/* 6 Curated Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {NIM_PRESETS.map((preset) => {
                const presetEval = analyzePosition(
                  preset.heaps,
                  preset.convention,
                  preset.maxTake
                );
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-6 rounded-2xl border flex flex-col justify-between gap-5 transition-colors ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/60'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                        <span>{preset.origin}</span>
                        <span aria-hidden="true">·</span>
                        <span>Opening ⊕ = {presetEval.nimSum}</span>
                      </div>
                      <h2 className="font-display text-xl font-semibold text-white">
                        {preset.name}
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-400">
                        {presetEval.isNPosition ? '1st Player Advantage' : '2nd Player Advantage'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Launch Preset</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Heap Builder */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-semibold text-white">
                    Custom Board Architect
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure between 2 and 6 heaps (1–12 stones per heap) and inspect the opening Nim-sum before starting.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={customHeaps.length <= 2}
                    onClick={() => setCustomHeaps((prev) => prev.slice(0, -1))}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Remove Heap</span>
                  </button>
                  <button
                    type="button"
                    disabled={customHeaps.length >= 6}
                    onClick={() => setCustomHeaps((prev) => [...prev, 4])}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Heap</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customHeaps.map((count, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-display text-base font-semibold text-white">
                        {getHeapLabel(idx)}
                      </div>
                      <div className="text-xs text-slate-400 font-mono-tabular">
                        {count} stones · {count.toString(2).padStart(4, '0')}₂
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={count <= 1}
                        onClick={() =>
                          setCustomHeaps((prev) =>
                            prev.map((c, i) => (i === idx ? Math.max(1, c - 1) : c))
                          )
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
                        aria-label={`Decrease stones in ${getHeapLabel(idx)}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono-tabular text-sm font-semibold text-amber-400">
                        {count}
                      </span>
                      <button
                        type="button"
                        disabled={count >= 12}
                        onClick={() =>
                          setCustomHeaps((prev) =>
                            prev.map((c, i) => (i === idx ? Math.min(12, c + 1) : c))
                          )
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
                        aria-label={`Increase stones in ${getHeapLabel(idx)}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCustomConvention('normal')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        customConvention === 'normal'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Normal Play (Last Wins)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomConvention('misere')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        customConvention === 'misere'
                          ? 'bg-slate-800 text-amber-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Misère Play (Last Loses)
                    </button>
                  </div>

                  <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCustomMaxTake(null)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        customMaxTake === null
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Unlimited Take
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMaxTake(3)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        customMaxTake === 3
                          ? 'bg-slate-800 text-amber-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Max 3 Stones / Turn
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyCustomBoard}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Start Custom Match ([{customHeaps.join(', ')}])</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 3: DEDICATED NIM-SUM (XOR) ANALYZER & OPTIMAL MOVE CALCULATOR
            ===================================================================== */}
        {activeSection === 'analyzer' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Sprague-Grundy Theorem</span>
                  <span aria-hidden="true">·</span>
                  <span>Bitwise Exclusive-OR (⊕) Inspector</span>
                </div>
                <h1 className="font-display text-3xl font-semibold text-white">
                  Live Nim-Sum &amp; Move Tree Analyzer
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Inspect the exact binary column parity of your active match or modify heap counts directly to test Bouton’s winning condition ($s_1 \oplus s_2 \oplus \dots \oplus s_n = 0$).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('arena')}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Return to Arena Board
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Cols: Binary Parity Matrix */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-xl font-semibold text-white">
                    Bitwise Column Decomposition
                  </h2>
                  <span className="font-mono-tabular text-xs text-slate-400">
                    Nim-Sum = {analysis.nimSum} ({analysis.nimSumBits.join('')}₂)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono-tabular text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="py-3 pr-4 font-sans font-medium">Heap</th>
                        <th className="py-3 px-3 text-center">Adjust</th>
                        <th className="py-3 px-3 text-right">Grundy</th>
                        <th className="py-3 px-3 text-center">8 (2³)</th>
                        <th className="py-3 px-3 text-center">4 (2²)</th>
                        <th className="py-3 px-3 text-center">2 (2¹)</th>
                        <th className="py-3 pl-3 text-center">1 (2⁰)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {analysis.rows.map((row) => (
                        <tr key={row.heapIndex} className="text-slate-200">
                          <td className="py-3 pr-4 font-sans font-medium text-white">
                            {row.label}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={row.stones <= 0}
                                onClick={() => {
                                  const next = [...heaps];
                                  next[row.heapIndex] = Math.max(0, next[row.heapIndex] - 1);
                                  setHeaps(next);
                                }}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 cursor-pointer"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs">{row.stones}</span>
                              <button
                                type="button"
                                disabled={row.stones >= 15}
                                onClick={() => {
                                  const next = [...heaps];
                                  next[row.heapIndex] = Math.min(15, next[row.heapIndex] + 1);
                                  setHeaps(next);
                                }}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-300">{row.grundy}</td>
                          {row.bits.map((bit, bIdx) => (
                            <td
                              key={bIdx}
                              className={`py-3 px-3 text-center font-semibold ${
                                bit === 1 ? 'text-amber-400' : 'text-slate-600'
                              }`}
                            >
                              {bit}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 font-semibold">
                        <td
                          colSpan={2}
                          className="pt-4 pr-4 font-sans text-xs text-slate-300"
                        >
                          Column Parity Sum (XOR ⊕)
                        </td>
                        <td className="pt-4 px-3 text-right text-amber-400">
                          {analysis.nimSum}
                        </td>
                        {analysis.nimSumBits.map((bit, bIdx) => (
                          <td
                            key={bIdx}
                            className={`pt-4 px-3 text-center ${
                              bit === 1 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {bit} ({bit === 1 ? 'Odd' : 'Even'})
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-xs font-semibold text-white">
                    Diagnosis: {analysis.statusLabel}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {analysis.mathematicalSummary}
                  </p>
                </div>
              </div>

              {/* Right 5 Cols: Winning Move Enumeration */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-semibold text-white">
                    Winning Move Enumeration ({analysis.optimalMoves.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Every legal move below transitions the board into a P-Position for your opponent.
                  </p>
                </div>

                {analysis.optimalMoves.length === 0 ? (
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Zero Winning Moves Available (P-Position)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Because every binary column already has an even number of 1-bits (or you face an odd number of unit heaps in Misère play), any move you make will unbalance at least one bit column.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.optimalMoves.map((move, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-emerald-400">
                              Take {move.count} from {getHeapLabel(move.heapIndex)}
                            </span>
                            <span className="font-mono-tabular text-xs text-slate-400">
                              Result: [{move.resultingHeaps.join(', ')}] · ⊕={move.resultingNimSum}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {move.reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            executeMove(move.heapIndex, move.count, currentTurn);
                            setActiveSection('arena');
                          }}
                          className="self-start px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Execute Move in Arena
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 4: STRATEGY GUIDE & INTERACTIVE ENDGAME PUZZLES
            ===================================================================== */}
        {activeSection === 'strategy' && (
          <div className="space-y-12">
            {/* Interactive Mastery Puzzles Section */}
            <section className="space-y-6">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Tactical Training</span>
                  <span aria-hidden="true">·</span>
                  <span>6 Combinatorial Endgame Challenges</span>
                </div>
                <h1 className="font-display text-3xl font-semibold text-white">
                  Combinatorial Mastery Puzzles
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Test your ability to compute binary Nim-sums and Misère endgame inversions mentally. Select a puzzle and click the exact stones to remove in one winning move.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Puzzle Selector List (4 Cols) */}
                <div className="lg:col-span-4 space-y-2.5">
                  {NIM_PUZZLES.map((p) => {
                    const isCurrent = p.id === activePuzzle.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPuzzleId(p.id);
                          setPuzzleAttempt(null);
                          setShowPuzzleHint(false);
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-900 border-amber-400/70'
                            : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
                          <span>{p.difficulty}</span>
                          <span className="font-mono-tabular">[{p.heaps.join(' · ')}]</span>
                        </div>
                        <div className="font-display text-base font-semibold text-white">
                          {p.title}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Puzzle Solver Card (8 Cols) */}
                <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{activePuzzle.difficulty}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {activePuzzle.convention === 'normal'
                            ? 'Normal Play (Last Wins)'
                            : 'Misère Play (Last Loses)'}
                        </span>
                        {activePuzzle.maxTake && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Max {activePuzzle.maxTake} Stones</span>
                          </>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-semibold text-white">
                        {activePuzzle.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLoadPuzzleToArena(activePuzzle)}
                      className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Load Full Match in Arena
                    </button>
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed">
                    {activePuzzle.prompt}
                  </p>

                  {/* Interactive Puzzle Heaps */}
                  <div className="space-y-3">
                    {activePuzzle.heaps.map((count, hIdx) => (
                      <div
                        key={hIdx}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="sm:w-36 shrink-0">
                          <div className="font-display text-sm font-semibold text-white">
                            {getHeapLabel(hIdx)}
                          </div>
                          <div className="text-xs text-slate-400 font-mono-tabular">
                            {count} stones ({count.toString(2).padStart(4, '0')}₂)
                          </div>
                        </div>

                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          {Array.from({ length: count }).map((_, sIdx) => {
                            const rawTake = count - sIdx;
                            const takeAmt = activePuzzle.maxTake
                              ? Math.min(rawTake, activePuzzle.maxTake)
                              : rawTake;
                            const isSelectedInAttempt =
                              puzzleAttempt?.heapIndex === hIdx &&
                              sIdx >= count - puzzleAttempt.count;

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => {
                                  soundFX.playStoneSelect(takeAmt);
                                  const matched = activePuzzleAnalysis.optimalMoves.find(
                                    (m) => m.heapIndex === hIdx && m.count === takeAmt
                                  );
                                  if (matched) {
                                    setPuzzleAttempt({
                                      heapIndex: hIdx,
                                      count: takeAmt,
                                      isCorrect: true,
                                      feedback: `Correct! ${matched.reason}`,
                                    });
                                  } else {
                                    const nextHeaps = [...activePuzzle.heaps];
                                    nextHeaps[hIdx] -= takeAmt;
                                    const remXor = nextHeaps.reduce(
                                      (acc, s) => acc ^ computeGrundy(s, activePuzzle.maxTake),
                                      0
                                    );
                                    setPuzzleAttempt({
                                      heapIndex: hIdx,
                                      count: takeAmt,
                                      isCorrect: false,
                                      feedback: `Removing ${takeAmt} from ${getHeapLabel(
                                        hIdx
                                      )} leaves [${nextHeaps.join(', ')}] with Nim-sum ${remXor}, allowing your opponent a forced win. Try another move!`,
                                    });
                                  }
                                }}
                                className={`w-9 h-9 rounded-full font-mono-tabular text-xs font-semibold transition-transform cursor-pointer ${
                                  isSelectedInAttempt
                                    ? puzzleAttempt?.isCorrect
                                      ? 'bg-emerald-400 text-slate-950 scale-105 ring-2 ring-emerald-200'
                                      : 'bg-rose-500 text-white scale-105 ring-2 ring-rose-300'
                                    : 'bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-200'
                                }`}
                                title={`Test removing ${takeAmt} from ${getHeapLabel(hIdx)}`}
                              >
                                −{takeAmt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Puzzle Feedback & Hint */}
                  {puzzleAttempt && (
                    <div
                      className={`p-4 rounded-xl border text-xs leading-relaxed ${
                        puzzleAttempt.isCorrect
                          ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                          : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
                      }`}
                    >
                      <strong className="font-semibold block mb-0.5">
                        {puzzleAttempt.isCorrect ? 'Solved Optimal Move' : 'Not Optimal'}
                      </strong>
                      {puzzleAttempt.feedback}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPuzzleHint((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{showPuzzleHint ? 'Hide Mathematical Hint' : 'Reveal Mathematical Hint'}</span>
                    </button>
                  </div>

                  {showPuzzleHint && (
                    <p className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      {activePuzzle.hint}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Editorial Treatise on Bouton's Theorem (with Generated Photography & Fallbacks) */}
            <section className="pt-8 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Combinatorial Game Theory</span>
                    <span aria-hidden="true">·</span>
                    <span>Charles Leonard Bouton (1901)</span>
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-white">
                    The Complete Mathematical Theory of Nim
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    In 1901, Harvard mathematician Charles Leonard Bouton published <em>Nim, A Game with a Complete Mathematical Theory</em>, launching modern combinatorial game theory. Bouton proved that any multi-heap game of Nim is completely solved by expressing each heap size in binary and computing their bitwise exclusive-OR sum ($s_1 \oplus s_2 \oplus \dots \oplus s_k$).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <h3 className="font-display text-base font-semibold text-amber-400">
                        01. Normal Play Equilibrium
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        A position with a Nim-sum of 0 ($0000_2$) is a <strong>P-Position</strong>: every legal move changes at least one binary bit in a single heap, forcing the Nim-sum to become non-zero. Conversely, from any non-zero <strong>N-Position</strong>, there is always a move that restores the Nim-sum to 0.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <h3 className="font-display text-base font-semibold text-amber-400">
                        02. The Misère Endgame Inversion
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        When the last stone loses, play follows normal zero-XOR strategy until your move would leave only heaps of size 1. At that exact transition, reduce the last large heap to leave an <strong>odd number</strong> of size-1 heaps.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-400">
                  <span>Sprague-Grundy Theorem (1935–1939): Every impartial game is equivalent to a Nim heap.</span>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 gap-6">
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[220px] flex flex-col justify-end">
                  {!heroImgError ? (
                    <img
                      src={heroBoardImg}
                      alt="Top-down studio view of the Marienbad 1-3-5-7 stone pyramid on dark slate"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-amber-400/40" />
                    </div>
                  )}
                  <div className="relative z-10 p-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-1">
                    <div className="text-xs font-medium text-amber-300">
                      Marienbad 1 · 3 · 5 · 7 Configuration
                    </div>
                    <p className="text-xs text-slate-200">
                      Because $1 \oplus 3 \oplus 5 \oplus 7 = 0$, the classic Marienbad layout is a second-player win under perfect play.
                    </p>
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[220px] flex flex-col justify-end">
                  {!tokensImgError ? (
                    <img
                      src={boutonTokensImg}
                      alt="Polished brass and slate mathematical game tokens representing binary powers"
                      referrerPolicy="no-referrer"
                      onError={() => setTokensImgError(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-amber-400/40" />
                    </div>
                  )}
                  <div className="relative z-10 p-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-1">
                    <div className="text-xs font-medium text-amber-300">
                      Binary Sub-Piles ($8, 4, 2, 1$)
                    </div>
                    <p className="text-xs text-slate-200">
                      Mentally split every heap into powers of two and pair off matching powers across rows.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* QUIET EDITORIAL FOOTER */}
      <footer className="mt-12 border-t border-slate-800/80 py-6 px-6 lg:px-10 text-xs text-slate-400">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Marienbad · Combinatorial Game Theory &amp; Classic Nim Strategy
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('arena')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Arena
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('variants')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Variants
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('analyzer')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Nim-Sum X-Ray
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('strategy')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Puzzles &amp; Theory
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
{/* PROJECT DONE */}
