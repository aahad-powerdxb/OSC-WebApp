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

// Status areas
export const configStatusEl = document.getElementById('configStatus');
export const passwordStatusEl = document.getElementById('passwordStatus');
export const leadStatusEl = document.getElementById('leadStatus');

// Form elements (Lead Form Step 1)
export const nameInputEl = document.getElementById('nameInput');
export const emailInputEl = document.getElementById('emailInput');
export const passwordInputEl = document.getElementById('passwordInput');

// Multi-step form elements
export const formStep1El = document.getElementById('formStep1');
export const formStep2El = document.getElementById('formStep2');
export const formStep3El = document.getElementById('formStep3');
export const controllerTitleEl = document.getElementById('controllerTitle');
export const leadInstructionsEl = document.getElementById('leadInstructions');


// ---------- UI Utilities and Navigation Functions ----------

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
 * Shows the initial lead form step (Step 1).
 * @param {function} [onShow] - Optional callback function to execute after showing.
 */
export function showStartScreen(onShow) {
    hideOtherScreens();
    hideAllFormSteps(); 

    // Show Step 1
    if (formStep1El) formStep1El.classList.remove('hidden');
    
    // // Clear form fields to prevent showing old data
    if (nameInputEl) nameInputEl.value = '';
    if (emailInputEl) emailInputEl.value = '';

    if (controllerTitleEl) controllerTitleEl.textContent = 'Welcome to the Controller';
    if (leadInstructionsEl) leadInstructionsEl.textContent = 'Please enter your details to proceed to the video controls.';
    if (leadInstructionsEl) leadInstructionsEl.classList.remove('hidden');
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
    if (controllerTitleEl) controllerTitleEl.textContent = 'Select Video';
    if (leadInstructionsEl) leadInstructionsEl.classList.add('hidden');
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
    if (controllerTitleEl) controllerTitleEl.textContent = 'Session Complete';
    if (leadInstructionsEl) leadInstructionsEl.classList.add('hidden');
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
