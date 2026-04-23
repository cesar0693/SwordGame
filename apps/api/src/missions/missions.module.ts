import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsModule } from '../items/items.module';
import { ResourcesModule } from '../resources/resources.module';
import { SpellsModule } from '../spells/spells.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [HeroesModule, ItemsModule, ResourcesModule, SpellsModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
