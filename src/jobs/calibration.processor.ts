import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { JobQueue } from './jobs.constants';

export interface CalibrationJobData {
  puzzleId?: string;
  autoApply?: boolean;
  minSubmissions?: number;
}

@Processor(JobQueue.CALIBRATION)
export class CalibrationProcessor {
  private readonly logger = new Logger(CalibrationProcessor.name);

  @Process()
  async handleCalibration(job: Job<CalibrationJobData>): Promise<{ success: boolean; calibratedPuzzleId?: string }> {
    this.logger.log(`Processing calibration job #${job.id} for puzzle: ${job.data.puzzleId || 'all'}`);

    // Calibration processing logic
    this.logger.log(`Calibration job completed for ${job.data.puzzleId || 'all puzzles'}`);

    return {
      success: true,
      calibratedPuzzleId: job.data.puzzleId,
    };
  }

  @OnQueueCompleted()
  onCompleted(job: Job<CalibrationJobData>, result: any): void {
    this.logger.log(`Calibration job #${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<CalibrationJobData>, error: Error): void {
    this.logger.error(
      `Calibration job #${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${error.message}`,
      error.stack,
    );
  }
}
