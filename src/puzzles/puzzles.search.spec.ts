import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import { Puzzle } from './entities/puzzle.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { PuzzleTranslation } from './entities/puzzle-translation.entity';
import { StreakService } from '../streak/services/streak.service';

describe('PuzzlesService - Full-Text Search Suite', () => {
  let service: PuzzlesService;
  let mockPuzzleRepository: any;

  const mockQueryBuilder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
  };

  const samplePuzzles: Partial<Puzzle>[] = [
    {
      id: 'puz-1',
      title: 'Sudoku Master',
      description: 'Classic 9x9 number grid puzzle',
      difficulty: 'hard',
      category: { id: 'cat-1', name: 'Logic', slug: 'logic' } as any,
      createdAt: new Date(),
    },
    {
      id: 'puz-2',
      title: 'Bridge Builder',
      description: 'Connect islands with wooden bridges',
      difficulty: 'medium',
      category: { id: 'cat-2', name: 'Spatial', slug: 'spatial' } as any,
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockPuzzleRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzlesService,
        {
          provide: getRepositoryToken(Puzzle),
          useValue: mockPuzzleRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { findOne: vi.fn() },
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: { find: vi.fn() },
        },
        {
          provide: getRepositoryToken(PuzzleTranslation),
          useValue: { find: vi.fn() },
        },
        {
          provide: StreakService,
          useValue: { recordPuzzleCompletion: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<PuzzlesService>(PuzzlesService);
  });

  describe('search', () => {
    test('rejects query under 2 characters with BadRequestException (400)', async () => {
      await expect(service.search({ q: 'a' })).rejects.toThrow(BadRequestException);
      await expect(service.search({ q: ' ' })).resolves.toBeDefined();
    });

    test('empty query falls back to standard findAll pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([samplePuzzles, 2]);

      const result = await service.search({ q: '' });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQueryBuilder.addSelect).not.toHaveBeenCalled();
    });

    test('valid keyword query performs ranked search and calculates relevance scores', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[samplePuzzles[0]], 1]);

      const result = await service.search({ q: 'Sudoku' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('puz-1');
      expect(result.data[0].relevanceScore).toBeGreaterThan(1);
      expect(result.query).toBe('Sudoku');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('puzzle.title ILIKE :search'),
        expect.objectContaining({ search: '%Sudoku%' }),
      );
    });

    test('combines search keyword with difficulty and category filters', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[samplePuzzles[0]], 1]);

      const result = await service.search({
        q: 'Sudoku',
        difficulty: 'hard',
        category: 'logic',
      });

      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'puzzle.difficulty = :difficulty',
        { difficulty: 'hard' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'category.slug = :categorySlug',
        { categorySlug: 'logic' },
      );
    });
  });
});
