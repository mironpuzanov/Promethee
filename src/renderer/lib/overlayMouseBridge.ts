/**
 * Mouse passthrough uses real hit-testing: pointer position + elementFromPoint.
 * Ref-counting mouseenter/leave was losing sync and stuck the full-screen overlay
 * in "eat all clicks" or the opposite.
 *
 * Dragging (task pill / mentor bubble) temporarily forces capture so sync doesn’t
 * release mid-gesture when the cursor leaves the small target.
 */

let lastX = -1;
let lastY = -1;
let lastPassthrough: boolean | null = null;
let suppressHitTest = 0;

const HIT_SEL = '.promethee-mouse-target';

function isOverInteractive(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return false;
  return el.closest(HIT_SEL) != null;
}

function applyPassthrough(wantPassthrough: boolean) {
  if (lastPassthrough === wantPassthrough) return;
  lastPassthrough = wantPassthrough;
  window.promethee.window.setIgnoreMouseEvents(wantPassthrough);
}

function syncPointerPosition(clientX: number, clientY: number) {
  lastX = clientX;
  lastY = clientY;
  if (suppressHitTest > 0) {
    applyPassthrough(false);
    return;
  }
  applyPassthrough(!isOverInteractive(clientX, clientY));
}

/** Call while dragging overlay UI so hit-test isn’t wrong outside the pill. */
export function overlaySuppressHitTest(delta: number) {
  suppressHitTest = Math.max(0, suppressHitTest + delta);
  if (suppressHitTest > 0) {
    lastPassthrough = null;
    applyPassthrough(false);
    return;
  }
  lastPassthrough = null;
  if (lastX >= 0 && lastY >= 0) {
    syncPointerPosition(lastX, lastY);
  } else {
    applyPassthrough(true);
  }
}

export function overlayRestoreClickThrough() {
  lastPassthrough = null;
  if (suppressHitTest > 0) return;
  if (lastX >= 0 && lastY >= 0) {
    syncPointerPosition(lastX, lastY);
  } else {
    applyPassthrough(true);
  }
}

/** Session boundary: reset drag suppression and baseline to passthrough. */
export function overlaySetFocusSessionActive(_active: boolean) {
  suppressHitTest = 0;
  lastPassthrough = null;
  lastX = -1;
  lastY = -1;
  window.promethee.window.setIgnoreMouseEvents(true);
}

/** Legacy no-ops — pointer sync replaces ref-count enter/leave. */
export function overlayPointerInteractiveEnter() {}
export function overlayPointerInteractiveLeave() {}

export function overlayPointerReset() {
  overlayRestoreClickThrough();
}

export function overlayInstallPointerSync(): () => void {
  const onMove = (e: PointerEvent) => {
    syncPointerPosition(e.clientX, e.clientY);
  };
  const onDown = (e: PointerEvent) => {
    syncPointerPosition(e.clientX, e.clientY);
  };
  const onBlur = () => {
    if (suppressHitTest > 0) return;
    lastPassthrough = null;
    applyPassthrough(true);
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointermove', onMove, opts);
  window.addEventListener('pointerdown', onDown, opts);
  window.addEventListener('blur', onBlur);
  applyPassthrough(true);
  return () => {
    window.removeEventListener('pointermove', onMove, opts);
    window.removeEventListener('pointerdown', onDown, opts);
    window.removeEventListener('blur', onBlur);
  };
}
