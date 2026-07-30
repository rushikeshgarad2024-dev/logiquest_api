import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDto } from '../users/dto/user.dto';

@ApiTags('social')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('social')
@ApiResponse({ status: 401, description: 'Unauthenticated' })
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('follow/:userId')
  @ApiOperation({ summary: 'Follow another player' })
  @ApiParam({ name: 'userId', description: 'UUID of the user to follow' })
  @ApiResponse({ status: 201, description: 'Successfully followed the user' })
  @ApiResponse({ status: 400, description: 'Cannot follow self or duplicate follow' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async follow(@Param('userId') userId: string, @Request() req) {
    const followerId = req.user.id;
    return this.socialService.follow(followerId, userId);
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: 'Unfollow a player' })
  @ApiParam({ name: 'userId', description: 'UUID of the user to unfollow' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed the user' })
  @ApiResponse({ status: 404, description: 'Follow relationship not found' })
  async unfollow(@Param('userId') userId: string, @Request() req) {
    const followerId = req.user.id;
    await this.socialService.unfollow(followerId, userId);
    return { success: true };
  }

  @Get('following')
  @ApiOperation({ summary: 'Get list of players the authenticated user follows' })
  @ApiResponse({ status: 200, description: 'List of followed players', type: [UserDto] })
  async getFollowing(@Request() req): Promise<UserDto[]> {
    const userId = req.user.id;
    return this.socialService.getFollowing(userId);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get list of players following the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of followers', type: [UserDto] })
  async getFollowers(@Request() req): Promise<UserDto[]> {
    const userId = req.user.id;
    return this.socialService.getFollowers(userId);
  }
}
