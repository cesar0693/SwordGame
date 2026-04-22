import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Hero } from '@swordgame/shared';
import { AuthService } from '../../core/auth/auth.service';
import { HeroesService } from '../../core/heroes/heroes.service';
import { CampfireSceneComponent } from './scene/campfire-scene.component';
import { HeroHudComponent } from './ui/hero-hud.component';
import { ActionDockComponent, type DockAction } from './ui/action-dock.component';
import { ProfilePanelComponent } from './panels/profile-panel.component';
import { HeroCreationComponent } from './hero-creation.component';

@Component({
  selector: 'sg-campfire',
  standalone: true,
  imports: [
    CampfireSceneComponent,
    HeroHudComponent,
    ActionDockComponent,
    ProfilePanelComponent,
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
      <!-- Full-viewport scene (background layer) -->
      <sg-campfire-scene [heroClass]="sceneClass()" />

      <!-- Top-right: user + logout -->
      <div class="topbar">
        <span class="user">{{ auth.user()?.username }}</span>
        <button type="button" (click)="logout()">Déconnexion</button>
      </div>

      @if (heroes.hero(); as hero) {
        <!-- HUD top-left -->
        <sg-hero-hud [hero]="hero" />

        <!-- Bottom dock -->
        <sg-action-dock (opened)="openPanel($event)" />

        <!-- Modal panels -->
        @switch (openPanelId()) {
          @case ('profile') {
            <sg-profile-panel [hero]="hero" (closed)="closePanel()" />
          }
        }
      } @else {
        <!-- No hero yet: creation panel centered on the scene -->
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
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly openPanelId = signal<DockAction | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.heroes.loadMine();
    } catch (err: unknown) {
      this.error.set((err as Error).message ?? 'Erreur inconnue');
    } finally {
      this.loading.set(false);
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
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
