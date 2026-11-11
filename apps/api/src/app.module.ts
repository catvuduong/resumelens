import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbService } from './db.service.js';
import { AnalysesController } from './analyses/analyses.controller.js';
import { AnalysesService } from './analyses/analyses.service.js';

@Module({
  imports: [],
  controllers: [AppController, AnalysesController],
  providers: [AppService, DbService, AnalysesService],
})
export class AppModule {}
