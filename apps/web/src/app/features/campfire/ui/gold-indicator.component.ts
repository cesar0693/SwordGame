import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ResourcesService } from '../../../core/resources/resources.service';

@Component({
  selector: 'sg-gold-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        position: fixed;
        top: 0.75rem;
        right: 12rem;
        z-index: 10;
      }
      .chip {
        display: inline-flex; align-items: center; gap: 0.4rem;
        background: rgba(22, 14, 8, 0.75);
        border: 1px solid #6b4a26;
        border-radius: 999px;
        padding: 0.25rem 0.8rem;
        color: #ffd28a;
        font-weight: 700;
        backdrop-filter: blur(2px);
      }
      .coin {
        width: 16px; height: 16px; border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #ffe8a8, #c77a2c 70%, #6b3f15);
        box-shadow: 0 0 4px rgba(255, 200, 120, 0.5);
      }
    `,
  ],
  template: `
    <div class="chip" title="Or">
      <span class="coin"></span>
      <span>{{ gold() }}</span>
    </div>
  `,
})
export class GoldIndicatorComponent {
  private readonly resources = inject(ResourcesService);
  protected readonly gold = computed(() => this.resources.get('GOLD'));
}
