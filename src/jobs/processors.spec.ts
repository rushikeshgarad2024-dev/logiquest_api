import { EmailProcessor } from './email.processor';
import { NftProcessor } from './nft.processor';
import { LeaderboardProcessor } from './leaderboard.processor';
import { CalibrationProcessor } from './calibration.processor';
import { StreaksProcessor } from './streaks.processor';
import type { Job } from 'bull';

describe('Job Processors', () => {
  const createMockJob = <T>(id: string, data: T, attemptsMade = 1): Job<T> =>
    ({
      id,
      data,
      attemptsMade,
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    } as unknown as Job<T>);

  describe('EmailProcessor', () => {
    let processor: EmailProcessor;

    beforeEach(() => {
      processor = new EmailProcessor();
    });

    it('should successfully process a valid email job', async () => {
      const job = createMockJob('job-1', {
        to: 'test@example.com',
        subject: 'Weekly Digest',
        body: 'Hello World',
      });

      const result = await processor.handleEmailDelivery(job);
      expect(result).toEqual({ success: true, deliveredTo: 'test@example.com' });
    });

    it('should throw error when email payload is invalid', async () => {
      const job = createMockJob('job-2', {
        to: '',
        subject: '',
      });

      await expect(processor.handleEmailDelivery(job)).rejects.toThrow(
        'Invalid email payload: missing recipient or subject',
      );
    });

    it('should handle onCompleted and onFailed events without throwing', () => {
      const job = createMockJob('job-3', { to: 'a@b.com', subject: 'Hi' });
      expect(() => processor.onCompleted(job, { success: true })).not.toThrow();
      expect(() => processor.onFailed(job, new Error('SMTP Error'))).not.toThrow();
    });
  });

  describe('NftProcessor', () => {
    let processor: NftProcessor;

    beforeEach(() => {
      processor = new NftProcessor();
    });

    it('should successfully process an NFT mint job', async () => {
      const job = createMockJob('nft-1', {
        userId: 'user-456',
        achievementId: 'puzzle-master',
      });

      const result = await processor.handleNftMint(job);
      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(result.txHash?.startsWith('0x')).toBe(true);
    });

    it('should throw error when userId is missing', async () => {
      const job = createMockJob('nft-2', {
        userId: '',
      });

      await expect(processor.handleNftMint(job)).rejects.toThrow('Invalid NFT job payload: missing userId');
    });

    it('should handle onCompleted and onFailed events', () => {
      const job = createMockJob('nft-3', { userId: 'u-1' });
      expect(() => processor.onCompleted(job, { success: true })).not.toThrow();
      expect(() => processor.onFailed(job, new Error('Blockchain timeout'))).not.toThrow();
    });
  });

  describe('LeaderboardProcessor', () => {
    let processor: LeaderboardProcessor;

    beforeEach(() => {
      processor = new LeaderboardProcessor();
    });

    it('should successfully process leaderboard recalculation', async () => {
      const job = createMockJob('lb-1', {
        timeframe: 'weekly' as const,
      });

      const result = await processor.handleRecalculation(job);
      expect(result.success).toBe(true);
      expect(result.recalculatedAt).toBeInstanceOf(Date);
    });

    it('should handle onCompleted and onFailed events', () => {
      const job = createMockJob('lb-2', {});
      expect(() => processor.onCompleted(job, { success: true })).not.toThrow();
      expect(() => processor.onFailed(job, new Error('DB Lock'))).not.toThrow();
    });
  });

  describe('CalibrationProcessor', () => {
    let processor: CalibrationProcessor;

    beforeEach(() => {
      processor = new CalibrationProcessor();
    });

    it('should successfully process puzzle calibration', async () => {
      const job = createMockJob('cal-1', {
        puzzleId: 'puzzle-abc',
        autoApply: true,
      });

      const result = await processor.handleCalibration(job);
      expect(result.success).toBe(true);
      expect(result.calibratedPuzzleId).toBe('puzzle-abc');
    });

    it('should handle onCompleted and onFailed events', () => {
      const job = createMockJob('cal-2', {});
      expect(() => processor.onCompleted(job, { success: true })).not.toThrow();
      expect(() => processor.onFailed(job, new Error('Calculation error'))).not.toThrow();
    });
  });

  describe('StreaksProcessor', () => {
    let processor: StreaksProcessor;

    beforeEach(() => {
      processor = new StreaksProcessor();
    });

    it('should successfully process streak evaluation', async () => {
      const job = createMockJob('streak-1', {
        userId: 'user-789',
        action: 'evaluate' as const,
      });

      const result = await processor.handleStreak(job);
      expect(result.success).toBe(true);
      expect(result.evaluatedCount).toBe(1);
    });

    it('should handle onCompleted and onFailed events', () => {
      const job = createMockJob('streak-2', {});
      expect(() => processor.onCompleted(job, { success: true })).not.toThrow();
      expect(() => processor.onFailed(job, new Error('Evaluation error'))).not.toThrow();
    });
  });
});
