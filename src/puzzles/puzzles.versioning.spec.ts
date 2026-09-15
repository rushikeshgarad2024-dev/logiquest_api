import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import { Puzzle } from './entities/puzzle.entity';
import { PuzzleVersion } from './entities/puzzle-version.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { PuzzleTranslation } from './entities/puzzle-translation.entity';
import { StreakService } from '../streak/services/streak.service';
import { Role } from '../common/enums/role.enum';

describe('PuzzlesService - Puzzle Versioning Suite', () => {
  let service: PuzzlesService;
  let mockPuzzleRepo: any;
  let mockVersionRepo: any;
  let mockCategoryRepo: any;

  const samplePuzzle: Partial<Puzzle> = {
    id: 'puz-100',
    title: 'Laser Grid',
    description: 'Direct the laser beam to the target',
    difficulty: 'hard',
    conditions: { mirrors: 3 },
    effects: { unlockedDoors: ['A'] },
    authorId: 'admin-1',
    currentVersion: 1,
    currentVersionId: 'ver-1',
  };

  const sampleVersion1: Partial<PuzzleVersion> = {
    id: 'ver-1',
    puzzleId: 'puz-100',
    versionNumber: 1,
    title: 'Laser Grid',
    description: 'Direct the laser beam to the target',
    difficulty: 'hard',
    conditions: { mirrors: 3 },
    effects: { unlockedDoors: ['A'] },
    authorId: 'admin-1',
    changelog: 'Initial version',
    createdAt: new Date('2026-01-01'),
  };

  const sampleVersion2: Partial<PuzzleVersion> = {
    id: 'ver-2',
    puzzleId: 'puz-100',
    versionNumber: 2,
    title: 'Laser Grid Refined',
    description: 'Direct the laser beam to the target with prisms',
    difficulty: 'hard',
    conditions: { mirrors: 4, prisms: 1 },
    effects: { unlockedDoors: ['A', 'B'] },
    authorId: 'admin-1',
    changelog: 'Updated to version 2',
    createdAt: new Date('2026-02-01'),
  };

  beforeEach(async () => {
    mockPuzzleRepo = {
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 'puz-100' })),
      save: vi.fn().mockImplementation((puz) => Promise.resolve({ ...puz })),
      findOne: vi.fn().mockResolvedValue({ ...samplePuzzle }),
      find: vi.fn(),
      remove: vi.fn(),
    };

    mockVersionRepo = {
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 'ver-generated-uuid' })),
      save: vi.fn().mockImplementation((ver) => Promise.resolve({ ...ver })),
      findOne: vi.fn(),
      find: vi.fn(),
    };

    mockCategoryRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Optics' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzlesService,
        {
          provide: getRepositoryToken(Puzzle),
          useValue: mockPuzzleRepo,
        },
        {
          provide: getRepositoryToken(PuzzleVersion),
          useValue: mockVersionRepo,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepo,
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

  describe('create', () => {
    test('creates puzzle and automatically generates initial Version 1 snapshot', async () => {
      const dto = {
        title: 'New Mirror Maze',
        description: 'Navigate the reflections',
        difficulty: 'medium',
        conditions: { steps: 10 },
        effects: { points: 50 },
        categoryId: 'cat-1',
      };

      const result = await service.create(dto as any, 'admin-1');

      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 1,
          title: dto.title,
          authorId: 'admin-1',
          changelog: 'Initial version',
        }),
      );
      expect(result.currentVersion).toBe(1);
    });
  });

  describe('update', () => {
    test('increments version number and creates a new PuzzleVersion record on edit', async () => {
      const updateDto = {
        title: 'Laser Grid Refined',
        conditions: { mirrors: 4, prisms: 1 },
      };

      const result = await service.update('puz-100', updateDto as any, 'admin-1', Role.ADMIN);

      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          puzzleId: 'puz-100',
          versionNumber: 2,
          title: 'Laser Grid Refined',
          changelog: 'Updated to version 2',
        }),
      );
      expect(result.currentVersion).toBe(2);
    });
  });

  describe('getVersions and getVersion', () => {
    test('getVersions returns all historical versions ordered by versionNumber DESC', async () => {
      mockVersionRepo.find.mockResolvedValueOnce([sampleVersion2, sampleVersion1]);

      const versions = await service.getVersions('puz-100');
      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
    });

    test('getVersion returns specific snapshot by versionNumber', async () => {
      mockVersionRepo.findOne.mockResolvedValueOnce(sampleVersion1);

      const version = await service.getVersion('puz-100', '1');
      expect(version.versionNumber).toBe(1);
      expect(version.title).toBe('Laser Grid');
    });

    test('getVersion throws NotFoundException if version does not exist', async () => {
      mockVersionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getVersion('puz-100', '99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollback', () => {
    test('restores previous snapshot data and generates new incremented version', async () => {
      mockVersionRepo.findOne.mockResolvedValueOnce(sampleVersion1); // Target rollback: v1

      const result = await service.rollback('puz-100', 'ver-1', 'admin-1');

      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 2,
          title: sampleVersion1.title,
          conditions: sampleVersion1.conditions,
          changelog: 'Rollback to version 1',
        }),
      );
      expect(result.currentVersion).toBe(2);
      expect(result.title).toBe(sampleVersion1.title);
    });
  });
});
