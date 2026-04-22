import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ResourcesModule } from '../resources/resources.module';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';

@Module({
  imports: [HeroesModule, ResourcesModule],
  controllers: [DailyController],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
