import { Controller, Get, Patch, Post, Param, Query, UseGuards, Request, Body, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JobsService } from '../jobs/jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from './dto/pagination.dto';
import { SessionFilterDto } from './dto/session-filter.dto';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiResponse({ status: 401, description: 'Unauthenticated' })
@ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jobsService: JobsService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  getUsers(@Query() dto: PaginationDto) {
    return this.adminService.getUsers(dto);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the user to ban' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  banUser(@Param('id') id: string, @Request() req) {
    const adminId = req.user.id;
    return this.adminService.banUser(adminId, id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all sessions with optional status/date filters' })
  @ApiResponse({ status: 200, description: 'Paginated and filtered session list' })
  getSessions(@Query() dto: SessionFilterDto) {
    return this.adminService.getSessions(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Retrieve platform-wide statistics (users, sessions, puzzles)' })
  @ApiResponse({ status: 200, description: 'Aggregated platform stats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('submissions')
  @ApiOperation({ summary: 'List all puzzle submissions pending review' })
  @ApiResponse({ status: 200, description: 'List of pending puzzle submissions' })
  getPendingSubmissions() {
    return this.adminService.getPendingSubmissions();
  }

  @Patch('submissions/:id/approve')
  @ApiOperation({ summary: 'Approve a pending puzzle submission' })
  @ApiParam({ name: 'id', description: 'UUID of the puzzle submission' })
  @ApiResponse({ status: 200, description: 'Submission approved and puzzle published' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  approveSubmission(@Param('id') id: string, @Request() req) {
    const adminId = req.user.id;
    return this.adminService.approveSubmission(adminId, id);
  }

  @Patch('submissions/:id/reject')
  @ApiOperation({ summary: 'Reject a pending puzzle submission with a reason' })
  @ApiParam({ name: 'id', description: 'UUID of the puzzle submission' })
  @ApiBody({ schema: { properties: { reason: { type: 'string', example: 'Duplicate of existing puzzle.' } }, required: ['reason'] } })
  @ApiResponse({ status: 200, description: 'Submission rejected' })
  @ApiResponse({ status: 400, description: 'Rejection reason is required' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  rejectSubmission(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    const adminId = req.user.id;
    return this.adminService.rejectSubmission(adminId, id, reason);
  }

  @Get('jobs/status')
  @ApiOperation({ summary: 'Get background job queue status and failed counts across all queues' })
  @ApiResponse({ status: 200, description: 'Queue depths and failed job counts per queue' })
  getJobStatus() {
    return this.jobsService.getQueueStatus();
  }

  @Post('jobs/:queue/retry-failed')
  @ApiOperation({ summary: 'Re-enqueue all dead-letter / failed jobs for a given queue' })
  @ApiParam({ name: 'queue', description: 'Name of the queue (email, nft, leaderboard, calibration, streaks)' })
  @ApiResponse({ status: 200, description: 'Failed jobs re-enqueued successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  retryFailedJobs(@Param('queue') queue: string) {
    return this.jobsService.retryFailedJobs(queue);
  }
}
