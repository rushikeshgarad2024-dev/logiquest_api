import { Controller, Post, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { SendTestEmailDto, UpdateEmailPreferencesDto } from './dto/email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('email')
@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('admin/email/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a test email template via the configured provider (Admin only)' })
  @ApiResponse({ status: 200, description: 'Test email queued successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async sendTestEmail(@Body() dto: SendTestEmailDto) {
    return this.emailService.sendTestEmail(dto.to, dto.template);
  }

  @Patch('users/me/email-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update email notification preferences for the authenticated player' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePreferences(@Req() req: any, @Body() dto: UpdateEmailPreferencesDto) {
    const userId = req.user.sub || req.user.id;
    return this.emailService.updateUserPreferences(userId, dto);
  }
}
