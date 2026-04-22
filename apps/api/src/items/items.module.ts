import { Module, forwardRef } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  imports: [forwardRef(() => HeroesModule)],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
