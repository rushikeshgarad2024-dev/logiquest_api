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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleDto } from './dto/create-puzzle.dto';
import { UpdatePuzzleDto } from './dto/update-puzzle.dto';
import { GetPuzzlesFilterDto } from './dto/get-puzzles-filter.dto';
import { SetPuzzleTagsDto } from './dto/set-puzzle-tags.dto';
import { UpsertPuzzleTranslationDto } from './dto/upsert-puzzle-translation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

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
  @ApiResponse({ status: 201, description: 'Puzzle created with initial Version 1 snapshot' })
  create(@Body() createPuzzleDto: CreatePuzzleDto, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.create(createPuzzleDto, authorId);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a puzzle draft for admin review' })
  @ApiBody({ type: CreatePuzzleDto })
  @ApiResponse({ status: 201, description: 'Draft submitted with Version 1 snapshot' })
  submit(@Body() createPuzzleDto: CreatePuzzleDto, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.submitDraft(createPuzzleDto, authorId);
  }

  @Get('my-submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "List the authenticated user's own puzzle submissions" })
  findMySubmissions(@Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.findMySubmissions(authorId);
  }

  @Get()
  @ApiOperation({ summary: 'List published puzzles with optional filtering' })
  findAll(@Query() filterDto: GetPuzzlesFilterDto) {
    return this.puzzlesService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a puzzle by ID' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  findOne(@Param('id') id: string) {
    return this.puzzlesService.findOne(id);
  }

  @Get(':id/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get full historical version snapshots for a puzzle (Admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiResponse({ status: 200, description: 'Array of historical version snapshots' })
  getVersions(@Param('id') id: string) {
    return this.puzzlesService.getVersions(id);
  }

  @Get(':id/versions/:versionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific historical version snapshot of a puzzle' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiParam({ name: 'versionId', description: 'Version UUID or version number' })
  @ApiResponse({ status: 200, description: 'Version snapshot object' })
  getVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.puzzlesService.getVersion(id, versionId);
  }

  @Post(':id/rollback/:versionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Roll back puzzle definition to a previous version snapshot (Admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiParam({ name: 'versionId', description: 'Target version UUID or version number to restore' })
  @ApiResponse({ status: 200, description: 'Puzzle rolled back and new active version generated' })
  rollback(@Param('id') id: string, @Param('versionId') versionId: string, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.rollback(id, versionId, authorId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update puzzle details and automatically create a new version snapshot' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  @ApiBody({ type: UpdatePuzzleDto })
  @ApiResponse({ status: 200, description: 'Puzzle updated and new version snapshot created' })
  update(@Param('id') id: string, @Body() updatePuzzleDto: UpdatePuzzleDto, @Request() req) {
    const authorId = req.user.id;
    const role = req.user.role;
    return this.puzzlesService.update(id, updatePuzzleDto, authorId, role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a puzzle (Admin only)' })
  @ApiParam({ name: 'id', description: 'Puzzle UUID' })
  remove(@Param('id') id: string, @Request() req) {
    const role = req.user.role;
    return this.puzzlesService.remove(id, role);
  }

  @Post(':id/tags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set tags on a puzzle (Admin only)' })
  setTags(@Param('id') id: string, @Body() dto: SetPuzzleTagsDto, @Request() req) {
    const role = req.user.role;
    return this.puzzlesService.setTags(id, dto.tagIds, role);
  }

  @Post(':id/translations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upsert a localized translation for a puzzle' })
  upsertTranslation(@Param('id') id: string, @Body() dto: UpsertPuzzleTranslationDto, @Request() req) {
    const authorId = req.user.id;
    return this.puzzlesService.upsertTranslation(id, dto, authorId);
  }
}
