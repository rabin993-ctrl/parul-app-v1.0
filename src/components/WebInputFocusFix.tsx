import { useEffect } from 'react';
import { Platform } from 'react-native';

const STYLE_ID = 'paw-web-input-focus-reset-v3';
const VIEWPORT_META_SELECTOR = 'meta[name="viewport"]';

function ensureMobileWebViewportMeta() {
  if (typeof document === 'undefined') return;

  let meta = document.querySelector(VIEWPORT_META_SELECTOR) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }

  const required = [
    'width=device-width',
    'initial-scale=1',
    'viewport-fit=cover',
    'interactive-widget=resizes-content',
  ];
  const parts = new Set(
    (meta.content || 'width=device-width, initial-scale=1')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .filter(part => !part.startsWith('shrink-to-fit')),
  );
  for (const token of required) parts.add(token);
  meta.content = [...parts].join(', ');
}

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Mobile Safari often ignores the first tap when a scroll container or modal
 * ancestor handles touch in the capture phase. Stop the event from reaching
 * RN-web's ScrollView responder so the field receives focus from the *native*
 * tap.
 *
 * IMPORTANT: do NOT call target.focus() during `touchstart` on iOS. Focusing a
 * field mid-tap makes Safari toggle the freshly-opened keyboard right back off —
 * the keyboard "blinks" open then dismisses (regression seen on the sign-in
 * fields, iOS only). The native tap focuses the field on its own once the
 * ScrollView responder is out of the way. We only focus eagerly for mouse
 * (desktop), where it's harmless and the natural focus is reliable.
 */
function handleFieldTouch(e: Event) {
  const target = e.target;
  if (!isTextField(target)) return;
  e.stopPropagation();
  if (e.type === 'mousedown' && document.activeElement !== target) {
    target.focus({ preventScroll: true });
  }
}

export function WebInputFocusFix() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    ensureMobileWebViewportMeta();

    document.addEventListener('touchstart', handleFieldTouch, true);
    document.addEventListener('mousedown', handleFieldTouch, true);

    if (document.getElementById(STYLE_ID)) {
      return () => {
        document.removeEventListener('touchstart', handleFieldTouch, true);
        document.removeEventListener('mousedown', handleFieldTouch, true);
      };
    }

    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      html, body, #root {
        max-width: 100%;
        overflow-x: clip;
      }
      textarea:focus,
      input:focus,
      textarea:focus-visible,
      input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
      @supports (-webkit-touch-callout: none) {
        textarea, input, select {
          font-size: 16px !important;
        }
      }
      /*
       * RN-Web puts -webkit-user-select:none on Views (incl. ScrollView content
       * containers). On iOS Safari that inherits into descendant inputs and makes
       * them non-editable — tapping focuses nothing and the keyboard never opens.
       * Force every form control back to selectable/editable + tap-friendly touch
       * handling. Also reset ancestors inside modals/sheets so inheritance breaks.
       */
      [role="dialog"] input,
      [role="dialog"] textarea,
      [role="dialog"] select,
      div[aria-modal="true"] input,
      div[aria-modal="true"] textarea,
      div[aria-modal="true"] select,
      [data-sheet-scroll-body="true"] input,
      [data-sheet-scroll-body="true"] textarea,
      [data-sheet-scroll-body="true"] select,
      input, textarea, select {
        -webkit-user-select: text !important;
        user-select: text !important;
        touch-action: manipulation !important;
        -webkit-touch-callout: default;
        pointer-events: auto !important;
      }
      [data-sheet-scroll-body="true"] {
        -webkit-user-select: auto !important;
        user-select: auto !important;
        touch-action: auto !important;
      }
      div[aria-modal="true"] {
        background-color: transparent !important;
      }
      [data-mention-scroll="true"]::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
      [data-sheet-body-dimmed="true"]::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
    `;
    document.head.appendChild(el);

    return () => {
      document.removeEventListener('touchstart', handleFieldTouch, true);
      document.removeEventListener('mousedown', handleFieldTouch, true);
    };
  }, []);

  return null;
}
