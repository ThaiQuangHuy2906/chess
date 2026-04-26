import { describe, expect, it } from 'vitest'
import {
    applyMove,
    createGameStateFromFen,
    createInitialGameState,
    getLegalMovesForSquare,
    type GameState,
    type Square,
} from './game'
import { createCoachInsight, createMoveGuidance, selectAgentMove } from './ai'

function algebraicToSquare(value: string): Square {
    return {
        row: 8 - Number(value[1]),
        col: value.charCodeAt(0) - 97,
    }
}

function applyLan(state: GameState, lan: string): GameState {
    return applyMove(state, {
        from: algebraicToSquare(lan.slice(0, 2)),
        to: algebraicToSquare(lan.slice(2, 4)),
    })
}

describe('agentic chess AI', () => {
    it('always selects a legal move for the side to move', () => {
        const state = createInitialGameState()

        const decision = selectAgentMove(state, { color: 'white', level: 'normal' })
        const legalMoves = getLegalMovesForSquare(state, decision.move.from)

        expect(
            legalMoves.some(
                (move) =>
                    move.to.row === decision.move.to.row &&
                    move.to.col === decision.move.to.col,
            ),
        ).toBe(true)
        expect(decision.candidates.length).toBeGreaterThanOrEqual(2)
        expect(decision.reason).not.toHaveLength(0)
    })

    it('returns a premium agent trace with Vietnamese planning fields', () => {
        const state = createInitialGameState()

        const decision = selectAgentMove(state, { color: 'white', level: 'normal' })

        expect(decision.goal).not.toHaveLength(0)
        expect(decision.plan).not.toHaveLength(0)
        expect(decision.risk).not.toHaveLength(0)
        expect(decision.reflection).not.toHaveLength(0)
        expect(decision.principalVariation.length).toBeGreaterThan(0)
        expect(decision.toolsUsed).toEqual(
            expect.arrayContaining([
                'observe-position',
                'rank-candidates',
                'self-review',
            ]),
        )
        expect(decision.trace.goal).toBe(decision.goal)
        expect(decision.trace.observation.legalMoveCount).toBeGreaterThan(0)
        expect(decision.trace.candidatePlans.length).toBeGreaterThan(0)
        expect(decision.trace.memoryNotes.length).toBeGreaterThan(0)
        expect(decision.trace.reflection).toMatch(/[àáạảãăâđêôơư]/i)
        expect(decision.trace.principalLine[0]).toMatchObject({
            san: decision.move.san,
            from: decision.move.from,
            to: decision.move.to,
        })
        expect(decision.trace.visualCues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'chosen',
                    square: decision.move.from,
                }),
                expect.objectContaining({
                    kind: 'chosen',
                    square: decision.move.to,
                }),
            ]),
        )
    })

    it('finds a mate in one at hard level', () => {
        const state = createGameStateFromFen('7k/6Q1/6K1/8/8/8/8/8 w - - 0 1')

        const decision = selectAgentMove(state, { color: 'white', level: 'hard' })

        expect(decision.move.san.endsWith('#')).toBe(true)
    })

    it('prefers winning a high-value queen when no mate is available', () => {
        const state = createGameStateFromFen('4k3/8/8/8/8/4q3/4R3/4K3 w - - 0 1')

        const decision = selectAgentMove(state, { color: 'white', level: 'normal' })

        expect(decision.move.san).toBe('Rxe3+')
    })

    it('handles special legal moves without producing invalid promotion or castling output', () => {
        const promotionState = createGameStateFromFen('7k/P7/8/8/8/8/8/4K3 w - - 0 1')
        const castleState = [
            ['e2e4', 'e7e5'],
            ['g1f3', 'b8c6'],
            ['f1c4', 'g8f6'],
        ].reduce((state, [whiteMove, blackMove]) => {
            const afterWhite = applyLan(state, whiteMove)
            return applyLan(afterWhite, blackMove)
        }, createInitialGameState())

        const promotionDecision = selectAgentMove(promotionState, {
            color: 'white',
            level: 'hard',
        })
        const castleDecision = selectAgentMove(castleState, {
            color: 'white',
            level: 'hard',
        })

        expect(promotionDecision.move.promotion).toBeDefined()
        expect(promotionDecision.move.san).toContain('=')
        expect(castleDecision.candidates.some((candidate) => candidate.san === 'O-O')).toBe(
            true,
        )
    })

    it('creates a structured coach insight for the current position', () => {
        const state = createInitialGameState()

        const insight = createCoachInsight(state, { color: 'white', level: 'normal' })

        expect(insight.bestMove).not.toHaveLength(0)
        expect(insight.reason).not.toHaveLength(0)
        expect(insight.candidates).toHaveLength(2)
        expect(typeof insight.score).toBe('number')
        expect(insight.plan).not.toHaveLength(0)
        expect(insight.risk).not.toHaveLength(0)
        expect(insight.suggestion).toMatch(/[àáạảãăâđêôơư]/i)
        expect(insight.memoryNotes.length).toBeGreaterThan(0)
        expect(insight.trace?.goal).not.toHaveLength(0)
        expect(insight.trace?.principalVariation).toContain(insight.bestMove)
        expect(insight.trace?.tools.map((tool) => tool.name)).toEqual(
            expect.arrayContaining(['observe-position', 'rank-candidates']),
        )
    })

    it('creates move guidance for the selected piece', () => {
        const state = createGameStateFromFen('4k3/8/8/8/8/4q3/4R3/4K3 w - - 0 1')

        const guidance = createMoveGuidance(state, {
            color: 'white',
            level: 'normal',
            from: algebraicToSquare('e2'),
        })

        expect(guidance?.recommendedMove.san).toBe('Rxe3+')
        expect(guidance?.summary).toContain('Rxe3+')
        expect(guidance?.candidateAdvice.length).toBeGreaterThan(0)
        expect(guidance?.destinationCues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'recommended',
                    square: algebraicToSquare('e3'),
                }),
            ]),
        )
    })
})
