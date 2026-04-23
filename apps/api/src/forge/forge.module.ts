import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsModule } from '../items/items.module';
import { ResourcesModule } from '../resources/resources.module';
import { ForgeController } from './forge.controller';
import { ForgeService } from './forge.service';

@Module({
  imports: [HeroesModule, ItemsModule, ResourcesModule],
  controllers: [ForgeController],
  providers: [ForgeService],
  exports: [ForgeService],
})
export class ForgeModule {}
