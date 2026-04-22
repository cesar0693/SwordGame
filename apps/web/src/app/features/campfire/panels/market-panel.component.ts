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
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  type AuctionDurationHours,
  type MarketListing,
  type MarketListingType,
  type ResourceType,
} from '@swordgame/shared';
import { MarketService } from '../../../core/market/market.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';

type Tab = 'browse' | 'sell' | 'mine';

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

      .filters {
        display: flex; gap: 0.4rem; margin-bottom: 0.6rem; flex-wrap: wrap;
      }
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
      .row .what { display: flex; flex-direction: column; }
      .row .what b { color: var(--fg); }
      .row .what small { color: var(--fg-muted); font-size: 0.78rem; }
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

      @if (tab() === 'browse') {
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

        <div class="list">
          @if (listings().length === 0) {
            <div class="empty">Aucune offre pour ces filtres.</div>
          } @else {
            @for (l of listings(); track l.id) {
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
                  <button type="button" (click)="buy(l)" [disabled]="busy() === l.id">
                    Acheter
                  </button>
                } @else {
                  <span class="price">
                    {{ l.highestBid ?? l.priceGold }} or
                    @if (l.buyoutGold) { <small>(buy {{ l.buyoutGold }})</small> }
                  </span>
                  <div class="bid-input">
                    <input type="number" min="1" [(ngModel)]="bidFor[l.id]" placeholder="{{ (l.highestBid ?? l.priceGold) + 1 }}" />
                    <button type="button" (click)="bid(l)" [disabled]="busy() === l.id">Enchérir</button>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      @if (tab() === 'sell') {
        <form class="sell-form" (submit)="createListing($event)">
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

          @if (error()) {
            <div class="full error">{{ error() }}</div>
          }

          <div class="full cta">
            <button type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Publication…' : 'Mettre en vente' }}
            </button>
          </div>
        </form>
      }

      @if (tab() === 'mine') {
        <div class="list">
          @if (mine().length === 0) {
            <div class="empty">Tu n'as pas d'offres actives.</div>
          } @else {
            @for (l of mine(); track l.id) {
              <div class="row">
                <div class="what">
                  <b>{{ l.amount }}× {{ resourceLabel(l.resourceType!) }}</b>
                  <small>
                    {{ l.listingType === 'AUCTION' ? 'Enchère' : 'Achat direct' }} ·
                    État : {{ stateLabel(l.state) }} ·
                    @if (l.state === 'ACTIVE') { Fin : {{ relativeTime(l.expiresAt) }} }
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

  readonly closed = output<void>();

  readonly listings = this.marketSvc.listings;
  readonly mine = this.marketSvc.mine;
  readonly resources = RESOURCE_TYPES;
  readonly sellableResources = RESOURCE_TYPES.filter((r) => r !== 'GOLD');
  readonly durations = AUCTION_DURATIONS_HOURS;
  readonly taxPct = Math.round(MARKET_TAX_RATE * 100);

  readonly tab = signal<Tab>('browse');
  readonly busy = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  protected bidFor: Record<string, number | null> = {};

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

  protected readonly grossPrice = computed(() => Number(this.form.priceGold || 0));
  protected readonly netProceeds = computed(() =>
    Math.floor(this.grossPrice() * (1 - MARKET_TAX_RATE)),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.resourcesSvc.loadMine(),
      this.marketSvc.loadListings(),
    ]);
  }

  protected async reload(): Promise<void> {
    await this.marketSvc.loadListings({
      resourceType: this.filterResource || undefined,
      listingType: this.filterType || undefined,
    });
  }

  protected async switchTab(t: Tab): Promise<void> {
    this.tab.set(t);
    this.error.set(null);
    if (t === 'browse') await this.reload();
    if (t === 'mine') await this.marketSvc.loadMine();
  }

  protected async buy(l: MarketListing): Promise<void> {
    this.busy.set(l.id);
    try {
      await this.marketSvc.buy(l.id);
      await Promise.all([this.reload(), this.resourcesSvc.loadMine()]);
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
      await Promise.all([this.reload(), this.resourcesSvc.loadMine()]);
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
      await Promise.all([this.marketSvc.loadMine(), this.resourcesSvc.loadMine()]);
    } catch (err) {
      this.error.set(this.errMsg(err));
    }
  }

  protected async createListing(event: Event): Promise<void> {
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

  protected ownedOf(r: ResourceType): number {
    return this.resourcesSvc.get(r);
  }

  protected resourceLabel(t: ResourceType): string {
    return RESOURCE_LABELS[t];
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
