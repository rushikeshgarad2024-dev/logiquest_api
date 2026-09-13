import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty({ description: '6-digit TOTP verification code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyTwoFactorDto {
  @ApiPropertyOptional({ description: 'User ID for login-time verification', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: '6-digit TOTP verification code or 8-character backup code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: '6-digit TOTP code or backup code to confirm 2FA deactivation', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
