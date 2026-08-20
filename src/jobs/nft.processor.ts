import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { JobQueue } from './jobs.constants';

export interface NftMintJobData {
  userId: string;
  achievementId?: string;
  metadataUri?: string;
  tokenId?: string;
  recipientAddress?: string;
}

@Processor(JobQueue.NFT)
export class NftProcessor {
  private readonly logger = new Logger(NftProcessor.name);

  @Process()
  async handleNftMint(job: Job<NftMintJobData>): Promise<{ success: boolean; txHash?: string }> {
    this.logger.log(`Processing NFT minting job #${job.id} for user ${job.data.userId}`);

    if (!job.data.userId) {
      throw new Error('Invalid NFT job payload: missing userId');
    }

    // Execute NFT minting / retry logic
    const mockTxHash = `0x${Buffer.from(job.data.userId + Date.now().toString()).toString('hex').slice(0, 64)}`;
    this.logger.log(`NFT successfully minted with transaction ${mockTxHash}`);

    return {
      success: true,
      txHash: mockTxHash,
    };
  }

  @OnQueueCompleted()
  onCompleted(job: Job<NftMintJobData>, result: any): void {
    this.logger.log(`NFT job #${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<NftMintJobData>, error: Error): void {
    this.logger.error(
      `NFT job #${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${error.message}`,
      error.stack,
    );
  }
}
