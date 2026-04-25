import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Hero } from '@swordgame/shared';
import { AuthService } from '../../core/auth/auth.service';
import { HeroesService } from '../../core/heroes/heroes.service';
import { DailyService } from '../../core/daily/daily.service';
import { ResourcesService } from '../../core/resources/resources.service';
import { CampfireSceneComponent } from './scene/campfire-scene.component';
import { HeroHudComponent } from './ui/hero-hud.component';
import { GoldIndicatorComponent } from './ui/gold-indicator.component';
import { ActionDockComponent, type DockAction } from './ui/action-dock.component';
import { ProfilePanelComponent } from './panels/profile-panel.component';
import { CampPanelComponent } from './panels/camp-panel.component';
import { MarketPanelComponent } from './panels/market-panel.component';
import { DailyClaimPanelComponent } from './panels/daily-claim-panel.component';
import { InventoryPanelComponent } from './panels/inventory-panel.component';
import { MissionsPanelComponent } from './panels/missions-panel.component';
import { ForgePanelComponent } from './panels/forge-panel.component';
import { SpellsPanelComponent } from './panels/spells-panel.component';
import { ArenaPanelComponent } from './panels/arena-panel.component';
import { ToastHostComponent } from './ui/toast-host.component';
import { LangPickerComponent } from './ui/lang-picker.component';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { HeroCreationComponent } from './hero-creation.component';

@Component({
  selector: 'sg-campfire',
  standalone: true,
  imports: [
    CampfireSceneComponent,
    HeroHudComponent,
    GoldIndicatorComponent,
    ActionDockComponent,
    ProfilePanelComponent,
    CampPanelComponent,
    MarketPanelComponent,
    DailyClaimPanelComponent,
    InventoryPanelComponent,
    MissionsPanelComponent,
    ForgePanelComponent,
    SpellsPanelComponent,
    ArenaPanelComponent,
    ToastHostComponent,
    LangPickerComponent,
    HeroCreationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }

      .topbar {
        position: fixed;
        top: 0.75rem;
        right: 0.75rem;
        z-index: 10;
        display: flex; align-items: center; gap: 0.5rem;
        background: rgba(22, 14, 8, 0.7);
        border: 1px solid #5a3e1f;
        border-radius: 999px;
        padding: 0.3rem 0.5rem 0.3rem 0.8rem;
        color: var(--fg);
        backdrop-filter: blur(2px);
      }
      .topbar .user { font-size: 0.85rem; color: var(--fg-muted); }
      .topbar button {
        padding: 0.25rem 0.6rem;
        background: #c77a2c;
        color: #18100a;
        font-size: 0.8rem;
      }

      .loading {
        position: fixed; inset: 0;
        display: grid; place-items: center;
        color: var(--fg);
        background: #0d0806;
        z-index: 100;
      }

      .error-toast {
        position: fixed; top: 0.75rem; left: 50%; transform: translateX(-50%);
        background: rgba(90, 20, 10, 0.9); color: #ffd9a8;
        border: 1px solid #c0392b; padding: 0.5rem 0.9rem;
        border-radius: 8px; z-index: 50;
        font-size: 0.9rem;
      }
    `,
  ],
  template: `
    @if (loading()) {
      <div class="loading">Chargement du camp…</div>
    } @else {
      <sg-campfire-scene [heroClass]="sceneClass()" />

      <div class="topbar">
        <sg-lang-picker />
        <span class="user">{{ auth.user()?.username }}</span>
        <button type="button" (click)="logout()">{{ i18n.t('topbar.logout') }}</button>
      </div>

      @if (heroes.hero(); as hero) {
        <sg-hero-hud [hero]="hero" />
        <sg-gold-indicator />
        <sg-action-dock (opened)="openPanel($event)" />
        <sg-toast-host />

        @switch (openPanelId()) {
          @case ('profile') {
            <sg-profile-panel [hero]="hero" (closed)="closePanel()" />
          }
          @case ('camp') {
            <sg-camp-panel (closed)="closePanel()" />
          }
          @case ('market') {
            <sg-market-panel (closed)="closePanel()" />
          }
          @case ('dailies') {
            <sg-daily-claim-panel (closed)="closePanel()" />
          }
          @case ('inventory') {
            <sg-inventory-panel
              (closed)="closePanel()"
              (openMarketSell)="openPanel('market')"
            />
          }
          @case ('missions') {
            <sg-missions-panel (closed)="closePanel()" />
          }
          @case ('forge') {
            <sg-forge-panel (closed)="closePanel()" />
          }
          @case ('spells') {
            <sg-spells-panel (closed)="closePanel()" />
          }
          @case ('arena') {
            <sg-arena-panel (closed)="closePanel()" />
          }
        }
      } @else {
        <sg-hero-creation />
      }

      @if (error()) {
        <div class="error-toast">{{ error() }}</div>
      }
    }
  `,
})
export class CampfireComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly heroes = inject(HeroesService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly dailySvc = inject(DailyService);
  private readonly notifications = inject(NotificationsService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly openPanelId = signal<DockAction | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const hero = await this.heroes.loadMine();
      if (hero) {
        await Promise.all([this.resourcesSvc.loadMine(), this.loadDailyAndMaybeOpen()]);
        this.notifications.connect();
      }
    } catch (err: unknown) {
      this.error.set((err as Error).message ?? 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDailyAndMaybeOpen(): Promise<void> {
    try {
      const state = await this.dailySvc.loadState();
      if (state.canClaimToday) {
        this.openPanelId.set('dailies');
      }
    } catch {
      // silent — non-critical
    }
  }

  protected sceneClass(): Hero['heroClass'] {
    return this.heroes.hero()?.heroClass ?? 'WARRIOR';
  }

  protected openPanel(id: DockAction): void {
    this.openPanelId.set(id);
  }

  protected closePanel(): void {
    this.openPanelId.set(null);
  }

  async logout(): Promise<void> {
    this.notifications.disconnect();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
