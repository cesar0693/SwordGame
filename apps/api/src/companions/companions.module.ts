import { Module, forwardRef } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsModule } from '../items/items.module';
import { ResourcesModule } from '../resources/resources.module';
import { CompanionsController } from './companions.controller';
import { CompanionsService } from './companions.service';

@Module({
  imports: [forwardRef(() => HeroesModule), ResourcesModule, ItemsModule],
  controllers: [CompanionsController],
  providers: [CompanionsService],
  exports: [CompanionsService],
})
export class CompanionsModule {}
