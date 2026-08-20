import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { JobQueue } from './jobs.constants';

export interface StreakJobData {
  userId?: string;
  action?: 'evaluate' | 'reset' | 'restore';
  date?: string;
}

@Processor(JobQueue.STREAKS)
export class StreaksProcessor {
  private readonly logger = new Logger(StreaksProcessor.name);

  @Process()
  async handleStreak(job: Job<StreakJobData>): Promise<{ success: boolean; evaluatedCount?: number }> {
    this.logger.log(
      `Processing streak job #${job.id}, action: ${job.data.action || 'evaluate'}, user: ${job.data.userId || 'all'}`,
    );

    // Streak processing logic
    this.logger.log(`Streak processing complete for user: ${job.data.userId || 'all users'}`);

    return {
      success: true,
      evaluatedCount: job.data.userId ? 1 : 0,
    };
  }

  @OnQueueCompleted()
  onCompleted(job: Job<StreakJobData>, result: any): void {
    this.logger.log(`Streak job #${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<StreakJobData>, error: Error): void {
    this.logger.error(
      `Streak job #${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${error.message}`,
      error.stack,
    );
  }
}
