import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Puzzle } from './entities/puzzle.entity';
import { PuzzleTranslation } from './entities/puzzle-translation.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { CreatePuzzleDto } from './dto/create-puzzle.dto';
import { UpdatePuzzleDto } from './dto/update-puzzle.dto';
import { GetPuzzlesFilterDto } from './dto/get-puzzles-filter.dto';
import { SearchPuzzlesDto } from './dto/search-puzzles.dto';
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
    });

    return this.puzzleRepository.save(puzzle);
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
    });

    return this.puzzleRepository.save(puzzle);
  }

  async findMySubmissions(authorId: string): Promise<Puzzle[]> {
    return this.puzzleRepository.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
      relations: { category: true },
    });
  }



  async search(dto: SearchPuzzlesDto) {
    const rawQuery = dto.q ? dto.q.trim() : '';

    // If query is empty, fall back to standard paginated list
    if (!rawQuery) {
      return this.findAll({
        difficulty: dto.difficulty,
        category: dto.category,
        tags: dto.tags,
        page: dto.page,
        limit: dto.limit,
      });
    }

    if (rawQuery.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const searchTerm = `%${rawQuery}%`;

    const qb = this.puzzleRepository
      .createQueryBuilder('puzzle')
      .leftJoinAndSelect('puzzle.category', 'category')
      .leftJoinAndSelect('puzzle.tags', 'tags');

    qb.andWhere(
      '(puzzle.title ILIKE :search OR puzzle.description ILIKE :search OR category.name ILIKE :search)',
      { search: searchTerm },
    );

    if (dto.difficulty) {
      qb.andWhere('puzzle.difficulty = :difficulty', { difficulty: dto.difficulty });
    }

    if (dto.category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.category);
      if (isUuid) {
        qb.andWhere('category.id = :categoryId', { categoryId: dto.category });
      } else {
        qb.andWhere('category.slug = :categorySlug', { categorySlug: dto.category });
      }
    }

    if (dto.tags) {
      const tagSlugs = dto.tags.split(',').map((s) => s.trim()).filter(Boolean);
      if (tagSlugs.length > 0) {
        qb.innerJoin('puzzle.tags', 'filterTags', 'filterTags.slug IN (:...tagSlugs)', { tagSlugs });
      }
    }

    qb.addSelect(
      `CASE
        WHEN puzzle.title ILIKE :exact THEN 3
        WHEN puzzle.title ILIKE :search THEN 2
        WHEN category.name ILIKE :search THEN 1.5
        ELSE 1
      END`,
      'relevance_score',
    )
    .setParameter('exact', rawQuery)
    .orderBy('relevance_score', 'DESC')
    .addOrderBy('puzzle.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((puzzle) => {
      let score = 1.0;
      const lowerQ = rawQuery.toLowerCase();
      if (puzzle.title.toLowerCase().includes(lowerQ)) score += 2.0;
      if (puzzle.category?.name?.toLowerCase().includes(lowerQ)) score += 1.5;
      if (puzzle.description?.toLowerCase().includes(lowerQ)) score += 0.5;

      return {
        ...puzzle,
        relevanceScore: Math.round(score * 10) / 10,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      query: rawQuery,
    };
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

  /**
   * Returns a puzzle with its content localised to `locale`.
   * Falls back to the base Puzzle row (English) if no translation row exists.
   */
  async findOneLocalised(id: string, locale: string): Promise<LocalisedPuzzle> {
    const puzzle = await this.findOne(id);

    // Base puzzle IS the English content — no translation lookup needed for 'en'.
    if (locale === DEFAULT_LOCALE) {
      return this.mergeBaseAsLocalised(puzzle, DEFAULT_LOCALE);
    }

    const translation = await this.translationRepository.findOne({
      where: { puzzleId: id, locale },
    });

    if (!translation) {
      // Graceful fallback to English base content.
      return this.mergeBaseAsLocalised(puzzle, DEFAULT_LOCALE);
    }

    return {
      ...puzzle,
      title: translation.title,
      description: translation.description,
      hints: translation.hints,
      locale,
    };
  }

  private mergeBaseAsLocalised(puzzle: Puzzle, locale: string): LocalisedPuzzle {
    return {
      ...puzzle,
      // Base Puzzle has no hints column — callers expecting hints will get null.
      hints: null,
      locale,
    };
  }

  async update(id: string, dto: UpdatePuzzleDto): Promise<Puzzle> {
    const puzzle = await this.puzzleRepository.findOne({
      where: { id },
      relations: { category: true },
    });

    if (!puzzle) {
      throw new NotFoundException(`Puzzle with ID "${id}" not found`);
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        puzzle.category = null;
      } else {
        const category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
        if (!category) {
          throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
        }
        puzzle.category = category;
      }
    }

    if (dto.title !== undefined) puzzle.title = dto.title;
    if (dto.description !== undefined) puzzle.description = dto.description;
    if (dto.difficulty !== undefined) puzzle.difficulty = dto.difficulty;
    if (dto.conditions !== undefined) puzzle.conditions = dto.conditions;
    if (dto.effects !== undefined) puzzle.effects = dto.effects;

    return this.puzzleRepository.save(puzzle);
  }

  async remove(id: string): Promise<void> {
    const puzzle = await this.puzzleRepository.findOne({ where: { id } });
    if (!puzzle) {
      throw new NotFoundException(`Puzzle with ID "${id}" not found`);
    }
    await this.puzzleRepository.remove(puzzle);
  }

  async setTags(id: string, tagIds: string[], userId: string, userRole: Role): Promise<Puzzle> {
    const puzzle = await this.puzzleRepository.findOne({
      where: { id },
      relations: { category: true, tags: true },
    });

    if (!puzzle) {
      throw new NotFoundException(`Puzzle with ID "${id}" not found`);
    }

    if (userRole !== Role.ADMIN && puzzle.authorId !== userId) {
      throw new ForbiddenException('Only the puzzle author or an admin can update tags');
    }

    const uniqueTagIds = [...new Set(tagIds)];
    const tags = uniqueTagIds.length > 0 ? await this.tagRepository.find({ where: { id: In(uniqueTagIds) } }) : [];

    if (tags.length !== uniqueTagIds.length) {
      const foundIds = new Set(tags.map((tag) => tag.id));
      const missingIds = uniqueTagIds.filter((tagId) => !foundIds.has(tagId));
      throw new NotFoundException(`Tag(s) not found: ${missingIds.join(', ')}`);
    }

    puzzle.tags = tags;
    return this.puzzleRepository.save(puzzle);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Translation management (admin)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upserts a translation for the given puzzle.
   * Validates the locale against SUPPORTED_LOCALES (throws 400 if invalid).
   * Creates if the (puzzleId, locale) pair doesn't exist; updates otherwise.
   */
  async upsertTranslation(
    puzzleId: string,
    dto: UpsertPuzzleTranslationDto,
  ): Promise<PuzzleTranslationResponseDto> {
    // Ensure the puzzle exists first — 404 if not.
    await this.findOne(puzzleId);

    // Throws BadRequestException for unsupported locales.
    validateLocale(dto.locale);

    const existing = await this.translationRepository.findOne({
      where: { puzzleId, locale: dto.locale },
    });

    let translation: PuzzleTranslation;

    if (existing) {
      existing.title = dto.title;
      existing.description = dto.description;
      existing.hints = dto.hints ?? null;
      translation = await this.translationRepository.save(existing);
    } else {
      const created = this.translationRepository.create({
        puzzleId,
        locale: dto.locale,
        title: dto.title,
        description: dto.description,
        hints: dto.hints ?? null,
      });
      translation = await this.translationRepository.save(created);
    }

    return this.toResponseDto(translation);
  }

  /**
   * Returns all translation rows for a puzzle (admin view).
   * Returns an empty array if no translations exist yet.
   */
  async findAllTranslations(puzzleId: string): Promise<PuzzleTranslationResponseDto[]> {
    // Ensure puzzle exists.
    await this.findOne(puzzleId);

    const translations = await this.translationRepository.find({
      where: { puzzleId },
      order: { locale: 'ASC' },
    });

    return translations.map((t) => this.toResponseDto(t));
  }

  private toResponseDto(t: PuzzleTranslation): PuzzleTranslationResponseDto {
    const dto = new PuzzleTranslationResponseDto();
    dto.id = t.id;
    dto.puzzleId = t.puzzleId;
    dto.locale = t.locale;
    dto.title = t.title;
    dto.description = t.description;
    dto.hints = t.hints;
    dto.createdAt = t.createdAt;
    dto.updatedAt = t.updatedAt;
    return dto;
  }
}
