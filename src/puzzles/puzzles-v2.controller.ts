import { Controller, Get, Version } from '@nestjs/common';

@Controller('puzzles')
export class PuzzlesV2Controller {
  @Get()
  @Version('2')
  getPuzzlesV2() {
    return {
      data: [
        {
          id: '1',
          title: 'Modern Puzzle V2',
          difficultyRating: 1200,
          onChainHash: '0xabc...123',
        },
      ],
      meta: { page: 1, total: 1 },
    };
  }
}