# Marienbad: Classic Nim & Combinatorial Strategy

An interactive web application for playing the mathematical strategy game of **Nim** across classic Marienbad (`1 · 3 · 5 · 7`), Bouton's Triad (`3 · 4 · 5`), Fibonacci (`2 · 3 · 5 · 8`), Binary Powers (`1 · 2 · 4 · 8`), Bounded Subtraction, and custom heap configurations.

## Features

- **Playable Nim Arena**:
  - **Single-Player vs. AI**: Face the **Bouton Solver (Grandmaster)** (which calculates exact binary XOR Nim-sums and executes the Misère endgame parity switch), **Tactician**, or **Novice** bots.
  - **Two-Player Local (`2P Local`)**: Pass-and-play mode with a live dual-player turn tracker (`PLAYER 1'S TURN` / `PLAYER 2'S TURN`) and explicit post-game match result announcements (`YOU WON THE MATCH`, `OPPONENT WON THE MATCH`, `PLAYER 1 WON THE MATCH`, `PLAYER 2 WON THE MATCH`).
  - **Normal & Misère Conventions**: Play with either *Last Stone Wins* (Normal Play) or *Last Stone Loses* (Misère Play).
- **Live Binary Nim-Sum (XOR) Analyzer**:
  - Real-time 4-bit binary decomposition ($8, 4, 2, 1$) and Sprague-Grundy values.
  - Automatic classification of **N-Positions** (Winning advantage) and **P-Positions** (Balanced zero-sum trap), plus full winning move enumeration.
- **Custom Board Architect & Mastery Puzzles**:
  - Build custom boards from 2 to 6 heaps (1–12 stones per heap) with optional per-turn subtraction limits.
  - Solve 6 interactive one-move Combinatorial Game Theory endgame puzzles.

## Getting Started Locally

### Prerequisites

- **Node.js** (v18 or newer recommended)
- **npm**

### Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Start the development server on http://localhost:3000
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```
