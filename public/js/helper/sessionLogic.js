import * as DOM from '../dom.js';
import * as Net from '../networking.js';
import * as State from '../appState.js';
import { getActiveVideoIds } from './domHelpers.js';
import { getVideoButton } from './domHelpers.js'; // Needed by checkAllVideosSentAndReset
import { enableAllVideoButtons } from './domHelpers.js'; // Needed for error recovery

const { HOLDING_VIDEO_ID, INACTIVITY_TIMEOUT_MS } = State;

/**
 * Dynamically creates the initial buttonStatus object based on the currently available buttons.
 * @returns {Object} { button1: false, button2: false, ... }
 */
export function initializeButtonStatus() {
    const ids = getActiveVideoIds();
    const status = {};
    ids.forEach(id => {
        status[`button${id}`] = false;
    });
    return status;
}

/**
 * Clears the 90-second inactivity timer.
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
    
    // 1. DYNAMICALLY LOG THE DATA BEFORE CLEARING STATE
    const logData = {
        name: State.capturedLeadData.name,
        email: State.capturedLeadData.email,
    };

    // DYNAMICALLY ADD buttonXpushed fields
    for (const key in State.buttonStatus) {
        if (Object.prototype.hasOwnProperty.call(State.buttonStatus, key) && key.startsWith('button')) {
            const logKey = key + 'pushed'; 
            logData[logKey] = State.buttonStatus[key];
        }
    }

    Net.logLeadData(logData);

    // 2. Clear captured data for next session
    State.setCapturedLeadData({ name: '', email: '' });
    State.setButtonStatus({}); 

    // 3. Stop any running timers
    clearInactivityTimer(); // Use the new common function

    // 4. Show Step 3 (Thank You screen)
    DOM.showStep3();
    
    // 5. Set timeout to reset to Step 1 (5000ms = 5 seconds)
    setTimeout(() => {
        DOM.showStartScreen(); 
    }, 5000); 
}

/**
 * Starts the 90-second inactivity timer.
 */
export function startInactivityTimer() {
    clearTimeout(State.inactivityTimeoutId);
    // Set a new timer that calls the transition function if it expires
    const id = setTimeout(transitionToStep3AndReset, INACTIVITY_TIMEOUT_MS);
    State.setInactivityTimeoutId(id);
    console.log(`Inactivity timer started/reset for ${INACTIVITY_TIMEOUT_MS / 1000} seconds.`);
}

/**
 * Resets the 90-second inactivity timer.
 * Only resets if the application is currently on the video controls screen (Step 2).
 */
export function resetInactivityTimer() {
    if (DOM.formStep2El && !DOM.formStep2El.classList.contains('hidden')) {
        startInactivityTimer();
    }
}


/**
 * Checks if all video buttons currently present in the buttons-row are disabled.
 * If they are all disabled, it transitions to the 'thank you' screen.
 */
export function checkAllVideosSentAndReset() {
    // Dynamically fetch all buttons in the control row
    const videoButtons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button') : [];
    
    const playButtons = Array.from(videoButtons).filter(btn => btn.hasAttribute('data-video-id') && btn.getAttribute('data-video-id') !== HOLDING_VIDEO_ID.toString());

    if (playButtons.length === 0) return; 

    let allDisabled = true;

    for (const button of playButtons) {
        if (!button.disabled) {
            allDisabled = false;
            break;
        }
    }

    if (allDisabled) {
        transitionToStep3AndReset();
    }
}

/**
 * Handles error recovery by re-enabling the last pressed button.
 */
export function handleVideoCommandError() {
    DOM.getActiveStatusEl().textContent = `Error: Network failed to send last command.`;

    if (State.currentVideoId !== HOLDING_VIDEO_ID) {
        const button = getVideoButton(State.currentVideoId);
        if (button) {
            button.disabled = false;
        }
    }
}
