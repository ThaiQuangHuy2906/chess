export type Color = 'white' | 'black'
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'

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
    notation: string
}

export type GameStatus =
    | {
        kind: 'active' | 'check' | 'stalemate' | 'unsupported'
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
}

const BOARD_SIZE = 8
const BACK_RANK: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
]
const UNSUPPORTED_PROMOTION_MESSAGE =
    'A pawn reached the final rank. Promotion is outside this MVP. Reset to start a new game.'

export function createInitialGameState(): GameState {
    const board = createInitialBoard()

    return {
        board,
        turn: 'white',
        history: [],
        status: evaluateGameStatus(board, 'white'),
    }
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

export function formatColor(color: Color): string {
    return color[0].toUpperCase() + color.slice(1)
}

export function isGameLocked(status: GameStatus): boolean {
    return (
        status.kind === 'checkmate' ||
        status.kind === 'stalemate' ||
        status.kind === 'unsupported'
    )
}

export function getLegalMoves(
    board: Board,
    from: Square,
    color: Color,
): Square[] {
    const piece = getPieceAt(board, from)

    if (!piece || piece.color !== color) {
        return []
    }

    return getPseudoLegalMoves(board, from).filter((to) => {
        const nextBoard = simulateMove(board, from, to)

        return !isKingInCheck(nextBoard, color)
    })
}

export function applyMove(
    gameState: GameState,
    from: Square,
    to: Square,
): GameState {
    if (isGameLocked(gameState.status)) {
        return gameState
    }

    const piece = getPieceAt(gameState.board, from)

    if (!piece || piece.color !== gameState.turn) {
        return gameState
    }

    const legalMoves = getLegalMoves(gameState.board, from, gameState.turn)

    if (!legalMoves.some((move) => areSquaresEqual(move, to))) {
        return gameState
    }

    const capturedPiece = getPieceAt(gameState.board, to)
    const nextBoard = simulateMove(gameState.board, from, to)
    const nextTurn = oppositeColor(gameState.turn)

    return {
        board: nextBoard,
        turn: nextTurn,
        history: [
            ...gameState.history,
            {
                color: gameState.turn,
                notation: createNotation(from, to, capturedPiece),
            },
        ],
        status: evaluateGameStatus(nextBoard, nextTurn),
    }
}

function createInitialBoard(): Board {
    const board = Array.from({ length: BOARD_SIZE }, () =>
        Array<Piece | null>(BOARD_SIZE).fill(null),
    )

    board[0] = createBackRank('black')
    board[1] = Array.from({ length: BOARD_SIZE }, () => ({
        color: 'black' as const,
        type: 'pawn' as const,
    }))
    board[6] = Array.from({ length: BOARD_SIZE }, () => ({
        color: 'white' as const,
        type: 'pawn' as const,
    }))
    board[7] = createBackRank('white')

    return board
}

function createBackRank(color: Color): Piece[] {
    return BACK_RANK.map((type) => ({ color, type }))
}

function getPseudoLegalMoves(board: Board, from: Square): Square[] {
    const piece = getPieceAt(board, from)

    if (!piece) {
        return []
    }

    switch (piece.type) {
        case 'pawn':
            return getPawnMoves(board, from, piece)
        case 'knight':
            return getKnightMoves(board, from, piece)
        case 'bishop':
            return getSlidingMoves(board, from, piece, [
                [-1, -1],
                [-1, 1],
                [1, -1],
                [1, 1],
            ])
        case 'rook':
            return getSlidingMoves(board, from, piece, [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ])
        case 'queen':
            return getSlidingMoves(board, from, piece, [
                [-1, -1],
                [-1, 1],
                [1, -1],
                [1, 1],
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ])
        case 'king':
            return getKingMoves(board, from, piece)
        default:
            return []
    }
}

function getPawnMoves(board: Board, from: Square, piece: Piece): Square[] {
    const moves: Square[] = []
    const direction = piece.color === 'white' ? -1 : 1
    const startRow = piece.color === 'white' ? 6 : 1
    const nextRow = from.row + direction

    if (isInsideBoard(nextRow, from.col) && !board[nextRow][from.col]) {
        moves.push({ row: nextRow, col: from.col })

        const jumpRow = from.row + direction * 2

        if (
            from.row === startRow &&
            isInsideBoard(jumpRow, from.col) &&
            !board[jumpRow][from.col]
        ) {
            moves.push({ row: jumpRow, col: from.col })
        }
    }

    for (const colOffset of [-1, 1]) {
        const targetCol = from.col + colOffset

        if (!isInsideBoard(nextRow, targetCol)) {
            continue
        }

        const targetPiece = board[nextRow][targetCol]

        if (
            targetPiece &&
            targetPiece.color !== piece.color &&
            targetPiece.type !== 'king'
        ) {
            moves.push({ row: nextRow, col: targetCol })
        }
    }

    return moves
}

function getKnightMoves(board: Board, from: Square, piece: Piece): Square[] {
    const moves: Square[] = []
    const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
    ]

    for (const [rowOffset, colOffset] of offsets) {
        const row = from.row + rowOffset
        const col = from.col + colOffset

        if (!isInsideBoard(row, col)) {
            continue
        }

        const targetPiece = board[row][col]

        if (canOccupySquare(piece, targetPiece)) {
            moves.push({ row, col })
        }
    }

    return moves
}

function getSlidingMoves(
    board: Board,
    from: Square,
    piece: Piece,
    directions: number[][],
): Square[] {
    const moves: Square[] = []

    for (const [rowStep, colStep] of directions) {
        let row = from.row + rowStep
        let col = from.col + colStep

        while (isInsideBoard(row, col)) {
            const targetPiece = board[row][col]

            if (!targetPiece) {
                moves.push({ row, col })
                row += rowStep
                col += colStep
                continue
            }

            if (canOccupySquare(piece, targetPiece)) {
                moves.push({ row, col })
            }

            break
        }
    }

    return moves
}

function getKingMoves(board: Board, from: Square, piece: Piece): Square[] {
    const moves: Square[] = []

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) {
                continue
            }

            const row = from.row + rowOffset
            const col = from.col + colOffset

            if (!isInsideBoard(row, col)) {
                continue
            }

            const targetPiece = board[row][col]

            if (canOccupySquare(piece, targetPiece)) {
                moves.push({ row, col })
            }
        }
    }

    return moves
}

function canOccupySquare(piece: Piece, targetPiece: Piece | null): boolean {
    return (
        targetPiece !== null &&
        targetPiece.color !== piece.color &&
        targetPiece.type !== 'king'
    ) || targetPiece === null
}

function isInsideBoard(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

function simulateMove(board: Board, from: Square, to: Square): Board {
    const nextBoard = board.map((row) => row.slice())

    nextBoard[to.row][to.col] = nextBoard[from.row][from.col]
    nextBoard[from.row][from.col] = null

    return nextBoard
}

function oppositeColor(color: Color): Color {
    return color === 'white' ? 'black' : 'white'
}

function isKingInCheck(board: Board, color: Color): boolean {
    const kingSquare = findKing(board, color)

    if (!kingSquare) {
        return true
    }

    return isSquareAttacked(board, kingSquare, oppositeColor(color))
}

function isSquareAttacked(board: Board, target: Square, byColor: Color): boolean {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            const piece = board[row][col]

            if (!piece || piece.color !== byColor) {
                continue
            }

            if (doesPieceAttackSquare(board, { row, col }, target)) {
                return true
            }
        }
    }

    return false
}

function doesPieceAttackSquare(
    board: Board,
    from: Square,
    target: Square,
): boolean {
    const piece = getPieceAt(board, from)

    if (!piece) {
        return false
    }

    const rowDiff = target.row - from.row
    const colDiff = target.col - from.col
    const absRow = Math.abs(rowDiff)
    const absCol = Math.abs(colDiff)

    switch (piece.type) {
        case 'pawn': {
            const direction = piece.color === 'white' ? -1 : 1
            return rowDiff === direction && absCol === 1
        }
        case 'knight':
            return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2)
        case 'bishop':
            return absRow === absCol && absRow > 0
                ? isPathClear(board, from, target, Math.sign(rowDiff), Math.sign(colDiff))
                : false
        case 'rook':
            return rowDiff === 0 || colDiff === 0
                ? rowDiff !== 0 || colDiff !== 0
                    ? isPathClear(
                        board,
                        from,
                        target,
                        Math.sign(rowDiff),
                        Math.sign(colDiff),
                    )
                    : false
                : false
        case 'queen':
            return rowDiff === 0 || colDiff === 0 || absRow === absCol
                ? rowDiff !== 0 || colDiff !== 0
                    ? isPathClear(
                        board,
                        from,
                        target,
                        Math.sign(rowDiff),
                        Math.sign(colDiff),
                    )
                    : false
                : false
        case 'king':
            return Math.max(absRow, absCol) === 1
        default:
            return false
    }
}

function isPathClear(
    board: Board,
    from: Square,
    target: Square,
    rowStep: number,
    colStep: number,
): boolean {
    let row = from.row + rowStep
    let col = from.col + colStep

    while (row !== target.row || col !== target.col) {
        if (board[row][col]) {
            return false
        }

        row += rowStep
        col += colStep
    }

    return true
}

function findKing(board: Board, color: Color): Square | null {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            const piece = board[row][col]

            if (piece?.color === color && piece.type === 'king') {
                return { row, col }
            }
        }
    }

    return null
}

function hasAnyLegalMove(board: Board, color: Color): boolean {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            const piece = board[row][col]

            if (!piece || piece.color !== color) {
                continue
            }

            if (getLegalMoves(board, { row, col }, color).length > 0) {
                return true
            }
        }
    }

    return false
}

function evaluateGameStatus(board: Board, turn: Color): GameStatus {
    const unsupportedMessage = getUnsupportedMessage(board)

    if (unsupportedMessage) {
        return {
            kind: 'unsupported',
            message: unsupportedMessage,
        }
    }

    const inCheck = isKingInCheck(board, turn)

    if (hasAnyLegalMove(board, turn)) {
        return {
            kind: inCheck ? 'check' : 'active',
            message: inCheck
                ? `${formatColor(turn)} is in check.`
                : `${formatColor(turn)} to move.`,
        }
    }

    if (inCheck) {
        const winner = oppositeColor(turn)

        return {
            kind: 'checkmate',
            winner,
            message: `Checkmate. ${formatColor(winner)} wins.`,
        }
    }

    return {
        kind: 'stalemate',
        message: 'Stalemate. No legal moves remain.',
    }
}

function getUnsupportedMessage(board: Board): string | null {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
        const topPiece = board[0][col]
        const bottomPiece = board[BOARD_SIZE - 1][col]

        if (topPiece?.type === 'pawn' || bottomPiece?.type === 'pawn') {
            return UNSUPPORTED_PROMOTION_MESSAGE
        }
    }

    return null
}

function createNotation(
    from: Square,
    to: Square,
    capturedPiece: Piece | null,
): string {
    return `${squareToAlgebraic(from)}${capturedPiece ? 'x' : '-'}${squareToAlgebraic(to)}`
}