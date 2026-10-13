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
---

## 🏛️ Preset Board Configurations

The arena comes pre-loaded with famous mathematical heap distributions, each offering unique tactical properties:

| Preset Name | Heap Distribution | Initial Nim-Sum ($S$) | Initial State | Theoretical Significance |
| :--- | :--- | :---: | :---: | :--- |
| **Marienbad** | `1 · 3 · 5 · 7` | `0` ($0000_2$) | **P-Position** | Immortalized by the 1961 film *Last Year at Marienbad*; second player has a guaranteed win under optimal play. |
| **Bouton's Triad** | `3 · 4 · 5` | `2` ($0010_2$) | **N-Position** | Charles L. Bouton's classic 1901 foundational example; first player wins by reducing the `3`-stone heap to `1`. |
| **Fibonacci** | `2 · 3 · 5 · 8` | `12` ($1100_2$) | **N-Position** | Asymmetric growth distribution requiring high-bit ($8$ and $4$) parity balancing. |
| **Binary Powers** | `1 · 2 · 4 · 8` | `15` ($1111_2$) | **N-Position** | Every binary bit is active ($2^0, 2^1, 2^2, 2^3$). Cannot be balanced in a single move without subtraction rules. |
| **Bounded Subtraction** | Custom + Cap $k$ | $\text{Grundy}(n) = n \bmod (k+1)$ | **Variable** | Restricts max stones removed per turn ($1 \le x \le k$), shifting the math to modular Sprague-Grundy arithmetic. |

---

## 🧠 Mathematical Engine & Game Theory

### 1. The Nim-Sum ($\oplus$) & 4-Bit Decomposition
By the **Sprague-Grundy Theorem**, any impartial game under normal play is equivalent to a single-heap Nim game (a *nimber*). For heaps of size $h_1, h_2, \dots, h_n$, the game state is evaluated via the bitwise XOR sum:

$$S = h_1 \oplus h_2 \oplus \dots \oplus h_n$$

* **$\mathcal{P}$-Position (Previous Player Wins | $S = 0$):** A balanced zero-sum trap. Every legal move is guaranteed to transition the board to an $\mathcal{N}$-position ($S \neq 0$).
* **$\mathcal{N}$-Position (Next Player Wins | $S \neq 0$):** A winning advantage exists. To find a winning move, locate a heap $h_i$ where the most significant bit of $S$ is `1` (such that $(h_i \oplus S) < h_i$), and reduce that heap to $h_i' = h_i \oplus S$.

#### Example: Evaluating `3 · 4 · 5` in the 4-Bit Analyzer
```text
Heap 1 (3) :  0  0  1  1
Heap 2 (4) :  0  1  0  0
Heap 3 (5) :  0  1  0  1
------------------------ (XOR)
Nim-Sum (2):  0  0  1  0  --> Non-zero (N-Position: Winning Move Available)
