import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs/jobs.service';
import { EmailTemplate, EmailProvider, EmailPreferences, DEFAULT_EMAIL_PREFERENCES } from './email.constants';
import { renderEmailTemplate, RenderedEmail } from './email.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private readonly fromAddress: string;

  // In-memory or database preferences cache
  private userPreferences: Map<string, EmailPreferences> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
  ) {
    const rawProvider = this.configService.get<string>('EMAIL_PROVIDER', 'smtp').toLowerCase();
    if (rawProvider === 'sendgrid') {
      this.provider = EmailProvider.SENDGRID;
    } else if (rawProvider === 'console') {
      this.provider = EmailProvider.CONSOLE;
    } else {
      this.provider = EmailProvider.SMTP;
    }

    this.fromAddress = this.configService.get<string>('EMAIL_FROM', 'noreply@logiquest.io');
    this.logger.log(`EmailService initialized with provider: ${this.provider} (from: ${this.fromAddress})`);
  }

  getProvider(): EmailProvider {
    return this.provider;
  }

  getUserPreferences(userId: string): EmailPreferences {
    return this.userPreferences.get(userId) || { ...DEFAULT_EMAIL_PREFERENCES };
  }

  updateUserPreferences(userId: string, partial: Partial<EmailPreferences>): EmailPreferences {
    const current = this.getUserPreferences(userId);
    const updated: EmailPreferences = {
      ...current,
      ...partial,
      transactional: true, // Never allow opt-out of critical transactional emails
    };
    this.userPreferences.set(userId, updated);
    return updated;
  }

  isOptedIn(userId: string, template: EmailTemplate | string): boolean {
    if (template === EmailTemplate.PASSWORD_RESET) {
      return true; // Critical transactional email
    }
    const prefs = this.getUserPreferences(userId);
    if (template === EmailTemplate.WELCOME) return true;
    if (template === EmailTemplate.WEEKLY_SUMMARY) return prefs.weeklySummary;
    if (template === EmailTemplate.ACHIEVEMENT_UNLOCKED) return prefs.achievements;
    return prefs.marketing;
  }

  /**
   * Queue email asynchronously via Bull Queue with 3x retry exponential backoff.
   */
  async queueEmail(options: {
    to: string;
    template: EmailTemplate | string;
    context?: Record<string, any>;
    userId?: string;
  }): Promise<{ queued: boolean; message: string }> {
    const { to, template, context, userId } = options;

    if (userId && !this.isOptedIn(userId, template)) {
      this.logger.log(`Skipping email '${template}' to user '${userId}' (${to}) due to opt-out preference.`);
      return { queued: false, message: 'User has opted out of this email category.' };
    }

    const rendered: RenderedEmail = renderEmailTemplate(template, context);

    await this.jobsService.addEmailJob({
      to,
      subject: rendered.subject,
      template: String(template),
      context: context || {},
      body: rendered.html,
    });

    this.logger.log(`Enqueued email '${rendered.subject}' to '${to}'`);
    return { queued: true, message: 'Email queued successfully.' };
  }

  /**
   * Send test email for admin verification.
   */
  async sendTestEmail(to: string, template: EmailTemplate = EmailTemplate.WELCOME): Promise<{ success: boolean; to: string; template: string }> {
    if (!to || !to.includes('@')) {
      throw new BadRequestException('Valid recipient email address is required.');
    }

    const res = await this.queueEmail({
      to,
      template,
      context: {
        username: 'TestAdmin',
        resetUrl: 'https://logiquest.io/test-reset',
        achievementName: 'Master Debugger',
        rank: 1,
        points: 9999,
        puzzlesSolved: 100,
      },
    });

    return {
      success: res.queued,
      to,
      template,
    };
  }
}
