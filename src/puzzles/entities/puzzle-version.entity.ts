import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Puzzle } from './puzzle.entity';

@Entity('puzzle_versions')
@Index(['puzzleId', 'versionNumber'], { unique: true })
export class PuzzleVersion {
  @ApiProperty({ example: 'uuid-version-id', description: 'Version snapshot UUID' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'uuid-puzzle-id', description: 'Associated puzzle UUID' })
  @Column()
  puzzleId!: string;

  @ApiProperty({ example: 1, description: 'Sequential version number' })
  @Column({ type: 'int' })
  versionNumber!: number;

  @ApiProperty({ example: 'The Missing Key', description: 'Puzzle title at this version' })
  @Column()
  title!: string;

  @ApiProperty({ example: 'Find the key using logic.', description: 'Puzzle description at this version' })
  @Column()
  description!: string;

  @ApiProperty({ example: 'medium', description: 'Difficulty level at this version' })
  @Column()
  difficulty!: string;

  @ApiProperty({ description: 'Win conditions JSON at this version' })
  @Column({ type: 'json', nullable: true })
  conditions!: any;

  @ApiProperty({ description: 'Effects / rewards JSON at this version' })
  @Column({ type: 'json', nullable: true })
  effects!: any;

  @ApiPropertyOptional({ description: 'Hints snapshot at this version' })
  @Column({ type: 'json', nullable: true })
  hints!: any;

  @ApiProperty({ example: 'uuid-author-id', description: 'Author or admin who created this version' })
  @Column()
  authorId!: string;

  @ApiPropertyOptional({ example: 'Updated conditions for balance', description: 'Changelog or reason for edit' })
  @Column({ nullable: true })
  changelog!: string;

  @ApiProperty({ example: '2024-03-01T12:00:00.000Z', description: 'Version creation timestamp' })
  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Puzzle, (puzzle) => puzzle.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'puzzleId' })
  puzzle!: Puzzle;
}
