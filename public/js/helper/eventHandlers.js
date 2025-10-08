// eventHandlers.js
import * as DOM from '../dom.js';
import * as State from '../appState.js';
import { showPasswordWallWithTimeout, setTarget, submitPassword } from './authAndConfig.js';
import { submitLeadForm } from '../appLogic.js'; // Call main logic entry points

const { TAP_THRESHOLD, TAP_TIME_LIMIT } = State;

// --- KIOSK KEY LOCKING / UNLOCKING ---
// Place at module scope (directly after the imports / consts)
let _unlockMode = false;
let _unlockTimerId = null;
const UNLOCK_DURATION_MS = 10_000; // how long unlock stays active after ctrl+alt+shift+O

function setUnlockMode(on) {
  _unlockMode = !!on;
  if (_unlockTimerId) {
    clearTimeout(_unlockTimerId);
    _unlockTimerId = null;
  }
  if (_unlockMode) {
    if (typeof DOM !== 'undefined' && DOM.showStatus && DOM.statusEl) {
      DOM.showStatus(DOM.statusEl, 'Keyboard unlocked (10s)', 2000);
    }
    _unlockTimerId = setTimeout(() => {
      _unlockMode = false;
      _unlockTimerId = null;
      if (typeof DOM !== 'undefined' && DOM.showStatus && DOM.statusEl) {
        DOM.showStatus(DOM.statusEl, 'Keyboard locked', 1500);
      }
    }, UNLOCK_DURATION_MS);
  } else {
    if (typeof DOM !== 'undefined' && DOM.showStatus && DOM.statusEl) {
      DOM.showStatus(DOM.statusEl, 'Keyboard locked', 1500);
    }
  }
}

function isTypingTarget(ev) {
  const t = ev.target;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (t.isContentEditable) return true;
  return false;
}

const protectedCombos = [
  { test: ev => ev.key === 'F5', label: 'Refresh (F5)' },
  { test: ev => (ev.ctrlKey && !ev.metaKey) && (ev.key === 'r' || ev.key === 'R'), label: 'Refresh (Ctrl+R)' },
  { test: ev => (ev.ctrlKey && !ev.metaKey) && (ev.key === 'w' || ev.key === 'W'), label: 'Close Tab (Ctrl+W)' },
  { test: ev => (ev.ctrlKey && !ev.metaKey) && (ev.key === 'q' || ev.key === 'Q'), label: 'Quit (Ctrl+Q)' },
  { test: ev => (ev.ctrlKey && ev.shiftKey) && (ev.key === 'r' || ev.key === 'R'), label: 'Hard Refresh (Ctrl+Shift+R)' },
  { test: ev => (ev.ctrlKey && !ev.metaKey) && (ev.key === 'p' || ev.key === 'P'), label: 'Print (Ctrl+P)' },
  { test: ev => ev.key === 'F11', label: 'Fullscreen toggle (F11)' },
  { test: ev => ev.altKey && (ev.key === 'F4' || ev.key === 'f4'), label: 'Close Window (Alt+F4) — may be blocked by OS' },
  { test: ev => ev.metaKey && (ev.key === 'd' || ev.key === 'D'), label: 'Show Desktop (Win+D) — may be blocked by OS' },
  { test: ev => ev.metaKey && (ev.key === 'ArrowDown' || ev.key === 'Down'), label: 'Win+Down — may be blocked by OS' },
];

function globalKeydownHandler(ev) {
  try {
    if (ev.ctrlKey && ev.altKey && ev.shiftKey && (ev.key === 'o' || ev.key === 'O')) {
      setUnlockMode(true);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (isTypingTarget(ev)) return;
    if (_unlockMode) return;

    for (const item of protectedCombos) {
      if (item.test(ev)) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof DOM !== 'undefined' && DOM.showStatus && DOM.statusEl) {
          DOM.showStatus(DOM.statusEl, `Blocked: ${item.label}`, 1500);
        }
        return;
      }
    }
  } catch (err) {
    console.error('globalKeydownHandler error', err);
  }
}

/**
 * Compute the "active" image path from the given src.
 * - If src contains "icons-" it replaces it with "icons_active-"
 * - Otherwise inserts "_active" before the file extension.
 */
function computeActiveSrc(src) {
  if (!src) return src;
  try {
    // Preserve query string if present
    const parts = src.split('?');
    const path = parts[0];
    const qs = parts[1] ? '?' + parts.slice(1).join('?') : '';

    if (path.includes('icons-')) {
      return path.replace('icons-', 'icons_active-') + qs;
    }

    // fallback: insert _active before extension
    const dot = path.lastIndexOf('.');
    if (dot === -1) return path + '_active' + qs;
    return path.slice(0, dot) + '_active' + path.slice(dot) + qs;
  } catch (err) {
    return src;
  }
}

/**
 * Wire up hover / focus / touch handlers to swap button images.
 * Call this once during initialization (from setupEventListeners()).
 */
function setupIconHoverSwaps() {
  const buttons = document.querySelectorAll('.buttons-row button');

  buttons.forEach((btn) => {
    const img = btn.querySelector('img');
    if (!img) return;

    // store original & compute active
    const orig = img.getAttribute('src');
    const active = computeActiveSrc(orig);

    // store on dataset for later use
    img.dataset.origSrc = orig;
    img.dataset.activeSrc = active;

    // preload active image to avoid flicker
    if (active && active !== orig) {
      const pre = new Image();
      pre.src = active;
    }

    // helper to set src safely
    const setActive = () => {
      if (img.dataset.activeSrc) img.src = img.dataset.activeSrc;
    };
    const setOrig = () => {
      if (img.dataset.origSrc) img.src = img.dataset.origSrc;
    };

    // Mouse events
    btn.addEventListener('mouseenter', setActive, { passive: true });
    btn.addEventListener('mouseleave', setOrig, { passive: true });

    // Keyboard focus/blur (accessibility)
    btn.addEventListener('focus', setActive);
    btn.addEventListener('blur', setOrig);

    // Touch: touchstart => active. On touchend/touchcancel restore (use small timeout so quick taps still show active)
    btn.addEventListener('touchstart', (e) => {
      setActive();
      // don't prevent default — allow click to fire
    }, { passive: true });

    btn.addEventListener('touchend', () => {
      // delay restore slightly to show active state on quick tap
      setTimeout(setOrig, 120);
    }, { passive: true });

    btn.addEventListener('touchcancel', setOrig, { passive: true });
  });
}

/**
 * Sets up all global and form-related event listeners.
 */
export function setupEventListeners() {
    // --- Secret tap logic ---
    DOM.tapTargetEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        let currentTapCount = State.tapCount;

        if (now - State.lastTapTime < TAP_TIME_LIMIT) {
            currentTapCount++;
        } else {
            currentTapCount = 1;
        }
        State.setLastTapTime(now);
        State.setTapCount(currentTapCount);


        if (currentTapCount >= TAP_THRESHOLD) {
            showPasswordWallWithTimeout();
            State.setTapCount(0);
        }
    });

    // --- Skip Lead Form ---
    DOM.skipLeadFormEl.addEventListener('click', (e) => {
        e.stopPropagation();
        submitLeadForm(true);
    });

    // --- Target Form Enter handler (Configuration) ---
    const targetForm = document.getElementById('targetForm');
    if (targetForm) {
      targetForm.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              setTarget();
          }
      });
    }

    // --- Password Form Enter handler ---
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              submitPassword();
          }
      });
    }

    // --- Lead Form Enter handler (Step 1) ---
    const leadForm = document.getElementById('leadForm');
    if (leadForm) {
      leadForm.addEventListener('keydown', (e) => {
          // Prevent submission on Enter if Step 1 is visible
          if (e.key === 'Enter' && DOM.formStep1El && !DOM.formStep1El.classList.contains('hidden')) {
               e.preventDefault();
               submitLeadForm(); // Call exported function from appLogic
          }
          // Also prevent default enter key on video controls screen (Step 2)
          if (e.key === 'Enter' && DOM.formStep2El && !DOM.formStep2El.classList.contains('hidden')) {
              e.preventDefault();
          }
      });
    }

    // --- ICON HOVER / TOUCH SWAPS ---
    // Wire up icon swapping for current buttons.
    // If you dynamically add/remove buttons later, call setupIconHoverSwaps() again.
    setupIconHoverSwaps();

    // --- GLOBAL KEYDOWN (capture) to protect kiosk keys ---
    // Use capture: true to get events earlier in the chain.
    document.addEventListener('keydown', globalKeydownHandler, { capture: true, passive: false });
}
