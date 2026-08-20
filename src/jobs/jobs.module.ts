import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JobQueue } from './jobs.constants';
import { JobsService } from './jobs.service';
import { EmailProcessor } from './email.processor';
import { NftProcessor } from './nft.processor';
import { LeaderboardProcessor } from './leaderboard.processor';
import { CalibrationProcessor } from './calibration.processor';
import { StreaksProcessor } from './streaks.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<number>('REDIS_PORT', 6379)),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnFail: false,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: JobQueue.EMAIL },
      { name: JobQueue.NFT },
      { name: JobQueue.LEADERBOARD },
      { name: JobQueue.CALIBRATION },
      { name: JobQueue.STREAKS },
    ),
  ],
  providers: [
    JobsService,
    EmailProcessor,
    NftProcessor,
    LeaderboardProcessor,
    CalibrationProcessor,
    StreaksProcessor,
  ],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
