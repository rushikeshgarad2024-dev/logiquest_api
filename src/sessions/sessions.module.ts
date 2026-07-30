import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Session } from './entities/session.entity';
import { SessionReplayEvent } from './entities/session-replay-event.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionsScheduler } from './sessions.scheduler';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), ScheduleModule.forRoot(), GatewayModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsScheduler],
  exports: [SessionsService],
import { ReplayService } from './replay.service';
import { ReplayController } from './replay.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, SessionReplayEvent]),
    ScheduleModule.forRoot(),
  ],
  controllers: [SessionsController, ReplayController],
  providers: [SessionsService, SessionsScheduler, ReplayService],
  exports: [SessionsService, ReplayService],
})
export class SessionsModule {}
