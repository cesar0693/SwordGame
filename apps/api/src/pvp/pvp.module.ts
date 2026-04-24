import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsModule } from '../items/items.module';
import { ResourcesModule } from '../resources/resources.module';
import { SpellsModule } from '../spells/spells.module';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';

@Module({
  imports: [HeroesModule, ItemsModule, ResourcesModule, SpellsModule],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
