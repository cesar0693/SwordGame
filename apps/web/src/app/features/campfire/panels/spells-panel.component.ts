import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  MAX_EQUIPPED_SPELLS,
  spellsForClass,
  type HeroClass,
  type SpellDef,
  type SpellEffect,
} from '@swordgame/shared';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { SpellsService } from '../../../core/spells/spells.service';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-spells-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .lead { color: var(--fg-muted); margin: 0 0 0.5rem; font-size: 0.85rem; }
      .counter {
        margin: 0 0 0.8rem;
        font-size: 0.82rem; color: #ffd28a;
      }

      .list { display: grid; gap: 0.45rem; }
      .spell {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.3rem 0.8rem;
        padding: 0.55rem 0.7rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-left-width: 3px;
        border-radius: 6px;
        align-items: center;
      }
      .spell.damage   { border-left-color: #e07a2b; }
      .spell.heal     { border-left-color: #8ec04a; }
      .spell.buff     { border-left-color: #8ecbff; }
      .spell.locked   { opacity: 0.45; }
      .spell.equipped { box-shadow: 0 0 0 1px #c77a2c inset; }

      .spell b { color: #ffd9a8; }
      .spell .desc { grid-column: 1 / -1; color: var(--fg-muted); font-size: 0.78rem; }
      .spell .meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; font-size: 0.75rem; color: var(--fg-muted); }
      .spell .meta b { color: var(--fg); }

      .spell button {
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
        background: #c77a2c; color: #18100a; border: none;
      }
      .spell button:disabled { opacity: 0.45; cursor: not-allowed; }
      .spell button.outline {
        background: transparent; color: #ffd9a8; border: 1px solid #6b4a26;
      }

      .error { color: var(--danger); font-size: 0.85rem; margin-top: 0.4rem; }
    `,
  ],
  template: `
    <sg-panel title="Sorts" (closed)="closed.emit()">
      <p class="lead">
        Sorts de la classe <b>{{ className() }}</b>. Appris automatiquement quand ton niveau atteint celui requis.
      </p>
      <p class="counter">
        Équipés : <b>{{ equippedCount() }} / {{ maxEquipped }}</b>
      </p>

      <div class="list">
        @for (sp of classSpells(); track sp.code) {
          @let state = spellState(sp);
          <div
            class="spell"
            [class.damage]="sp.effect.type === 'DAMAGE'"
            [class.heal]="sp.effect.type === 'HEAL'"
            [class.buff]="sp.effect.type === 'BUFF'"
            [class.locked]="!state.learned"
            [class.equipped]="state.equipped"
          >
            <div>
              <b>{{ sp.name }}</b>
              <span style="color: var(--fg-muted); font-size: 0.78rem;">
                — Niv. {{ sp.learnAtLevel }}+
              </span>
            </div>
            @if (!state.learned) {
              <button type="button" disabled>Verrouillé</button>
            } @else if (state.equipped) {
              <button type="button" class="outline"
                      [disabled]="busy() === sp.code"
                      (click)="unequip(sp)">Retirer</button>
            } @else {
              <button type="button"
                      [disabled]="busy() === sp.code || equippedCount() >= maxEquipped"
                      (click)="equip(sp)">Équiper</button>
            }
            <div class="desc">{{ sp.description }}</div>
            <div class="meta">
              <span>Type : <b>{{ effectLabel(sp.effect) }}</b></span>
              <span>Coût : <b>{{ sp.mpCost }} PM</b></span>
              <span>Cooldown : <b>{{ sp.cooldownTurns }} tours</b></span>
            </div>
          </div>
        }
      </div>

      @if (error()) { <div class="error">{{ error() }}</div> }
    </sg-panel>
  `,
})
export class SpellsPanelComponent implements OnInit {
  private readonly spellsSvc = inject(SpellsService);
  private readonly heroesSvc = inject(HeroesService);

  readonly closed = output<void>();

  readonly maxEquipped = MAX_EQUIPPED_SPELLS;

  protected readonly classSpells = computed(() => {
    const h = this.heroesSvc.hero();
    if (!h) return [] as SpellDef[];
    return spellsForClass(h.heroClass as HeroClass);
  });

  protected readonly equippedCount = computed(() =>
    this.spellsSvc.mine().filter((s) => s.equipped).length,
  );

  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.spellsSvc.loadCatalog(), this.spellsSvc.loadMine()]);
  }

  protected className(): string {
    const c = this.heroesSvc.hero()?.heroClass;
    switch (c) {
      case 'WARRIOR': return 'Guerrier';
      case 'MAGE':    return 'Mage';
      case 'RANGER':  return 'Rôdeur';
      default:        return '—';
    }
  }

  protected spellState(sp: SpellDef): { learned: boolean; equipped: boolean } {
    const row = this.spellsSvc.mine().find((s) => s.code === sp.code);
    return {
      learned: !!row,
      equipped: !!row?.equipped,
    };
  }

  protected effectLabel(e: SpellEffect): string {
    if (e.type === 'DAMAGE') {
      const hits = e.hits && e.hits > 1 ? `×${e.hits}` : '';
      const flat = e.flatDamage ? ` + ${e.flatDamage}` : '';
      return `Dégâts ${Math.round((e.attackMultiplier ?? 1) * 100)}% ATQ${flat}${hits}`;
    }
    if (e.type === 'HEAL') return `Soin ${e.healHp} PV`;
    return `+${e.amount} ${e.stat} · ${e.durationTurns} tours`;
  }

  protected async equip(sp: SpellDef): Promise<void> {
    this.busy.set(sp.code);
    this.error.set(null);
    try {
      await this.spellsSvc.equip(sp.code);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async unequip(sp: SpellDef): Promise<void> {
    this.busy.set(sp.code);
    this.error.set(null);
    try {
      await this.spellsSvc.unequip(sp.code);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  private msg(err: unknown): string {
    return (
      (err as { error?: { message?: string } })?.error?.message ??
      (err as Error)?.message ??
      'Erreur'
    );
  }
}
