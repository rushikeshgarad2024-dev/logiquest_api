import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Streak } from '../schemas/streak.schema';
import { StreakEvents } from '../events/streak.events';
import { streakConfig } from '../config/streak.config';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class StreakService {
  constructor(
    @InjectModel(Streak.name) private streakModel: Model<Streak>,
    private readonly streakEvents: StreakEvents,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private getUTCDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  private isActiveToday(lastActiveDate: Date | null): boolean {
    if (!lastActiveDate) return false;
    return this.getUTCDateString() === this.getUTCDateString(lastActiveDate);
  }

  private wasActiveYesterday(lastActiveDate: Date | null): boolean {
    if (!lastActiveDate) return false;
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return this.getUTCDateString(yesterday) === this.getUTCDateString(lastActiveDate);
  }

  async recordPuzzleCompletion(userId: string): Promise<Streak> {
    const userObjectId = new Types.ObjectId(userId);
    let streak = await this.streakModel.findOne({ userId: userObjectId });

    if (!streak) {
      streak = new this.streakModel({
        userId: userObjectId,
        currentStreak: 1,
        lastActiveDate: new Date(),
      });
      await streak.save();
      this.checkMilestones(streak);
      return streak;
    }

    if (this.isActiveToday(streak.lastActiveDate)) {
      return streak; // Already active today
    }

    const wasActiveYesterday = this.wasActiveYesterday(streak.lastActiveDate);
    const now = new Date();

    if (wasActiveYesterday) {
      streak.currentStreak += 1;
    } else {
      streak.currentStreak = 1;
    }

    const isNewRecord = streak.currentStreak > streak.longestStreak;

    streak.lastActiveDate = now;
    await streak.save();

    this.checkMilestones(streak);
    this.checkStellaRewards(streak);

    if (isNewRecord) {
      this.eventEmitter.emit('streak.record-broken', {
        userId: userId,
        currentStreak: streak.currentStreak,
      });
    }

    return streak;
  }

  async getStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: Date | null }> {
    const userObjectId = new Types.ObjectId(userId);
    const streak = await this.streakModel.findOne({ userId: userObjectId });
    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    }
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
    };
  }

  async resetExpiredStreaks(): Promise<number> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const expiredStreaks = await this.streakModel.find({
      lastActiveDate: { $lt: yesterday },
      currentStreak: { $gt: 0 },
    });

    const resetPromises = expiredStreaks.map(async (streak) => {
      const previousStreak = streak.currentStreak;
      streak.currentStreak = 0;
      await streak.save();
      this.streakEvents.emit('streak:reset', {
        userId: streak.userId.toString(),
        previousStreak,
        resetDate: new Date(),
      });
    });

    await Promise.all(resetPromises);
    return expiredStreaks.length;
  }

  private checkMilestones(streak: Streak): void {
    if (streakConfig.milestones.includes(streak.currentStreak)) {
      this.streakEvents.emit('streak:milestone', {
        userId: streak.userId.toString(),
        streak: streak.currentStreak,
        milestone: streak.currentStreak,
      });
    }
  }

  private checkStellaRewards(streak: Streak): void {
    const reward = streakConfig.stellaRewards[streak.currentStreak];
    if (reward) {
      this.streakEvents.emit('streak:stellaReward', {
        userId: streak.userId.toString(),
        streak: streak.currentStreak,
        stellaAmount: reward,
      });
    }
  }
}