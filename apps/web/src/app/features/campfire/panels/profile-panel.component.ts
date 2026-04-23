import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { AllocatableStat, Hero, HeroStats } from '@swordgame/shared';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { PanelComponent } from '../ui/panel.component';

interface StatRow {
  key: keyof HeroStats;
  label: string;
  pct?: boolean;
  allocatable?: AllocatableStat;
}

@Component({
  selector: 'sg-profile-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .header-line {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .header-line .name { font-size: 1.2rem; font-weight: 700; }
      .header-line .cls  { color: var(--fg-muted); font-size: 0.9rem; }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      thead th {
        text-align: right;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.3rem 0.4rem;
        border-bottom: 1px solid #3a2a18;
      }
      thead th:first-child { text-align: left; }
      tbody td {
        padding: 0.35rem 0.4rem;
        border-bottom: 1px dashed #3a2a18;
        text-align: right;
      }
      tbody td:first-child {
        text-align: left;
        color: var(--fg-muted);
      }
      tbody td.bonus {
        color: #8ec04a;
      }
      tbody td.bonus.zero { color: var(--fg-muted); opacity: 0.4; }
      tbody td.eff {
        color: var(--fg);
        font-weight: 700;
      }

      .xp { margin-top: 1rem; }
      .bar {
        height: 10px; background: rgba(0,0,0,0.5);
        border: 1px solid #3a2a18; border-radius: 999px; overflow: hidden;
      }
      .bar > div {
        height: 100%;
        background: linear-gradient(90deg, #ff8a3d, #ffd28a);
      }
      .xp-label { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--fg-muted); margin-top: 0.3rem; }

      .points {
        margin-top: 0.75rem; padding: 0.6rem 0.75rem;
        background: #2a1b10; border: 1px solid #3a2a18; border-radius: 8px;
        color: var(--fg-muted); font-size: 0.9rem;
      }

      .alloc-btn {
        padding: 0.1rem 0.45rem;
        font-size: 0.75rem;
        background: #c77a2c;
        color: #18100a;
        border: none;
        border-radius: 4px;
        margin-left: 0.4rem;
      }
      .alloc-btn:disabled { opacity: 0.3; }
    `,
  ],
  template: `
    <sg-panel title="Profil du héros" (closed)="closed.emit()">
      <div class="header-line">
        <span class="name">{{ hero().name }}</span>
        <span class="cls">{{ className() }} · Niveau {{ hero().level }}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Base</th>
            <th>Bonus</th>
            <th>Effectif</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.key) {
            @let base = hero().stats[row.key];
            @let eff = hero().effectiveStats[row.key];
            @let delta = eff - base;
            <tr>
              <td>
                {{ row.label }}
                @if (row.allocatable && hero().unallocatedPoints > 0) {
                  <button type="button" class="alloc-btn"
                          [disabled]="busy()"
                          (click)="allocate(row.allocatable)">+</button>
                }
              </td>
              <td>{{ format(base, row.pct) }}</td>
              <td class="bonus" [class.zero]="delta === 0">
                {{ delta === 0 ? '—' : (delta > 0 ? '+' : '') + format(delta, row.pct) }}
              </td>
              <td class="eff">{{ format(eff, row.pct) }}</td>
            </tr>
          }
        </tbody>
      </table>

      <div class="xp">
        <div class="bar"><div [style.width.%]="xpPct()"></div></div>
        <div class="xp-label">
          <span>XP</span>
          <span>{{ hero().xp }} / {{ hero().xpToNext }}</span>
        </div>
      </div>

      <div class="points">
        Points disponibles : <b>{{ hero().unallocatedPoints }}</b>
        @if (hero().unallocatedPoints > 0) {
          — clique sur <b>+</b> à côté d'une stat pour le dépenser.
        }
      </div>
    </sg-panel>
  `,
})
export class ProfilePanelComponent {
  readonly hero = input.required<Hero>();
  readonly closed = output<void>();

  private readonly heroesSvc = inject(HeroesService);
  protected readonly busy = signal(false);

  protected readonly rows: StatRow[] = [
    { key: 'hp', label: 'Points de vie', allocatable: 'hp' },
    { key: 'mp', label: 'Points de mana', allocatable: 'mp' },
    { key: 'attack', label: 'Attaque', allocatable: 'attack' },
    { key: 'defense', label: 'Défense', allocatable: 'defense' },
    { key: 'speed', label: 'Vitesse', allocatable: 'speed' },
    { key: 'critChance', label: 'Critique', pct: true },
    { key: 'critFailChance', label: 'Échec crit', pct: true },
    { key: 'dodgeChance', label: 'Esquive', pct: true },
  ];

  protected async allocate(stat: AllocatableStat): Promise<void> {
    if (this.hero().unallocatedPoints <= 0) return;
    this.busy.set(true);
    try {
      await this.heroesSvc.allocate(stat);
    } finally {
      this.busy.set(false);
    }
  }

  protected format(value: number, pct?: boolean): string {
    if (pct) return `${Math.round(value * 100)}%`;
    return `${Math.round(value)}`;
  }

  protected xpPct(): number {
    const h = this.hero();
    if (h.xpToNext <= 0) return 0;
    return Math.min(100, Math.max(0, (h.xp / h.xpToNext) * 100));
  }

  protected className(): string {
    switch (this.hero().heroClass) {
      case 'WARRIOR': return 'Guerrier';
      case 'MAGE':    return 'Mage';
      case 'RANGER':  return 'Rôdeur';
    }
  }
}
