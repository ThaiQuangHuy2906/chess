import { useState } from 'react'
import './App.css'
import {
  applyMove,
  areSquaresEqual,
  createInitialGameState,
  formatColor,
  getLegalMoves,
  getPieceAt,
  isGameLocked,
  squareToAlgebraic,
  type Piece,
  type Square,
} from './game'

const PIECE_SYMBOLS: Record<Piece['color'], Record<Piece['type'], string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
}

function App() {
  const [gameState, setGameState] = useState(createInitialGameState)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  const selectedPiece = selectedSquare
    ? getPieceAt(gameState.board, selectedSquare)
    : null
  const legalMoves = selectedSquare
    ? getLegalMoves(gameState.board, selectedSquare, gameState.turn)
    : []
  const historyRows = buildHistoryRows(gameState.history)

  function handleSquareClick(square: Square) {
    if (isGameLocked(gameState.status)) {
      return
    }

    const clickedPiece = getPieceAt(gameState.board, square)

    if (!selectedSquare) {
      if (clickedPiece?.color === gameState.turn) {
        setSelectedSquare(square)
      }

      return
    }

    if (areSquaresEqual(selectedSquare, square)) {
      setSelectedSquare(null)
      return
    }

    if (legalMoves.some((move) => areSquaresEqual(move, square))) {
      setGameState((current) => applyMove(current, selectedSquare, square))
      setSelectedSquare(null)
      return
    }

    if (clickedPiece?.color === gameState.turn) {
      setSelectedSquare(square)
    }
  }

  function handleReset() {
    setGameState(createInitialGameState())
    setSelectedSquare(null)
  }

  return (
    <main className="app-shell">
      <header className="panel hero-panel">
        <div>
          <p className="eyebrow">React + TypeScript local PvP</p>
          <h1>Chess MVP</h1>
          <p className="hero-copy">
            Reduced ruleset only: no castling, no en passant, no promotion.
          </p>
        </div>
        <button type="button" className="reset-button" onClick={handleReset}>
          Reset game
        </button>
      </header>

      <div className="layout">
        <section className="panel board-panel">
          <div className="status-row">
            <div>
              <span className="label">Current turn</span>
              <strong className="turn-value">{formatColor(gameState.turn)}</strong>
            </div>
            <p className={`status-badge status-badge--${gameState.status.kind}`}>
              {gameState.status.message}
            </p>
          </div>

          <div className="board" role="grid" aria-label="Chess board">
            {gameState.board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                const square = { row: rowIndex, col: colIndex }
                const isLightSquare = (rowIndex + colIndex) % 2 === 0
                const isSelected =
                  selectedSquare !== null && areSquaresEqual(selectedSquare, square)
                const isLegalMove = legalMoves.some((move) =>
                  areSquaresEqual(move, square),
                )
                const classes = [
                  'square',
                  isLightSquare ? 'square--light' : 'square--dark',
                  isSelected ? 'square--selected' : '',
                  isLegalMove ? 'square--legal' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={squareToAlgebraic(square)}
                    type="button"
                    className={classes}
                    onClick={() => handleSquareClick(square)}
                    aria-label={buildSquareLabel(piece, square)}
                  >
                    <span className="square-name">{squareToAlgebraic(square)}</span>
                    {piece ? (
                      <span className="piece-symbol" aria-hidden="true">
                        {PIECE_SYMBOLS[piece.color][piece.type]}
                      </span>
                    ) : null}
                  </button>
                )
              }),
            )}
          </div>

          <p className="board-note">
            If a pawn reaches the final rank, the app stops in an unsupported
            state and asks for a reset. Promotion is not implemented.
          </p>
        </section>

        <aside className="sidebar">
          <section className="panel info-panel">
            <h2>Selection</h2>
            <p className="selection-copy">
              {selectedSquare && selectedPiece
                ? `${formatColor(selectedPiece.color)} ${selectedPiece.type} at ${squareToAlgebraic(selectedSquare)}. ${legalMoves.length} legal move${legalMoves.length === 1 ? '' : 's'} available.`
                : isGameLocked(gameState.status)
                  ? 'The board is locked. Reset to start a new game.'
                  : 'Select one of the current player’s pieces to see its legal moves.'}
            </p>
          </section>

          <section className="panel info-panel">
            <div className="history-header">
              <h2>Move history</h2>
              <span>{gameState.history.length} moves</span>
            </div>

            {historyRows.length > 0 ? (
              <div className="history-list" role="list" aria-label="Move history">
                {historyRows.map((entry) => (
                  <div key={entry.number} className="history-row" role="listitem">
                    <span className="history-index">{entry.number}.</span>
                    <span>{entry.white}</span>
                    <span>{entry.black ?? '...'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No moves yet.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

function buildSquareLabel(piece: Piece | null, square: Square): string {
  const location = squareToAlgebraic(square)

  if (!piece) {
    return `Empty square ${location}`
  }

  return `${formatColor(piece.color)} ${piece.type} on ${location}`
}

function buildHistoryRows(history: Array<{ notation: string }>) {
  const rows: Array<{ number: number; white: string; black?: string }> = []

  for (let index = 0; index < history.length; index += 2) {
    rows.push({
      number: index / 2 + 1,
      white: history[index].notation,
      black: history[index + 1]?.notation,
    })
  }

  return rows
}

export default App
