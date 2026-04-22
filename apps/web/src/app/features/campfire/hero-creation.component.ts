import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HERO_CLASSES, type HeroClass } from '@swordgame/shared';
import { HeroesService } from '../../core/heroes/heroes.service';
import { PanelComponent } from './ui/panel.component';
import { HeroSpriteComponent } from './scene/hero-sprite.component';

@Component({
  selector: 'sg-hero-creation',
  standalone: true,
  imports: [FormsModule, PanelComponent, HeroSpriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      h2 { margin: 0 0 0.25rem; color: #ffd9a8; }
      p.lead { margin: 0 0 1rem; color: var(--fg-muted); }

      .layout {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 1rem;
        align-items: start;
      }
      .preview {
        display: grid; place-items: end center;
        height: 220px;
        background: radial-gradient(circle at 50% 100%, rgba(255,130,50,0.15), transparent 70%);
        border: 1px dashed #513719;
        border-radius: 8px;
      }

      label { display: block; font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.25rem; }

      .classes {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
      }
      .class-btn {
        background: #241810; border: 1px solid #3a2a18; color: var(--fg);
        padding: 0.6rem; border-radius: 8px; cursor: pointer; text-align: left;
        font: inherit;
      }
      .class-btn.selected { border-color: #c77a2c; box-shadow: 0 0 0 1px #c77a2c; }
      .class-btn b { display: block; margin-bottom: 0.15rem; }
      .class-btn span { color: var(--fg-muted); font-size: 0.8rem; }

      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      .actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
      .error { color: var(--danger); font-size: 0.9rem; margin-top: 0.5rem; }

      @media (max-width: 520px) {
        .layout { grid-template-columns: 1fr; }
        .preview { height: 180px; }
        .row { grid-template-columns: 1fr; }
      }
    `,
  ],
  template: `
    <sg-panel title="Ton premier héros">
      <h2>Allume ton feu de camp</h2>
      <p class="lead">
        Choisis un nom, une classe et quelques traits. Tu pourras ajouter des détails plus tard.
      </p>

      <form class="layout" (submit)="submit($event)">
        <div class="preview">
          <sg-hero-sprite [heroClass]="heroClass()" face="right" />
        </div>

        <div>
          <div>
            <label>Classe</label>
            <div class="classes">
              @for (c of classes; track c) {
                <button
                  type="button"
                  class="class-btn"
                  [class.selected]="heroClass() === c"
                  (click)="heroClass.set(c)"
                >
                  <b>{{ classLabels[c] }}</b>
                  <span>{{ classBlurb[c] }}</span>
                </button>
              }
            </div>
          </div>

          <div class="row" style="margin-top: 0.75rem">
            <div>
              <label for="name">Nom</label>
              <input id="name" name="name" [(ngModel)]="name" minlength="3" maxlength="20" required />
            </div>
            <div>
              <label for="outfit">Tenue</label>
              <select id="outfit" name="outfit" [(ngModel)]="outfit">
                <option value="leather">Cuir</option>
                <option value="robe">Robe</option>
                <option value="plate">Plaque</option>
              </select>
            </div>
          </div>

          @if (error()) {
            <div class="error">{{ error() }}</div>
          }

          <div class="actions">
            <button type="submit" [disabled]="busy()">
              {{ busy() ? 'Création…' : 'Rejoindre le camp' }}
            </button>
          </div>
        </div>
      </form>
    </sg-panel>
  `,
})
export class HeroCreationComponent {
  private readonly heroes = inject(HeroesService);

  protected readonly classes = HERO_CLASSES;
  protected readonly classLabels: Record<HeroClass, string> = {
    WARRIOR: 'Guerrier',
    MAGE: 'Mage',
    RANGER: 'Rôdeur',
  };
  protected readonly classBlurb: Record<HeroClass, string> = {
    WARRIOR: 'Costaud, ATK et DEF.',
    MAGE: 'Mana élevé, ATK magique.',
    RANGER: 'Rapide, critique, esquive.',
  };

  name = '';
  outfit = 'leather';
  readonly heroClass = signal<HeroClass>('WARRIOR');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.heroes.create({
        name: this.name,
        heroClass: this.heroClass(),
        appearance: {
          skinTone: 'medium',
          hair: 'brown',
          eyes: 'green',
          outfit: this.outfit,
        },
      });
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'Création impossible');
    } finally {
      this.busy.set(false);
    }
  }
}
