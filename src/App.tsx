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
    PROMOTION_PIECE_TYPES,
    requiresPromotionChoice,
    squareToAlgebraic,
    type Piece,
    type PromotionPieceType,
    type Square,
} from './game'

const PIECE_SYMBOLS: Record<Piece['color'], Record<Piece['type'], string>> = {
    white: {
        king: '\u2654',
        queen: '\u2655',
        rook: '\u2656',
        bishop: '\u2657',
        knight: '\u2658',
        pawn: '\u2659',
    },
    black: {
        king: '\u265A',
        queen: '\u265B',
        rook: '\u265C',
        bishop: '\u265D',
        knight: '\u265E',
        pawn: '\u265F',
    },
}

const PROMOTION_LABELS: Record<PromotionPieceType, string> = {
    queen: 'Queen',
    rook: 'Rook',
    bishop: 'Bishop',
    knight: 'Knight',
}

interface PendingPromotion {
    from: Square
    to: Square
    color: Piece['color']
}

function App() {
    const [gameState, setGameState] = useState(createInitialGameState)
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
    const [pendingPromotion, setPendingPromotion] =
        useState<PendingPromotion | null>(null)

    const selectedPiece = selectedSquare
        ? getPieceAt(gameState.board, selectedSquare)
        : null
    const legalMoves = selectedSquare && !pendingPromotion
        ? getLegalMoves(gameState.board, selectedSquare, gameState.turn)
        : []
    const historyRows = buildHistoryRows(gameState.history)
    const statusKind = pendingPromotion ? 'active' : gameState.status.kind
    const statusMessage = pendingPromotion
        ? `Choose a piece to promote the pawn on ${squareToAlgebraic(pendingPromotion.to)}.`
        : gameState.status.message

    function handleSquareClick(square: Square) {
        if (pendingPromotion || isGameLocked(gameState.status)) {
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
            if (requiresPromotionChoice(gameState.board, selectedSquare, square)) {
                setPendingPromotion({
                    from: selectedSquare,
                    to: square,
                    color: gameState.turn,
                })
                setSelectedSquare(null)
                return
            }

            setGameState((current) => applyMove(current, selectedSquare, square))
            setSelectedSquare(null)
            return
        }

        if (clickedPiece?.color === gameState.turn) {
            setSelectedSquare(square)
        }
    }

    function handlePromotionChoice(pieceType: PromotionPieceType) {
        if (!pendingPromotion) {
            return
        }

        setGameState((current) =>
            applyMove(current, pendingPromotion.from, pendingPromotion.to, pieceType),
        )
        setPendingPromotion(null)
    }

    function handleReset() {
        setGameState(createInitialGameState())
        setSelectedSquare(null)
        setPendingPromotion(null)
    }

    return (
        <main className="app-shell">
            <header className="panel hero-panel">
                <div>
                    <p className="eyebrow">React + TypeScript local PvP</p>
                    <h1>Chess MVP</h1>
                    <p className="hero-copy">
                        Reduced ruleset only: no castling and no en passant.
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
                        <p className={`status-badge status-badge--${statusKind}`}>
                            {statusMessage}
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
                        Promotion now uses an inline chooser for queen, rook, bishop, or
                        knight. Castling and en passant remain out of scope.
                    </p>

                    {pendingPromotion ? (
                        <div className="promotion-chooser" role="group" aria-label="Promotion chooser">
                            <p className="promotion-copy">
                                Promote the pawn on {squareToAlgebraic(pendingPromotion.to)} to:
                            </p>
                            <div className="promotion-options">
                                {PROMOTION_PIECE_TYPES.map((pieceType) => (
                                    <button
                                        key={pieceType}
                                        type="button"
                                        className="promotion-button"
                                        onClick={() => handlePromotionChoice(pieceType)}
                                    >
                                        <span className="promotion-piece" aria-hidden="true">
                                            {PIECE_SYMBOLS[pendingPromotion.color][pieceType]}
                                        </span>
                                        <span>{PROMOTION_LABELS[pieceType]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>

                <aside className="sidebar">
                    <section className="panel info-panel">
                        <h2>Selection</h2>
                        <p className="selection-copy">
                            {pendingPromotion
                                ? `Promotion pending from ${squareToAlgebraic(pendingPromotion.from)} to ${squareToAlgebraic(pendingPromotion.to)}. Choose queen, rook, bishop, or knight to complete the move.`
                                : selectedSquare && selectedPiece
                                    ? `${formatColor(selectedPiece.color)} ${selectedPiece.type} at ${squareToAlgebraic(selectedSquare)}. ${legalMoves.length} legal move${legalMoves.length === 1 ? '' : 's'} available.`
                                    : isGameLocked(gameState.status)
                                        ? 'The board is locked. Reset to start a new game.'
                                        : "Select one of the current player's pieces to see its legal moves."}
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