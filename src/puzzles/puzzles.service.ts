import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Puzzle } from './entities/puzzle.entity';
import { PuzzleVersion } from './entities/puzzle-version.entity';
import { PuzzleTranslation } from './entities/puzzle-translation.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { CreatePuzzleDto } from './dto/create-puzzle.dto';
import { UpdatePuzzleDto } from './dto/update-puzzle.dto';
import { GetPuzzlesFilterDto } from './dto/get-puzzles-filter.dto';
import { Role } from '../common/enums/role.enum';
import { UpsertPuzzleTranslationDto } from './dto/upsert-puzzle-translation.dto';
import { PuzzleTranslationResponseDto } from './dto/puzzle-translation-response.dto';
import { validateLocale } from '../config/locale.helper';
import { DEFAULT_LOCALE } from '../config/locale.config';
import { StreakService } from '../streak/services/streak.service';

/** Shape returned by GET /puzzles/:id — localised title/description/hints merged on top. */
export interface LocalisedPuzzle extends Omit<Puzzle, 'title' | 'description'> {
  title: string;
  description: string;
  hints: Array<{ order: number; content: string }> | null;
  locale: string;
}

@Injectable()
export class PuzzlesService {
  constructor(
    @InjectRepository(Puzzle)
    private readonly puzzleRepository: Repository<Puzzle>,
    @InjectRepository(PuzzleVersion)
    private readonly versionRepository: Repository<PuzzleVersion>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(PuzzleTranslation)
    private readonly translationRepository: Repository<PuzzleTranslation>,
    private readonly streakService: StreakService,
  ) {}

  async completePuzzle(userId: string, puzzleId: string) {
    await this.streakService.recordPuzzleCompletion(userId);
  }

  async create(dto: CreatePuzzleDto, authorId: string): Promise<Puzzle> {
    let category: Category | null = null;

    if (dto.categoryId) {
      category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
    }

    const puzzle = this.puzzleRepository.create({
      title: dto.title,
      description: dto.description,
      difficulty: dto.difficulty,
      conditions: dto.conditions,
      effects: dto.effects,
      category,
      authorId,
      currentVersion: 1,
    });

    const savedPuzzle = await this.puzzleRepository.save(puzzle);

    // Create initial Version 1 snapshot
    const initialVersion = this.versionRepository.create({
      puzzleId: savedPuzzle.id,
      versionNumber: 1,
      title: savedPuzzle.title,
      description: savedPuzzle.description,
      difficulty: savedPuzzle.difficulty,
      conditions: savedPuzzle.conditions,
      effects: savedPuzzle.effects,
      authorId,
      changelog: 'Initial version',
    });
    const savedVersion = await this.versionRepository.save(initialVersion);

    savedPuzzle.currentVersionId = savedVersion.id;
    return this.puzzleRepository.save(savedPuzzle);
  }

  async submitDraft(dto: CreatePuzzleDto, authorId: string): Promise<Puzzle> {
    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
    }

    const puzzle = this.puzzleRepository.create({
      title: dto.title,
      description: dto.description,
      difficulty: dto.difficulty,
      conditions: dto.conditions,
      effects: dto.effects,
      category,
      authorId,
      submissionStatus: 'pending' as any,
      currentVersion: 1,
    });

    const savedPuzzle = await this.puzzleRepository.save(puzzle);

    const initialVersion = this.versionRepository.create({
      puzzleId: savedPuzzle.id,
      versionNumber: 1,
      title: savedPuzzle.title,
      description: savedPuzzle.description,
      difficulty: savedPuzzle.difficulty,
      conditions: savedPuzzle.conditions,
      effects: savedPuzzle.effects,
      authorId,
      changelog: 'Initial draft submission',
    });
    const savedVersion = await this.versionRepository.save(initialVersion);

    savedPuzzle.currentVersionId = savedVersion.id;
    return this.puzzleRepository.save(savedPuzzle);
  }

  async findMySubmissions(authorId: string): Promise<Puzzle[]> {
    return this.puzzleRepository.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
      relations: { category: true },
    });
  }

  async findAll(filter: GetPuzzlesFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const queryBuilder = this.puzzleRepository
      .createQueryBuilder('puzzle')
      .leftJoinAndSelect('puzzle.category', 'category')
      .leftJoinAndSelect('puzzle.tags', 'tags');

    if (filter.difficulty) {
      queryBuilder.andWhere('puzzle.difficulty = :difficulty', { difficulty: filter.difficulty });
    }

    if (filter.category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter.category);
      if (isUuid) {
        queryBuilder.andWhere('category.id = :categoryId', { categoryId: filter.category });
      } else {
        queryBuilder.andWhere('category.slug = :categorySlug', { categorySlug: filter.category });
      }
    }

    if (filter.tags) {
      const tagSlugs = filter.tags
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean);

      if (tagSlugs.length > 0) {
        queryBuilder.innerJoin('puzzle.tags', 'filterTags', 'filterTags.slug IN (:...tagSlugs)', { tagSlugs });
      }
    }

    if (filter.search) {
      queryBuilder
        .leftJoin('puzzle.tags', 'searchTags')
        .andWhere('(puzzle.title ILIKE :search OR puzzle.description ILIKE :search OR searchTags.name ILIKE :search)', {
          search: `%${filter.search.trim()}%`,
        });
    }

    queryBuilder
      .orderBy('puzzle.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Puzzle> {
    const puzzle = await this.puzzleRepository.findOne({
      where: { id },
      relations: { category: true, tags: true },
    });
    if (!puzzle) {
      throw new NotFoundException(`Puzzle with ID "${id}" not found`);
    }
    return puzzle;
  }

  async update(id: string, dto: UpdatePuzzleDto, authorId: string, role?: Role): Promise<Puzzle> {
    const puzzle = await this.findOne(id);

    if (role !== Role.ADMIN && puzzle.authorId !== authorId) {
      throw new ForbiddenException('You do not have permission to update this puzzle');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
      puzzle.category = category;
    }

    const nextVersionNumber = (puzzle.currentVersion || 1) + 1;

    // Apply updates
    if (dto.title !== undefined) puzzle.title = dto.title;
    if (dto.description !== undefined) puzzle.description = dto.description;
    if (dto.difficulty !== undefined) puzzle.difficulty = dto.difficulty;
    if (dto.conditions !== undefined) puzzle.conditions = dto.conditions;
    if (dto.effects !== undefined) puzzle.effects = dto.effects;

    // Snapshot as new version
    const newVersion = this.versionRepository.create({
      puzzleId: puzzle.id,
      versionNumber: nextVersionNumber,
      title: puzzle.title,
      description: puzzle.description,
      difficulty: puzzle.difficulty,
      conditions: puzzle.conditions,
      effects: puzzle.effects,
      authorId,
      changelog: `Updated to version ${nextVersionNumber}`,
    });
    const savedVersion = await this.versionRepository.save(newVersion);

    puzzle.currentVersion = nextVersionNumber;
    puzzle.currentVersionId = savedVersion.id;

    return this.puzzleRepository.save(puzzle);
  }

  async remove(id: string, role?: Role): Promise<void> {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete puzzles');
    }
    const puzzle = await this.findOne(id);
    await this.puzzleRepository.remove(puzzle);
  }

  /**
   * Return full version history for a puzzle (Admin only)
   */
  async getVersions(puzzleId: string): Promise<PuzzleVersion[]> {
    await this.findOne(puzzleId);
    return this.versionRepository.find({
      where: { puzzleId },
      order: { versionNumber: 'DESC' },
    });
  }

  /**
   * Return a specific version snapshot of a puzzle
   */
  async getVersion(puzzleId: string, versionId: string): Promise<PuzzleVersion> {
    await this.findOne(puzzleId);
    let version: PuzzleVersion | null = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId);
    if (isUuid) {
      version = await this.versionRepository.findOne({ where: { id: versionId, puzzleId } });
    } else if (!isNaN(Number(versionId))) {
      version = await this.versionRepository.findOne({ where: { versionNumber: Number(versionId), puzzleId } });
    }

    if (!version) {
      throw new NotFoundException(`Puzzle version "${versionId}" not found for puzzle "${puzzleId}"`);
    }
    return version;
  }

  /**
   * Roll back a puzzle to a previous version snapshot and activate it as a new latest version
   */
  async rollback(puzzleId: string, targetVersionId: string, authorId: string): Promise<Puzzle> {
    const puzzle = await this.findOne(puzzleId);
    const targetVersion = await this.getVersion(puzzleId, targetVersionId);

    const nextVersionNumber = (puzzle.currentVersion || 1) + 1;

    puzzle.title = targetVersion.title;
    puzzle.description = targetVersion.description;
    puzzle.difficulty = targetVersion.difficulty;
    puzzle.conditions = targetVersion.conditions;
    puzzle.effects = targetVersion.effects;

    const restoredVersion = this.versionRepository.create({
      puzzleId: puzzle.id,
      versionNumber: nextVersionNumber,
      title: puzzle.title,
      description: puzzle.description,
      difficulty: puzzle.difficulty,
      conditions: puzzle.conditions,
      effects: puzzle.effects,
      authorId,
      changelog: `Rollback to version ${targetVersion.versionNumber}`,
    });
    const savedVersion = await this.versionRepository.save(restoredVersion);

    puzzle.currentVersion = nextVersionNumber;
    puzzle.currentVersionId = savedVersion.id;

    return this.puzzleRepository.save(puzzle);
  }

  async setTags(puzzleId: string, tagIds: string[], role?: Role): Promise<Puzzle> {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can manage puzzle tags');
    }
    const puzzle = await this.findOne(puzzleId);
    if (tagIds.length === 0) {
      puzzle.tags = [];
      return this.puzzleRepository.save(puzzle);
    }
    const tags = await this.tagRepository.find({ where: { id: In(tagIds) } });
    puzzle.tags = tags;
    return this.puzzleRepository.save(puzzle);
  }

  async upsertTranslation(
    puzzleId: string,
    dto: UpsertPuzzleTranslationDto,
    authorId: string,
  ): Promise<PuzzleTranslationResponseDto> {
    const locale = validateLocale(dto.locale);
    await this.findOne(puzzleId);

    let translation = await this.translationRepository.findOne({
      where: { puzzleId, locale },
    });

    if (translation) {
      translation.title = dto.title;
      translation.description = dto.description;
      translation.hints = dto.hints ?? null;
      translation.authorId = authorId;
    } else {
      translation = this.translationRepository.create({
        puzzleId,
        locale,
        title: dto.title,
        description: dto.description,
        hints: dto.hints ?? null,
        authorId,
      });
    }

    const saved = await this.translationRepository.save(translation);
    return {
      id: saved.id,
      puzzleId: saved.puzzleId,
      locale: saved.locale,
      title: saved.title,
      description: saved.description,
      hints: saved.hints,
      authorId: saved.authorId,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
