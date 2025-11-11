import * as DOM from './dom.js';
import * as Net from './networking.js';
import * as State from './appState.js';
import { getVideoButton, hideAndDisableButton, enableAllVideoButtons } from './helper/domHelpers.js';
import { initializeButtonStatus, checkAllVideosSentAndReset, clearInactivityTimer, startInactivityTimer, handleVideoCommandError } from './helper/sessionLogic.js';
import { handlePasswordResult, submitPassword, setTarget, setTargetAndTest } from './helper/authAndConfig.js';
import { setupEventListeners } from './helper/eventHandlers.js';

// Destructure common state and constants for cleaner access
const { HOLDING_VIDEO_ID } = State;

// Expose setupEventListeners for main.js bootstrap
export { setupEventListeners };

// ---------- Server Message Handling ----------

// --------------------
// Detector helper (handles numbers, bigints, numeric strings)
// --------------------
function coerceToNumber(val) {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'string') {
        const trimmed = val.endsWith('n') ? val.slice(0, -1) : val;
        const n = parseFloat(trimmed);
        if (!Number.isNaN(n)) return n;
    }
    return null;
}

/**
 * Detects the specific "/@3/1000" end-of-video message format:
 * args example: [3, "Autoplay", 3, 1, ...]
 * - returns { matched: true, index: <videoIndex> } when:
 *    - address === '/@3/1000'
 *    - fourth arg (args[3]) coerces to 1
 *    - third arg (args[2]) coerces to 1|2|3
 * - otherwise returns { matched: false, index: null }
 */
function detectEndOfVideo(data) {
    if (!data || typeof data.address !== 'string') return { matched: false, index: null };
    if (data.address !== '/@3/1000') return { matched: false, index: null };

    const args = Array.isArray(data.args) ? data.args : [];

    if (args.length < 4) return { matched: false, index: null };

    const thirdRaw = args[2];
    const fourthRaw = args[3];

    const third = coerceToNumber(thirdRaw);
    const fourth = coerceToNumber(fourthRaw);

    if (third === null || fourth === null) return { matched: false, index: null };

    if (Math.abs(fourth - 1) > 1e-9) return { matched: false, index: null };

    const intThird = Math.round(third);
    if (![1,2,3].includes(intThird)) return { matched: false, index: null };

    return { matched: true, index: intThird };
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'target_set':
            Net.lastKnownTarget.host = data.host;
            Net.lastKnownTarget.port = data.port;
            // Update UI placeholders and config status
            DOM.hostInput.placeholder = Net.lastKnownTarget.host;
            DOM.portInput.placeholder = Net.lastKnownTarget.port; 
            Net.updateConfigStatus();
            break;

        case 'password_result':
            handlePasswordResult(Boolean(data.success));
            break;

        case 'sent':
            // Watch for /@3/20 ["Video", N] messages and update main UI state
            if (data.address === '/@3/20' && Array.isArray(data.args) && data.args.length >= 2 && data.args[0] === 'Autoplay') {
                const videoNum = parseInt(data.args[1], 10);
                if (Number.isInteger(videoNum) && videoNum >= HOLDING_VIDEO_ID) { 
                    State.setCurrentVideoId(videoNum);
                    Net.updateMainStatus(State.currentVideoId);
                    
                    if (videoNum !== HOLDING_VIDEO_ID) {
                        checkAllVideosSentAndReset();
                    }
                }
            }
            Net.updateConfigStatus(`Sent ${data.address} ${JSON.stringify(data.args)}`);
            break;

        case 'error':
            // Show error in the active status area and try to re-enable button
            DOM.getActiveStatusEl().textContent = `Error: ${data.message}`;
            handleVideoCommandError();
            break;

        case 'osc': {
            // Every forwarded OSC message hits this branch.
            const endInfo = detectEndOfVideo(data);
            if (endInfo.matched) {
                console.log('Detected end-of-video OSC:', data, ' -> videoIndex:', endInfo.index);

                // Only act if not already in holding state
                if (State.currentVideoId !== HOLDING_VIDEO_ID) {
                    // Optionally record which video ended (temporary)
                    if (typeof endInfo.index === 'number') {
                        State.setCurrentVideoId(endInfo.index);
                    }

                    try {
                        setTimeout(() => {
                            sendHolding();
                        }, 500) // <---- VERY IMPORTANT. IF INSTANTLY SENT, THEN NO WORK. KEEP AROUND 500-1000
                    } catch (err) {
                        console.error('Error while sending holding from OSC handler:', err);
                        handleVideoCommandError();
                    }
                } else {
                    console.log('Already in holding state; ignoring end-of-video event.');
                }
            } else {
                // ignored OSC messages arrive here; you can enable debug if needed
                // console.log('OSC message (ignored):', data.address, data.args);
            }
            break;
        }

        default:
            // ignore unknown types
            break;
    }
}

// Attach the handler to the networking module
Net.setOnMessageCallback(handleServerMessage);

// ---------- OSC / UI actions (Unchanged) ----------

// Re-export Auth/Config methods to maintain a flat API for main.js
export { submitPassword, setTarget, setTargetAndTest };


export function send(n) {
    // Disable only the specific button pressed
    const button = getVideoButton(n);
    if (button) {
        hideAndDisableButton(button);
    }

    // --- TRACK BUTTON PRESS ---
    const buttonKey = button.getAttribute('value');
    if (State.buttonStatus.hasOwnProperty(buttonKey)) {
        State.buttonStatus[buttonKey] = true;
    }

    console.log("buttonKey: ", buttonKey);
    // --------------------------
    
    // Update local state for error recovery and send command
    State.setCurrentVideoId(n);

    // Prevent the leftover inactivity timer from expiring while a new video plays.
    // Clearing it here avoids going to Step 3 mid-play; sendHolding() will restart it later.
    clearInactivityTimer();

    Net.sendVideoCommand(n, buttonKey);
}

export function sendHolding() {
    // Update local state for error recovery
    State.setCurrentVideoId(HOLDING_VIDEO_ID);
    Net.sendVideoCommand(HOLDING_VIDEO_ID);

    // Start the inactivity timer with ONLY LEFTOVER_TIMEOUT_MS — this guarantees
    // the primary timer that transitions to Step 3 runs only after holding is sent.
    try {
        startInactivityTimer(State.LEFTOVER_TIMEOUT_MS);
    } catch (err) {
        console.error('Failed to start inactivity timer after sendHolding():', err);
    }
}

// ---------- NEW MODULAR PHONE VALIDATION FUNCTION (CORRECTED) ----------

/**
 * Validates and sanitizes a phone number.
 * Accepts examples like:
 *   +971 50 218 0463
 *   +971502180463
 *   0502180463
 *
 * Rejects:
 *   multiple plus signs, consecutive spaces, letters/symbols, plus not at start, etc.
 *
 * @param {string} phone - The raw phone number string (already trimmed).
 * @returns {string|null} The sanitized phone number string (e.g. '+971502180463' or '0502180463') if valid, otherwise null.
 */
function validateAndSanitizePhone(phone) {
    if (!phone) return null;

    // normalize some unicode spaces (NBSP) to normal space, then trim
    phone = phone.replace(/\u00A0/g, ' ').trim();

    // Count plus signs — allow at most one and only at the start
    const plusCount = (phone.match(/\+/g) || []).length;
    if (plusCount > 1) return null;
    if (plusCount === 1 && phone.charAt(0) !== '+') return null;

    // Only allow digits, spaces and an optional leading plus
    // (since we've enforced plus being at index 0 above, this is safe)
    if (!/^\+?[0-9 ]+$/.test(phone)) return null;

    // Reject consecutive spaces (e.g. "50  218")
    if (/\s{2,}/.test(phone)) return null;

    // If there's a leading plus it must be immediately followed by a digit
    if (phone.startsWith('+') && !/^\+\d/.test(phone)) return null;

    // Strip all non-digit characters to compute digit-only length
    const digitsOnly = phone.replace(/\D/g, '');

    // Require a plausible digit length (adjust min/max as you like)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) return null;

    // Return normalized value: keep leading + if present
    return (phone.startsWith('+') ? '+' : '') + digitsOnly;
}

// ---------- Lead form logic (Step 1 to Step 2 transition) ----------

export function submitLeadForm(skip_validation = false) {
    const name = DOM.nameInputEl.value.trim();
    const nationality = DOM.nationalityInputEl.value.trim();
    const email = DOM.emailInputEl.value.trim();
    const phone = DOM.phoneInputEl.value.trim();

    if (!skip_validation)
    {
        // Basic validation
        // NOTE: This check ensures that the input fields have *some* content (even spaces)
        // The phone validation below handles if the content is only invalid separators.
        if (name.length === 0 || nationality.length === 0 || email.length === 0 || phone.length === 0) {
            DOM.showStatus(DOM.leadStatusEl, 'Please enter all the fields', 2000);
            return;
        }

        // Simple email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            DOM.showStatus(DOM.leadStatusEl, 'Please enter a valid email address', 2000);
            return;
        }

        // -----------------------------------------------------
        // Phone number validity check using the new modular function
        const sanitizedPhone = validateAndSanitizePhone(phone);
        
        if (!sanitizedPhone) {
            // This will catch numbers that are only separators or have invalid characters/length.
            DOM.showStatus(DOM.leadStatusEl, 'Please enter a valid mobile number (e.g. +97150... or 050...)', 2000);
            return;
        }
        // -----------------------------------------------------
        
        // --------------------------------------------
        // --- CAPTURE DATA AND DYNAMICALLY INITIALIZE BUTTON STATUS ---
        State.setCapturedLeadData({ name, nationality, email, phone: sanitizedPhone }); // Use the sanitized phone number
    }
    State.setButtonStatus(initializeButtonStatus());

    // Success message before transition
    // DOM.leadStatusEl.textContent = 'Details captured. Accessing controls...';
    // DOM.leadStatusEl.classList.remove('hidden');

    // Transition to step 2 (video controls) after a brief moment
    setTimeout(() => {
        showMainContent(); // Use local function for navigation
        // DOM.leadStatusEl.classList.add('hidden'); // Clear status after transition

        DOM.hideStatusImmediately(DOM.leadStatusEl);
    }, 100);
}


// ---------- Navigation Functions (Unchanged) ----------

export function showMainContent() {
    // clearPasswordTimeout is handled within authAndConfig and showStartScreen
    DOM.showMainContent();
    Net.updateMainStatus(State.currentVideoId);
    enableAllVideoButtons(); 
    startInactivityTimer(State.LEFTOVER_TIMEOUT_MS); // <--- START TIMER WHEN ENTERING STEP 2
};

export function showStartScreen() {
    // clearPasswordTimeout is handled within authAndConfig
    clearInactivityTimer(); // <--- Use the dedicated clear function
    DOM.showStartScreen();
    // Clear lead form inputs when returning to Step 1
    if (DOM.nameInputEl) DOM.nameInputEl.value = '';
    if (DOM.emailInputEl) DOM.emailInputEl.value = '';
};


// ---------- Initialization (Unchanged) ----------

export function initApp() {
    DOM.showStartScreen();
    Net.updateConfigStatus();
    Net.populateCurrentTargetFromServer();
}