import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaderboardEntry]),
    SocialModule,
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
