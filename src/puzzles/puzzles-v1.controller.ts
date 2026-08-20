import { Controller, Get, Version, UseInterceptors } from '@nestjs/common';
import { DeprecationInterceptor } from '../common/interceptors/deprecation.interceptor';

@Controller('puzzles')
export class PuzzlesV1Controller {
  @Get()
  @Version('1')
  @UseInterceptors(new DeprecationInterceptor('2026-12-31T23:59:59Z'))
  getPuzzlesV1() {
    return {
      data: [
        { id: '1', title: 'Legacy Puzzle V1', difficulty: 'easy' },
      ],
    };
  }
}