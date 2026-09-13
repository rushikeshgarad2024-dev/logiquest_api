import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { JobsService } from '../jobs/jobs.service';
import { EmailTemplate, EmailProvider } from './email.constants';
import { renderEmailTemplate } from './email.templates';

describe('Email Notification Service Suite', () => {
  let emailService: EmailService;
  let jobsService: any;

  beforeEach(async () => {
    jobsService = {
      addEmailJob: vi.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultVal: any) => {
              if (key === 'EMAIL_PROVIDER') return 'smtp';
              if (key === 'EMAIL_FROM') return 'noreply@logiquest.io';
              return defaultVal;
            }),
          },
        },
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  describe('Template Rendering', () => {
    test('renders Welcome email template', () => {
      const rendered = renderEmailTemplate(EmailTemplate.WELCOME, { username: 'Bob' });
      expect(rendered.subject).toContain('Welcome to LogiQuest');
      expect(rendered.html).toContain('Bob');
      expect(rendered.text).toContain('Welcome to LogiQuest, Bob');
    });

    test('renders Password Reset email template', () => {
      const rendered = renderEmailTemplate(EmailTemplate.PASSWORD_RESET, {
        resetUrl: 'https://logiquest.io/reset?token=xyz',
        expiresIn: '30 minutes',
      });
      expect(rendered.subject).toContain('Reset Your LogiQuest Password');
      expect(rendered.html).toContain('https://logiquest.io/reset?token=xyz');
      expect(rendered.text).toContain('30 minutes');
    });

    test('renders Achievement Unlocked email template', () => {
      const rendered = renderEmailTemplate(EmailTemplate.ACHIEVEMENT_UNLOCKED, {
        achievementName: 'Speed Demon',
        rewardPoints: 50,
      });
      expect(rendered.subject).toContain('Achievement Unlocked: Speed Demon');
      expect(rendered.html).toContain('+50 Points');
    });

    test('renders Weekly Summary email template', () => {
      const rendered = renderEmailTemplate(EmailTemplate.WEEKLY_SUMMARY, {
        username: 'Alice',
        rank: 3,
        points: 1500,
        puzzlesSolved: 25,
      });
      expect(rendered.subject).toContain('Weekly Summary');
      expect(rendered.html).toContain('#3');
      expect(rendered.html).toContain('1500');
    });
  });

  describe('Queue Submission and Opt-Out Enforcement', () => {
    test('enqueues email when user is opted in', async () => {
      const result = await emailService.queueEmail({
        to: 'alice@example.com',
        template: EmailTemplate.WELCOME,
        context: { username: 'Alice' },
      });

      expect(result.queued).toBe(true);
      expect(jobsService.addEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: expect.stringContaining('Welcome'),
          template: EmailTemplate.WELCOME,
        }),
      );
    });

    test('skips optional email when user has opted out', async () => {
      const userId = 'user-opt-out-1';
      emailService.updateUserPreferences(userId, { weeklySummary: false });

      const result = await emailService.queueEmail({
        to: 'optout@example.com',
        template: EmailTemplate.WEEKLY_SUMMARY,
        context: { username: 'OptOutUser' },
        userId,
      });

      expect(result.queued).toBe(false);
      expect(jobsService.addEmailJob).not.toHaveBeenCalled();
    });

    test('always allows critical transactional password reset email even if opted out of marketing', async () => {
      const userId = 'user-opt-out-2';
      emailService.updateUserPreferences(userId, { marketing: false, weeklySummary: false, achievements: false });

      const result = await emailService.queueEmail({
        to: 'secure@example.com',
        template: EmailTemplate.PASSWORD_RESET,
        context: { resetUrl: 'https://logiquest.io/reset' },
        userId,
      });

      expect(result.queued).toBe(true);
      expect(jobsService.addEmailJob).toHaveBeenCalled();
    });
  });

  describe('Admin Test Email', () => {
    test('sendTestEmail queues a test email successfully', async () => {
      const result = await emailService.sendTestEmail('admin@example.com', EmailTemplate.WELCOME);
      expect(result.success).toBe(true);
      expect(result.to).toBe('admin@example.com');
      expect(jobsService.addEmailJob).toHaveBeenCalled();
    });
  });
});
