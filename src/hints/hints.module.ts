import { Module } from '@nestjs/common';
import { HintsService } from './hints.service';
import { HintsController } from './hints.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [SessionsModule, ScoringModule, GatewayModule],
  providers: [HintsService],
  controllers: [HintsController],
  exports: [HintsService],
})
export class HintsModule {}
