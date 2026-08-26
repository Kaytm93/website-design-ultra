/**
 * Simple uniform control panel for lab experiments.
 *
 * Built with zero framework dependencies: a DOM-based panel of sliders,
 * checkboxes, and colour pickers. Each experiment creates its own panel
 * and registers bindings; the panel calls back on every change.
 *
 * @module
 */

export type UniformBinding =
  | { name: string; type: 'float'; value: number; min: number; max: number; step: number }
  | { name: string; type: 'int'; value: number; min: number; max: number; step: number }
  | { name: string; type: 'boolean'; value: boolean };

export class UniformPanel {
  private container: HTMLElement;
  private bindings: Map<string, UniformBinding> = new Map();
  private onChange: (name: string, value: number | boolean) => void;

  /**
   * @param containerEl  The DOM element to mount the panel into.
   * @param onChange     Called with (name, newValue) on every user interaction.
   */
  constructor(
    containerEl: HTMLElement,
    onChange: (name: string, value: number | boolean) => void,
  ) {
    this.container = containerEl;
    this.container.innerHTML = '';
    this.container.style.cssText = [
      'background: rgba(16, 16, 24, 0.88)',
      'border: 1px solid #3a3a44',
      'border-radius: 8px',
      'padding: 10px 12px',
      'font-family: ui-monospace, "SF Mono", Menlo, monospace',
      'font-size: 11px',
      'color: #c8c8d0',
      'max-height: 40vh',
      'overflow-y: auto',
      'user-select: none',
    ].join(';');

    this.onChange = onChange;
  }

  /** Register a uniform binding. */
  add(binding: UniformBinding): void {
    this.bindings.set(binding.name, binding);
    this.render();
  }

  /** Get the current value of a binding. */
  get(name: string): number | boolean | undefined {
    return this.bindings.get(name)?.value;
  }

  /** Update a binding's value programmatically (no callback). */
  set(name: string, value: number | boolean): void {
    const b = this.bindings.get(name);
    if (b) b.value = value;
  }

  /** Collect all current values keyed by name. */
  getAll(): Record<string, number | boolean> {
    const result: Record<string, number | boolean> = {};
    for (const [name, b] of this.bindings) result[name] = b.value;
    return result;
  }

  private render(): void {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; margin-bottom: 6px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;';
    title.textContent = 'Uniforms';
    this.container.appendChild(title);

    for (const [name, b] of this.bindings) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom: 5px;';

      const label = document.createElement('div');
      label.style.cssText = 'margin-bottom: 2px;';
      label.textContent = name;
      row.appendChild(label);

      switch (b.type) {
        case 'float': {
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(b.min);
          input.max = String(b.max);
          input.step = String(b.step);
          input.value = String(b.value);
          input.style.width = '100%';
          input.addEventListener('input', () => {
            const val = parseFloat(input.value);
            b.value = val;
            this.onChange(name, val);
          });
          row.appendChild(input);
          break;
        }
        case 'int': {
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(b.min);
          input.max = String(b.max);
          input.step = String(b.step);
          input.value = String(b.value);
          input.style.width = '100%';
          input.addEventListener('input', () => {
            const val = parseInt(input.value, 10);
            b.value = val;
            this.onChange(name, val);
          });
          row.appendChild(input);
          break;
        }
        case 'boolean': {
          const labelCheck = document.createElement('label');
          labelCheck.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = b.value as boolean;
          input.addEventListener('change', () => {
            b.value = input.checked;
            this.onChange(name, input.checked);
          });
          labelCheck.appendChild(input);
          labelCheck.appendChild(document.createTextNode(String(b.value)));
          row.appendChild(labelCheck);
          break;
        }
      }
      this.container.appendChild(row);
    }
  }
}