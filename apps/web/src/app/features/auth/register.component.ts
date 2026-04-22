import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'sg-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 2rem 1rem; }
      .card { width: min(26rem, 100%); }
      h1 { margin: 0 0 1rem; font-size: 1.5rem; }
      label { display: block; font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.25rem; }
      .error { color: var(--danger); font-size: 0.9rem; }
      .hint { font-size: 0.85rem; color: var(--fg-muted); text-align: center; margin-top: 1rem; }
    `,
  ],
  template: `
    <div class="wrap">
      <form class="card stack" (submit)="submit($event)">
        <h1>Créer un compte</h1>

        <div>
          <label for="username">Pseudo</label>
          <input id="username" name="username" [(ngModel)]="username" minlength="3" maxlength="24" required />
        </div>

        <div>
          <label for="email">Email</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
        </div>

        <div>
          <label for="password">Mot de passe (8+)</label>
          <input id="password" type="password" name="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password" />
        </div>

        @if (error()) {
          <div class="error">{{ error() }}</div>
        }

        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Création…' : 'Créer mon compte' }}
        </button>

        <div class="hint">
          Déjà un compte ? <a routerLink="/login">Se connecter</a>
        </div>
      </form>
    </div>
  `,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.register({
        username: this.username,
        email: this.email,
        password: this.password,
      });
      await this.router.navigate(['/campfire']);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'Inscription impossible');
    } finally {
      this.busy.set(false);
    }
  }
}
