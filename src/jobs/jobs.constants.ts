export enum JobQueue {
  EMAIL = 'email',
  NFT = 'nft',
  LEADERBOARD = 'leaderboard',
  CALIBRATION = 'calibration',
  STREAKS = 'streaks',
}

export const JOB_QUEUES = [
  JobQueue.EMAIL,
  JobQueue.NFT,
  JobQueue.LEADERBOARD,
  JobQueue.CALIBRATION,
  JobQueue.STREAKS,
] as const;

export type JobQueueName = (typeof JOB_QUEUES)[number];

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused?: number;
}

export interface QueuesStatusResponse {
  [queueName: string]: QueueJobCounts;
}

export interface RetryFailedResponse {
  queue: string;
  retriedCount: number;
  message: string;
}
