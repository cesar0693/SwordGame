import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ResourcesModule } from '../resources/resources.module';
import { QuestsModule } from '../quests/quests.module';
import { MinigamesController } from './minigames.controller';
import { MinigamesService } from './minigames.service';

@Module({
  imports: [HeroesModule, ResourcesModule, QuestsModule],
  controllers: [MinigamesController],
  providers: [MinigamesService],
  exports: [MinigamesService],
})
export class MinigamesModule {}
