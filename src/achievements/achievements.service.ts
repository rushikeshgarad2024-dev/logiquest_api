import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from './entities/achievement.entity';
import { PlayerAchievement } from './entities/player-achievement.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../events/events.enum';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(PlayerAchievement)
    private readonly playerAchRepo: Repository<PlayerAchievement>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAll(): Promise<Achievement[]> {
    return this.achievementRepo.find();
  }

  async getForUser(userId: string): Promise<PlayerAchievement[]> {
    return this.playerAchRepo.find({ where: { userId }, relations: { achievement: true } });
  }

  /**
   * Evaluate achievements for a user after a session.
   * `sessionStats` should contain numeric fields matching condition types.
   */
  async evaluate(userId: string, sessionStats: any): Promise<void> {
    const achievements = await this.achievementRepo.find();
    for (const ach of achievements) {
      // skip if already unlocked (idempotent)
      const existing = await this.playerAchRepo.findOne({ where: { userId, achievementId: ach.id } });
      if (existing) continue;

      let satisfied = false;
      switch (ach.conditionType) {
        case 'puzzles_solved':
          satisfied = (sessionStats.puzzlesSolved ?? 0) >= ach.threshold;
          break;
        case 'hard_puzzles_without_hints':
          satisfied = (sessionStats.hardPuzzlesWithoutHints ?? 0) >= ach.threshold;
          break;
        default:
          satisfied = false;
      }

      if (satisfied) {
        const pa = this.playerAchRepo.create({ userId, achievementId: ach.id });
        await this.playerAchRepo.save(pa);
        this.eventEmitter.emit(EventName.AchievementUnlocked, {
          userId,
          achievementId: ach.id,
        });
      }
    }
  }
}
