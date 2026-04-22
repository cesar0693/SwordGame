import { Module, forwardRef } from '@nestjs/common';
import { ResourcesModule } from '../resources/resources.module';
import { CompanionsModule } from '../companions/companions.module';
import { ItemsModule } from '../items/items.module';
import { HeroesController } from './heroes.controller';
import { HeroesService } from './heroes.service';

@Module({
  imports: [
    ResourcesModule,
    forwardRef(() => CompanionsModule),
    forwardRef(() => ItemsModule),
  ],
  controllers: [HeroesController],
  providers: [HeroesService],
  exports: [HeroesService],
})
export class HeroesModule {}
