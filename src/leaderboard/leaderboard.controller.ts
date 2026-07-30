import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardQueryDto, LeaderboardEntryDto } from './dto/leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a leaderboard scoped to followed players' })
  @ApiResponse({ status: 200, description: 'Friends leaderboard entries', type: [LeaderboardEntryDto] })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getFriendsLeaderboard(@Req() req: Request, @Query() query: LeaderboardQueryDto): Promise<LeaderboardEntryDto[]> {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.leaderboardService.getFriendsLeaderboard(userId, query);
  }

  @Get()
  @ApiOperation({ summary: 'Get the global (or category-scoped) top rankings' })
  @ApiResponse({ status: 200, description: 'Paginated leaderboard entries sorted by total score', type: [LeaderboardEntryDto] })
  async getLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardEntryDto[]> {
    return this.leaderboardService.getTop(query);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the authenticated user's current leaderboard rank" })
  @ApiResponse({ status: 200, description: "User's rank entry", type: LeaderboardEntryDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getMyRank(@Req() req: Request): Promise<LeaderboardEntryDto> {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.leaderboardService.getUserRank(userId);
  }
}
