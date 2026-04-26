import {
    applyMove,
    getLegalMoves,
    isGameLocked,
    type Color,
    type GameState,
    type LegalMoveOption,
    type Piece,
    type PieceType,
    type Square,
} from './game'

export type AiLevel = 'easy' | 'normal' | 'hard'

export interface AgentOptions {
    color: Color
    level: AiLevel
}

export interface AgentCandidate {
    move: LegalMoveOption
    san: string
    score: number
    reason: string
    plan: string
    risk: string
}

export interface AgentToolResult {
    name: string
    summary: string
}

export interface AgentLineMove {
    san: string
    from: Square
    to: Square
}

export interface AgentVisualCue {
    square: Square
    kind: 'chosen' | 'plan' | 'risk'
    label: string
}

export interface AgentObservation {
    fen: string
    turn: Color
    status: GameState['status']['kind']
    legalMoveCount: number
    phase: 'khai cuộc' | 'trung cuộc' | 'tàn cuộc'
    materialBalance: number
    materialSummary: string
    recentPattern: string
}

export interface AgentTrace {
    observation: AgentObservation
    goal: string
    tools: AgentToolResult[]
    candidatePlans: Array<{
        san: string
        score: number
        reason: string
        plan: string
        risk: string
    }>
    principalVariation: string[]
    principalLine: AgentLineMove[]
    visualCues: AgentVisualCue[]
    risk: string
    reflection: string
    coach: string
    memoryNotes: string[]
}

export interface MoveGuidanceOptions extends AgentOptions {
    from: Square
}

export interface MoveGuidance {
    selectedSquare: Square
    legalMoveCount: number
    recommendedMove: LegalMoveOption
    summary: string
    candidateAdvice: Array<{
        san: string
        score: number
        plan: string
        risk: string
    }>
    destinationCues: Array<{
        square: Square
        kind: 'recommended' | 'candidate' | 'risky'
        label: string
    }>
}

export interface AgentDecision {
    move: LegalMoveOption
    score: number
    level: AiLevel
    depth: number
    reason: string
    goal: string
    plan: string
    risk: string
    reflection: string
    principalVariation: string[]
    toolsUsed: string[]
    trace: AgentTrace
    candidates: AgentCandidate[]
}

export interface CoachInsight {
    bestMove: string
    score: number
    reason: string
    plan: string
    risk: string
    suggestion: string
    memoryNotes: string[]
    trace: AgentTrace | null
    candidates: Array<{
        san: string
        score: number
        reason: string
        plan: string
        risk: string
    }>
}

const MATE_SCORE = 100_000
const PIECE_VALUES: Record<PieceType, number> = {
    king: 0,
    queen: 900,
    rook: 500,
    bishop: 330,
    knight: 320,
    pawn: 100,
}

const LEVEL_DEPTH: Record<AiLevel, number> = {
    easy: 1,
    normal: 2,
    hard: 3,
}

const LEVEL_BRANCHING: Record<AiLevel, number> = {
    easy: 8,
    normal: 12,
    hard: 12,
}

export function selectAgentMove(
    gameState: GameState,
    options: AgentOptions,
): AgentDecision {
    const moves = getAllLegalMoves(gameState)

    if (moves.length === 0) {
        throw new Error('Cannot select an AI move when no legal moves are available.')
    }

    const depth = LEVEL_DEPTH[options.level]
    const maxBranching = LEVEL_BRANCHING[options.level]
    const observation = observePosition(gameState, moves, options.color)
    const candidates = buildAgentCandidates(
        gameState,
        moves,
        options.color,
        depth,
        maxBranching,
        observation,
    )

    const selectedCandidate =
        options.level === 'easy'
            ? selectDeterministicEasyCandidate(candidates, gameState.fen)
            : candidates[0]
    const principalLine = buildPrincipalLine(
        gameState,
        selectedCandidate.move,
        options.color,
    )
    const principalVariation = principalLine.map((move) => move.san)
    const goal = chooseGoal(gameState, selectedCandidate, observation)
    const risk = describeDecisionRisk(selectedCandidate, candidates, observation)
    const plan = describeDecisionPlan(selectedCandidate, principalVariation, observation)
    const reflection = describeReflection(selectedCandidate, plan, risk)
    const tools = buildToolTrace(observation, candidates)
    const memoryNotes = buildMemoryNotes(gameState, observation)
    const trace: AgentTrace = {
        observation,
        goal,
        tools,
        candidatePlans: candidates.slice(0, 3).map((candidate) => ({
            san: candidate.san,
            score: candidate.score,
            reason: candidate.reason,
            plan: candidate.plan,
            risk: candidate.risk,
        })),
        principalVariation,
        principalLine,
        visualCues: buildVisualCues(selectedCandidate.move, principalLine),
        risk,
        reflection,
        coach: buildCoachSuggestion(goal, selectedCandidate, risk, observation),
        memoryNotes,
    }

    return {
        move: selectedCandidate.move,
        score: selectedCandidate.score,
        level: options.level,
        depth,
        reason: selectedCandidate.reason,
        goal,
        plan,
        risk,
        reflection,
        principalVariation,
        toolsUsed: tools.map((tool) => tool.name),
        trace,
        candidates,
    }
}

export function createCoachInsight(
    gameState: GameState,
    options: AgentOptions,
): CoachInsight {
    if (isGameLocked(gameState.status)) {
        return {
            bestMove: 'Game over',
            score: evaluateState(gameState, options.color),
            reason: gameState.status.message,
            plan: 'Ván đã kết thúc nên agent không lập kế hoạch mới.',
            risk: 'Không còn rủi ro chiến thuật trong ván này.',
            suggestion: 'Hãy đặt lại ván để luyện tiếp một thế mới.',
            memoryNotes: [gameState.status.message],
            trace: null,
            candidates: [],
        }
    }

    const decision = selectAgentMove(gameState, options)

    return {
        bestMove: decision.move.san,
        score: decision.score,
        reason: decision.reflection,
        plan: decision.plan,
        risk: decision.risk,
        suggestion: decision.trace.coach,
        memoryNotes: decision.trace.memoryNotes,
        trace: decision.trace,
        candidates: decision.candidates.slice(0, 2).map((candidate) => ({
            san: candidate.san,
            score: candidate.score,
            reason: candidate.reason,
            plan: candidate.plan,
            risk: candidate.risk,
        })),
    }
}

export function createMoveGuidance(
    gameState: GameState,
    options: MoveGuidanceOptions,
): MoveGuidance | null {
    if (isGameLocked(gameState.status)) {
        return null
    }

    const moves = getAllLegalMoves(gameState).filter((move) =>
        areSquaresEqual(move.from, options.from),
    )

    if (moves.length === 0) {
        return null
    }

    const depth = LEVEL_DEPTH[options.level]
    const maxBranching = LEVEL_BRANCHING[options.level]
    const observation = observePosition(gameState, moves, options.color)
    const candidates = buildAgentCandidates(
        gameState,
        moves,
        options.color,
        depth,
        maxBranching,
        observation,
    )
    const recommended = candidates[0]

    return {
        selectedSquare: options.from,
        legalMoveCount: moves.length,
        recommendedMove: recommended.move,
        summary: `Gợi ý cho quân đang chọn: ${recommended.san}. ${recommended.plan} ${recommended.risk}`,
        candidateAdvice: candidates.slice(0, 3).map((candidate) => ({
            san: candidate.san,
            score: candidate.score,
            plan: candidate.plan,
            risk: candidate.risk,
        })),
        destinationCues: candidates.slice(0, 3).map((candidate, index) => ({
            square: candidate.move.to,
            kind: index === 0
                ? 'recommended'
                : candidate.score < recommended.score - 120
                    ? 'risky'
                    : 'candidate',
            label: index === 0
                ? `Nước agent khuyên: ${candidate.san}`
                : `${candidate.san}: ${formatScore(candidate.score)}`,
        })),
    }
}

function observePosition(
    gameState: GameState,
    moves: LegalMoveOption[],
    rootColor: Color,
): AgentObservation {
    const materialBalance = calculateMaterialBalance(gameState, rootColor)

    return {
        fen: gameState.fen,
        turn: gameState.turn,
        status: gameState.status.kind,
        legalMoveCount: moves.length,
        phase: detectPhase(gameState),
        materialBalance,
        materialSummary: describeMaterialBalance(materialBalance),
        recentPattern: describeRecentPattern(gameState),
    }
}

function buildAgentCandidates(
    gameState: GameState,
    moves: LegalMoveOption[],
    rootColor: Color,
    depth: number,
    maxBranching: number,
    observation: AgentObservation,
): AgentCandidate[] {
    const scoredCandidates = orderMoves(moves)
        .map((move) => {
            const nextState = applyMove(gameState, {
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            })
            const score = minimax(
                nextState,
                depth - 1,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
                rootColor,
                maxBranching,
            )

            return {
                move,
                san: move.san,
                score,
                reason: describeMove(move),
                plan: '',
                risk: '',
            }
        })
        .sort((left, right) => right.score - left.score)

    return scoredCandidates.map((candidate, index) => ({
        ...candidate,
        plan: describeCandidatePlan(candidate, observation),
        risk: describeCandidateRisk(candidate, index, scoredCandidates),
    }))
}

function chooseGoal(
    gameState: GameState,
    candidate: AgentCandidate,
    observation: AgentObservation,
): string {
    if (candidate.move.isCheckmate) {
        return 'Kết thúc ván bằng chiếu hết ngay khi có cơ hội.'
    }

    if (candidate.move.captured === 'queen') {
        return 'Thắng vật chất lớn và ép đối thủ vào thế phòng thủ.'
    }

    if (gameState.status.kind === 'check') {
        return 'Thoát khỏi áp lực lên vua và giành lại nhịp chủ động.'
    }

    if (candidate.move.isCheck) {
        return 'Tạo đòn chiếu để buộc đối thủ phản ứng theo ý mình.'
    }

    if (observation.phase === 'khai cuộc') {
        return 'Phát triển quân, kiểm soát trung tâm và chuẩn bị nhập thành an toàn.'
    }

    if (observation.materialBalance > 180) {
        return 'Đơn giản hóa thế cờ để giữ lợi thế vật chất.'
    }

    if (observation.materialBalance < -180) {
        return 'Tìm phản công chủ động để bù lại bất lợi vật chất.'
    }

    return 'Cải thiện hoạt động quân và giảm lựa chọn tốt của đối thủ.'
}

function describeCandidatePlan(
    candidate: AgentCandidate,
    observation: AgentObservation,
): string {
    if (candidate.move.isCheckmate) {
        return `Đi ${candidate.san} để kết thúc ván ngay.`
    }

    if (candidate.move.isPromotion) {
        return `Đi ${candidate.san} để phong cấp và tạo ưu thế quyết định.`
    }

    if (candidate.move.captured) {
        return `Đi ${candidate.san} để thắng ${formatPiece(candidate.move.captured)} rồi củng cố vị trí.`
    }

    if (candidate.move.isCastle) {
        return `Đi ${candidate.san} để đưa vua vào an toàn và nối hai xe.`
    }

    if (observation.phase === 'khai cuộc') {
        return `Đi ${candidate.san} để phát triển quân và giữ trung tâm.`
    }

    return `Đi ${candidate.san} để tăng hoạt động quân và giữ thế chủ động.`
}

function describeCandidateRisk(
    candidate: AgentCandidate,
    index: number,
    candidates: AgentCandidate[],
): string {
    if (candidate.move.isCheckmate) {
        return 'Rủi ro rất thấp vì nước này chiếu hết.'
    }

    const bestScore = candidates[0]?.score ?? candidate.score

    if (index > 0 && candidate.score < bestScore - 120) {
        return 'Rủi ro là bỏ lỡ lựa chọn mạnh hơn trong danh sách ứng viên.'
    }

    if (candidate.move.captured) {
        return 'Cần kiểm tra phản đòn sau khi đổi quân.'
    }

    if (candidate.move.isCheck) {
        return 'Đối thủ có thể dùng nước đỡ chiếu để đổi nhịp.'
    }

    return 'Rủi ro chính là đối thủ còn thời gian cải thiện quân.'
}

function describeDecisionPlan(
    candidate: AgentCandidate,
    principalVariation: string[],
    observation: AgentObservation,
): string {
    const line =
        principalVariation.length > 1
            ? ` Chuỗi dự kiến: ${principalVariation.join(', ')}.`
            : ''

    return `${candidate.plan} Trong ${observation.phase}, agent ưu tiên nước có điểm ổn định hơn là chỉ nhìn nước đầu.${line}`
}

function describeDecisionRisk(
    candidate: AgentCandidate,
    candidates: AgentCandidate[],
    observation: AgentObservation,
): string {
    if (candidate.move.isCheckmate) {
        return 'Rủi ro thấp: nước được chọn đã chiếu hết.'
    }

    const secondBest = candidates.find((item) => item.san !== candidate.san)

    if (secondBest && Math.abs(candidate.score - secondBest.score) <= 25) {
        return `Rủi ro: ${secondBest.san} gần ngang điểm, nên thế cờ vẫn cần theo dõi kỹ.`
    }

    if (observation.materialBalance < -180) {
        return 'Rủi ro: đang kém vật chất, cần tránh đổi quân vô ích.'
    }

    return candidate.risk
}

function describeReflection(
    candidate: AgentCandidate,
    plan: string,
    risk: string,
): string {
    return `Tôi chọn ${candidate.san} vì ${candidate.reason.toLowerCase()} ${plan} ${risk}`
}

function buildToolTrace(
    observation: AgentObservation,
    candidates: AgentCandidate[],
): AgentToolResult[] {
    const topCandidate = candidates[0]

    return [
        {
            name: 'observe-position',
            summary: `${observation.phase}; ${observation.materialSummary}; ${observation.legalMoveCount} nước hợp lệ.`,
        },
        {
            name: 'rank-candidates',
            summary: `Ứng viên dẫn đầu là ${topCandidate.san} với điểm ${formatScore(topCandidate.score)}.`,
        },
        {
            name: 'self-review',
            summary: `Kiểm tra rủi ro chính: ${topCandidate.risk}`,
        },
    ]
}

function buildCoachSuggestion(
    goal: string,
    candidate: AgentCandidate,
    risk: string,
    observation: AgentObservation,
): string {
    if (candidate.move.isCheckmate) {
        return 'Bài học: khi có chiếu hết, hãy kiểm tra toàn bộ nước ép vua trước khi tính kế hoạch dài.'
    }

    if (candidate.move.captured) {
        return `Bài học: sau ${candidate.san}, hãy hỏi liệu quân vừa bắt có bị phản đòn không. ${risk}`
    }

    return `Gợi ý: hãy so sánh nước của bạn với mục tiêu "${goal}" và theo dõi ${observation.recentPattern.toLowerCase()}`
}

function buildMemoryNotes(
    gameState: GameState,
    observation: AgentObservation,
): string[] {
    const captureCount = gameState.history.filter((move) => move.captured).length
    const checkCount = gameState.history.filter((move) => move.san.includes('+')).length
    const notes = [
        `Nhịp ván: ${observation.phase}, ${observation.materialSummary.toLowerCase()}`,
        observation.recentPattern,
    ]

    if (captureCount > 0) {
        notes.push(`Đã có ${captureCount} nước bắt quân; cần kiểm soát trao đổi.`)
    } else {
        notes.push('Chưa có trao đổi lớn; ưu tiên phát triển và an toàn vua.')
    }

    if (checkCount > 0) {
        notes.push(`Đã có ${checkCount} lần chiếu; chú ý các motif ép vua.`)
    }

    return notes
}

function buildVisualCues(
    selectedMove: LegalMoveOption,
    principalLine: AgentLineMove[],
): AgentVisualCue[] {
    const cues: AgentVisualCue[] = [
        {
            square: selectedMove.from,
            kind: 'chosen',
            label: `Agent xuất phát từ ${formatSquare(selectedMove.from)}`,
        },
        {
            square: selectedMove.to,
            kind: 'chosen',
            label: `Agent chọn ${selectedMove.san}`,
        },
    ]

    for (let index = 1; index < principalLine.length; index += 1) {
        const move = principalLine[index]
        const kind = index % 2 === 1 ? 'risk' : 'plan'

        cues.push({
            square: move.to,
            kind,
            label: kind === 'risk'
                ? `Phản ứng cần chú ý: ${move.san}`
                : `Kế hoạch tiếp theo: ${move.san}`,
        })
    }

    return cues
}

function buildPrincipalLine(
    gameState: GameState,
    firstMove: LegalMoveOption,
    rootColor: Color,
): AgentLineMove[] {
    const line: AgentLineMove[] = [mapLineMove(firstMove)]
    let currentState = applyMove(gameState, {
        from: firstMove.from,
        to: firstMove.to,
        promotion: firstMove.promotion,
    })

    for (let ply = 0; ply < 2; ply += 1) {
        if (isGameLocked(currentState.status)) {
            break
        }

        const moves = orderMoves(getAllLegalMoves(currentState))

        if (moves.length === 0) {
            break
        }

        const scoredMoves = moves.map((move) => {
            const nextState = applyMove(currentState, {
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            })

            return {
                move,
                score: evaluateState(nextState, rootColor),
            }
        })
        const bestMove = scoredMoves.sort((left, right) =>
            currentState.turn === rootColor
                ? right.score - left.score
                : left.score - right.score,
        )[0]?.move

        if (!bestMove) {
            break
        }

        line.push(mapLineMove(bestMove))
        currentState = applyMove(currentState, {
            from: bestMove.from,
            to: bestMove.to,
            promotion: bestMove.promotion,
        })
    }

    return line
}

function mapLineMove(move: LegalMoveOption): AgentLineMove {
    return {
        san: move.san,
        from: move.from,
        to: move.to,
    }
}

function minimax(
    gameState: GameState,
    depth: number,
    alpha: number,
    beta: number,
    rootColor: Color,
    maxBranching: number,
): number {
    if (depth === 0 || isGameLocked(gameState.status)) {
        return evaluateState(gameState, rootColor)
    }

    const moves = orderMoves(getAllLegalMoves(gameState)).slice(0, maxBranching)

    if (moves.length === 0) {
        return evaluateState(gameState, rootColor)
    }

    if (gameState.turn === rootColor) {
        let bestScore = Number.NEGATIVE_INFINITY
        let currentAlpha = alpha

        for (const move of moves) {
            const nextState = applyMove(gameState, {
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            })
            const score = minimax(
                nextState,
                depth - 1,
                currentAlpha,
                beta,
                rootColor,
                maxBranching,
            )

            bestScore = Math.max(bestScore, score)
            currentAlpha = Math.max(currentAlpha, score)

            if (beta <= currentAlpha) {
                break
            }
        }

        return bestScore
    }

    let bestScore = Number.POSITIVE_INFINITY
    let currentBeta = beta

    for (const move of moves) {
        const nextState = applyMove(gameState, {
            from: move.from,
            to: move.to,
            promotion: move.promotion,
        })
        const score = minimax(
            nextState,
            depth - 1,
            alpha,
            currentBeta,
            rootColor,
            maxBranching,
        )

        bestScore = Math.min(bestScore, score)
        currentBeta = Math.min(currentBeta, score)

        if (currentBeta <= alpha) {
            break
        }
    }

    return bestScore
}

function evaluateState(gameState: GameState, rootColor: Color): number {
    if (gameState.status.kind === 'checkmate') {
        return gameState.status.winner === rootColor ? MATE_SCORE : -MATE_SCORE
    }

    if (gameState.status.kind === 'stalemate' || gameState.status.kind === 'draw') {
        return 0
    }

    let score = 0

    for (let row = 0; row < gameState.board.length; row += 1) {
        for (let col = 0; col < gameState.board[row].length; col += 1) {
            const piece = gameState.board[row][col]

            if (!piece) {
                continue
            }

            const pieceScore = PIECE_VALUES[piece.type] + positionalScore(piece, row, col)
            score += piece.color === rootColor ? pieceScore : -pieceScore
        }
    }

    if (gameState.status.kind === 'check') {
        score += gameState.turn === rootColor ? -35 : 35
    }

    return score
}

function calculateMaterialBalance(gameState: GameState, rootColor: Color): number {
    let score = 0

    for (const row of gameState.board) {
        for (const piece of row) {
            if (!piece) {
                continue
            }

            const pieceScore = PIECE_VALUES[piece.type]
            score += piece.color === rootColor ? pieceScore : -pieceScore
        }
    }

    return score
}

function detectPhase(gameState: GameState): AgentObservation['phase'] {
    if (gameState.history.length < 10) {
        return 'khai cuộc'
    }

    let nonKingMaterial = 0

    for (const row of gameState.board) {
        for (const piece of row) {
            if (piece && piece.type !== 'king') {
                nonKingMaterial += PIECE_VALUES[piece.type]
            }
        }
    }

    return nonKingMaterial <= 2_400 ? 'tàn cuộc' : 'trung cuộc'
}

function describeMaterialBalance(score: number): string {
    if (score >= 180) {
        return `Đang hơn khoảng ${formatScore(score)}.`
    }

    if (score <= -180) {
        return `Đang kém khoảng ${formatScore(Math.abs(score))}.`
    }

    return 'Vật chất gần cân bằng.'
}

function describeRecentPattern(gameState: GameState): string {
    const lastMove = gameState.history.at(-1)

    if (!lastMove) {
        return 'Chưa có nước nào, trọng tâm là kiểm soát trung tâm.'
    }

    if (gameState.status.kind === 'check') {
        return `${lastMove.san} vừa tạo thế chiếu, cần xử lý an toàn vua.`
    }

    if (lastMove.captured) {
        return `${lastMove.san} vừa bắt ${formatPiece(lastMove.captured)}, thế cờ có khả năng đổi quân.`
    }

    return `Nước gần nhất là ${lastMove.san}, cần cải thiện quân trước khi tấn công.`
}

function positionalScore(piece: Piece, row: number, col: number): number {
    const centerDistance = Math.max(Math.abs(row - 3.5), Math.abs(col - 3.5))
    const centerBonus = (3.5 - centerDistance) * 8

    switch (piece.type) {
        case 'pawn':
            return pawnAdvancement(piece, row)
        case 'knight':
        case 'bishop':
            return centerBonus
        case 'queen':
            return centerBonus * 0.5
        case 'king':
            return -centerBonus * 0.25
        case 'rook':
            return Math.abs(col - 3.5) <= 0.5 ? 8 : 0
        default:
            return 0
    }
}

function pawnAdvancement(piece: Piece, row: number): number {
    return piece.color === 'white' ? (6 - row) * 8 : (row - 1) * 8
}

function getAllLegalMoves(gameState: GameState): LegalMoveOption[] {
    return getLegalMoves(gameState)
}

function orderMoves(moves: LegalMoveOption[]): LegalMoveOption[] {
    return [...moves].sort((left, right) => scoreMoveOrder(right) - scoreMoveOrder(left))
}

function scoreMoveOrder(move: LegalMoveOption): number {
    let score = 0

    if (move.isCheckmate) {
        score += 100_000
    }

    if (move.captured) {
        score += PIECE_VALUES[move.captured] * 10 - PIECE_VALUES[move.piece]
    }

    if (move.isPromotion) {
        score += move.promotion ? PIECE_VALUES[move.promotion] : PIECE_VALUES.queen
    }

    if (move.isCastle) {
        score += 80
    }

    if (move.isCheck) {
        score += 40
    }

    return score
}

function selectDeterministicEasyCandidate(
    candidates: AgentCandidate[],
    fen: string,
): AgentCandidate {
    const bestScore = candidates[0].score
    const playableCandidates = candidates.filter(
        (candidate) => candidate.score >= bestScore - 50,
    )
    const selectedIndex = hashString(fen) % playableCandidates.length

    return playableCandidates[selectedIndex]
}

function hashString(value: string): number {
    let hash = 0

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }

    return hash
}

function areSquaresEqual(left: Square, right: Square): boolean {
    return left.row === right.row && left.col === right.col
}

function formatSquare(square: Square): string {
    return `${String.fromCharCode(97 + square.col)}${8 - square.row}`
}

function describeMove(move: LegalMoveOption): string {
    if (move.isCheckmate) {
        return 'Chiếu hết ngay lập tức.'
    }

    if (move.isPromotion && move.promotion) {
        return `Phong cấp thành ${formatPiece(move.promotion)}.`
    }

    if (move.isCastle) {
        return 'Nhập thành để tăng an toàn vua.'
    }

    if (move.isEnPassant) {
        return 'Bắt tốt qua đường để thắng một tốt.'
    }

    if (move.captured) {
        return `Bắt ${formatPiece(move.captured)}.`
    }

    if (move.isCheck) {
        return 'Chiếu vua và giới hạn lựa chọn của đối thủ.'
    }

    return 'Cải thiện hoạt động quân.'
}

function formatPiece(piece: PieceType): string {
    const labels: Record<PieceType, string> = {
        king: 'vua',
        queen: 'hậu',
        rook: 'xe',
        bishop: 'tượng',
        knight: 'mã',
        pawn: 'tốt',
    }

    return labels[piece]
}

function formatScore(score: number): string {
    if (Math.abs(score) >= 99_000) {
        return score > 0 ? 'chiếu hết' : 'bị chiếu hết'
    }

    const pawns = score / 100

    return `${pawns.toFixed(1)} tốt`
}
