import { Injectable, Logger, OnApplicationShutdown, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job, JobOptions } from 'bull';
import {
  JobQueue,
  JOB_QUEUES,
  JobQueueName,
  QueueJobCounts,
  QueuesStatusResponse,
  RetryFailedResponse,
} from './jobs.constants';
import { EmailJobData } from './email.processor';
import { NftMintJobData } from './nft.processor';
import { LeaderboardJobData } from './leaderboard.processor';
import { CalibrationJobData } from './calibration.processor';
import { StreakJobData } from './streaks.processor';

@Injectable()
export class JobsService implements OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectQueue(JobQueue.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(JobQueue.NFT) private readonly nftQueue: Queue,
    @InjectQueue(JobQueue.LEADERBOARD) private readonly leaderboardQueue: Queue,
    @InjectQueue(JobQueue.CALIBRATION) private readonly calibrationQueue: Queue,
    @InjectQueue(JobQueue.STREAKS) private readonly streaksQueue: Queue,
  ) {
    this.queues = new Map<string, Queue>([
      [JobQueue.EMAIL, this.emailQueue],
      [JobQueue.NFT, this.nftQueue],
      [JobQueue.LEADERBOARD, this.leaderboardQueue],
      [JobQueue.CALIBRATION, this.calibrationQueue],
      [JobQueue.STREAKS, this.streaksQueue],
    ]);
  }

  getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue '${queueName}' not found. Available queues: ${JOB_QUEUES.join(', ')}`);
    }
    return queue;
  }

  async addEmailJob(data: EmailJobData, options?: JobOptions): Promise<Job<EmailJobData>> {
    return this.emailQueue.add(data, options);
  }

  async addNftJob(data: NftMintJobData, options?: JobOptions): Promise<Job<NftMintJobData>> {
    return this.nftQueue.add(data, options);
  }

  async addLeaderboardJob(data: LeaderboardJobData, options?: JobOptions): Promise<Job<LeaderboardJobData>> {
    return this.leaderboardQueue.add(data, options);
  }

  async addCalibrationJob(data: CalibrationJobData, options?: JobOptions): Promise<Job<CalibrationJobData>> {
    return this.calibrationQueue.add(data, options);
  }

  async addStreakJob(data: StreakJobData, options?: JobOptions): Promise<Job<StreakJobData>> {
    return this.streaksQueue.add(data, options);
  }

  async getQueueStatus(): Promise<QueuesStatusResponse> {
    const status: QueuesStatusResponse = {};

    for (const [name, queue] of this.queues.entries()) {
      const counts: QueueJobCounts = (await queue.getJobCounts()) as QueueJobCounts;
      status[name] = counts;
    }

    return status;
  }

  async retryFailedJobs(queueName: string): Promise<RetryFailedResponse> {
    const normalizedQueue = queueName.toLowerCase();
    const queue = this.getQueue(normalizedQueue);

    const failedJobs = await queue.getFailed();
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (err) {
        this.logger.error(`Failed to retry job #${job.id} in queue '${normalizedQueue}': ${(err as Error).message}`);
      }
    }

    this.logger.log(`Retried ${retriedCount} failed jobs in queue '${normalizedQueue}'`);

    return {
      queue: normalizedQueue,
      retriedCount,
      message: `Successfully re-enqueued ${retriedCount} dead-letter / failed job(s) for queue '${normalizedQueue}'.`,
    };
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Gracefully shutting down Bull job queues (signal: ${signal || 'none'})...`);

    for (const [name, queue] of this.queues.entries()) {
      try {
        this.logger.log(`Pausing and draining queue '${name}'...`);
        // Pausing with (true, true) waits for current active jobs to finish processing before closing
        await queue.pause(true, true);
        await queue.close();
        this.logger.log(`Queue '${name}' closed successfully.`);
      } catch (error) {
        this.logger.error(`Error while closing queue '${name}': ${(error as Error).message}`);
      }
    }

    this.logger.log('All job queues have been drained and closed.');
  }
}
