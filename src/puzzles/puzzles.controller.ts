import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleDto } from './dto/create-puzzle.dto';
import { UpdatePuzzleDto } from './dto/update-puzzle.dto';
import { GetPuzzlesFilterDto } from './dto/get-puzzles-filter.dto';
import { SearchPuzzlesDto } from './dto/search-puzzles.dto';
import { SetPuzzleTagsDto } from './dto/set-puzzle-tags.dto';
import { UpsertPuzzleTranslationDto } from './dto/upsert-puzzle-translation.dto';
import { PuzzleTranslationResponseDto } from './dto/puzzle-translation-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { resolveLocale } from '../config/locale.helper';

@ApiTags('puzzles')
@Controller('puzzles')
export class PuzzlesController {
  constructor(private readonly puzzlesService: PuzzlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create and immediately publish a puzzle (admin only)' })
  @ApiBody({ type: CreatePuzzleDto })
  @ApiResponse({ status: 201, description: 'Puzzle created and published' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  create(@Body() createPuzzleDto: CreatePuzzleDto, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.create(createPuzzleDto, authorId);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a puzzle draft for admin review' })
  @ApiBody({ type: CreatePuzzleDto })
  @ApiResponse({ status: 201, description: 'Draft submitted and awaiting review' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  submit(@Body() createPuzzleDto: CreatePuzzleDto, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.submitDraft(createPuzzleDto, authorId);
  }

  @Get('my-submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "List the authenticated user's own puzzle submissions" })
  @ApiResponse({ status: 200, description: 'List of submitted puzzles with their review status' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  findMySubmissions(@Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.findMySubmissions(authorId);
  }


  @Get('search')
  @ApiOperation({ summary: 'Full-text search puzzles across title, description, and category' })
  @ApiResponse({ status: 200, description: 'Relevance-ranked search results' })
  @ApiResponse({ status: 400, description: 'Search query under 2 characters' })
  search(@Query() queryDto: SearchPuzzlesDto) {
    return this.puzzlesService.search(queryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List published puzzles with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated puzzle list' })
  findAll(@Query() query: GetPuzzlesFilterDto) {
    return this.puzzlesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single puzzle, localised via Accept-Language header' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiHeader({ name: 'accept-language', required: false, description: 'BCP-47 locale (e.g. fr, es). Falls back to English.' })
  @ApiResponse({ status: 200, description: 'Puzzle detail (localised title/description if translation exists)' })
  @ApiResponse({ status: 404, description: 'Puzzle not found' })
  findOne(
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ) {
    const locale = resolveLocale(acceptLanguage);
    return this.puzzlesService.findOneLocalised(id, locale);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a puzzle (admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiBody({ type: UpdatePuzzleDto })
  @ApiResponse({ status: 200, description: 'Puzzle updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Puzzle not found' })
  update(@Param('id') id: string, @Body() updatePuzzleDto: UpdatePuzzleDto) {
    return this.puzzlesService.update(id, updatePuzzleDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a puzzle permanently (admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiResponse({ status: 200, description: 'Puzzle deleted' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Puzzle not found' })
  remove(@Param('id') id: string) {
    return this.puzzlesService.remove(id);
  }

  @Patch(':id/tags')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Replace the full tag set of a puzzle' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiBody({ type: SetPuzzleTagsDto })
  @ApiResponse({ status: 200, description: 'Tags updated' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Puzzle not found' })
  setTags(@Param('id') id: string, @Body() setPuzzleTagsDto: SetPuzzleTagsDto, @Request() req) {
    return this.puzzlesService.setTags(id, setPuzzleTagsDto.tagIds, req.user.id, req.user.role);
  }

  // ── Translation management (admin-only) ──────────────────────────────────

  @Post(':id/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or update a localised translation for a puzzle (admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiBody({ type: UpsertPuzzleTranslationDto })
  @ApiResponse({ status: 201, description: 'Translation upserted', type: PuzzleTranslationResponseDto })
  @ApiResponse({ status: 400, description: 'Unsupported locale or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  upsertTranslation(
    @Param('id') puzzleId: string,
    @Body() dto: UpsertPuzzleTranslationDto,
  ) {
    return this.puzzlesService.upsertTranslation(puzzleId, dto);
  }

  @Get(':id/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all stored translations for a puzzle (admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiResponse({ status: 200, description: 'All translations for this puzzle', type: [PuzzleTranslationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  findAllTranslations(@Param('id') puzzleId: string) {
    return this.puzzlesService.findAllTranslations(puzzleId);
  }
}
