import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AnalysesService, AnalysisDetail, AnalysisPage, RewriteResponse } from './analyses.service.js';
import { parseId, parsePagination, validateAnalysisInput } from './validation.js';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analyses: AnalysesService) {}

  @Post()
  create(@Body() body: unknown): Promise<AnalysisDetail> {
    return this.analyses.create(validateAnalysisInput(body));
  }

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string): Promise<AnalysisPage> {
    return this.analyses.list(parsePagination(page, pageSize));
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AnalysisDetail> {
    return this.analyses.get(parseId(id));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.analyses.remove(parseId(id));
  }

  @Post(':id/rewrite')
  @HttpCode(200)
  rewrite(@Param('id') id: string): Promise<RewriteResponse> {
    return this.analyses.rewrite(parseId(id));
  }
}
