import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
    createCoachInsight,
    selectAgentMove,
    type AgentDecision,
    type AgentTrace,
    type AiLevel,
    type CoachInsight,
} from './ai'
import {
    applyMove,
    areSquaresEqual,
    createInitialGameState,
    getLegalMovesForSquare,
    getPieceAt,
    isGameLocked,
    PROMOTION_PIECE_TYPES,
    requiresPromotionChoice,
    squareToAlgebraic,
    type Color,
    type GameState,
    type Piece,
    type PromotionPieceType,
    type Square,
} from './game'

type PlayMode = 'pvp' | 'human-ai'

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
    queen: 'Hậu',
    rook: 'Xe',
    bishop: 'Tượng',
    knight: 'Mã',
}

const AI_LEVEL_LABELS: Record<AiLevel, string> = {
    easy: 'Nhanh',
    normal: 'Chuẩn',
    hard: 'Sâu',
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
    const [playMode, setPlayMode] = useState<PlayMode>('pvp')
    const [humanColor, setHumanColor] = useState<Color>('white')
    const [aiLevel, setAiLevel] = useState<AiLevel>('normal')
    const [lastAgentDecision, setLastAgentDecision] =
        useState<AgentDecision | null>(null)

    const aiColor = humanColor === 'white' ? 'black' : 'white'
    const gameLocked = isGameLocked(gameState.status)
    const isAiTurn =
        playMode === 'human-ai' &&
        gameState.turn === aiColor &&
        !pendingPromotion &&
        !gameLocked
    const selectedPiece = selectedSquare
        ? getPieceAt(gameState.board, selectedSquare)
        : null
    const legalMoves = selectedSquare && !pendingPromotion && !isAiTurn
        ? getLegalMovesForSquare(gameState, selectedSquare)
        : []
    const historyRows = buildHistoryRows(gameState.history)
    const statusKind = pendingPromotion || isAiTurn ? 'active' : gameState.status.kind
    const statusMessage = pendingPromotion
        ? `Chọn quân phong cấp cho tốt ở ${squareToAlgebraic(pendingPromotion.to)}.`
        : isAiTurn
            ? 'Agent đang suy nghĩ...'
            : formatStatusMessage(gameState.status)
    const coachInsight = useMemo(
        () => (isAiTurn ? null : buildCoachInsight(gameState, aiLevel)),
        [aiLevel, gameState, isAiTurn],
    )
    const activeTrace = lastAgentDecision?.trace ?? coachInsight?.trace ?? null

    useEffect(() => {
        if (!isAiTurn) {
            return
        }

        const timer = window.setTimeout(() => {
            const decision = selectAgentMove(gameState, {
                color: aiColor,
                level: aiLevel,
            })

            setGameState((current) => {
                if (
                    current.fen !== gameState.fen ||
                    current.turn !== aiColor ||
                    isGameLocked(current.status)
                ) {
                    return current
                }

                return applyMove(current, {
                    from: decision.move.from,
                    to: decision.move.to,
                    promotion: decision.move.promotion,
                })
            })
            setLastAgentDecision(decision)
            setSelectedSquare(null)
        }, 300)

        return () => window.clearTimeout(timer)
    }, [aiColor, aiLevel, gameState, isAiTurn])

    function handleSquareClick(square: Square) {
        if (pendingPromotion || gameLocked || isAiTurn) {
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

        if (legalMoves.some((move) => areSquaresEqual(move.to, square))) {
            if (requiresPromotionChoice(gameState, selectedSquare, square)) {
                setPendingPromotion({
                    from: selectedSquare,
                    to: square,
                    color: gameState.turn,
                })
                setSelectedSquare(null)
                return
            }

            setGameState((current) =>
                applyMove(current, {
                    from: selectedSquare,
                    to: square,
                }),
            )
            setLastAgentDecision(null)
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
            applyMove(current, {
                from: pendingPromotion.from,
                to: pendingPromotion.to,
                promotion: pieceType,
            }),
        )
        setLastAgentDecision(null)
        setPendingPromotion(null)
    }

    function handleReset() {
        setGameState(createInitialGameState())
        setSelectedSquare(null)
        setPendingPromotion(null)
        setLastAgentDecision(null)
    }

    function handleModeChange(nextMode: PlayMode) {
        setPlayMode(nextMode)
        setSelectedSquare(null)
        setPendingPromotion(null)
        setLastAgentDecision(null)
    }

    function handleHumanColorChange(nextColor: Color) {
        setHumanColor(nextColor)
        setSelectedSquare(null)
        setPendingPromotion(null)
        setLastAgentDecision(null)
    }

    return (
        <main className="app-shell">
            <header className="panel hero-panel">
                <div>
                    <p className="eyebrow">Cờ vua full-rules + agent local</p>
                    <h1>Chess Agentic AI</h1>
                    <p className="hero-copy">
                        Chơi PvP tại máy hoặc đấu với agent có kế hoạch, tự đánh giá,
                        ghi nhớ nhịp ván và coach bằng tiếng Việt.
                    </p>
                </div>
                <div className="header-actions">
                    <button type="button" className="reset-button" onClick={handleReset}>
                        Ván mới
                    </button>
                </div>
            </header>

            <div className="game-workspace">
                <aside className="side-rail side-rail--left">
                    <section className="panel controls-panel" aria-label="Điều khiển ván cờ">
                        <div className="control-group">
                            <span className="label">Chế độ</span>
                            <div className="segmented-control">
                                <button
                                    type="button"
                                    className={playMode === 'pvp' ? 'segment segment--active' : 'segment'}
                                    onClick={() => handleModeChange('pvp')}
                                >
                                    PvP tại máy
                                </button>
                                <button
                                    type="button"
                                    className={
                                        playMode === 'human-ai' ? 'segment segment--active' : 'segment'
                                    }
                                    onClick={() => handleModeChange('human-ai')}
                                >
                                    Người vs AI
                                </button>
                            </div>
                        </div>

                        <div className="control-group">
                            <span className="label">Bạn cầm</span>
                            <div className="segmented-control">
                                {(['white', 'black'] as Color[]).map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={
                                            humanColor === color ? 'segment segment--active' : 'segment'
                                        }
                                        disabled={playMode === 'pvp'}
                                        onClick={() => handleHumanColorChange(color)}
                                    >
                                        {formatColorVi(color)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="control-group">
                            <span className="label">Độ sâu AI</span>
                            <div className="segmented-control">
                                {(['easy', 'normal', 'hard'] as AiLevel[]).map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={aiLevel === level ? 'segment segment--active' : 'segment'}
                                        disabled={playMode === 'pvp'}
                                        onClick={() => setAiLevel(level)}
                                    >
                                        {AI_LEVEL_LABELS[level]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="panel info-panel">
                        <h2>Lựa chọn</h2>
                        <p className="selection-copy">
                            {pendingPromotion
                                ? `Đang chờ phong cấp từ ${squareToAlgebraic(pendingPromotion.from)} đến ${squareToAlgebraic(pendingPromotion.to)}. Chọn hậu, xe, tượng hoặc mã để hoàn tất.`
                                : isAiTurn
                                    ? `AI bên ${formatColorVi(aiColor)} đang chọn nước.`
                                    : selectedSquare && selectedPiece
                                        ? `${formatColorVi(selectedPiece.color)} ${formatPieceVi(selectedPiece.type)} tại ${squareToAlgebraic(selectedSquare)}. Có ${legalMoves.length} nước hợp lệ.`
                                        : gameLocked
                                            ? 'Ván đã kết thúc. Bấm Ván mới để chơi lại.'
                                            : 'Chọn một quân của bên đang tới lượt để xem nước hợp lệ.'}
                        </p>
                    </section>

                    <section className="panel info-panel">
                        <h2>Coach tiếng Việt</h2>
                        {lastAgentDecision && playMode === 'human-ai' ? (
                            <p className="coach-copy">
                                AI vừa đi {lastAgentDecision.move.san}. {lastAgentDecision.reflection}
                            </p>
                        ) : null}
                        {coachInsight ? (
                            <CoachPanel insight={coachInsight} turn={gameState.turn} />
                        ) : (
                            <p className="empty-state">{statusMessage}</p>
                        )}
                    </section>
                </aside>

                <section className="panel board-panel">
                    <div className="status-row">
                        <div>
                            <span className="label">Lượt đi</span>
                            <strong className="turn-value">{formatColorVi(gameState.turn)}</strong>
                        </div>
                        <p className={`status-badge status-badge--${statusKind}`}>
                            {statusMessage}
                        </p>
                    </div>

                    <div className="board" role="grid" aria-label="Bàn cờ vua">
                        {gameState.board.map((row, rowIndex) =>
                            row.map((piece, colIndex) => {
                                const square = { row: rowIndex, col: colIndex }
                                const isLightSquare = (rowIndex + colIndex) % 2 === 0
                                const isSelected =
                                    selectedSquare !== null && areSquaresEqual(selectedSquare, square)
                                const isLegalMove = legalMoves.some((move) =>
                                    areSquaresEqual(move.to, square),
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
                                        disabled={isAiTurn || gameLocked || pendingPromotion !== null}
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
                        Luật cờ đầy đủ: nhập thành, bắt tốt qua đường, ký hiệu SAN và
                        phong cấp.
                    </p>

                    {pendingPromotion ? (
                        <div className="promotion-chooser" role="group" aria-label="Chọn quân phong cấp">
                            <p className="promotion-copy">
                                Phong cấp tốt ở {squareToAlgebraic(pendingPromotion.to)} thành:
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

                <aside className="side-rail side-rail--right">
                    <section className="panel info-panel agent-panel">
                        <div className="history-header">
                            <h2>Agentic AI Premium</h2>
                            <span>{aiLevel === 'hard' ? 'Sâu' : AI_LEVEL_LABELS[aiLevel]}</span>
                        </div>
                        {activeTrace ? (
                            <AgentTracePanel
                                trace={activeTrace}
                                playedMove={lastAgentDecision?.move.san}
                            />
                        ) : (
                            <p className="empty-state">
                                Agent sẽ hiện mục tiêu, kế hoạch và tự đánh giá khi có thế cờ.
                            </p>
                        )}
                    </section>

                    <section className="panel info-panel">
                        <div className="history-header">
                            <h2>Lịch sử nước đi</h2>
                            <span>{gameState.history.length} nước</span>
                        </div>

                        {historyRows.length > 0 ? (
                            <div className="history-list" role="list" aria-label="Lịch sử nước đi">
                                {historyRows.map((entry) => (
                                    <div key={entry.number} className="history-row" role="listitem">
                                        <span className="history-index">{entry.number}.</span>
                                        <span>{entry.white}</span>
                                        <span>{entry.black ?? '...'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-state">Chưa có nước nào.</p>
                        )}
                    </section>
                </aside>
            </div>
        </main>
    )
}

function CoachPanel({
    insight,
    turn,
}: {
    insight: CoachInsight
    turn: Color
}) {
    return (
        <div className="coach-panel">
            <div className="coach-best">
                <span className="label">Tốt nhất cho {formatColorVi(turn)}</span>
                <strong>{insight.bestMove}</strong>
            </div>
            <p className="coach-copy">{insight.suggestion}</p>
            <div className="insight-grid">
                <div>
                    <span className="label">Kế hoạch</span>
                    <p>{insight.plan}</p>
                </div>
                <div>
                    <span className="label">Rủi ro</span>
                    <p>{insight.risk}</p>
                </div>
            </div>
            <div className="memory-list" role="list" aria-label="Ghi nhớ coach">
                {insight.memoryNotes.map((note) => (
                    <span key={note} role="listitem">
                        {note}
                    </span>
                ))}
            </div>
            <div className="candidate-list" role="list" aria-label="Ứng viên coach">
                {insight.candidates.map((candidate) => (
                    <div key={candidate.san} className="candidate-row" role="listitem">
                        <span>{candidate.san}</span>
                        <span>{formatScore(candidate.score)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function AgentTracePanel({
    trace,
    playedMove,
}: {
    trace: AgentTrace
    playedMove?: string
}) {
    return (
        <div className="agent-trace">
            <div className="agent-summary">
                <div>
                    <span className="label">Mục tiêu</span>
                    <p>{trace.goal}</p>
                </div>
                {playedMove ? (
                    <strong className="agent-move">Vừa đi {playedMove}</strong>
                ) : null}
            </div>

            <div className="insight-grid">
                <div>
                    <span className="label">Kế hoạch</span>
                    <p>{trace.principalVariation.join(', ')}</p>
                </div>
                <div>
                    <span className="label">Tự đánh giá</span>
                    <p>{trace.reflection}</p>
                </div>
                <div>
                    <span className="label">Rủi ro</span>
                    <p>{trace.risk}</p>
                </div>
                <div>
                    <span className="label">Quan sát</span>
                    <p>
                        {trace.observation.phase}; {trace.observation.materialSummary}{' '}
                        {trace.observation.legalMoveCount} nước hợp lệ.
                    </p>
                </div>
            </div>

            <div className="tool-list" role="list" aria-label="Công cụ agent đã dùng">
                {trace.tools.map((tool) => (
                    <div key={tool.name} className="tool-row" role="listitem">
                        <span>{tool.name}</span>
                        <p>{tool.summary}</p>
                    </div>
                ))}
            </div>

            <div className="candidate-list" role="list" aria-label="Ứng viên agent">
                {trace.candidatePlans.map((candidate) => (
                    <div key={candidate.san} className="candidate-card" role="listitem">
                        <div>
                            <strong>{candidate.san}</strong>
                            <span>{formatScore(candidate.score)}</span>
                        </div>
                        <p>{candidate.plan}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

function buildCoachInsight(
    gameState: GameState,
    level: AiLevel,
): CoachInsight | null {
    if (isGameLocked(gameState.status)) {
        return null
    }

    return createCoachInsight(gameState, {
        color: gameState.turn,
        level,
    })
}

function buildSquareLabel(piece: Piece | null, square: Square): string {
    const location = squareToAlgebraic(square)

    if (!piece) {
        return `Ô trống ${location}`
    }

    return `${formatColorVi(piece.color)} ${formatPieceVi(piece.type)} ở ${location}`
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

function formatScore(score: number): string {
    if (Math.abs(score) >= 99_000) {
        return score > 0 ? 'Chiếu hết' : 'Bị chiếu hết'
    }

    const pawns = score / 100

    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

function formatColorVi(color: Color): string {
    return color === 'white' ? 'Trắng' : 'Đen'
}

function formatPieceVi(piece: Piece['type']): string {
    const labels: Record<Piece['type'], string> = {
        king: 'vua',
        queen: 'hậu',
        rook: 'xe',
        bishop: 'tượng',
        knight: 'mã',
        pawn: 'tốt',
    }

    return labels[piece]
}

function formatStatusMessage(status: GameState['status']): string {
    switch (status.kind) {
        case 'active':
            return status.message.includes('Black') ? 'Đen tới lượt.' : 'Trắng tới lượt.'
        case 'check':
            return status.message.includes('Black')
                ? 'Đen đang bị chiếu.'
                : 'Trắng đang bị chiếu.'
        case 'checkmate':
            return `Chiếu hết. ${formatColorVi(status.winner)} thắng.`
        case 'stalemate':
            return 'Hòa pat. Không còn nước hợp lệ.'
        case 'draw':
            return 'Hòa. Ván cờ kết thúc không có bên thắng.'
        case 'unsupported':
            return 'Trạng thái ván cờ chưa được hỗ trợ.'
    }

    return 'Trạng thái ván cờ.'
}

export default App
