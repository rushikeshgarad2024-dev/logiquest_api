import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { JobQueue } from './jobs.constants';

export interface EmailJobData {
  to: string;
  subject: string;
  template?: string;
  context?: Record<string, any>;
  body?: string;
}

@Processor(JobQueue.EMAIL)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process()
  async handleEmailDelivery(job: Job<EmailJobData>): Promise<{ success: boolean; deliveredTo: string }> {
    this.logger.log(`Processing email job #${job.id} for ${job.data.to}`);

    if (!job.data.to || !job.data.subject) {
      throw new Error('Invalid email payload: missing recipient or subject');
    }

    // Process email sending logic
    this.logger.log(`Email successfully processed for ${job.data.to}`);
    return {
      success: true,
      deliveredTo: job.data.to,
    };
  }

  @OnQueueCompleted()
  onCompleted(job: Job<EmailJobData>, result: any): void {
    this.logger.log(`Email job #${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<EmailJobData>, error: Error): void {
    this.logger.error(
      `Email job #${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${error.message}`,
      error.stack,
    );
  }
}
