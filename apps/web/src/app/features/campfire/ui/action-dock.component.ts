import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

export type DockAction =
  | 'profile'
  | 'camp'
  | 'market'
  | 'inventory'
  | 'missions'
  | 'forge'
  | 'spells'
  | 'arena'
  | 'dailies';

interface DockItem {
  id: DockAction;
  labelKey: string;
  hint: string;
  available: boolean;
  glyph: string;
}

@Component({
  selector: 'sg-action-dock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        position: fixed;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%);
        z-index: 10;
        display: block;
        max-width: calc(100vw - 2rem);
      }

      .dock {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem;
        background: linear-gradient(180deg, rgba(22, 14, 8, 0.88), rgba(14, 9, 5, 0.88));
        border: 1px solid #5a3e1f;
        border-radius: 14px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        overflow-x: auto;
      }

      button {
        background: #241810;
        color: var(--fg);
        border: 1px solid #3a2a18;
        border-radius: 10px;
        padding: 0.55rem 0.7rem 0.5rem;
        display: grid;
        grid-template-rows: auto auto;
        gap: 0.15rem;
        justify-items: center;
        min-width: 72px;
        font-size: 0.75rem;
        line-height: 1;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
      }
      button:hover:not(:disabled) { border-color: #c77a2c; background: #2e1d11; }
      button:active:not(:disabled) { transform: translateY(1px); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }

      .glyph {
        width: 28px; height: 28px;
        display: grid; place-items: center;
        background: radial-gradient(circle, #3a2413, #1c100a);
        border: 1px solid #6b4a26;
        border-radius: 8px;
        color: #ffd9a8;
        font-weight: 700;
        font-size: 0.95rem;
      }
    `,
  ],
  template: `
    <nav class="dock" aria-label="Actions">
      @for (it of items; track it.id) {
        <button
          type="button"
          [title]="it.hint"
          [disabled]="!it.available"
          (click)="open(it)"
        >
          <span class="glyph">{{ it.glyph }}</span>
          <span>{{ i18n.t(it.labelKey) }}</span>
        </button>
      }
    </nav>
  `,
})
export class ActionDockComponent {
  readonly opened = output<DockAction>();
  protected readonly i18n = inject(I18nService);

  protected readonly items: DockItem[] = [
    { id: 'profile',   labelKey: 'dock.profile',   glyph: '♦', hint: 'Stats et progression du héros', available: true },
    { id: 'camp',      labelKey: 'dock.camp',      glyph: '⌂', hint: 'Compagnons, ressources et progression', available: true },
    { id: 'market',    labelKey: 'dock.market',    glyph: '⚖', hint: 'Acheter, vendre, enchérir', available: true },
    { id: 'dailies',   labelKey: 'dock.dailies',   glyph: '☀', hint: 'Récompense de connexion quotidienne', available: true },
    { id: 'inventory', labelKey: 'dock.inventory', glyph: '▣', hint: 'Inventaire & équipement', available: true },
    { id: 'missions',  labelKey: 'dock.missions',  glyph: '▶', hint: 'Combat PvE auto', available: true },
    { id: 'forge',     labelKey: 'dock.forge',     glyph: '⚒', hint: 'Améliorations, recettes, démantelage', available: true },
    { id: 'spells',    labelKey: 'dock.spells',    glyph: '✦', hint: 'Sorts de classe à équiper pour le combat', available: true },
    { id: 'arena',     labelKey: 'dock.arena',     glyph: '⚔', hint: 'PvP classé Elo', available: true },
  ];

  protected open(item: DockItem): void {
    if (!item.available) return;
    this.opened.emit(item.id);
  }
}
