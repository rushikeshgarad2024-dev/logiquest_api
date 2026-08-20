import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JobsService } from '../jobs/jobs.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AdminController', () => {
  let controller: AdminController;

  const mockAdminService = {
    getUsers: jest.fn(),
    banUser: jest.fn(),
    getSessions: jest.fn(),
    getStats: jest.fn(),
    getPendingSubmissions: jest.fn(),
    approveSubmission: jest.fn(),
    rejectSubmission: jest.fn(),
  };

  const mockJobsService = {
    getQueueStatus: jest.fn().mockResolvedValue({
      email: { waiting: 0, active: 0, completed: 5, failed: 1, delayed: 0, paused: 0 },
      nft: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      leaderboard: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      calibration: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      streaks: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
    }),
    retryFailedJobs: jest.fn().mockImplementation((queue: string) => {
      if (queue === 'email') {
        return Promise.resolve({
          queue: 'email',
          retriedCount: 1,
          message: "Successfully re-enqueued 1 dead-letter / failed job(s) for queue 'email'.",
        });
      }
      return Promise.reject(new NotFoundException(`Queue '${queue}' not found`));
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: JobsService, useValue: mockJobsService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /admin/jobs/status', () => {
    it('should return queue depths and failed job counts per queue', async () => {
      const status = await controller.getJobStatus();

      expect(mockJobsService.getQueueStatus).toHaveBeenCalled();
      expect(status).toHaveProperty('email');
      expect(status.email.failed).toBe(1);
    });
  });

  describe('POST /admin/jobs/:queue/retry-failed', () => {
    it('should re-enqueue failed jobs for valid queue', async () => {
      const result = await controller.retryFailedJobs('email');

      expect(mockJobsService.retryFailedJobs).toHaveBeenCalledWith('email');
      expect(result).toEqual({
        queue: 'email',
        retriedCount: 1,
        message: "Successfully re-enqueued 1 dead-letter / failed job(s) for queue 'email'.",
      });
    });

    it('should forward NotFoundException for unknown queue', async () => {
      await expect(controller.retryFailedJobs('invalid-queue')).rejects.toThrow(NotFoundException);
    });
  });
});
