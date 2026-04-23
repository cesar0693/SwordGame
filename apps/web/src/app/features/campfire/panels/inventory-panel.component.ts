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
  ITEM_SLOTS,
  RARITY_COLOR,
  RARITY_LABEL,
  SLOT_LABEL,
  STAT_LABEL,
  type Item,
  type ItemSlot,
  type ItemStatBonus,
} from '@swordgame/shared';
import { ItemsService } from '../../../core/items/items.service';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-inventory-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .lead { color: var(--fg-muted); margin: 0 0 0.8rem; font-size: 0.85rem; }

      .equipped-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 0.4rem;
        margin-bottom: 1rem;
      }
      .slot {
        padding: 0.5rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 6px;
        min-height: 68px;
        display: flex; flex-direction: column; justify-content: space-between;
      }
      .slot .slot-name { color: var(--fg-muted); font-size: 0.7rem; }
      .slot .name { font-weight: 600; font-size: 0.82rem; line-height: 1.15; margin: 0.1rem 0; }
      .slot.empty .name { color: var(--fg-muted); font-style: italic; }
      .slot button {
        padding: 0.2rem 0.4rem; font-size: 0.72rem;
        background: #3a2413; color: #ffd9a8; border: 1px solid #6b4a26;
      }

      h3 {
        margin: 0.2rem 0 0.5rem;
        color: #ffd9a8;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .inventory-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.45rem;
      }
      @media (min-width: 520px) {
        .inventory-grid { grid-template-columns: 1fr 1fr; }
      }

      .item {
        padding: 0.55rem 0.7rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-left-width: 3px;
        border-radius: 6px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.4rem 0.7rem;
        align-items: center;
      }
      .item .title {
        font-weight: 600; color: var(--fg);
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.9rem; line-height: 1.15;
      }
      .item .sub {
        grid-column: 1 / 2;
        color: var(--fg-muted); font-size: 0.72rem;
      }
      .item .bonuses {
        grid-column: 1 / -1;
        display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem;
        font-size: 0.78rem;
      }
      .item .bonuses span { color: #8ec04a; }
      .item .actions {
        display: flex; gap: 0.3rem; grid-column: 2; grid-row: 1 / 3;
      }
      .item .actions button {
        padding: 0.25rem 0.5rem; font-size: 0.75rem;
      }
      .item .actions button.danger {
        background: transparent; color: #d88; border: 1px solid #6b2a2a;
      }
      .item .actions button.danger:hover { background: #3a1414; }

      .item.on-market { opacity: 0.7; }
      .item .market-badge {
        font-size: 0.7rem;
        padding: 0.05rem 0.4rem;
        border-radius: 999px;
        background: #3a2413;
        color: #ffd28a;
        border: 1px solid #6b4a26;
      }

      .empty-state { color: var(--fg-muted); text-align: center; padding: 1.5rem 0; }
      .error { color: var(--danger); font-size: 0.85rem; margin-top: 0.3rem; }
    `,
  ],
  template: `
    <sg-panel title="Inventaire" (closed)="closed.emit()">
      <p class="lead">
        {{ items().length }} item(s) — {{ equippedCount() }} équipé(s) sur {{ slots.length }}.
      </p>

      <h3>Équipés</h3>
      <div class="equipped-grid">
        @for (s of slots; track s) {
          @let it = equippedBy(s);
          <div class="slot" [class.empty]="!it">
            <div class="slot-name">{{ slotLabel(s) }}</div>
            <div
              class="name"
              [style.color]="it ? rarityColor(it) : null"
            >{{ it ? it.name : '—' }}</div>
            @if (it) {
              <button type="button" [disabled]="busy() === it.id" (click)="unequip(it)">
                Retirer
              </button>
            }
          </div>
        }
      </div>

      <h3>Sac</h3>
      @if (unequipped().length === 0) {
        <div class="empty-state">Sac vide. Fais travailler le Forgeron pour obtenir des items.</div>
      } @else {
        <div class="inventory-grid">
          @for (it of unequipped(); track it.id) {
            <div class="item" [class.on-market]="it.onMarket" [style.border-left-color]="rarityColor(it)">
              <div class="title">
                <span>{{ it.name }}</span>
                @if (it.onMarket) { <span class="market-badge">Au marché</span> }
              </div>
              <div class="sub">
                {{ slotLabel(it.slot) }} · {{ rarityLabel(it) }}
              </div>
              <div class="bonuses">
                @for (b of bonusEntries(it); track b.key) {
                  <span>+{{ b.display }} {{ statLabel(b.key) }}</span>
                }
              </div>
              <div class="actions">
                @if (it.onMarket) {
                  <button type="button" (click)="goToMarket()">Voir au marché</button>
                } @else {
                  <button
                    type="button"
                    [disabled]="busy() === it.id || !it.slot"
                    (click)="equip(it)"
                  >
                    Équiper
                  </button>
                  <button type="button" (click)="sell(it)">Vendre</button>
                  <button
                    type="button"
                    class="danger"
                    [disabled]="busy() === it.id"
                    (click)="drop(it)"
                  >
                    Jeter
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }
    </sg-panel>
  `,
})
export class InventoryPanelComponent implements OnInit {
  private readonly itemsSvc = inject(ItemsService);
  private readonly heroesSvc = inject(HeroesService);

  readonly closed = output<void>();
  readonly openMarketSell = output<void>();

  readonly items = this.itemsSvc.items;
  readonly slots = ITEM_SLOTS;

  readonly equippedCount = computed(() => this.items().filter((i) => i.equipped).length);
  readonly unequipped = computed(() => this.items().filter((i) => !i.equipped));

  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.itemsSvc.loadMine();
  }

  protected equippedBy(slot: ItemSlot): Item | null {
    return this.items().find((i) => i.equipped && i.slot === slot) ?? null;
  }

  protected slotLabel(slot: ItemSlot | null): string {
    return slot ? SLOT_LABEL[slot] : '—';
  }

  protected rarityLabel(it: Item): string {
    return RARITY_LABEL[it.rarity];
  }

  protected rarityColor(it: Item): string {
    return RARITY_COLOR[it.rarity];
  }

  protected statLabel(k: keyof ItemStatBonus): string {
    return STAT_LABEL[k];
  }

  protected bonusEntries(it: Item): Array<{ key: keyof ItemStatBonus; display: string }> {
    const out: Array<{ key: keyof ItemStatBonus; display: string }> = [];
    for (const key of Object.keys(it.bonuses) as Array<keyof ItemStatBonus>) {
      const v = it.bonuses[key];
      if (typeof v !== 'number' || v === 0) continue;
      const isPct = key === 'critChance' || key === 'dodgeChance';
      out.push({ key, display: isPct ? `${Math.round(v * 100)}%` : `${v}` });
    }
    return out;
  }

  protected async equip(it: Item): Promise<void> {
    this.busy.set(it.id);
    this.error.set(null);
    try {
      await this.itemsSvc.equip(it.id);
      await this.heroesSvc.loadMine();
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async unequip(it: Item): Promise<void> {
    this.busy.set(it.id);
    this.error.set(null);
    try {
      await this.itemsSvc.unequip(it.id);
      await this.heroesSvc.loadMine();
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected sell(_it: Item): void {
    // Ask the parent to open the Market panel on the Sell/Item tab.
    this.openMarketSell.emit();
  }

  protected goToMarket(): void {
    this.openMarketSell.emit();
  }

  protected async drop(it: Item): Promise<void> {
    if (!confirm(`Jeter ${it.name} ?`)) return;
    this.busy.set(it.id);
    this.error.set(null);
    try {
      await this.itemsSvc.drop(it.id);
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
