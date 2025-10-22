// public/js/helper/sessionLogic.js
import * as DOM from '../dom.js';
import * as Net from '../networking.js';
import * as State from '../appState.js';
import { getVideoButton, showAndEnableButton } from './domHelpers.js';

const { HOLDING_VIDEO_ID, LEFTOVER_TIMEOUT_MS } = State;

/**
 * Build initial buttonStatus object from buttons present in the DOM.
 * Returns an object like { video1: false, video2: false, ... }
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

/** Clear the primary inactivity timer. */
export function clearInactivityTimer() {
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
        console.log('[sessionLogic] Inactivity timer cleared.');
    }
}

/** End the current session: log data, show Thank You, and reset to start. */
export function transitionToStep3AndReset() {
    console.log('[sessionLogic] Session finishing: transition to Step 3 and reset.');

    const logData = {
        name: State.capturedLeadData?.name || '',
        nationality: State.capturedLeadData?.nationality || '',
        email: State.capturedLeadData?.email || '',
        phone: State.capturedLeadData?.phone || ''
    };

    for (const key in State.buttonStatus) {
        if (Object.prototype.hasOwnProperty.call(State.buttonStatus, key)) {
            logData[key] = !!State.buttonStatus[key];
        }
    }

    try {
        Net.logLeadData(logData);
    } catch (err) {
        console.error('[sessionLogic] Failed to send log data to server:', err);
    }

    State.setCapturedLeadData({ name: '', nationality: '', email: '', phone: '' });
    State.setButtonStatus({});

    clearInactivityTimer();

    DOM.showStep3();
    Net.resetVideoStatus();

    setTimeout(() => {
        DOM.showStartScreen();
    }, 5000);
}

/** Start or reset the inactivity timer. */
export function startInactivityTimer(overrideMs) {
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
    }

    const timeoutMs = overrideMs;

    const id = setTimeout(transitionToStep3AndReset, timeoutMs);
    State.setInactivityTimeoutId(id);
    console.log(`[sessionLogic] Inactivity timer started/reset for ${timeoutMs / 1000}s (id: ${id}).`);
}

/** Reset inactivity when still on Step 2. */
export function resetInactivityTimer() {
    if (DOM.formStep2El && !DOM.formStep2El.classList.contains('hidden')) {
        startInactivityTimer();
    }
}

/** If all play buttons are disabled, finish the session. */
export function checkAllVideosSentAndReset() {
    const videoButtons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button') : [];
    const playButtons = Array.from(videoButtons).filter(btn => btn.hasAttribute('data-video-id') && btn.getAttribute('data-video-id') !== HOLDING_VIDEO_ID.toString());
    if (playButtons.length === 0) return;
    const allDisabled = playButtons.every(btn => btn.disabled);
    if (allDisabled) transitionToStep3AndReset();
}

/** On network error try to re-enable the last pressed button for recovery. */
export function handleVideoCommandError() {
    const activeStatus = DOM.getActiveStatusEl();
    if (activeStatus) activeStatus.textContent = `Error: Network failed to send last command.`;
    if (State.currentVideoId !== HOLDING_VIDEO_ID) {
        const button = getVideoButton(State.currentVideoId);
        if (button) showAndEnableButton(button);
    }
}
