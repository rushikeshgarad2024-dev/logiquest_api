import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionsService } from './sessions.service';
import { SessionGateway } from '../gateway/session.gateway';

@Injectable()
export class SessionsScheduler {
  private readonly logger = new Logger(SessionsScheduler.name);
  private readonly TIME_WARNING_THRESHOLDS = [60, 30, 10]; // seconds remaining
  private readonly SESSION_TIME_LIMIT = 600; // 10 minutes in seconds

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionGateway: SessionGateway,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoAbandon(): Promise<void> {
    const count = await this.sessionsService.autoAbandonStaleSessions();
    if (count > 0) {
      this.logger.log(`Auto-abandoned ${count} stale session(s)`);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleTimeWarnings(): Promise<void> {
    const activeSessions = await this.sessionsService.getActiveSessions();
    const now = Date.now();

    for (const session of activeSessions) {
      const elapsedSeconds = Math.floor((now - session.startedAt.getTime()) / 1000);
      const timeRemaining = this.SESSION_TIME_LIMIT - elapsedSeconds;

      // Check if we should emit a time warning
      for (const threshold of this.TIME_WARNING_THRESHOLDS) {
        if (timeRemaining <= threshold && timeRemaining > threshold - 10) {
          this.sessionGateway.emitTimeWarning(session.id, {
            sessionId: session.id,
            timeRemaining,
            threshold,
          });
          this.logger.debug(
            `Time warning emitted for session ${session.id}: ${timeRemaining}s remaining`,
          );
          break; // Only emit one warning per threshold check
        }
      }
    }
  }
}
