import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  COMPANION_CATALOG,
  type Companion,
  type CompanionRole,
  type PerkChoice,
} from '@swordgame/shared';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-perk-picker',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .lead { color: var(--fg-muted); margin: 0 0 0.8rem; }
      .warn { color: #ffb86b; margin: 0 0 0.8rem; font-size: 0.85rem; }

      .choices { display: grid; gap: 0.6rem; grid-template-columns: 1fr; }
      @media (min-width: 520px) {
        .choices { grid-template-columns: repeat(3, 1fr); }
      }

      .choice {
        text-align: left; padding: 0.75rem;
        background: #241810; border: 1px solid #3a2a18; color: var(--fg);
        border-radius: 8px; cursor: pointer;
      }
      .choice:hover { border-color: #c77a2c; }
      .choice b { display: block; color: #ffd9a8; margin-bottom: 0.15rem; }
      .choice .trade {
        display: inline-block;
        color: #8ec04a; font-size: 0.8rem; font-weight: 600;
        margin-bottom: 0.3rem;
      }
      .choice p { margin: 0; color: var(--fg-muted); font-size: 0.85rem; }
    `,
  ],
  template: `
    <sg-panel [title]="'Voie de spécialisation · ' + name()" (closed)="closed.emit()">
      <p class="lead">
        Au Niveau {{ level() }}, choisis <b>une seule</b> voie.
      </p>
      <p class="warn">⚠ Choix irréversible pour ce palier. Les autres voies seront verrouillées.</p>

      <div class="choices">
        @for (c of choices(); track c.code) {
          <button type="button" class="choice" (click)="pick(c)">
            <b>{{ c.label }}</b>
            <span class="trade">{{ c.tradeoff }}</span>
            <p>{{ c.description }}</p>
          </button>
        }
      </div>
    </sg-panel>
  `,
})
export class PerkPickerComponent {
  readonly companion = input.required<Companion>();
  readonly picked = output<{ role: CompanionRole; level: number; code: string }>();
  readonly closed = output<void>();

  protected readonly level = computed(() => this.companion().pendingPerkLevel ?? 0);
  protected readonly name = computed(() => COMPANION_CATALOG[this.companion().role].name);
  protected readonly choices = computed<PerkChoice[]>(() => {
    const c = this.companion();
    const tier = COMPANION_CATALOG[c.role].perkTiers.find((t) => t.level === c.pendingPerkLevel);
    return tier?.choices ?? [];
  });

  protected pick(c: PerkChoice): void {
    const comp = this.companion();
    if (comp.pendingPerkLevel === null) return;
    this.picked.emit({ role: comp.role, level: comp.pendingPerkLevel, code: c.code });
  }
}
