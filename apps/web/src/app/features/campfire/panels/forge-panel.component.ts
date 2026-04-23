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
  RARITY_COLOR,
  RARITY_LABEL,
  RESOURCE_LABELS,
  SLOT_LABEL,
  UPGRADE_MAX_LEVEL,
  salvageRefund,
  upgradeCost,
  upgradeSuccessChance,
  type Item,
  type ItemStatBonus,
  type ResourceType,
} from '@swordgame/shared';
import { ForgeService, type RecipeRow } from '../../../core/forge/forge.service';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { ItemsService } from '../../../core/items/items.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';

type Tab = 'upgrade' | 'recipes' | 'salvage';

@Component({
  selector: 'sg-forge-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .tabs { display: flex; gap: 0.4rem; margin-bottom: 0.8rem;
              border-bottom: 1px solid #3a2a18; padding-bottom: 0.5rem; }
      .tabs button {
        background: transparent; color: var(--fg-muted);
        border: 1px solid transparent; padding: 0.35rem 0.7rem;
        border-radius: 6px; font-size: 0.85rem;
      }
      .tabs button.active { background: #3a2413; color: #ffd9a8; border-color: #6b4a26; }

      .lead { color: var(--fg-muted); margin: 0 0 0.8rem; font-size: 0.85rem; }

      .locked {
        padding: 1rem; text-align: center;
        background: #1a100a; border: 1px dashed #3a2a18; border-radius: 8px;
        color: var(--fg-muted);
      }

      .list { display: grid; gap: 0.4rem; }

      .card {
        padding: 0.55rem 0.7rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-left-width: 3px;
        border-radius: 6px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.3rem 0.8rem;
        align-items: center;
      }
      .card.locked-row { opacity: 0.55; }
      .card b { color: var(--fg); }
      .card .sub { color: var(--fg-muted); font-size: 0.78rem; }
      .card .bonuses {
        grid-column: 1 / -1;
        display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem;
        font-size: 0.78rem; color: #8ec04a;
      }
      .card .cost {
        grid-column: 1 / -1;
        font-size: 0.78rem; color: #ffd28a;
        display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem;
      }
      .card button {
        background: #c77a2c; color: #18100a; border: none;
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
      }
      .card button:disabled { opacity: 0.45; cursor: not-allowed; }
      .card button.danger {
        background: transparent; color: #d88; border: 1px solid #6b2a2a;
      }

      .upgrade-preview {
        display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;
        font-size: 0.82rem;
      }
      .empty { color: var(--fg-muted); text-align: center; padding: 1rem; }
      .flash-success {
        color: #8ec04a;
        padding: 0.5rem 0;
      }
      .flash-fail { color: #d88; padding: 0.5rem 0; }
    `,
  ],
  template: `
    <sg-panel title="Forge" (closed)="closed.emit()">
      @if (forgeSvc.blacksmithLevel() <= 0) {
        <div class="locked">
          Le Forgeron doit être débloqué dans le Camp pour ouvrir la Forge.
        </div>
      } @else {
        <div class="tabs">
          <button [class.active]="tab() === 'upgrade'" (click)="tab.set('upgrade')">Améliorer</button>
          <button [class.active]="tab() === 'recipes'" (click)="reloadRecipes()">Recettes</button>
          <button [class.active]="tab() === 'salvage'" (click)="tab.set('salvage')">Démantelage</button>
        </div>

        <!-- ========== UPGRADE ========== -->
        @if (tab() === 'upgrade') {
          <p class="lead">
            Améliore un item équipable ({{ maxLevel }} max). Chaque +N applique +10 % à tous les bonus.
            Échec = ressources perdues, niveau inchangé.
          </p>
          @if (upgradable().length === 0) {
            <div class="empty">Aucun item améliorable dans le sac.</div>
          } @else {
            <div class="list">
              @for (it of upgradable(); track it.id) {
                @let preview = upgradePreview(it);
                <div class="card" [style.border-left-color]="rarityColor(it)">
                  <div>
                    <b [style.color]="rarityColor(it)">{{ itemLabel(it) }}</b>
                    <span class="sub"> · {{ slotLabel(it.slot) }} · {{ rarityLabel(it) }}</span>
                  </div>
                  <button type="button"
                          [disabled]="busy() === it.id || it.upgradeLevel >= maxLevel || !preview.affordable"
                          (click)="doUpgrade(it)">
                    {{ it.upgradeLevel >= maxLevel ? 'Max' : 'Tenter +' + (it.upgradeLevel + 1) }}
                  </button>
                  @if (it.upgradeLevel < maxLevel) {
                    <div class="cost">
                      <span>{{ preview.cost.iron }} fer</span>
                      <span>{{ preview.cost.gem }} gemme(s)</span>
                      <span>{{ preview.cost.gold }} or</span>
                      <span>Réussite : {{ pct(preview.chance) }}</span>
                    </div>
                  }
                  @if (flash()[it.id]; as f) {
                    <div [class.flash-success]="f === 'ok'" [class.flash-fail]="f === 'ko'">
                      {{ f === 'ok' ? '✦ Succès !' : '✗ Échec. Les ressources sont perdues.' }}
                    </div>
                  }
                </div>
              }
            </div>
          }
        }

        <!-- ========== RECIPES ========== -->
        @if (tab() === 'recipes') {
          <p class="lead">
            Craft direct d'un item spécifique. Les recettes se débloquent avec le niveau du Forgeron
            (actuellement Niv. {{ forgeSvc.blacksmithLevel() }}).
          </p>
          @if (forgeSvc.recipes().length === 0) {
            <div class="empty">Chargement…</div>
          } @else {
            <div class="list">
              @for (r of forgeSvc.recipes(); track r.code) {
                <div class="card" [class.locked-row]="!r.unlocked"
                     [style.border-left-color]="rarityColorStr(r.output.rarity)">
                  <div>
                    <b [style.color]="rarityColorStr(r.output.rarity)">{{ r.name }}</b>
                    <span class="sub"> · {{ slotLabelStr(r.output.slot) }} · {{ rarityLabelStr(r.output.rarity) }}</span>
                  </div>
                  <button type="button"
                          [disabled]="!r.unlocked || !r.affordable || busy() === r.code"
                          (click)="doCraft(r)">
                    @if (!r.unlocked) { Niv. {{ r.blacksmithLevel }}+ }
                    @else if (!r.affordable) { Ressources }
                    @else { Forger }
                  </button>
                  <div class="sub" style="grid-column: 1 / -1">{{ r.description }}</div>
                  <div class="bonuses">
                    @for (b of bonusEntriesObj(r.output.bonuses); track b.key) {
                      <span>+{{ b.display }} {{ b.key }}</span>
                    }
                  </div>
                  <div class="cost">
                    @for (c of costEntries(r.cost); track c.type) {
                      <span>{{ c.amount }} {{ resourceLabel(c.type) }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- ========== SALVAGE ========== -->
        @if (tab() === 'salvage') {
          <p class="lead">
            Démantèle un item pour récupérer des ressources. Basé sur la rareté et le niveau d'upgrade.
          </p>
          @if (salvageable().length === 0) {
            <div class="empty">Aucun item à démanteler (déséquipe d'abord).</div>
          } @else {
            <div class="list">
              @for (it of salvageable(); track it.id) {
                @let refund = salvagePreview(it);
                <div class="card" [style.border-left-color]="rarityColor(it)">
                  <div>
                    <b [style.color]="rarityColor(it)">{{ itemLabel(it) }}</b>
                    <span class="sub"> · {{ slotLabel(it.slot) }} · {{ rarityLabel(it) }}</span>
                  </div>
                  <button type="button" class="danger"
                          [disabled]="busy() === it.id"
                          (click)="doSalvage(it)">
                    Démanteler
                  </button>
                  <div class="cost">
                    @for (r of refund; track r.type) {
                      <span>+{{ r.amount }} {{ resourceLabel(r.type) }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }
      }
    </sg-panel>
  `,
})
export class ForgePanelComponent implements OnInit {
  protected readonly forgeSvc = inject(ForgeService);
  private readonly itemsSvc = inject(ItemsService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly heroesSvc = inject(HeroesService);

  readonly closed = output<void>();

  readonly tab = signal<Tab>('upgrade');
  readonly busy = signal<string | null>(null);
  readonly flash = signal<Record<string, 'ok' | 'ko' | undefined>>({});

  readonly maxLevel = UPGRADE_MAX_LEVEL;

  readonly upgradable = computed(() =>
    this.itemsSvc.items().filter(
      (i) => i.kind === 'EQUIPMENT' && !i.onMarket && i.upgradeLevel < UPGRADE_MAX_LEVEL,
    ),
  );
  readonly salvageable = computed(() =>
    this.itemsSvc.items().filter(
      (i) => i.kind === 'EQUIPMENT' && !i.equipped && !i.onMarket,
    ),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.forgeSvc.loadState(),
      this.itemsSvc.loadMine(),
      this.resourcesSvc.loadMine(),
    ]);
  }

  protected async reloadRecipes(): Promise<void> {
    this.tab.set('recipes');
    await this.forgeSvc.loadRecipes();
  }

  // --- Upgrade ---

  protected upgradePreview(it: Item) {
    const cost = upgradeCost(it.upgradeLevel);
    const chance = upgradeSuccessChance(it.upgradeLevel);
    const owned = {
      iron: this.resourcesSvc.get('IRON'),
      gem: this.resourcesSvc.get('GEM'),
      gold: this.resourcesSvc.get('GOLD'),
    };
    const affordable =
      owned.iron >= cost.iron && owned.gem >= cost.gem && owned.gold >= cost.gold;
    return { cost, chance, affordable };
  }

  protected async doUpgrade(it: Item): Promise<void> {
    this.busy.set(it.id);
    this.setFlash(it.id, undefined);
    try {
      const res = await this.forgeSvc.upgrade(it.id);
      this.setFlash(it.id, res.success ? 'ok' : 'ko');
      await Promise.all([
        this.itemsSvc.loadMine(),
        this.resourcesSvc.loadMine(),
        this.heroesSvc.loadMine(),
      ]);
    } catch {
      // error silently kept; user will see ressources perdues
    } finally {
      this.busy.set(null);
      setTimeout(() => this.setFlash(it.id, undefined), 2500);
    }
  }

  // --- Recipes ---

  protected async doCraft(r: RecipeRow): Promise<void> {
    this.busy.set(r.code);
    try {
      await this.forgeSvc.craft(r.code);
      await Promise.all([
        this.itemsSvc.loadMine(),
        this.resourcesSvc.loadMine(),
        this.forgeSvc.loadRecipes(),
      ]);
    } finally {
      this.busy.set(null);
    }
  }

  // --- Salvage ---

  protected salvagePreview(it: Item): Array<{ type: ResourceType; amount: number }> {
    const r = salvageRefund(it.rarity, it.upgradeLevel);
    return Object.entries(r)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([type, amount]) => ({ type: type as ResourceType, amount: amount as number }));
  }

  protected async doSalvage(it: Item): Promise<void> {
    if (!confirm(`Démanteler ${it.name} ?`)) return;
    this.busy.set(it.id);
    try {
      await this.forgeSvc.salvage(it.id);
      await Promise.all([
        this.itemsSvc.loadMine(),
        this.resourcesSvc.loadMine(),
      ]);
    } finally {
      this.busy.set(null);
    }
  }

  // --- Labels ---

  protected itemLabel(it: Item): string {
    return it.upgradeLevel > 0 ? `${it.name} +${it.upgradeLevel}` : it.name;
  }

  protected slotLabel(slot: Item['slot']): string {
    if (!slot) return '—';
    return SLOT_LABEL[slot];
  }
  protected slotLabelStr(slot: string): string {
    return (SLOT_LABEL as Record<string, string>)[slot] ?? slot;
  }
  protected rarityLabel(it: Item): string { return RARITY_LABEL[it.rarity]; }
  protected rarityLabelStr(r: string): string {
    return (RARITY_LABEL as Record<string, string>)[r] ?? r;
  }
  protected rarityColor(it: Item): string { return RARITY_COLOR[it.rarity]; }
  protected rarityColorStr(r: string): string {
    return (RARITY_COLOR as Record<string, string>)[r] ?? '#b6a88e';
  }
  protected resourceLabel(t: ResourceType): string { return RESOURCE_LABELS[t]; }

  protected pct(v: number): string { return `${Math.round(v * 100)}%`; }

  protected bonusEntriesObj(b: ItemStatBonus): Array<{ key: string; display: string }> {
    const out: Array<{ key: string; display: string }> = [];
    for (const k of Object.keys(b) as Array<keyof ItemStatBonus>) {
      const v = b[k];
      if (typeof v !== 'number' || v === 0) continue;
      const isPct = k === 'critChance' || k === 'dodgeChance';
      out.push({
        key: k,
        display: isPct ? `${Math.round(v * 100)}%` : `${v}`,
      });
    }
    return out;
  }

  protected costEntries(cost: Partial<Record<ResourceType, number>>) {
    return Object.entries(cost)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([type, amount]) => ({ type: type as ResourceType, amount: amount as number }));
  }

  private setFlash(id: string, v: 'ok' | 'ko' | undefined): void {
    this.flash.update((m) => ({ ...m, [id]: v }));
  }
}
