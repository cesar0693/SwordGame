import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ResourcesModule } from '../resources/resources.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [HeroesModule, ResourcesModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
