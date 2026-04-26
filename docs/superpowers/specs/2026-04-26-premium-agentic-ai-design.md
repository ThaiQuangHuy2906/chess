# Premium Agentic Chess AI Design

## Goal

Build the best local-first premium version of the chess AI without adding backend or API-key requirements. The app should feel like a Vietnamese agentic chess product: the AI plays with a visible goal, produces a short plan, reviews risk, explains its move, and coaches the player in Vietnamese.

## Scope

- Translate player-facing app text to Vietnamese.
- Upgrade the existing minimax AI into an agent-style decision pipeline.
- Return a structured `AgentTrace` with observation, goal, tool usage, candidates, plan, risk, reflection, and coaching.
- Keep `chess.js` as the rule authority.
- Keep everything browser-local for this iteration.
- Leave clear TypeScript boundaries for future Stockfish, backend LLM, IndexedDB, graph memory, or tool-router integrations.

## Architecture

The app remains a React + TypeScript + Vite app. `src/game.ts` stays responsible for legal chess state. `src/ai.ts` becomes the local agent module: it observes the current `GameState`, evaluates legal candidates, chooses a goal, creates a short plan, selects a move, and returns structured Vietnamese explanations. `src/App.tsx` renders the board, controls, agent trace, coach insight, and move history in Vietnamese.

The local agent has this loop:

1. Observe: read FEN, turn, status, legal moves, material, checks, and recent history.
2. Plan: classify the position goal and produce candidate move plans.
3. Evaluate: score candidates with minimax plus tactical and positional metadata.
4. Act: choose one legal move.
5. Reflect: summarize why the move was selected, what risk remains, and what the human should watch next.

## Data Model

`AgentDecision` should keep the current fields used by the UI and tests, while adding:

- `trace`: structured, human-readable agent reasoning.
- `goal`: concise tactical or strategic goal.
- `principalVariation`: 1-3 SAN moves from the best local continuation.
- `risk`: the main downside or opponent resource.
- `toolsUsed`: names of local tools used by the agent pipeline.

`CoachInsight` should include:

- best move and score,
- top candidate list,
- player-facing suggestion,
- risk warning,
- plan summary,
- memory notes.

## UI

The first screen remains the playable chess app, not a landing page. The UI should use compact operational panels:

- board and status,
- game controls,
- selection details,
- premium agent panel,
- Vietnamese coach panel,
- move history.

The tone is Vietnamese, concise, and chess-specific. No backend status or unimplemented promise should be shown as if it already exists.

## Memory

This iteration uses lightweight in-memory analysis derived from current game history, not persistent storage. It may detect repeated captures, checks, opening phase, material swing, and tactical themes. The code should keep a clean boundary so persistent browser memory can be added later.

## Error Handling

The agent never returns an illegal move. If no moves exist, it throws the existing no-legal-move error. Coach insight returns a finished-game explanation when the game is locked.

## Testing

Add or update tests for:

- legal move selection,
- mate-in-one behavior,
- high-value capture preference,
- special moves,
- structured Vietnamese coach insight,
- `AgentTrace` fields for tools, goal, plan, risk, and reflection.

Verification commands:

- `npm test`
- `npm run build`

## Assumptions

- "Premium" means best possible local-first UX and architecture in this repo, not paid API integration.
- No backend, OpenAI API, Stockfish WASM, IndexedDB, or graph database is added in this iteration.
- Existing uncommitted changes are treated as user-owned baseline and are not reverted.
