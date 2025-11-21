import { Module } from '@nestjs/common';
import { MatchModule } from './infrastructure/http/match/match.module';

@Module({
  imports: [MatchModule],
})
export class AppModule {}
