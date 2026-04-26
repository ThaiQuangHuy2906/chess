import { describe, expect, it } from 'vitest'
import {
    applyMove,
    createGameStateFromFen,
    createInitialGameState,
    getLegalMovesForSquare,
    isGameLocked,
    requiresPromotionChoice,
    squareToAlgebraic,
    type GameState,
    type PromotionPieceType,
    type Square,
} from './game'

function square(row: number, col: number): Square {
    return { row, col }
}

function moveListHas(moves: Array<{ to: Square }>, target: Square): boolean {
    return moves.some((move) => move.to.row === target.row && move.to.col === target.col)
}

function applyLan(state: GameState, lan: string, promotion?: PromotionPieceType): GameState {
    const from = algebraicToSquare(lan.slice(0, 2))
    const to = algebraicToSquare(lan.slice(2, 4))

    return applyMove(state, { from, to, promotion })
}

function algebraicToSquare(value: string): Square {
    return {
        row: 8 - Number(value[1]),
        col: value.charCodeAt(0) - 97,
    }
}

describe('chess.js-backed game adapter', () => {
    it('creates a full-rules initial state with FEN, PGN, and legal opening moves', () => {
        const state = createInitialGameState()

        expect(state.fen).toBe(
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        )
        expect(state.pgn).toBe('')
        expect(state.turn).toBe('white')
        expect(state.status.kind).toBe('active')
        expect(squareToAlgebraic(square(7, 4))).toBe('e1')
        expect(getLegalMovesForSquare(state, square(6, 4)).map((move) => move.san)).toEqual([
            'e3',
            'e4',
        ])
    })

    it('keeps state unchanged when an illegal move is requested', () => {
        const state = createInitialGameState()
        const nextState = applyMove(state, {
            from: algebraicToSquare('e2'),
            to: algebraicToSquare('e5'),
        })

        expect(nextState).toBe(state)
        expect(nextState.history).toHaveLength(0)
    })

    it('records SAN history and checkmate status for Fool\'s Mate', () => {
        let state = createInitialGameState()

        state = applyLan(state, 'f2f3')
        state = applyLan(state, 'e7e5')
        state = applyLan(state, 'g2g4')
        state = applyLan(state, 'd8h4')

        expect(state.status.kind).toBe('checkmate')
        if (state.status.kind === 'checkmate') {
            expect(state.status.winner).toBe('black')
        }
        expect(state.history.map((move) => move.notation)).toEqual([
            'f3',
            'e5',
            'g4',
            'Qh4#',
        ])
        expect(state.lastMove?.san).toBe('Qh4#')
        expect(isGameLocked(state.status)).toBe(true)
    })

    it('supports kingside castling and moves the rook with SAN notation', () => {
        let state = createInitialGameState()

        state = applyLan(state, 'e2e4')
        state = applyLan(state, 'e7e5')
        state = applyLan(state, 'g1f3')
        state = applyLan(state, 'b8c6')
        state = applyLan(state, 'f1c4')
        state = applyLan(state, 'g8f6')

        const castleMoves = getLegalMovesForSquare(state, algebraicToSquare('e1'))
        expect(moveListHas(castleMoves, algebraicToSquare('g1'))).toBe(true)

        state = applyLan(state, 'e1g1')

        expect(state.board[7][6]).toEqual({ color: 'white', type: 'king' })
        expect(state.board[7][5]).toEqual({ color: 'white', type: 'rook' })
        expect(state.board[7][4]).toBeNull()
        expect(state.board[7][7]).toBeNull()
        expect(state.history.at(-1)?.notation).toBe('O-O')
    })

    it('prevents castling through check', () => {
        const state = createGameStateFromFen(
            'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1',
        )

        const moves = getLegalMovesForSquare(state, algebraicToSquare('e1'))

        expect(moveListHas(moves, algebraicToSquare('g1'))).toBe(false)
        expect(moveListHas(moves, algebraicToSquare('c1'))).toBe(true)
    })

    it('supports en passant only immediately after the double pawn move', () => {
        let state = createInitialGameState()

        state = applyLan(state, 'e2e4')
        state = applyLan(state, 'a7a6')
        state = applyLan(state, 'e4e5')
        state = applyLan(state, 'd7d5')

        const enPassantMoves = getLegalMovesForSquare(state, algebraicToSquare('e5'))
        expect(moveListHas(enPassantMoves, algebraicToSquare('d6'))).toBe(true)

        state = applyLan(state, 'e5d6')

        expect(state.board[2][3]).toEqual({ color: 'white', type: 'pawn' })
        expect(state.board[3][3]).toBeNull()
        expect(state.history.at(-1)?.notation).toBe('exd6')
    })

    it('requires a human promotion choice and records SAN promotion notation', () => {
        const state = createGameStateFromFen('7k/P7/8/8/8/8/8/4K3 w - - 0 1')
        const from = algebraicToSquare('a7')
        const to = algebraicToSquare('a8')

        expect(requiresPromotionChoice(state, from, to)).toBe(true)
        expect(applyMove(state, { from, to })).toBe(state)

        const promotedState = applyMove(state, { from, to, promotion: 'queen' })

        expect(promotedState.board[0][0]).toEqual({ color: 'white', type: 'queen' })
        expect(promotedState.history.at(-1)?.notation).toBe('a8=Q+')
    })

    it('maps stalemate and draw statuses from FEN states', () => {
        const stalemate = createGameStateFromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
        const draw = createGameStateFromFen('8/8/8/8/8/8/4k3/4K3 w - - 0 1')

        expect(stalemate.status.kind).toBe('stalemate')
        expect(isGameLocked(stalemate.status)).toBe(true)
        expect(draw.status.kind).toBe('draw')
        expect(isGameLocked(draw.status)).toBe(true)
    })
})
