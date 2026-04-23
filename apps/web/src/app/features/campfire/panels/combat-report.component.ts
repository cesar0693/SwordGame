import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  RARITY_COLOR,
  RARITY_LABEL,
  RESOURCE_LABELS,
  SLOT_LABEL,
  type CombatAction,
  type CombatReport,
} from '@swordgame/shared';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-combat-report',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .verdict {
        text-align: center;
        padding: 0.8rem 0;
        font-size: 1.2rem;
        font-weight: 700;
      }
      .verdict.victory { color: #8ec04a; }
      .verdict.defeat  { color: #d88; }
      .hud {
        display: flex; justify-content: space-around;
        padding: 0.3rem 0 0.8rem;
        color: var(--fg-muted); font-size: 0.85rem;
      }

      .log {
        max-height: 320px;
        overflow-y: auto;
        border: 1px solid #3a2a18;
        border-radius: 6px;
        background: #1a100a;
        padding: 0.5rem;
      }
      .line {
        display: grid;
        grid-template-columns: 32px 24px 1fr;
        gap: 0.4rem;
        padding: 0.25rem 0;
        font-size: 0.85rem;
        border-bottom: 1px dashed #2a1b10;
      }
      .line:last-child { border-bottom: 0; }
      .line .turn { color: var(--fg-muted); font-size: 0.75rem; text-align: right; }
      .line .icon { text-align: center; }
      .line.hero .icon { color: #ffd28a; }
      .line.enemy .icon { color: #d88; }
      .line.heal .icon, .line.buff .icon { color: #8ec04a; }
      .line.crit .icon { color: #ffae3b; font-weight: 700; }
      .line.miss .icon { color: var(--fg-muted); }

      h3 { margin: 1rem 0 0.4rem; color: #ffd9a8; font-size: 0.9rem;
           text-transform: uppercase; letter-spacing: 0.05em; }

      .rewards-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.4rem;
      }
      .reward-chip {
        padding: 0.4rem 0.55rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 6px;
        font-size: 0.82rem;
      }
      .reward-chip.item { border-left-width: 3px; }
      .reward-chip.item small { color: var(--fg-muted); display: block; font-size: 0.7rem; }
      .reward-chip b { color: var(--fg); }
      .level-up {
        color: #ffd28a; font-weight: 700; text-align: center;
        margin: 0.5rem 0;
      }
    `,
  ],
  template: `
    <sg-panel [title]="title()" (closed)="closed.emit()">
      <div class="verdict" [class.victory]="report().outcome === 'VICTORY'" [class.defeat]="report().outcome === 'DEFEAT'">
        {{ report().outcome === 'VICTORY' ? 'Victoire !' : 'Défaite.' }}
      </div>
      <div class="hud">
        <span>Tours : {{ report().turns }}</span>
        <span>PV héros : {{ report().heroHpLeft }}</span>
        <span>PV ennemi : {{ report().enemyHpLeft }}</span>
      </div>

      <div class="log">
        @for (a of report().actions; track $index) {
          <div class="line" [class.hero]="a.side === 'HERO'" [class.enemy]="a.side === 'ENEMY'"
               [class.heal]="a.type === 'HEAL'" [class.buff]="a.type === 'BUFF'"
               [class.crit]="a.type === 'CRIT'" [class.miss]="a.type === 'DODGE' || a.type === 'CRIT_FAIL'">
            <span class="turn">T{{ a.turn }}</span>
            <span class="icon">{{ icon(a) }}</span>
            <span>{{ a.message }}</span>
          </div>
        }
      </div>

      @if (report().rewards; as r) {
        <h3>Récompenses</h3>
        @if (r.levelUps > 0) {
          <div class="level-up">✦ Level-up ! +{{ r.levelUps }} niveau(x)</div>
        }
        <div class="rewards-grid">
          <div class="reward-chip"><b>+{{ r.xp }} XP</b></div>
          <div class="reward-chip"><b>+{{ r.gold }} or</b></div>
          @for (res of r.resources; track res.type) {
            <div class="reward-chip"><b>+{{ res.amount }}</b> {{ resourceLabel(res.type) }}</div>
          }
          @for (it of r.items; track it.id) {
            <div class="reward-chip item"
                 [style.color]="rarityColor(it.rarity)"
                 [style.border-left-color]="rarityColor(it.rarity)">
              <b>{{ it.name }}</b>
              <small>{{ slotLabel(it.slot) }} · {{ rarityLabel(it.rarity) }}</small>
            </div>
          }
        </div>
      }
    </sg-panel>
  `,
})
export class CombatReportComponent {
  readonly report = input.required<CombatReport>();
  readonly closed = output<void>();

  protected title(): string {
    return this.report().outcome === 'VICTORY' ? 'Combat — Victoire' : 'Combat — Défaite';
  }

  protected icon(a: CombatAction): string {
    switch (a.type) {
      case 'ATTACK': return '⚔';
      case 'CRIT':   return '✦';
      case 'CRIT_FAIL': return '✗';
      case 'DODGE':  return '«';
      case 'HEAL':   return '+';
      case 'BUFF':   return '↑';
      case 'DEFEAT': return '☠';
    }
  }

  protected resourceLabel(t: string): string {
    return (RESOURCE_LABELS as Record<string, string>)[t] ?? t;
  }

  protected slotLabel(s: string | null): string {
    if (!s) return '—';
    return (SLOT_LABEL as Record<string, string>)[s] ?? s;
  }

  protected rarityLabel(r: string): string {
    return (RARITY_LABEL as Record<string, string>)[r] ?? r;
  }

  protected rarityColor(r: string): string {
    return (RARITY_COLOR as Record<string, string>)[r] ?? '#b6a88e';
  }
}
