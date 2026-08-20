import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobQueue } from './jobs.constants';

describe('JobsService', () => {
  let service: JobsService;

  const createMockQueue = (name: string) => ({
    name,
    add: jest.fn().mockImplementation((data, opts) =>
      Promise.resolve({
        id: `mock-job-${Date.now()}`,
        data,
        opts: opts || { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      }),
    ),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      completed: 10,
      failed: 3,
      delayed: 0,
      paused: 0,
    }),
    getFailed: jest.fn().mockResolvedValue([
      {
        id: 'failed-1',
        retry: jest.fn().mockResolvedValue(true),
      },
      {
        id: 'failed-2',
        retry: jest.fn().mockResolvedValue(true),
      },
    ]),
    pause: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  });

  let mockEmailQueue: ReturnType<typeof createMockQueue>;
  let mockNftQueue: ReturnType<typeof createMockQueue>;
  let mockLeaderboardQueue: ReturnType<typeof createMockQueue>;
  let mockCalibrationQueue: ReturnType<typeof createMockQueue>;
  let mockStreaksQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    mockEmailQueue = createMockQueue(JobQueue.EMAIL);
    mockNftQueue = createMockQueue(JobQueue.NFT);
    mockLeaderboardQueue = createMockQueue(JobQueue.LEADERBOARD);
    mockCalibrationQueue = createMockQueue(JobQueue.CALIBRATION);
    mockStreaksQueue = createMockQueue(JobQueue.STREAKS);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getQueueToken(JobQueue.EMAIL), useValue: mockEmailQueue },
        { provide: getQueueToken(JobQueue.NFT), useValue: mockNftQueue },
        { provide: getQueueToken(JobQueue.LEADERBOARD), useValue: mockLeaderboardQueue },
        { provide: getQueueToken(JobQueue.CALIBRATION), useValue: mockCalibrationQueue },
        { provide: getQueueToken(JobQueue.STREAKS), useValue: mockStreaksQueue },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Job Enqueuing', () => {
    it('should enqueue email job', async () => {
      const emailData = { to: 'user@example.com', subject: 'Welcome!' };
      const job = await service.addEmailJob(emailData);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(emailData, undefined);
      expect(job.data).toEqual(emailData);
    });

    it('should enqueue NFT job', async () => {
      const nftData = { userId: 'user-123', achievementId: 'ach-456' };
      const job = await service.addNftJob(nftData);

      expect(mockNftQueue.add).toHaveBeenCalledWith(nftData, undefined);
      expect(job.data).toEqual(nftData);
    });

    it('should enqueue leaderboard job', async () => {
      const lbData = { timeframe: 'daily' as const };
      const job = await service.addLeaderboardJob(lbData);

      expect(mockLeaderboardQueue.add).toHaveBeenCalledWith(lbData, undefined);
      expect(job.data).toEqual(lbData);
    });

    it('should enqueue calibration job', async () => {
      const calData = { puzzleId: 'puzzle-1', autoApply: true };
      const job = await service.addCalibrationJob(calData);

      expect(mockCalibrationQueue.add).toHaveBeenCalledWith(calData, undefined);
      expect(job.data).toEqual(calData);
    });

    it('should enqueue streaks job', async () => {
      const streakData = { userId: 'user-789', action: 'evaluate' as const };
      const job = await service.addStreakJob(streakData);

      expect(mockStreaksQueue.add).toHaveBeenCalledWith(streakData, undefined);
      expect(job.data).toEqual(streakData);
    });
  });

  describe('getQueueStatus', () => {
    it('should return job counts and queue depths for all 5 queues', async () => {
      const status = await service.getQueueStatus();

      expect(status).toHaveProperty('email');
      expect(status).toHaveProperty('nft');
      expect(status).toHaveProperty('leaderboard');
      expect(status).toHaveProperty('calibration');
      expect(status).toHaveProperty('streaks');

      expect(status.email).toEqual({
        waiting: 2,
        active: 1,
        completed: 10,
        failed: 3,
        delayed: 0,
        paused: 0,
      });

      expect(mockEmailQueue.getJobCounts).toHaveBeenCalled();
      expect(mockNftQueue.getJobCounts).toHaveBeenCalled();
      expect(mockLeaderboardQueue.getJobCounts).toHaveBeenCalled();
      expect(mockCalibrationQueue.getJobCounts).toHaveBeenCalled();
      expect(mockStreaksQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe('retryFailedJobs', () => {
    it('should re-enqueue all failed dead-letter jobs for a valid queue', async () => {
      const result = await service.retryFailedJobs('email');

      expect(result).toEqual({
        queue: 'email',
        retriedCount: 2,
        message: 'Successfully re-enqueued 2 dead-letter / failed job(s) for queue \'email\'.',
      });
      expect(mockEmailQueue.getFailed).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid queue name', async () => {
      await expect(service.retryFailedJobs('nonexistent-queue')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Graceful Shutdown (drain behaviour)', () => {
    it('should pause and close all queues when application terminates', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(mockEmailQueue.pause).toHaveBeenCalledWith(true, true);
      expect(mockEmailQueue.close).toHaveBeenCalled();

      expect(mockNftQueue.pause).toHaveBeenCalledWith(true, true);
      expect(mockNftQueue.close).toHaveBeenCalled();

      expect(mockLeaderboardQueue.pause).toHaveBeenCalledWith(true, true);
      expect(mockLeaderboardQueue.close).toHaveBeenCalled();

      expect(mockCalibrationQueue.pause).toHaveBeenCalledWith(true, true);
      expect(mockCalibrationQueue.close).toHaveBeenCalled();

      expect(mockStreaksQueue.pause).toHaveBeenCalledWith(true, true);
      expect(mockStreaksQueue.close).toHaveBeenCalled();
    });
  });
});
