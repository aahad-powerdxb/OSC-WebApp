// dom.js

// ---------- Cached DOM Elements ----------
export const statusEl = document.getElementById('status');
export const hostInput = document.getElementById('hostInput');
export const portInput = document.getElementById('portInput');
export const setTargetBtn = document.getElementById('setTargetBtn');
export const setTargetTestBtn = document.getElementById('setTargetTestBtn');

// Primary containers
export const mainContentEl = document.getElementById('mainContent');
export const configFormContainerEl = document.getElementById('configFormContainer');
export const passwordWallContainerEl = document.getElementById('passwordWallContainer');
export const tapTargetEl = document.getElementById('tapTarget');
export const skipLeadFormEl = document.getElementById('skipLeadForm');

// Status areas
export const configStatusEl = document.getElementById('configStatus');
export const passwordStatusEl = document.getElementById('passwordStatus');
export const leadStatusEl = document.getElementById('leadStatus');

// Form elements (Lead Form Step 1)
export const nameInputEl = document.getElementById('nameInput');
export const nationalityInputEl = document.getElementById('nationalityInput');
export const emailInputEl = document.getElementById('emailInput');
export const phoneInputEl = document.getElementById('phoneInput');
export const passwordInputEl = document.getElementById('passwordInput');

// Multi-step form elements
export const formStep1El = document.getElementById('formStep1');
export const formStep2El = document.getElementById('formStep2');
export const formStep3El = document.getElementById('formStep3');
export const controllerTitleEl = document.getElementById('controllerTitle');
// export const leadInstructionsEl = document.getElementById('leadInstructions');


// ---------- UI Utilities and Navigation Functions ----------

/**
 * Shows the status of a given page for a brief period of time at the top of the screen.
 * @param {string} message - The message to display.
 * @param {number} [duration=3500] - Duration in milliseconds to show the message.
 */

export function showStatus(statusElement, message, duration = 3500) {

  if (!statusElement) return;
  // Reset previous timers/animations
  if (statusElement._leadHideTimeout) {
    clearTimeout(statusElement._leadHideTimeout);
    statusElement._leadHideTimeout = null;
  }
  statusElement.textContent = message;
  statusElement.classList.remove('hidden', 'hide');
  statusElement.classList.add('floating', 'show');
  statusElement.setAttribute('role', 'status');
  statusElement.setAttribute('aria-live', 'polite');
  // Auto-hide
  statusElement._leadHideTimeout = setTimeout(() => {
    // start hide animation
    statusElement.classList.remove('show');
    statusElement.classList.add('hide');
    // after animation, fully hide
    statusElement._leadHideTimeout = setTimeout(() => {
      statusElement.classList.remove('floating', 'hide');
      statusElement.classList.add('hidden');
      statusElement._leadHideTimeout = null;
    }, 220);
  }, duration);
}

/**
 * Immediately hides the status element, cancelling any ongoing timers.
 */
export function hideStatusImmediately(statusElement) {
  if (!statusElement) return;
  if (statusElement._leadHideTimeout)
    {
        clearTimeout(statusElement._leadHideTimeout);
        statusElement._leadHideTimeout = null;
    }
  statusElement.classList.remove('floating', 'show', 'hide');
  statusElement.classList.add('hidden');
}

/**
 * Hides all main application views (Password Wall, Config Form).
 */
function hideOtherScreens() {
    if (passwordWallContainerEl) passwordWallContainerEl.classList.add('hidden');
    if (configFormContainerEl) configFormContainerEl.classList.add('hidden');
}

/**
 * Hides all internal form steps (1, 2, 3) and ensures main content is visible.
 */
function hideAllFormSteps() {
    if (formStep1El) formStep1El.classList.add('hidden');
    if (formStep2El) formStep2El.classList.add('hidden');
    if (formStep3El) formStep3El.classList.add('hidden');
    if (mainContentEl) mainContentEl.classList.remove('hidden');
}

/**
 * Returns the currently visible status element (config or main).
 * @returns {HTMLElement}
 */
export function getActiveStatusEl() {
    return configFormContainerEl && !configFormContainerEl.classList.contains('hidden') ? configStatusEl : statusEl;
}

/**
 * Set the controller title with optional Arabic + English lines.
 * - If `arabic` is provided, it will be rendered above the English line.
 * - If `arabic` is empty/null, the english text will be used as a single centered line.
 *
 * Usage:
 *   setControllerTitle("English text", "Arabic text");
 *   setControllerTitle("English only");
 */
export function setControllerTitle(english, arabic = '') {
  if (!controllerTitleEl) return;

  // sanitize (simple) — ensure strings
  const en = english ? String(english) : '';
  const ar = arabic ? String(arabic) : '';

  if (ar.trim()) {
    // bilingual stacked layout
    controllerTitleEl.classList.remove('single-line');
    controllerTitleEl.innerHTML = `
      <span class="title-ar" aria-hidden="false">${ar}</span>
      <span class="title-en">${en}</span>
    `;
    // ARIA label for screen readers: combine both (English primary or you may localize)
    controllerTitleEl.setAttribute('aria-label', `${en} — ${ar}`);
  } else {
    // only english line (single-line fallback)
    controllerTitleEl.classList.add('single-line');
    controllerTitleEl.textContent = en;
    controllerTitleEl.setAttribute('aria-label', en);
  }
}

/**
 * Shows the initial lead form step (Step 1).
 * @param {function} [onShow] - Optional callback function to execute after showing.
 */
export function showStartScreen(onShow) {
    hideOtherScreens();
    hideAllFormSteps(); 

    // Show Step 1
    if (formStep1El) formStep1El.classList.remove('hidden');
    
    // Clear form fields to prevent showing old data
    if (nameInputEl) nameInputEl.value = '';
    if (nationalityInputEl) nationalityInputEl.value = '';
    if (emailInputEl) emailInputEl.value = '';
    if (phoneInputEl) phoneInputEl.value = '';

    if (controllerTitleEl) controllerTitleEl.classList.remove('hidden');
    setControllerTitle('What if this was your everyday?', 'ﻣﺎذا ﻟﻮ ﻛﺎن ﻫﺬا ﻋﺎﻟﻤﻚ ﻛﻞ ﻳﻮم؟');
    if (leadStatusEl) leadStatusEl.classList.add('hidden');

    if (nameInputEl) nameInputEl.focus();
    if (onShow) onShow();
}

/**
 * Transitions from Step 1 (Lead Form) to the main controller view (Step 2/Video Controls).
 */
export function showMainContent() {
    hideOtherScreens();
    hideAllFormSteps(); 

    // Show Step 2
    if (formStep2El) formStep2El.classList.remove('hidden');

    // Update main card text
    if (controllerTitleEl) controllerTitleEl.classList.remove('hidden');
    // if (controllerTitleEl) controllerTitleEl.textContent = 'Experience a day through the eyes of';
    setControllerTitle('Experience a day through the eyes of', 'ﻛﻤﺎ أرى');
}

/**
 * Transitions from Step 2 (Video Controls) to the 'Thank You' screen (Step 3).
 * This step is temporary before resetting to Step 1.
 */
export function showStep3() {
    hideOtherScreens();
    hideAllFormSteps();

    // Show Step 3
    if (formStep3El) formStep3El.classList.remove('hidden');
    
    // Update main card text for the 'Thank You' screen
    if (controllerTitleEl) controllerTitleEl.classList.add('hidden');
    if (controllerTitleEl) controllerTitleEl.textContent = '';
    // if (leadInstructionsEl) leadInstructionsEl.classList.add('hidden');
}


/**
 * Shows the password wall for accessing configuration.
 * @param {function} [onShow] - Callback to run after showing.
 */
export function showPasswordWall(onShow) {
    if (!passwordWallContainerEl.classList.contains('hidden')) return;

    // Hide main content *and* show password wall
    if (mainContentEl) mainContentEl.classList.add('hidden');
    if (configFormContainerEl) configFormContainerEl.classList.add('hidden');
    if (passwordWallContainerEl) passwordWallContainerEl.classList.remove('hidden');
    if (passwordInputEl) passwordInputEl.focus();
    if (passwordStatusEl) passwordStatusEl.textContent = '';

    if (onShow) onShow();
}

/**
 * Shows the configuration form.
 */
export function showConfigForm() {
    if (mainContentEl) mainContentEl.classList.add('hidden'); // Hide the main controller flow
    if (passwordWallContainerEl) passwordWallContainerEl.classList.add('hidden');
    if (configFormContainerEl) configFormContainerEl.classList.remove('hidden');
    if (passwordInputEl) passwordInputEl.value = '';
    if (passwordStatusEl) passwordStatusEl.textContent = '';
}
