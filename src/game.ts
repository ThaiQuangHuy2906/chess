import {
    Chess,
    type Color as ChessColor,
    type Move as ChessMove,
    type PieceSymbol,
    type Square as ChessSquare,
} from 'chess.js'

export type Color = 'white' | 'black'
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'
export type PromotionPieceType = 'queen' | 'rook' | 'bishop' | 'knight'

export interface Piece {
    color: Color
    type: PieceType
}

export interface Square {
    row: number
    col: number
}

export type Board = Array<Array<Piece | null>>

export interface MoveRecord {
    color: Color
    from: Square
    to: Square
    notation: string
    san: string
    lan: string
    promotion?: PromotionPieceType
    captured?: PieceType
}

export interface LegalMoveOption {
    from: Square
    to: Square
    san: string
    lan: string
    piece: PieceType
    promotion?: PromotionPieceType
    captured?: PieceType
    isCapture: boolean
    isPromotion: boolean
    isEnPassant: boolean
    isCastle: boolean
    isCheck: boolean
    isCheckmate: boolean
}

export type GameStatus =
    | {
        kind: 'active' | 'check' | 'stalemate' | 'draw' | 'unsupported'
        message: string
    }
    | {
        kind: 'checkmate'
        message: string
        winner: Color
    }

export interface GameState {
    board: Board
    turn: Color
    history: MoveRecord[]
    status: GameStatus
    fen: string
    pgn: string
    lastMove?: MoveRecord
}

export interface MoveInput {
    from: Square
    to: Square
    promotion?: PromotionPieceType
}

const BOARD_SIZE = 8
export const PROMOTION_PIECE_TYPES: PromotionPieceType[] = [
    'queen',
    'rook',
    'bishop',
    'knight',
]

const CHESS_PIECE_TO_APP: Record<PieceSymbol, PieceType> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
}

const APP_PROMOTION_TO_CHESS: Record<PromotionPieceType, PieceSymbol> = {
    queen: 'q',
    rook: 'r',
    bishop: 'b',
    knight: 'n',
}

export function createInitialGameState(): GameState {
    return buildGameState(new Chess(), [])
}

export function createGameStateFromFen(fen: string): GameState {
    return buildGameState(new Chess(fen), [])
}

export function getPieceAt(board: Board, square: Square): Piece | null {
    return board[square.row]?.[square.col] ?? null
}

export function areSquaresEqual(left: Square, right: Square): boolean {
    return left.row === right.row && left.col === right.col
}

export function squareToAlgebraic(square: Square): string {
    return `${String.fromCharCode(97 + square.col)}${BOARD_SIZE - square.row}`
}

export function algebraicToSquare(square: string): Square {
    return {
        row: BOARD_SIZE - Number(square[1]),
        col: square.charCodeAt(0) - 97,
    }
}

export function formatColor(color: Color): string {
    return color[0].toUpperCase() + color.slice(1)
}

export function isGameLocked(status: GameStatus): boolean {
    return (
        status.kind === 'checkmate' ||
        status.kind === 'stalemate' ||
        status.kind === 'draw' ||
        status.kind === 'unsupported'
    )
}

export function getLegalMovesForSquare(
    gameState: GameState,
    from: Square,
): LegalMoveOption[] {
    if (isGameLocked(gameState.status)) {
        return []
    }

    const chess = new Chess(gameState.fen)

    return chess
        .moves({ verbose: true, square: toChessSquare(from) })
        .map(mapLegalMove)
}

export function getLegalMoves(gameState: GameState): LegalMoveOption[] {
    if (isGameLocked(gameState.status)) {
        return []
    }

    return new Chess(gameState.fen)
        .moves({ verbose: true })
        .map(mapLegalMove)
}

export function requiresPromotionChoice(
    gameState: GameState,
    from: Square,
    to: Square,
): boolean {
    return getLegalMovesForSquare(gameState, from).some(
        (move) => move.isPromotion && areSquaresEqual(move.to, to),
    )
}

export function applyMove(gameState: GameState, moveInput: MoveInput): GameState {
    if (isGameLocked(gameState.status)) {
        return gameState
    }

    if (
        requiresPromotionChoice(gameState, moveInput.from, moveInput.to) &&
        !moveInput.promotion
    ) {
        return gameState
    }

    const chess = new Chess(gameState.fen)
    const move = moveChessPiece(chess, moveInput)

    if (!move) {
        return gameState
    }

    const moveRecord = mapMoveRecord(move)
    const history = [...gameState.history, moveRecord]

    return buildGameState(chess, history, moveRecord)
}

function buildGameState(
    chess: Chess,
    history: MoveRecord[],
    lastMove?: MoveRecord,
): GameState {
    return {
        board: mapBoard(chess.board()),
        turn: mapColor(chess.turn()),
        history,
        status: evaluateGameStatus(chess),
        fen: chess.fen(),
        pgn: formatPgn(history),
        lastMove,
    }
}

function moveChessPiece(chess: Chess, moveInput: MoveInput): ChessMove | null {
    try {
        return chess.move({
            from: squareToAlgebraic(moveInput.from),
            to: squareToAlgebraic(moveInput.to),
            promotion: moveInput.promotion
                ? APP_PROMOTION_TO_CHESS[moveInput.promotion]
                : undefined,
        })
    } catch {
        return null
    }
}

function mapBoard(chessBoard: ReturnType<Chess['board']>): Board {
    return chessBoard.map((row) =>
        row.map((piece) =>
            piece
                ? {
                    color: mapColor(piece.color),
                    type: CHESS_PIECE_TO_APP[piece.type],
                }
                : null,
        ),
    )
}

function mapLegalMove(move: ChessMove): LegalMoveOption {
    return {
        from: algebraicToSquare(move.from),
        to: algebraicToSquare(move.to),
        san: move.san,
        lan: move.lan,
        piece: CHESS_PIECE_TO_APP[move.piece],
        promotion: move.promotion
            ? CHESS_PIECE_TO_APP[move.promotion] as PromotionPieceType
            : undefined,
        captured: move.captured ? CHESS_PIECE_TO_APP[move.captured] : undefined,
        isCapture: move.isCapture() || move.isEnPassant(),
        isPromotion: move.isPromotion(),
        isEnPassant: move.isEnPassant(),
        isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        isCheck: move.san.includes('+') || move.san.includes('#'),
        isCheckmate: move.san.includes('#'),
    }
}

function mapMoveRecord(move: ChessMove): MoveRecord {
    return {
        color: mapColor(move.color),
        from: algebraicToSquare(move.from),
        to: algebraicToSquare(move.to),
        notation: move.san,
        san: move.san,
        lan: move.lan,
        promotion: move.promotion
            ? CHESS_PIECE_TO_APP[move.promotion] as PromotionPieceType
            : undefined,
        captured: move.captured ? CHESS_PIECE_TO_APP[move.captured] : undefined,
    }
}

function evaluateGameStatus(chess: Chess): GameStatus {
    const turn = mapColor(chess.turn())

    if (chess.isCheckmate()) {
        const winner = oppositeColor(turn)

        return {
            kind: 'checkmate',
            winner,
            message: `Checkmate. ${formatColor(winner)} wins.`,
        }
    }

    if (chess.isStalemate()) {
        return {
            kind: 'stalemate',
            message: 'Stalemate. No legal moves remain.',
        }
    }

    if (chess.isDraw()) {
        return {
            kind: 'draw',
            message: 'Draw. The game is over without a winner.',
        }
    }

    if (chess.isCheck()) {
        return {
            kind: 'check',
            message: `${formatColor(turn)} is in check.`,
        }
    }

    return {
        kind: 'active',
        message: `${formatColor(turn)} to move.`,
    }
}

function formatPgn(history: MoveRecord[]): string {
    const rows: string[] = []

    for (let index = 0; index < history.length; index += 2) {
        const whiteMove = history[index]?.san
        const blackMove = history[index + 1]?.san

        if (!whiteMove) {
            continue
        }

        rows.push(
            blackMove
                ? `${index / 2 + 1}. ${whiteMove} ${blackMove}`
                : `${index / 2 + 1}. ${whiteMove}`,
        )
    }

    return rows.join(' ')
}

function toChessSquare(square: Square): ChessSquare {
    return squareToAlgebraic(square) as ChessSquare
}

function mapColor(color: ChessColor): Color {
    return color === 'w' ? 'white' : 'black'
}

function oppositeColor(color: Color): Color {
    return color === 'white' ? 'black' : 'white'
}
