import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

export enum NotificationType {
  PUZZLE_SOLVED = 'PUZZLE_SOLVED',
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  REWARD_GRANTED = 'REWARD_GRANTED',
  NFT_MINTED = 'NFT_MINTED',
  DIFFICULTY_RECALIBRATED = 'DIFFICULTY_RECALIBRATED',
  STREAK_RECORD_BROKEN = 'STREAK_RECORD_BROKEN',
}

@Entity()
export class Notification {
  @ApiProperty({ example: 'uuid-notification-id', description: 'Notification UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'uuid-user-id', description: 'UUID of the user this notification belongs to' })
  @Column()
  userId: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.ACHIEVEMENT_UNLOCKED, description: 'Notification type' })
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ example: 'You unlocked the "First Blood" achievement!', description: 'Human-readable notification message' })
  @Column()
  message: string;

  @ApiProperty({ example: false, description: 'Whether the notification has been read by the user' })
  @Column({ default: false })
  isRead: boolean;

  @ApiProperty({ example: '2024-07-01T12:00:00.000Z', description: 'Timestamp when the notification was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Soft-delete timestamp (null if not deleted)' })
  @DeleteDateColumn()
  deletedAt?: Date;
}
