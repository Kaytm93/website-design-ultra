import type { ShaderTextDomState } from './text-effects-uniforms';

export interface ShaderTextDomOptions {
  readonly mount: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly text: string;
  readonly translatedText?: string;
  readonly lang?: string;
  readonly label?: string;
}

export interface ShaderTextDomBinding {
  readonly element: HTMLHeadingElement;
  readonly canvas: HTMLCanvasElement;
  readonly readState: () => ShaderTextDomState;
  setLanguage(language: string): void;
  dispose(): void;
}

/**
 * Create the semantic DOM twin before uploading any atlas or creating a mesh.
 * The canvas is a decorative visual layer; all user-facing text stays in the
 * selectable, translatable, screen-reader-visible heading. The heading stays
 * in the accessibility tree so a screen reader can announce it once. */
export function createShaderTextDomTwin(options: ShaderTextDomOptions): ShaderTextDomBinding {
  const { mount, canvas } = options;
  const heading = document.createElement('h1');
  heading.textContent = options.text;
  heading.lang = options.lang ?? 'en';
  heading.setAttribute('lang', options.lang ?? 'en');
  heading.tabIndex = 0;
  heading.setAttribute('translate', 'yes');
  heading.setAttribute('aria-label', options.label ?? options.text);
  heading.dataset.wduShaderText = 'dom-authority';
  heading.style.cssText = 'user-select:text;-webkit-user-select:text;position:relative;z-index:1;';
  heading.style.userSelect = 'text';
  heading.style.webkitUserSelect = 'text';
  heading.style.position = 'relative';
  heading.style.zIndex = '1';

  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('inert', '');
  canvas.dataset.wduCanvasDecorative = 'true';
  canvas.style.pointerEvents = 'none';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.setAttribute('role', 'presentation');

  const overlay = document.createElement('span');
  overlay.style.position = 'relative';
  overlay.style.display = 'inline-block';
  overlay.append(heading, canvas);
  mount.appendChild(overlay);

  const state: { -readonly [K in keyof ShaderTextDomState]: ShaderTextDomState[K] } = {
    pointerInside: false,
    focused: false,
    activated: false,
    pulseAge: 0,
    pulseDuration: 0.4,
    layoutRevision: 0,
    eventSeed: 1,
    elapsedSeconds: 0,
    reducedMotion: false,
  };

  const listeners: Array<[keyof HTMLElementEventMap, EventListener]> = [];
  const listen = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void): void => {
    const listener = handler as EventListener;
    heading.addEventListener(type, listener);
    listeners.push([type, listener]);
  };
  listen('pointerenter', () => { state.pointerInside = true; });
  listen('pointerleave', () => { state.pointerInside = false; });
  listen('focus', () => { state.focused = true; });
  listen('blur', () => { state.focused = false; });
  listen('click', () => { state.activated = true; state.pulseAge = 0; });
  listen('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      state.activated = true;
      state.pulseAge = 0;
    }
  });

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver(() => { state.layoutRevision += 1; });
  resizeObserver?.observe(heading);

  return {
    element: heading,
    canvas,
    readState: () => ({ ...state }),
    setLanguage(language: string): void {
      heading.lang = language;
      heading.setAttribute('lang', language);
      if (language !== (options.lang ?? 'en') && options.translatedText) {
        heading.textContent = options.translatedText;
      } else {
        heading.textContent = options.text;
      }
      state.layoutRevision += 1;
    },
    dispose(): void {
      for (const [type, listener] of listeners) heading.removeEventListener(type, listener);
      resizeObserver?.disconnect();
      overlay.remove();
    },
  };
}
