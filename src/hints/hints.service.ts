import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Hint } from './entities/hint.entity';
import { SessionsService } from '../sessions/sessions.service';
import { ScoringService } from '../scoring/scoring.service';
import { SessionGateway } from '../gateway/session.gateway';

@Injectable()
export class HintsService {
  private hints: Hint[] = [];
  private sessionHints: Map<string, Set<number>> = new Map(); // sessionId -> Set of revealed hint orders (1-3)

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly scoringService: ScoringService,
    private readonly sessionGateway: SessionGateway,
  ) {
    // Seed some initial hints for puzzles
    // Supporting up to three tiered hints per puzzle (orders 1, 2, 3)
    this.hints = [
      new Hint('hint1-1', 'puzzle-1', 1, 'Puzzle 1: First Hint (Easy)'),
      new Hint('hint1-2', 'puzzle-1', 2, 'Puzzle 1: Second Hint (Medium)'),
      new Hint('hint1-3', 'puzzle-1', 3, 'Puzzle 1: Final Hint (Hard)'),
      new Hint('hint2-1', 'puzzle-2', 1, 'Puzzle 2: First Hint (Easy)'),
      new Hint('hint2-2', 'puzzle-2', 2, 'Puzzle 2: Second Hint (Medium)'),
      new Hint('hint2-3', 'puzzle-2', 3, 'Puzzle 2: Final Hint (Hard)'),
    ];
  }

  // Admin‑only endpoint retrieves all hints for a puzzle
  getHintsForPuzzle(puzzleId: string): Hint[] {
    const puzzleHints = this.hints.filter(h => h.puzzleId === puzzleId);
    return puzzleHints.sort((a, b) => a.order - b.order);
  }

  // Reveals next unrevealed hint for a session
  revealNextHint(sessionId: string): Hint {
    // 1. Retrieve the session & validate status (completed or abandoned sessions return 400)
    const session = this.sessionsService.getSession(sessionId);
    if (session.status === 'COMPLETED' || session.status === 'ABANDONED') {
      throw new BadRequestException('Cannot reveal hints in a completed or abandoned session');
    }

    const puzzleId = session.puzzleId;
    const puzzleHints = this.getHintsForPuzzle(puzzleId);
    if (puzzleHints.length === 0) {
      throw new NotFoundException(`No hints configured for puzzle ${puzzleId}`);
    }

    // 2. Track reveal and ensure repeat prevention
    if (!this.sessionHints.has(sessionId)) {
      this.sessionHints.set(sessionId, new Set<number>());
    }
    const revealedOrders = this.sessionHints.get(sessionId)!;

    // Find next unrevealed hint (ordered 1 to 3)
    const nextHint = puzzleHints.find(h => !revealedOrders.has(h.order));
    if (!nextHint) {
      throw new BadRequestException('All hints for this puzzle have already been revealed');
    }

    // Mark as revealed
    revealedOrders.add(nextHint.order);

    // 3. Trigger score penalty via the scoring module (hints cost points)
    this.scoringService.penalize(sessionId, 10);

    // Emit session:hint_revealed event
    this.sessionGateway.emitHintRevealed(sessionId, {
      sessionId,
      hintIndex: nextHint.order,
      hintText: nextHint.content,
      hintsUsed: revealedOrders.size,
    });

    return nextHint;
  }
}
