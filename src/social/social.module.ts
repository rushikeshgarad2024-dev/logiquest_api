import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { Achievement } from '../achievements/entities/achievement.entity';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { SocialListener } from './social.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, User, Achievement]),
    NotificationsModule,
  ],
  controllers: [SocialController],
  providers: [SocialService, SocialListener],
  exports: [SocialService],
})
export class SocialModule {}
