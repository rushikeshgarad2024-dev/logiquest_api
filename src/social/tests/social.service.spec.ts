import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialService } from '../social.service';
import { Follow } from '../entities/follow.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { LeaderboardEntry } from '../../leaderboard/entities/leaderboard-entry.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Social & Friends Leaderboard Logic', () => {
  let socialService: SocialService;
  let leaderboardService: LeaderboardService;
  let followRepo: Repository<Follow>;
  let userRepo: Repository<User>;
  let leaderboardRepo: Repository<LeaderboardEntry>;

  const mockFollowRepo = {
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockLeaderboardRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        LeaderboardService,
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(LeaderboardEntry),
          useValue: mockLeaderboardRepo,
        },
      ],
    }).compile();

    socialService = module.get<SocialService>(SocialService);
    leaderboardService = module.get<LeaderboardService>(LeaderboardService);
    followRepo = module.get<Repository<Follow>>(getRepositoryToken(Follow));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    leaderboardRepo = module.get<Repository<LeaderboardEntry>>(getRepositoryToken(LeaderboardEntry));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SocialService - follow', () => {
    it('should throw BadRequestException if a user tries to follow themselves', async () => {
      await expect(socialService.follow('user1', 'user1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if target user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(socialService.follow('user1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for duplicate follow relationship', async () => {
      const targetUser = new User();
      targetUser.id = 'user2';
      mockUserRepo.findOne.mockResolvedValue(targetUser);
      mockFollowRepo.findOne.mockResolvedValue(new Follow());

      await expect(socialService.follow('user1', 'user2')).rejects.toThrow(BadRequestException);
    });

    it('should successfully save follow relationship when valid', async () => {
      const targetUser = new User();
      targetUser.id = 'user2';
      const newFollow = { followerId: 'user1', followingId: 'user2' };

      mockUserRepo.findOne.mockResolvedValue(targetUser);
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue(newFollow);
      mockFollowRepo.save.mockResolvedValue(newFollow);

      const result = await socialService.follow('user1', 'user2');
      expect(mockFollowRepo.create).toHaveBeenCalledWith({ followerId: 'user1', followingId: 'user2' });
      expect(mockFollowRepo.save).toHaveBeenCalledWith(newFollow);
      expect(result).toEqual(newFollow);
    });
  });

  describe('SocialService - unfollow', () => {
    it('should throw NotFoundException if follow relationship does not exist', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);
      await expect(socialService.unfollow('user1', 'user2')).rejects.toThrow(NotFoundException);
    });

    it('should successfully remove follow relationship if exists', async () => {
      const existingFollow = new Follow();
      existingFollow.followerId = 'user1';
      existingFollow.followingId = 'user2';
      mockFollowRepo.findOne.mockResolvedValue(existingFollow);
      mockFollowRepo.remove.mockResolvedValue(existingFollow);

      await socialService.unfollow('user1', 'user2');
      expect(mockFollowRepo.remove).toHaveBeenCalledWith(existingFollow);
    });
  });

  describe('SocialService - query followers & following', () => {
    it('should map following relations to UserDtos', async () => {
      const followedUser = new User();
      followedUser.id = 'user2';
      followedUser.username = 'alice';
      followedUser.email = 'alice@example.com';
      followedUser.role = UserRole.PLAYER;

      const followEdge = { following: followedUser };
      mockFollowRepo.find.mockResolvedValue([followEdge]);

      const result = await socialService.getFollowing('user1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user2');
      expect(result[0].username).toBe('alice');
    });

    it('should map follower relations to UserDtos', async () => {
      const followerUser = new User();
      followerUser.id = 'user2';
      followerUser.username = 'bob';
      followerUser.email = 'bob@example.com';
      followerUser.role = UserRole.PLAYER;

      const followEdge = { follower: followerUser };
      mockFollowRepo.find.mockResolvedValue([followEdge]);

      const result = await socialService.getFollowers('user1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user2');
      expect(result[0].username).toBe('bob');
    });
  });

  describe('LeaderboardService - friends-scoped leaderboard', () => {
    it('should return empty list if following list is empty', async () => {
      jest.spyOn(socialService, 'getFollowing').mockResolvedValue([]);
      const result = await leaderboardService.getFriendsLeaderboard('user1', {});
      expect(result).toEqual([]);
    });

    it('should query, rank relative to subset and return correct list', async () => {
      const mockFollowingList = [
        { id: 'user2', username: 'alice', email: 'alice@example.com', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
        { id: 'user3', username: 'bob', email: 'bob@example.com', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() }
      ];
      jest.spyOn(socialService, 'getFollowing').mockResolvedValue(mockFollowingList);

      const mockEntries = [
        { playerId: 'user2', totalScore: 300, category: null, createdAt: new Date() },
        { playerId: 'user3', totalScore: 100, category: null, createdAt: new Date() }
      ];

      const qbSelectMock = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEntries),
      };

      mockLeaderboardRepo.createQueryBuilder.mockReturnValue(qbSelectMock);

      const result = await leaderboardService.getFriendsLeaderboard('user1', { category: undefined });
      expect(qbSelectMock.where).toHaveBeenCalledWith('lb.playerId IN (:...followingIds)', { followingIds: ['user2', 'user3'] });
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user2');
      expect(result[0].rank).toBe(1);
      expect(result[1].userId).toBe('user3');
      expect(result[1].rank).toBe(2);
    });
  });
});
