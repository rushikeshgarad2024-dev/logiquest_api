import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { UserDto } from '../users/dto/user.dto';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async follow(followerId: string, followingId: string): Promise<Follow> {
    if (followerId === followingId) {
      throw new BadRequestException('Users cannot follow themselves');
    }

    // Check if the target user actually exists
    const targetUser = await this.userRepo.findOne({ where: { id: followingId } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${followingId} not found`);
    }

    // Check duplicate
    const existing = await this.followRepo.findOne({ where: { followerId, followingId } });
    if (existing) {
      throw new BadRequestException('You are already following this user');
    }

    const follow = this.followRepo.create({ followerId, followingId });
    return this.followRepo.save(follow);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.followRepo.findOne({ where: { followerId, followingId } });
    if (!existing) {
      throw new NotFoundException('Follow relationship not found');
    }
    await this.followRepo.remove(existing);
  }

  async getFollowing(userId: string): Promise<UserDto[]> {
    const follows = await this.followRepo.find({
      where: { followerId: userId },
      relations: { following: true },
    });
    return follows.map(f => this.mapToUserDto(f.following));
  }

  async getFollowers(userId: string): Promise<UserDto[]> {
    const follows = await this.followRepo.find({
      where: { followingId: userId },
      relations: { follower: true },
    });
    return follows.map(f => this.mapToUserDto(f.follower));
  }

  private mapToUserDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
