import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AUCTION_DURATIONS_HOURS,
  MARKET_TAX_RATE,
  RARITY_COLOR,
  RARITY_LABEL,
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  SLOT_LABEL,
  STAT_LABEL,
  type AuctionDurationHours,
  type Item,
  type MarketAssetType,
  type MarketListing,
  type MarketListingType,
  type ResourceType,
} from '@swordgame/shared';
import { ItemsService } from '../../../core/items/items.service';
import { MarketService } from '../../../core/market/market.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';

type Tab = 'browse' | 'sell' | 'mine';
type AssetKind = 'RESOURCE' | 'ITEM';

@Component({
  selector: 'sg-market-panel',
  standalone: true,
  imports: [FormsModule, PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .tabs {
        display: flex; gap: 0.4rem; margin-bottom: 0.8rem;
        border-bottom: 1px solid #3a2a18; padding-bottom: 0.5rem;
      }
      .tabs button {
        background: transparent; color: var(--fg-muted);
        border: 1px solid transparent; padding: 0.35rem 0.7rem;
        border-radius: 6px; font-size: 0.85rem;
      }
      .tabs button.active { background: #3a2413; color: #ffd9a8; border-color: #6b4a26; }

      .asset-switch {
        display: flex; gap: 0.3rem; margin-bottom: 0.6rem;
      }
      .asset-switch button {
        background: #241810; color: var(--fg-muted);
        border: 1px solid #3a2a18; padding: 0.3rem 0.6rem;
        border-radius: 6px; font-size: 0.8rem;
      }
      .asset-switch button.on { background: #3a2413; color: #ffd9a8; border-color: #6b4a26; }

      .filters { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
      .filters select { width: auto; }

      .list { display: grid; gap: 0.4rem; }

      .row {
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 0.6rem;
        align-items: center;
        padding: 0.5rem 0.6rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 8px;
      }
      .row.item { border-left-width: 3px; }
      .row .what { display: flex; flex-direction: column; }
      .row .what b { color: var(--fg); }
      .row .what small { color: var(--fg-muted); font-size: 0.78rem; }
      .row .bonuses { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; font-size: 0.75rem; color: #8ec04a; }
      .row .price { font-weight: 700; color: #ffd28a; }
      .row .type-badge {
        font-size: 0.7rem; padding: 0.1rem 0.4rem;
        border-radius: 999px; background: #2a1b10; color: var(--fg-muted);
        border: 1px solid #3a2a18;
      }
      .row button {
        background: #c77a2c; color: #18100a; border: none;
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
      }
      .row .bid-input { display: flex; gap: 0.3rem; align-items: center; }
      .row .bid-input input { width: 80px; padding: 0.25rem 0.4rem; }

      .empty { color: var(--fg-muted); padding: 0.8rem; text-align: center; }

      .sell-form {
        display: grid; gap: 0.6rem; padding-top: 0.2rem;
        grid-template-columns: 1fr 1fr;
      }
      .sell-form .full { grid-column: 1 / -1; }
      .sell-form label { font-size: 0.8rem; color: var(--fg-muted); }
      .sell-form .tax-hint { font-size: 0.75rem; color: var(--fg-muted); }
      .sell-form .cta { display: flex; justify-content: flex-end; }
      .error { color: var(--danger); font-size: 0.85rem; }

      @media (max-width: 520px) {
        .sell-form { grid-template-columns: 1fr; }
        .row { grid-template-columns: 1fr auto; }
      }
    `,
  ],
  template: `
    <sg-panel title="Marché" (closed)="closed.emit()">
      <div class="tabs">
        <button [class.active]="tab() === 'browse'" (click)="switchTab('browse')">Acheter</button>
        <button [class.active]="tab() === 'sell'"   (click)="switchTab('sell')">Vendre</button>
        <button [class.active]="tab() === 'mine'"   (click)="switchTab('mine')">Mes offres</button>
      </div>

      @if (tab() === 'browse' || tab() === 'sell') {
        <div class="asset-switch">
          <button type="button" [class.on]="asset() === 'RESOURCE'" (click)="switchAsset('RESOURCE')">Ressources</button>
          <button type="button" [class.on]="asset() === 'ITEM'" (click)="switchAsset('ITEM')">Équipement</button>
        </div>
      }

      <!-- ============== BROWSE ============== -->
      @if (tab() === 'browse') {
        @if (asset() === 'RESOURCE') {
          <div class="filters">
            <select [(ngModel)]="filterResource" (change)="reload()">
              <option value="">Toutes ressources</option>
              @for (r of resources; track r) {
                <option [value]="r">{{ resourceLabel(r) }}</option>
              }
            </select>
            <select [(ngModel)]="filterType" (change)="reload()">
              <option value="">Tous types</option>
              <option value="INSTANT_BUY">Achat immédiat</option>
              <option value="AUCTION">Enchère</option>
            </select>
          </div>
        } @else {
          <div class="filters">
            <select [(ngModel)]="filterType" (change)="reload()">
              <option value="">Tous types</option>
              <option value="INSTANT_BUY">Achat immédiat</option>
              <option value="AUCTION">Enchère</option>
            </select>
          </div>
        }

        <div class="list">
          @if (listings().length === 0) {
            <div class="empty">Aucune offre pour ces filtres.</div>
          } @else {
            @for (l of listings(); track l.id) {
              @if (l.assetType === 'RESOURCE') {
                <div class="row">
                  <div class="what">
                    <b>{{ l.amount }}× {{ resourceLabel(l.resourceType!) }}</b>
                    <small>Vendeur : {{ l.sellerName }} · Fin : {{ relativeTime(l.expiresAt) }}</small>
                  </div>
                  <span class="type-badge">
                    {{ l.listingType === 'INSTANT_BUY' ? 'Achat direct' : 'Enchère' }}
                  </span>
                  @if (l.listingType === 'INSTANT_BUY') {
                    <span class="price">{{ l.priceGold }} or</span>
                    <button type="button" (click)="buy(l)" [disabled]="busy() === l.id">Acheter</button>
                  } @else {
                    <span class="price">
                      {{ l.highestBid ?? l.priceGold }} or
                      @if (l.buyoutGold) { <small>(buy {{ l.buyoutGold }})</small> }
                    </span>
                    <div class="bid-input">
                      <input type="number" min="1" [(ngModel)]="bidFor[l.id]"
                             placeholder="{{ (l.highestBid ?? l.priceGold) + 1 }}" />
                      <button type="button" (click)="bid(l)" [disabled]="busy() === l.id">Enchérir</button>
                    </div>
                  }
                </div>
              } @else {
                <!-- ITEM listing -->
                <div class="row item" [style.border-left-color]="itemColor(l)">
                  <div class="what">
                    <b [style.color]="itemColor(l)">{{ marketItemLabel(l) }}</b>
                    <small>
                      {{ slotLabel(l.item?.slot) }} · {{ rarityLabel(l) }} ·
                      Vendeur : {{ l.sellerName }} · Fin : {{ relativeTime(l.expiresAt) }}
                    </small>
                    @if (l.item) {
                      <div class="bonuses">
                        @for (b of itemBonuses(l.item); track b.key) {
                          <span>+{{ b.display }} {{ statLabel(b.key) }}</span>
                        }
                      </div>
                    }
                  </div>
                  <span class="type-badge">
                    {{ l.listingType === 'INSTANT_BUY' ? 'Achat direct' : 'Enchère' }}
                  </span>
                  @if (l.listingType === 'INSTANT_BUY') {
                    <span class="price">{{ l.priceGold }} or</span>
                    <button type="button" (click)="buy(l)" [disabled]="busy() === l.id">Acheter</button>
                  } @else {
                    <span class="price">
                      {{ l.highestBid ?? l.priceGold }} or
                      @if (l.buyoutGold) { <small>(buy {{ l.buyoutGold }})</small> }
                    </span>
                    <div class="bid-input">
                      <input type="number" min="1" [(ngModel)]="bidFor[l.id]"
                             placeholder="{{ (l.highestBid ?? l.priceGold) + 1 }}" />
                      <button type="button" (click)="bid(l)" [disabled]="busy() === l.id">Enchérir</button>
                    </div>
                  }
                </div>
              }
            }
          }
        </div>
      }

      <!-- ============== SELL ============== -->
      @if (tab() === 'sell') {
        @if (asset() === 'RESOURCE') {
          <form class="sell-form" (submit)="createResourceListing($event)">
            <div>
              <label>Type d'offre</label>
              <select [(ngModel)]="form.listingType" name="listingType">
                <option value="INSTANT_BUY">Achat immédiat</option>
                <option value="AUCTION">Enchère</option>
              </select>
            </div>
            <div>
              <label>Ressource</label>
              <select [(ngModel)]="form.resourceType" name="resourceType">
                @for (r of sellableResources; track r) {
                  <option [value]="r">{{ resourceLabel(r) }} ({{ ownedOf(r) }} dispo)</option>
                }
              </select>
            </div>
            <div>
              <label>Quantité</label>
              <input type="number" min="1" [(ngModel)]="form.amount" name="amount" required />
            </div>
            <div>
              <label>{{ form.listingType === 'AUCTION' ? 'Offre de départ (or)' : 'Prix (or)' }}</label>
              <input type="number" min="1" [(ngModel)]="form.priceGold" name="priceGold" required />
            </div>
            @if (form.listingType === 'AUCTION') {
              <div>
                <label>Achat direct optionnel (or)</label>
                <input type="number" min="1" [(ngModel)]="form.buyoutGold" name="buyoutGold" />
              </div>
              <div>
                <label>Durée</label>
                <select [(ngModel)]="form.durationHours" name="durationHours">
                  @for (h of durations; track h) {
                    <option [value]="h">{{ h }}h</option>
                  }
                </select>
              </div>
            }
            <div class="full tax-hint">
              Taxe de vente : {{ taxPct }}% (soit {{ netProceeds() }} or nets pour {{ grossPrice() }} or bruts).
            </div>
            @if (error()) { <div class="full error">{{ error() }}</div> }
            <div class="full cta">
              <button type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Publication…' : 'Mettre en vente' }}
              </button>
            </div>
          </form>
        } @else {
          <!-- ITEM sell form -->
          @if (sellableItems().length === 0) {
            <div class="empty">
              Aucun item vendable. Déséquipe un objet pour pouvoir le mettre en vente.
            </div>
          } @else {
            <form class="sell-form" (submit)="createItemListing($event)">
              <div class="full">
                <label>Item à vendre</label>
                <select [(ngModel)]="itemForm.itemId" name="itemId" required>
                  <option value="">— choisir —</option>
                  @for (it of sellableItems(); track it.id) {
                    <option [value]="it.id">
                      {{ it.name }} ({{ slotLabel(it.slot) }} · {{ rarityLabel2(it) }})
                    </option>
                  }
                </select>
              </div>
              <div>
                <label>Type d'offre</label>
                <select [(ngModel)]="itemForm.listingType" name="listingType">
                  <option value="INSTANT_BUY">Achat immédiat</option>
                  <option value="AUCTION">Enchère</option>
                </select>
              </div>
              <div>
                <label>{{ itemForm.listingType === 'AUCTION' ? 'Offre de départ (or)' : 'Prix (or)' }}</label>
                <input type="number" min="1" [(ngModel)]="itemForm.priceGold" name="priceGold" required />
              </div>
              @if (itemForm.listingType === 'AUCTION') {
                <div>
                  <label>Achat direct optionnel (or)</label>
                  <input type="number" min="1" [(ngModel)]="itemForm.buyoutGold" name="buyoutGold" />
                </div>
                <div>
                  <label>Durée</label>
                  <select [(ngModel)]="itemForm.durationHours" name="durationHours">
                    @for (h of durations; track h) {
                      <option [value]="h">{{ h }}h</option>
                    }
                  </select>
                </div>
              }
              <div class="full tax-hint">
                Taxe : {{ taxPct }}% · Net vendeur : {{ itemNetProceeds() }} or.
              </div>
              @if (error()) { <div class="full error">{{ error() }}</div> }
              <div class="full cta">
                <button type="submit" [disabled]="submitting() || !itemForm.itemId">
                  {{ submitting() ? 'Publication…' : 'Mettre en vente' }}
                </button>
              </div>
            </form>
          }
        }
      }

      <!-- ============== MINE ============== -->
      @if (tab() === 'mine') {
        <div class="list">
          @if (mine().length === 0) {
            <div class="empty">Tu n'as pas d'offres actives.</div>
          } @else {
            @for (l of mine(); track l.id) {
              <div class="row" [class.item]="l.assetType === 'ITEM'"
                   [style.border-left-color]="l.assetType === 'ITEM' ? itemColor(l) : null">
                <div class="what">
                  @if (l.assetType === 'RESOURCE') {
                    <b>{{ l.amount }}× {{ resourceLabel(l.resourceType!) }}</b>
                  } @else {
                    <b [style.color]="itemColor(l)">{{ marketItemLabel(l) }}</b>
                    <small>{{ slotLabel(l.item?.slot) }} · {{ rarityLabel(l) }}</small>
                  }
                  <small>
                    {{ l.listingType === 'AUCTION' ? 'Enchère' : 'Achat direct' }} ·
                    État : {{ stateLabel(l.state) }}
                    @if (l.state === 'ACTIVE') { · Fin : {{ relativeTime(l.expiresAt) }} }
                  </small>
                </div>
                <span class="price">
                  {{ l.listingType === 'AUCTION' ? (l.highestBid ?? l.priceGold) : l.priceGold }} or
                </span>
                @if (l.state === 'ACTIVE' && !l.highestBid) {
                  <span></span>
                  <button type="button" (click)="cancel(l)">Annuler</button>
                } @else {
                  <span></span><span></span>
                }
              </div>
            }
          }
        </div>
      }
    </sg-panel>
  `,
})
export class MarketPanelComponent implements OnInit {
  private readonly marketSvc = inject(MarketService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly itemsSvc = inject(ItemsService);

  readonly closed = output<void>();

  readonly listings = this.marketSvc.listings;
  readonly mine = this.marketSvc.mine;
  readonly resources = RESOURCE_TYPES.filter((r) => r !== 'GOLD');
  readonly sellableResources = RESOURCE_TYPES.filter((r) => r !== 'GOLD');
  readonly durations = AUCTION_DURATIONS_HOURS;
  readonly taxPct = Math.round(MARKET_TAX_RATE * 100);

  readonly tab = signal<Tab>('browse');
  readonly asset = signal<AssetKind>('RESOURCE');
  readonly busy = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  protected bidFor: Record<string, number | null> = {};

  readonly sellableItems = computed(() =>
    this.itemsSvc.items().filter((i) => !i.equipped && !i.onMarket && i.kind === 'EQUIPMENT'),
  );

  filterResource: ResourceType | '' = '';
  filterType: MarketListingType | '' = '';

  form: {
    listingType: MarketListingType;
    resourceType: ResourceType;
    amount: number;
    priceGold: number;
    buyoutGold: number | null;
    durationHours: AuctionDurationHours;
  } = {
    listingType: 'INSTANT_BUY',
    resourceType: 'WOOD',
    amount: 10,
    priceGold: 20,
    buyoutGold: null,
    durationHours: 8,
  };

  itemForm: {
    listingType: MarketListingType;
    itemId: string;
    priceGold: number;
    buyoutGold: number | null;
    durationHours: AuctionDurationHours;
  } = {
    listingType: 'INSTANT_BUY',
    itemId: '',
    priceGold: 50,
    buyoutGold: null,
    durationHours: 8,
  };

  protected readonly grossPrice = computed(() => Number(this.form.priceGold || 0));
  protected readonly netProceeds = computed(() =>
    Math.floor(this.grossPrice() * (1 - MARKET_TAX_RATE)),
  );
  protected readonly itemNetProceeds = computed(() =>
    Math.floor(Number(this.itemForm.priceGold || 0) * (1 - MARKET_TAX_RATE)),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.resourcesSvc.loadMine(),
      this.itemsSvc.loadMine(),
      this.marketSvc.loadListings({ assetType: 'RESOURCE' }),
    ]);
  }

  protected async reload(): Promise<void> {
    await this.marketSvc.loadListings({
      assetType: this.asset(),
      resourceType: this.asset() === 'RESOURCE' ? (this.filterResource || undefined) : undefined,
      listingType: this.filterType || undefined,
    });
  }

  protected async switchTab(t: Tab): Promise<void> {
    this.tab.set(t);
    this.error.set(null);
    if (t === 'browse') await this.reload();
    if (t === 'mine') await this.marketSvc.loadMine();
    if (t === 'sell') await this.itemsSvc.loadMine();
  }

  protected async switchAsset(a: AssetKind): Promise<void> {
    this.asset.set(a);
    this.filterResource = '';
    if (this.tab() === 'browse') await this.reload();
  }

  protected async buy(l: MarketListing): Promise<void> {
    this.busy.set(l.id);
    try {
      await this.marketSvc.buy(l.id);
      await Promise.all([this.reload(), this.resourcesSvc.loadMine(), this.itemsSvc.loadMine()]);
    } catch (err) {
      this.error.set(this.errMsg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async bid(l: MarketListing): Promise<void> {
    const amt = Number(this.bidFor[l.id] ?? 0);
    if (!amt || amt <= 0) return;
    this.busy.set(l.id);
    try {
      await this.marketSvc.bid(l.id, amt);
      await Promise.all([this.reload(), this.resourcesSvc.loadMine(), this.itemsSvc.loadMine()]);
      this.bidFor[l.id] = null;
    } catch (err) {
      this.error.set(this.errMsg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async cancel(l: MarketListing): Promise<void> {
    try {
      await this.marketSvc.cancel(l.id);
      await Promise.all([this.marketSvc.loadMine(), this.resourcesSvc.loadMine(), this.itemsSvc.loadMine()]);
    } catch (err) {
      this.error.set(this.errMsg(err));
    }
  }

  protected async createResourceListing(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.submitting.set(true);
    try {
      const payload = {
        listingType: this.form.listingType,
        resourceType: this.form.resourceType,
        amount: Number(this.form.amount),
        priceGold: Number(this.form.priceGold),
        ...(this.form.listingType === 'AUCTION'
          ? {
              durationHours: Number(this.form.durationHours) as AuctionDurationHours,
              ...(this.form.buyoutGold
                ? { buyoutGold: Number(this.form.buyoutGold) }
                : {}),
            }
          : {}),
      };
      await this.marketSvc.createResourceListing(payload);
      await Promise.all([this.resourcesSvc.loadMine(), this.marketSvc.loadMine()]);
      this.tab.set('mine');
    } catch (err) {
      this.error.set(this.errMsg(err));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async createItemListing(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!this.itemForm.itemId) return;
    this.submitting.set(true);
    try {
      const payload = {
        listingType: this.itemForm.listingType,
        itemId: this.itemForm.itemId,
        priceGold: Number(this.itemForm.priceGold),
        ...(this.itemForm.listingType === 'AUCTION'
          ? {
              durationHours: Number(this.itemForm.durationHours) as AuctionDurationHours,
              ...(this.itemForm.buyoutGold
                ? { buyoutGold: Number(this.itemForm.buyoutGold) }
                : {}),
            }
          : {}),
      };
      await this.marketSvc.createItemListing(payload);
      await Promise.all([this.itemsSvc.loadMine(), this.marketSvc.loadMine()]);
      this.itemForm.itemId = '';
      this.tab.set('mine');
    } catch (err) {
      this.error.set(this.errMsg(err));
    } finally {
      this.submitting.set(false);
    }
  }

  protected ownedOf(r: ResourceType): number {
    return this.resourcesSvc.get(r);
  }

  protected resourceLabel(t: ResourceType): string {
    return RESOURCE_LABELS[t];
  }

  protected slotLabel(slot: Item['slot'] | undefined): string {
    if (!slot) return '—';
    return SLOT_LABEL[slot];
  }

  protected rarityLabel(l: MarketListing): string {
    return l.item ? RARITY_LABEL[l.item.rarity] : '';
  }

  protected rarityLabel2(it: Item): string {
    return RARITY_LABEL[it.rarity];
  }

  protected itemColor(l: MarketListing): string {
    return l.item ? RARITY_COLOR[l.item.rarity] : '#b6a88e';
  }

  protected marketItemLabel(l: MarketListing): string {
    if (!l.item) return '';
    return l.item.upgradeLevel > 0 ? `${l.item.name} +${l.item.upgradeLevel}` : l.item.name;
  }

  protected itemBonuses(
    snap: NonNullable<MarketListing['item']>,
  ): Array<{ key: keyof typeof STAT_LABEL; display: string }> {
    const out: Array<{ key: keyof typeof STAT_LABEL; display: string }> = [];
    for (const key of Object.keys(snap.bonuses) as Array<keyof typeof STAT_LABEL>) {
      const v = snap.bonuses[key];
      if (typeof v !== 'number' || v === 0) continue;
      const isPct = key === 'critChance' || key === 'dodgeChance';
      out.push({ key, display: isPct ? `${Math.round(v * 100)}%` : `${v}` });
    }
    return out;
  }

  protected statLabel(k: keyof typeof STAT_LABEL): string {
    return STAT_LABEL[k];
  }

  protected relativeTime(iso: string): string {
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return 'expire…';
    const min = Math.round(ms / 60000);
    if (min < 60) return `dans ${min}m`;
    const h = Math.floor(min / 60);
    return `dans ${h}h`;
  }

  protected stateLabel(s: string): string {
    switch (s) {
      case 'ACTIVE': return 'Active';
      case 'SOLD': return 'Vendue';
      case 'CANCELLED': return 'Annulée';
      case 'EXPIRED': return 'Expirée';
      default: return s;
    }
  }

  private errMsg(err: unknown): string {
    return (
      (err as { error?: { message?: string } })?.error?.message ??
      (err as Error)?.message ??
      'Erreur'
    );
  }
}
