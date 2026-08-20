import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EventService } from './events/event.service';
import { ScoringModule } from './scoring/scoring.module';
import { AchievementsModule } from './achievements/achievements.module';
import { RewardsModule } from './rewards/rewards.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { SecurityModule } from './security/security.module';
import { HealthModule } from './health/health.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CategoriesModule } from './categories/categories.module';
import { PuzzlesModule } from './puzzles/puzzles.module';
import { TagsModule } from './tags/tags.module';
import { HintsModule } from './hints/hints.module';
import { SessionsModule } from './sessions/sessions.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { NftModule } from './nft/nft.module';
import { CalibrationModule } from './calibration/calibration.module';
import { GatewayModule } from './gateway/gateway.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StreakModule } from './streak/streak.module';
import { SocialModule } from './social/social.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    AppConfigModule,
    JobsModule,
    DatabaseModule,
    EventEmitterModule.forRoot({ global: true }),
    AuthModule,
    AnalyticsModule,
    ScoringModule,
    AchievementsModule,
    RewardsModule,
    NotificationsModule,
    SessionsModule,
    AdminModule,
    AuditModule,
    SecurityModule,
    HealthModule,
    CategoriesModule,
    PuzzlesModule,
    TagsModule,
    HintsModule,
    LeaderboardModule,
    NftModule,
    CalibrationModule,
    GatewayModule,
    RecommendationsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    StreakModule,
    SocialModule,
  ],
  controllers: [AppController],
  providers: [EventService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Log every inbound request across all routes.
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
