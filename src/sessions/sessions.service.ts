import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitSolutionDto } from './dto/submit-solution.dto';
import { SessionGateway } from '../gateway/session.gateway';

/**
 * In-memory session record used by the hints module for lightweight,
 * non-DB backed session state tracking during a request lifecycle.
 */
export interface InMemorySession {
  id: string;
  puzzleId: string;
  status: string;
}
import { DEFAULT_LOCALE } from '../config/locale.config';

@Injectable()
export class SessionsService {
  /** In-memory store used by hints/scoring helpers */
  private inMemorySessions: Map<string, InMemorySession> = new Map();

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly sessionGateway: SessionGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // In-memory session helpers (used by HintsService and similar consumers)
  // ---------------------------------------------------------------------------

  /**
   * Create a lightweight in-memory session record.
   * Used by the hints module to track session state without a DB round-trip.
   */
  createSession(sessionId: string, puzzleId: string): InMemorySession {
    const session: InMemorySession = {
      id: sessionId,
      puzzleId,
      status: 'ACTIVE',
    };
    this.inMemorySessions.set(sessionId, session);
    return session;
  }

  /**
   * Retrieve an in-memory session by ID.
   * Throws NotFoundException if the session does not exist.
   */
  getSession(sessionId: string): InMemorySession {
    const session = this.inMemorySessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  /**
   * Update the status of an in-memory session.
   * Throws NotFoundException if the session does not exist.
   */
  updateSessionStatus(sessionId: string, status: string): InMemorySession {
    const session = this.inMemorySessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    session.status = status;
    return session;
  }

  // ---------------------------------------------------------------------------
  // DB-backed session operations
  // ---------------------------------------------------------------------------

  async start(userId: string, dto: CreateSessionDto, locale?: string): Promise<Session> {
    const session = this.sessionRepo.create({
      userId,
      puzzleId: dto.puzzleId,
      status: SessionStatus.ACTIVE,
      locale: locale ?? dto.locale ?? DEFAULT_LOCALE,
    });
    const savedSession = await this.sessionRepo.save(session);
    
    // Emit session:joined event
    this.sessionGateway.emitSessionJoined(savedSession.id, {
      sessionId: savedSession.id,
      userId: savedSession.userId,
      puzzleId: savedSession.puzzleId,
      startedAt: savedSession.startedAt,
    });
    
    return savedSession;
  }

  async submit(
    userId: string,
    sessionId: string,
    dto: SubmitSolutionDto,
  ): Promise<Session> {
    const session = await this.findOwned(userId, sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    // Evaluate: accept any non-empty solution as correct for now.
    // Real puzzle validation would compare dto.solution against puzzle answer.
    const correct = dto.solution.trim().length > 0;

    session.status = correct ? SessionStatus.COMPLETED : session.status;
    session.completedAt = correct ? new Date() : null;
    session.score = correct ? this.calculateScore(session) : 0;
    if (dto.hintsUsed !== undefined) {
      session.hintsUsed = dto.hintsUsed;
    }

    const savedSession = await this.sessionRepo.save(session);
    
    // Emit session:score_update event when score changes
    if (correct) {
      this.sessionGateway.emitScoreUpdate(savedSession.id, {
        sessionId: savedSession.id,
        score: savedSession.score,
        timestamp: new Date(),
      });
      
      // Emit session:completed event when puzzle is solved
      const timeElapsed = Math.floor(
        (savedSession.completedAt!.getTime() - savedSession.startedAt.getTime()) / 1000,
      );
      this.sessionGateway.emitSessionCompleted(savedSession.id, {
        sessionId: savedSession.id,
        finalScore: savedSession.score,
        completedAt: savedSession.completedAt!,
        hintsUsed: savedSession.hintsUsed,
        timeElapsed,
      });
    }
    
    return savedSession;
  }

  async abandon(userId: string, sessionId: string): Promise<Session> {
    const session = await this.findOwned(userId, sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    session.status = SessionStatus.ABANDONED;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  async getById(userId: string, sessionId: string): Promise<Session> {
    return this.findOwned(userId, sessionId);
  }

  async autoAbandonStaleSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await this.sessionRepo.find({
      where: { status: SessionStatus.ACTIVE, startedAt: LessThan(cutoff) },
    });

    if (stale.length === 0) return 0;

    const now = new Date();
    for (const s of stale) {
      s.status = SessionStatus.ABANDONED;
      s.completedAt = now;
    }
    await this.sessionRepo.save(stale);
    return stale.length;
  }

  async getActiveSessions(): Promise<Session[]> {
    return this.sessionRepo.find({
      where: { status: SessionStatus.ACTIVE },
    });
  }

  private async findOwned(userId: string, sessionId: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Access denied');
    return session;
  }

  private calculateScore(session: Session): number {
    const elapsed = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );
    const base = 1000;
    const timePenalty = Math.min(elapsed, 600); // max 600s penalty
    const hintPenalty = session.hintsUsed * 50;
    return Math.max(0, base - timePenalty - hintPenalty);
  }
}
