import { Controller, Post, Body, Get, Req, UseGuards, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { EnableTwoFactorDto, VerifyTwoFactorDto, DisableTwoFactorDto } from './dto/two-factor.dto';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { GithubOAuthGuard } from './guards/github-oauth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new player account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account created - returns user entity', schema: { example: { id: 'uuid', username: 'player1', email: 'p1@example.com' } } })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with username and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Successful login - returns tokens or 2FA challenge', schema: { example: { accessToken: 'eyJ...', refreshToken: 'eyJ...' } } })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate TOTP secret and backup codes to initialize 2FA setup' })
  @ApiResponse({ status: 200, description: 'TOTP secret, otpauth QR URI, and backup codes generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  setupTwoFactor(@Req() req: any) {
    return this.authService.setupTwoFactor(req.user.sub || req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify initial TOTP code to confirm and activate 2FA' })
  @ApiBody({ type: EnableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA successfully activated' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  enableTwoFactor(@Req() req: any, @Body() dto: EnableTwoFactorDto) {
    return this.authService.enableTwoFactor(req.user.sub || req.user.id, dto.code);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify TOTP code or recovery backup code to complete login' })
  @ApiBody({ type: VerifyTwoFactorDto })
  @ApiResponse({ status: 200, description: 'Verification successful - returns JWT token pair' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code or backup code' })
  verifyTwoFactor(@Req() req: any, @Body() dto: VerifyTwoFactorDto) {
    const userId = dto.userId || req.user?.sub || req.user?.id;
    return this.authService.verifyTwoFactor(userId, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate 2FA on account with TOTP or backup code confirmation' })
  @ApiBody({ type: DisableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA successfully disabled' })
  @ApiResponse({ status: 401, description: 'Invalid confirmation code' })
  disableTwoFactor(@Req() req: any, @Body() dto: DisableTwoFactorDto) {
    return this.authService.disableTwoFactor(req.user.sub || req.user.id, dto.code);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh expired access token with valid refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: 'Refreshed token pair' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refreshTokens(refreshDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Log out and revoke current refresh token' })
  @ApiBody({ type: RefreshDto })
  logout(@Req() req: Request, @Body() refreshDto: RefreshDto) {
    return this.authService.logout(refreshDto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Log out and revoke all refresh tokens across devices' })
  logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.sub || req.user.id);
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 authentication flow' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiExcludeEndpoint()
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.handleOAuthLogin(req.user);
    res.json(tokens);
  }

  @Get('github')
  @UseGuards(GithubOAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth2 authentication flow' })
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(GithubOAuthGuard)
  @ApiExcludeEndpoint()
  async githubAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.handleOAuthLogin(req.user);
    res.json(tokens);
  }
}
