import { describe, expect, it } from 'vitest'
import {
    applyMove,
    createInitialGameState,
    getLegalMoves,
    isGameLocked,
    type Board,
    type Color,
    type GameState,
    type Piece,
    type Square,
} from './game'

function square(row: number, col: number): Square {
    return { row, col }
}

function createEmptyBoard(): Board {
    return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null))
}

function placePiece(board: Board, at: Square, piece: Piece): void {
    board[at.row][at.col] = piece
}

function createSeededState(board: Board, turn: Color): GameState {
    return {
        board,
        turn,
        history: [],
        status: {
            kind: 'active',
            message: 'seeded state',
        },
    }
}

function moveListHas(moves: Square[], target: Square): boolean {
    return moves.some((move) => move.row === target.row && move.col === target.col)
}

describe('pawn movement edge cases', () => {
    it('allows forward 1 and forward 2 from start when unobstructed', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 4), { color: 'black', type: 'king' })
        placePiece(board, square(6, 3), { color: 'white', type: 'pawn' })

        const moves = getLegalMoves(board, square(6, 3), 'white')

        expect(moveListHas(moves, square(5, 3))).toBe(true)
        expect(moveListHas(moves, square(4, 3))).toBe(true)
        expect(moves).toHaveLength(2)
    })

    it('blocks double-step when a piece is directly in front of the pawn', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 4), { color: 'black', type: 'king' })
        placePiece(board, square(6, 3), { color: 'white', type: 'pawn' })
        placePiece(board, square(5, 3), { color: 'black', type: 'knight' })

        const moves = getLegalMoves(board, square(6, 3), 'white')

        expect(moves).toHaveLength(0)
    })

    it('allows diagonal capture only when an enemy piece exists on that diagonal', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 4), { color: 'black', type: 'king' })
        placePiece(board, square(4, 3), { color: 'white', type: 'pawn' })
        placePiece(board, square(3, 2), { color: 'black', type: 'knight' })
        placePiece(board, square(3, 4), { color: 'white', type: 'knight' })

        const moves = getLegalMoves(board, square(4, 3), 'white')

        expect(moveListHas(moves, square(3, 2))).toBe(true)
        expect(moveListHas(moves, square(3, 4))).toBe(false)
        expect(moveListHas(moves, square(3, 3))).toBe(true)
    })
})

describe('legal move filtering', () => {
    it('prevents a pinned piece from moving in a way that exposes its own king', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 0), { color: 'black', type: 'king' })
        placePiece(board, square(6, 4), { color: 'white', type: 'rook' })
        placePiece(board, square(0, 4), { color: 'black', type: 'rook' })

        const moves = getLegalMoves(board, square(6, 4), 'white')

        expect(moveListHas(moves, square(6, 5))).toBe(false)
        expect(moveListHas(moves, square(6, 3))).toBe(false)
        expect(moveListHas(moves, square(5, 4))).toBe(true)
        expect(moveListHas(moves, square(0, 4))).toBe(true)
    })

    it('prevents the king from moving into check', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 7), { color: 'black', type: 'king' })
        placePiece(board, square(0, 4), { color: 'black', type: 'rook' })

        const moves = getLegalMoves(board, square(7, 4), 'white')

        expect(moveListHas(moves, square(6, 4))).toBe(false)
        expect(moveListHas(moves, square(7, 3))).toBe(true)
        expect(moveListHas(moves, square(7, 5))).toBe(true)
    })
})

describe('status evaluation via seeded states', () => {
    it('returns checkmate after a seeded mating move', () => {
        const board = createEmptyBoard()
        placePiece(board, square(0, 7), { color: 'black', type: 'king' })
        placePiece(board, square(2, 5), { color: 'white', type: 'king' })
        placePiece(board, square(2, 6), { color: 'white', type: 'queen' })

        const nextState = applyMove(
            createSeededState(board, 'white'),
            square(2, 6),
            square(1, 6),
        )

        expect(nextState.status.kind).toBe('checkmate')
        if (nextState.status.kind === 'checkmate') {
            expect(nextState.status.winner).toBe('white')
        }
        expect(isGameLocked(nextState.status)).toBe(true)
    })

    it('returns stalemate after a seeded forcing move', () => {
        const board = createEmptyBoard()
        placePiece(board, square(0, 7), { color: 'black', type: 'king' })
        placePiece(board, square(1, 5), { color: 'white', type: 'king' })
        placePiece(board, square(2, 4), { color: 'white', type: 'queen' })

        const nextState = applyMove(
            createSeededState(board, 'white'),
            square(2, 4),
            square(2, 6),
        )

        expect(nextState.status.kind).toBe('stalemate')
        expect(isGameLocked(nextState.status)).toBe(true)
    })
})

describe("Fool's Mate regression", () => {
    it('ends in checkmate for black after the known four-move sequence', () => {
        let state = createInitialGameState()

        state = applyMove(state, square(6, 5), square(5, 5))
        state = applyMove(state, square(1, 4), square(3, 4))
        state = applyMove(state, square(6, 6), square(4, 6))
        state = applyMove(state, square(0, 3), square(4, 7))

        expect(state.status.kind).toBe('checkmate')
        if (state.status.kind === 'checkmate') {
            expect(state.status.winner).toBe('black')
        }
        expect(state.history.map((move) => move.notation)).toEqual([
            'f2-f3',
            'e7-e5',
            'g2-g4',
            'd8-h4',
        ])
    })
})

describe('unsupported final-rank pawn handling', () => {
    it('enters unsupported state and reset initialization restores the game state', () => {
        const board = createEmptyBoard()
        placePiece(board, square(7, 4), { color: 'white', type: 'king' })
        placePiece(board, square(0, 7), { color: 'black', type: 'king' })
        placePiece(board, square(1, 0), { color: 'white', type: 'pawn' })

        const unsupportedState = applyMove(
            createSeededState(board, 'white'),
            square(1, 0),
            square(0, 0),
        )

        expect(unsupportedState.status.kind).toBe('unsupported')
        expect(isGameLocked(unsupportedState.status)).toBe(true)

        const lockedMoveAttempt = applyMove(
            unsupportedState,
            square(0, 7),
            square(1, 7),
        )
        expect(lockedMoveAttempt).toBe(unsupportedState)

        const resetState = createInitialGameState()
        expect(resetState.status.kind).toBe('active')
        expect(resetState.history).toHaveLength(0)
        expect(resetState.board[6][0]).toEqual({ color: 'white', type: 'pawn' })
        expect(resetState.board[1][0]).toEqual({ color: 'black', type: 'pawn' })
    })
})
