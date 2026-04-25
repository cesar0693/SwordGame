import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { LangPickerComponent } from '../campfire/ui/lang-picker.component';

@Component({
  selector: 'sg-register',
  standalone: true,
  imports: [FormsModule, RouterLink, LangPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 2rem 1rem; position: relative; }
      .lang { position: absolute; top: 1rem; right: 1rem; }
      .card { width: min(26rem, 100%); }
      h1 { margin: 0 0 1rem; font-size: 1.5rem; }
      label { display: block; font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.25rem; }
      .error { color: var(--danger); font-size: 0.9rem; }
      .hint { font-size: 0.85rem; color: var(--fg-muted); text-align: center; margin-top: 1rem; }
    `,
  ],
  template: `
    <div class="wrap">
      <div class="lang"><sg-lang-picker /></div>
      <form class="card stack" (submit)="submit($event)">
        <h1>{{ i18n.t('auth.register.title') }}</h1>

        <div>
          <label for="username">{{ i18n.t('auth.register.username') }}</label>
          <input id="username" name="username" [(ngModel)]="username" minlength="3" maxlength="24" required />
        </div>

        <div>
          <label for="email">{{ i18n.t('auth.register.email') }}</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
        </div>

        <div>
          <label for="password">{{ i18n.t('auth.register.password') }}</label>
          <input id="password" type="password" name="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password" />
        </div>

        @if (error()) {
          <div class="error">{{ error() }}</div>
        }

        <button type="submit" [disabled]="busy()">
          {{ busy() ? i18n.t('auth.register.submitting') : i18n.t('auth.register.submit') }}
        </button>

        <div class="hint">
          {{ i18n.t('auth.register.haveAccount') }}
          <a routerLink="/login">{{ i18n.t('auth.register.signin') }}</a>
        </div>
      </form>
    </div>
  `,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

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
      this.error.set(msg ?? this.i18n.t('auth.register.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
