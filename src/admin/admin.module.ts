import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { Puzzle } from '../puzzles/entities/puzzle.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditModule } from '../audit/audit.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Reward, Puzzle]),
    AuditModule,
    JobsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
