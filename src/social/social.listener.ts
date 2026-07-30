import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialService } from './social.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Achievement, Rarity } from '../achievements/entities/achievement.entity';
import { User } from '../users/entities/user.entity';
import { NotificationType } from '../notifications/notification.entity';
import { EventName } from '../events/events.enum';

@Injectable()
export class SocialListener {
  constructor(
    private readonly socialService: SocialService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @OnEvent(EventName.AchievementUnlocked)
  async handleAchievementUnlocked(payload: { userId: string; achievementId: string }) {
    const { userId, achievementId } = payload;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const achievement = await this.achievementRepo.findOne({ where: { id: achievementId } });

    if (!user || !achievement) return;

    // Check if the achievement is "rare" (RARE or EPIC)
    const isRare = achievement.rarity === Rarity.RARE || achievement.rarity === Rarity.EPIC;
    if (!isRare) return;

    // Fetch followers
    const followers = await this.socialService.getFollowers(userId);

    // Create notifications for followers
    for (const follower of followers) {
      await this.notificationsService.create({
        userId: follower.id,
        type: NotificationType.ACHIEVEMENT_UNLOCKED,
        message: `${user.username} unlocked a rare achievement: ${achievement.name}!`,
      });
    }
  }

  @OnEvent('streak.record-broken')
  async handleStreakRecordBroken(payload: { userId: string; currentStreak: number }) {
    const { userId, currentStreak } = payload;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    // Fetch followers
    const followers = await this.socialService.getFollowers(userId);

    // Create notifications for followers
    for (const follower of followers) {
      await this.notificationsService.create({
        userId: follower.id,
        type: NotificationType.STREAK_RECORD_BROKEN,
        message: `${user.username} broke their streak record with a ${currentStreak}-day streak!`,
      });
    }
  }
}
