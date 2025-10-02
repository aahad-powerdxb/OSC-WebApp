// eventHandlers.js
import * as DOM from '../dom.js';
import * as State from '../appState.js';
import { showPasswordWallWithTimeout, setTarget, submitPassword } from './authAndConfig.js';
import { submitLeadForm } from '../appLogic.js'; // Call main logic entry points

const { TAP_THRESHOLD, TAP_TIME_LIMIT } = State;

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
}
