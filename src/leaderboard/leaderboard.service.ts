import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardQueryDto, LeaderboardEntryDto } from './dto/leaderboard.dto';
import { SocialService } from '../social/social.service';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(LeaderboardEntry)
    private readonly repo: Repository<LeaderboardEntry>,
    private readonly socialService: SocialService,
  ) {}

  async getFriendsLeaderboard(userId: string, query: LeaderboardQueryDto): Promise<LeaderboardEntryDto[]> {
    const following = await this.socialService.getFollowing(userId);
    const followingIds = following.map(u => u.id);
    if (followingIds.length === 0) {
      return [];
    }
    const { limit = 20, page = 1, category } = query;
    const qb = this.repo.createQueryBuilder('lb')
      .where('lb.playerId IN (:...followingIds)', { followingIds })
      .orderBy('lb.totalScore', 'DESC')
      .addOrderBy('lb.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (category) {
      qb.andWhere('lb.category = :category', { category });
    } else {
      qb.andWhere('lb.category IS NULL');
    }
    const entries = await qb.getMany();
    return entries.map((e, idx) => ({
      userId: e.playerId,
      totalScore: e.totalScore,
      category: e.category ?? undefined,
      rank: (page - 1) * limit + idx + 1,
    }));
  }

  /** Get top entries with pagination and optional category filter */
  async getTop(query: LeaderboardQueryDto): Promise<LeaderboardEntryDto[]> {
    const { limit = 20, page = 1, category } = query;
    const qb = this.repo.createQueryBuilder('lb')
      .orderBy('lb.totalScore', 'DESC')
      .addOrderBy('lb.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (category) {
      qb.andWhere('lb.category = :category', { category });
    } else {
      qb.andWhere('lb.category IS NULL');
    }
    const entries = await qb.getMany();
    // Map to DTO with rank calculation based on offset
    return entries.map((e, idx) => ({
      userId: e.playerId,
      totalScore: e.totalScore,
      category: e.category ?? undefined,
      rank: (page - 1) * limit + idx + 1,
    }));
  }

  /** Get rank for a specific user (global) */
  async getUserRank(userId: string, category?: string): Promise<LeaderboardEntryDto> {
    // Count number of entries with higher score (or same score but earlier createdAt)
    const subQuery = this.repo.createQueryBuilder('lb')
      .select('COUNT(*)', 'cnt')
      .where('lb.totalScore > (SELECT totalScore FROM leaderboard_entry WHERE playerId = :userId AND category = :cat)', { userId, cat: category ?? null })
      .orWhere('lb.totalScore = (SELECT totalScore FROM leaderboard_entry WHERE playerId = :userId AND category = :cat) AND lb.createdAt < (SELECT createdAt FROM leaderboard_entry WHERE playerId = :userId AND category = :cat)', { userId, cat: category ?? null });
    const result = await subQuery.getRawOne();
    const rank = Number(result?.cnt ?? 0) + 1;
    const entry = await this.repo.findOne({ where: { playerId: userId, category: category ?? IsNull() } });
    if (!entry) {
      throw new Error('Leaderboard entry not found');
    }
    return {
      userId: entry.playerId,
      totalScore: entry.totalScore,
      category: entry.category ?? undefined,
      rank,
    };
  }

  /** Handle score update events */
  async handleScoreUpdated(payload: { sessionId: string; newScore: number; playerId: string; category?: string }) {
    const { playerId, newScore, category } = payload;
    // upsert the leaderboard entry
    const existing = await this.repo.findOne({ where: { playerId, category: category ?? IsNull() } });
    if (existing) {
      existing.totalScore += newScore;
      await this.repo.save(existing);
    } else {
      const entry = this.repo.create({
        playerId,
        category: category ?? null,
        totalScore: newScore,
      });
      await this.repo.save(entry);
    }
  }
}
