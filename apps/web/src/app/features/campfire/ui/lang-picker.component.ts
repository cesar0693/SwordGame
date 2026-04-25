import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SUPPORTED_LANGS, type Lang } from '../../../core/i18n/dictionary';

@Component({
  selector: 'sg-lang-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: inline-flex; gap: 0.2rem; }
      button {
        padding: 0.1rem 0.4rem;
        font-size: 0.7rem;
        background: transparent;
        color: var(--fg-muted);
        border: 1px solid #3a2a18;
        border-radius: 999px;
      }
      button.on {
        background: #3a2413;
        color: #ffd9a8;
        border-color: #6b4a26;
      }
    `,
  ],
  template: `
    @for (l of langs; track l) {
      <button type="button"
              [class.on]="i18n.lang() === l"
              (click)="i18n.set(l)">{{ l.toUpperCase() }}</button>
    }
  `,
})
export class LangPickerComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly langs: Lang[] = [...SUPPORTED_LANGS];
}
