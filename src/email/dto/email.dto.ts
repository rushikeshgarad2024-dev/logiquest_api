import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EmailTemplate } from '../email.constants';

export class UpdateEmailPreferencesDto {
  @ApiPropertyOptional({ example: true, description: 'Receive marketing and promotional updates' })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Receive weekly score and rank summary' })
  @IsOptional()
  @IsBoolean()
  weeklySummary?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Receive achievement unlock notifications' })
  @IsOptional()
  @IsBoolean()
  achievements?: boolean;
}

export class SendTestEmailDto {
  @ApiProperty({ example: 'admin@logiquest.io', description: 'Destination email address' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ enum: EmailTemplate, example: EmailTemplate.WELCOME, description: 'Template to test' })
  @IsOptional()
  @IsEnum(EmailTemplate)
  template?: EmailTemplate;
}
