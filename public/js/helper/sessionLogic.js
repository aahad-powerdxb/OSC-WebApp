// helper/sessionLogic.js
import * as DOM from '../dom.js';
import * as Net from '../networking.js';
import * as State from '../appState.js';
import { getVideoButton } from './domHelpers.js';

// NOTE: Do not destructure INACTIVITY_TIMEOUT_MS from State because it is mutated.
// Only destructure the truly-constant values that won't be reassigned here.
const { HOLDING_VIDEO_ID, VIDEO_DURATION_MS, LEFTOVER_TIMEOUT_MS } = State;

let INACTIVITY_TIMEOUT_MS = LEFTOVER_TIMEOUT_MS; // Default value, will be computed dynamically

/**
 * Dynamically creates the initial buttonStatus object based on the currently available buttons' 'value' attribute.
 * The 'value' attribute (e.g., "video1") is used as the key for logging.
 * @returns {Object} { video1: false, video2: false, ... }
 */
export function initializeButtonStatus() {
    const videoButtons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button[data-video-id]') : [];
    const status = {};

    Array.from(videoButtons)
        .filter(btn => {
            const id = parseInt(btn.getAttribute('data-video-id'), 10);
            return Number.isInteger(id) && id > HOLDING_VIDEO_ID;
        })
        .map(btn => btn.getAttribute('value'))
        .filter(key => key && key.trim() !== '')
        .forEach(key => {
            status[key] = false;
        });

    return status;
}

/**
 * Clears the inactivity timer (if one exists) and resets the stored id in State.
 */
export function clearInactivityTimer() {
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
        console.log("Inactivity timer cleared.");
    }
}

/**
 * Triggers the transition to Step 3 (Thank You screen) and schedules the final reset to Step 1.
 */
export function transitionToStep3AndReset() {
    console.log("Session finished or timed out. Transitioning to Step 3 and logging data.");

    // 1. Build log object using captured lead data + dynamic buttonStatus keys
    const logData = {
        name: State.capturedLeadData?.name || '',
        email: State.capturedLeadData?.email || ''
    };

    for (const key in State.buttonStatus) {
        if (Object.prototype.hasOwnProperty.call(State.buttonStatus, key)) {
            logData[key] = !!State.buttonStatus[key];
        }
    }

    // Send to server for CSV logging
    try {
        Net.logLeadData(logData);
    } catch (err) {
        console.error('Failed to send log data to server:', err);
    }

    // 2. Clear captured data for next session
    State.setCapturedLeadData({ name: '', email: '' });
    State.setButtonStatus({});

    // 3. Stop timers
    clearInactivityTimer();

    // 4. Show Step 3 (Thank You) UI
    DOM.showStep3();

    // 5. After a short delay, return to start screen
    setTimeout(() => {
        DOM.showStartScreen();
    }, 5000);
}

/**
 * Compute the appropriate inactivity timeout based on whether any video button has been pressed.
 *
 * - If NO buttons pressed: LEFTOVER_TIMEOUT_MS
 * - If ANY button pressed: VIDEO_DURATION_MS + LEFTOVER_TIMEOUT_MS
 *
 * This function updates State.INACTIVITY_TIMEOUT_MS and returns the computed value (ms).
 */
function computeInactivityTimeout() {
    const status = State.buttonStatus || {};
    const anyPressed = Object.values(status).some(v => v === true);

    const timeoutMs = anyPressed ? (VIDEO_DURATION_MS + LEFTOVER_TIMEOUT_MS) : LEFTOVER_TIMEOUT_MS;

    // Persist the computed timeout in application state for visibility elsewhere
    INACTIVITY_TIMEOUT_MS = timeoutMs;

    return timeoutMs;
}

/**
 * Starts the inactivity timer using the dynamically computed timeout.
 * Clears any previous timer first.
 */
export function startInactivityTimer() {
    // Clear existing timer if present
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
    }

    // Compute appropriate timeout and set a new timer
    const timeoutMs = computeInactivityTimeout();
    const id = setTimeout(transitionToStep3AndReset, timeoutMs);
    State.setInactivityTimeoutId(id);

    console.log(`Inactivity timer started/reset for ${timeoutMs / 1000} seconds (${timeoutMs} ms).`);
}

/**
 * Resets the inactivity timer when on the Step 2 (video controls) screen.
 * This recalculates the timeout dynamically before starting the timer.
 */
export function resetInactivityTimer() {
    if (DOM.formStep2El && !DOM.formStep2El.classList.contains('hidden')) {
        // startInactivityTimer will compute the correct timeout and restart the timer
        startInactivityTimer();
    }
}

/**
 * Checks if all video play buttons currently present are disabled. If so, trigger session end.
 */
export function checkAllVideosSentAndReset() {
    const videoButtons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button') : [];
    const playButtons = Array.from(videoButtons).filter(btn => btn.hasAttribute('data-video-id') && btn.getAttribute('data-video-id') !== HOLDING_VIDEO_ID.toString());

    if (playButtons.length === 0) return;

    const allDisabled = playButtons.every(btn => btn.disabled);

    if (allDisabled) {
        transitionToStep3AndReset();
    }
}

/**
 * Error recovery: re-enable the last pressed video button if sending failed.
 */
export function handleVideoCommandError() {
    const activeStatus = DOM.getActiveStatusEl();
    if (activeStatus) activeStatus.textContent = `Error: Network failed to send last command.`;

    if (State.currentVideoId !== HOLDING_VIDEO_ID) {
        const button = getVideoButton(State.currentVideoId);
        if (button) {
            button.disabled = false;
        }
    }
}
