import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HERO_CLASSES, type HeroClass } from '@swordgame/shared';
import { HeroesService } from '../../core/heroes/heroes.service';

@Component({
  selector: 'sg-hero-creation',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      h2 { margin: 0 0 0.75rem; }
      .classes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
      .class-btn {
        background: var(--bg-soft); border: 1px solid var(--border); color: var(--fg);
        padding: 0.8rem; border-radius: var(--radius); cursor: pointer; text-align: left;
      }
      .class-btn.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
      .class-btn b { display: block; margin-bottom: 0.25rem; }
      .class-btn span { color: var(--fg-muted); font-size: 0.85rem; }
      label { display: block; font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.25rem; }
      .error { color: var(--danger); font-size: 0.9rem; }
    `,
  ],
  template: `
    <h2>Ton premier héros</h2>
    <p style="color: var(--fg-muted); margin-top:0">
      Choisis un nom, une classe et une apparence. Tu pourras personnaliser davantage plus tard.
    </p>

    <form class="stack" (submit)="submit($event)">
      <div>
        <label for="name">Nom du héros</label>
        <input id="name" name="name" [(ngModel)]="name" minlength="3" maxlength="20" required />
      </div>

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

      <div>
        <label for="outfit">Tenue (placeholder)</label>
        <select id="outfit" name="outfit" [(ngModel)]="outfit">
          <option value="leather">Cuir</option>
          <option value="robe">Robe</option>
          <option value="plate">Plaque</option>
        </select>
      </div>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      <button type="submit" [disabled]="busy()">
        {{ busy() ? 'Création…' : 'Allumer le feu de camp' }}
      </button>
    </form>
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
    WARRIOR: 'Beaucoup de PV, ATK et DEF solides.',
    MAGE: 'Gros PM, ATK magique, peu de DEF.',
    RANGER: 'Rapide, critique élevé, esquive.',
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
