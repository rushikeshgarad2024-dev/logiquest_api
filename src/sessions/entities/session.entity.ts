import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Entity('sessions')
export class Session {
  @ApiProperty({ example: 'uuid-session-id', description: 'Session UUID' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'uuid-user-id', description: 'UUID of the player who started the session' })
  @Column()
  userId!: string;

  @ApiProperty({ example: 'uuid-puzzle-id', description: 'UUID of the puzzle being played' })
  @Column()
  puzzleId!: string;

  @ApiPropertyOptional({ example: 'uuid-version-id', description: 'Pinned puzzle version active when session started' })
  @Column({ nullable: true })
  puzzleVersionId!: string;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.ACTIVE, description: 'Current session state' })
  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.ACTIVE })
  status!: SessionStatus;

  @ApiProperty({ example: '2024-07-01T10:00:00.000Z', description: 'Session start timestamp' })
  @CreateDateColumn()
  startedAt!: Date;

  @ApiPropertyOptional({ example: '2024-07-01T10:15:00.000Z', nullable: true, description: 'Timestamp when the session was completed or abandoned' })
  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ example: 420, description: 'Score earned in this session' })
  @Column({ type: 'int', default: 0 })
  score!: number;

  @ApiProperty({ example: 2, description: 'Number of hints used during this session' })
  @Column({ type: 'int', default: 0 })
  hintsUsed!: number;

  @ApiProperty({ example: 'fr', description: 'BCP-47 locale tag active when the session started' })
  @Column({ default: 'en' })
  locale!: string;
}
