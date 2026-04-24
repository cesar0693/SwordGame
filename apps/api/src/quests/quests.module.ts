import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ResourcesModule } from '../resources/resources.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({
  imports: [HeroesModule, ResourcesModule],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
