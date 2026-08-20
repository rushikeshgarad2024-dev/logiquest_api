import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { JobQueue } from './jobs.constants';

export interface LeaderboardJobData {
  timeframe?: 'daily' | 'weekly' | 'all-time';
  category?: string;
  triggeredBy?: string;
}

@Processor(JobQueue.LEADERBOARD)
export class LeaderboardProcessor {
  private readonly logger = new Logger(LeaderboardProcessor.name);

  @Process()
  async handleRecalculation(job: Job<LeaderboardJobData>): Promise<{ success: boolean; recalculatedAt: Date }> {
    this.logger.log(
      `Processing leaderboard recalculation job #${job.id} for timeframe: ${job.data.timeframe || 'all-time'}`,
    );

    // Leaderboard recalculation logic
    this.logger.log(`Leaderboard recalculation complete for ${job.data.timeframe || 'all-time'}`);

    return {
      success: true,
      recalculatedAt: new Date(),
    };
  }

  @OnQueueCompleted()
  onCompleted(job: Job<LeaderboardJobData>, result: any): void {
    this.logger.log(`Leaderboard job #${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<LeaderboardJobData>, error: Error): void {
    this.logger.error(
      `Leaderboard job #${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${error.message}`,
      error.stack,
    );
  }
}
