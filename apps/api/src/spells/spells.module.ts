import { Module, forwardRef } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { SpellsController } from './spells.controller';
import { SpellsService } from './spells.service';

@Module({
  imports: [forwardRef(() => HeroesModule)],
  controllers: [SpellsController],
  providers: [SpellsService],
  exports: [SpellsService],
})
export class SpellsModule {}
