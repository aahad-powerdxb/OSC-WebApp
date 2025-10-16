// helper/sessionLogic.js
import * as DOM from '../dom.js';
import * as Net from '../networking.js';
import * as State from '../appState.js';
import { getVideoButton, showAndEnableButton } from './domHelpers.js';

const { HOLDING_VIDEO_ID, LEFTOVER_TIMEOUT_MS } = State;

// NOTE: video-duration timer removed. We will use OSC-based "video ended" events instead.
// let videoDurationTimerId = null;           // <--- removed
// let onVideoDurationEndCallback = null;     // <--- removed

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
    // Clear the main inactivity timer
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
        console.log('[sessionLogic] Inactivity timer cleared.');
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
        nationality: State.capturedLeadData?.nationality || '',
        email: State.capturedLeadData?.email || '',
        phone: State.capturedLeadData?.phone || ''
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
    Net.resetVideoStatus();

    // 5. After a short delay, return to start screen
    setTimeout(() => {
        DOM.showStartScreen();
    }, 5000);
}

// /**
//  * Register a callback that will be called when the video-duration timer expires.
//  * appLogic should call setOnVideoDurationEnd(sendHolding) during initialization.
//  * @param {Function|null} cb
//  */
// export function setOnVideoDurationEnd(cb) {
//   if (cb && typeof cb !== 'function') {
//     throw new TypeError('setOnVideoDurationEnd expects a function or null');
//   }
//   onVideoDurationEndCallback = cb || null;
// }

// /**
//  * Clears the secondary video-duration timer, if present.
//  */
// export function clearVideoDurationTimer() {
//   if (videoDurationTimerId) {
//     clearTimeout(videoDurationTimerId);
//     videoDurationTimerId = null;
//     console.log('[sessionLogic] Video-duration timer cleared.');
//   }
// }

// /**
//  * Starts the secondary video-duration timer. When it fires, call the registered callback
//  * (or perform a fallback action if no callback is registered).
//  *
//  * The timer duration is the current State.VIDEO_DURATION_MS (ms).
//  */
// function startVideoDurationTimer() {
//   // Clear any previous secondary timer first
//   clearVideoDurationTimer();

//   const durationMs = State.VIDEO_DURATION_MS || 0;
//   if (!Number.isFinite(durationMs) || durationMs <= 0) {
//     console.warn('[sessionLogic] startVideoDurationTimer: invalid State.VIDEO_DURATION_MS:', durationMs);
//     return;
//   }

//   // Set the timer
//   videoDurationTimerId = setTimeout(() => {
//     videoDurationTimerId = null; // clear stored id (timer fired)

//     console.log('[sessionLogic] Video-duration timer fired; executing registered handler.');

//     if (typeof onVideoDurationEndCallback === 'function') {
//       try {
//         onVideoDurationEndCallback(); // this should call appLogic.sendHolding()
//       } catch (err) {
//         console.error('[sessionLogic] error in onVideoDurationEndCallback:', err);
//       }
//     } else {
//       // fallback: if no callback is registered, attempt to do the minimal "holding" action here:
//       // - set state current video to HOLDING and send holding message via Net directly
//       // (this avoids importing appLogic)
//       State.setCurrentVideoId(HOLDING_VIDEO_ID);
//       try {
//         Net.sendVideoCommand(HOLDING_VIDEO_ID);
//       } catch (err) {
//         console.error('[sessionLogic] fallback sendHolding via Net failed:', err);
//       }
//       // restart inactivity timer so the session continues with the new state
//     //   resetInactivityTimer();
//     }
//   }, durationMs);

//   console.log(`[sessionLogic] Video-duration timer started for ${durationMs / 1000}s (id: ${videoDurationTimerId}).`);
// }

/**
 * Compute the appropriate inactivity timeout based on whether any video button has been pressed.
 *
 * - If NO buttons pressed: LEFTOVER_TIMEOUT_MS
 * - If ANY button pressed: VIDEO_DURATION_MS + LEFTOVER_TIMEOUT_MS
 *
 * This function computes the Timer based on the values of State.VIDEO_DURATION_MS & LEFTOVER_TIMEOUT_MS and returns the computed value (ms).
 */
function computeInactivityTimeout() {
    const status = State.buttonStatus || {};
    const anyPressed = Object.values(status).some(v => v === true);

    // read the live duration from State (ms)
    const videoDuration = State.VIDEO_DURATION_MS || 0;

    const timeoutMs = anyPressed ? (videoDuration + LEFTOVER_TIMEOUT_MS) : LEFTOVER_TIMEOUT_MS;

    console.log('[sessionLogic] computeInactivityTimeout:', {
        anyPressed,
        videoDuration,
        LEFTOVER_TIMEOUT_MS,
        timeoutMs
    });

    return timeoutMs;
}

/**
 * Starts the inactivity timer using the dynamically computed timeout.
 * Clears any previous timer first.
 */
export function startInactivityTimer() {
    // Clear existing main timer if present
    if (State.inactivityTimeoutId) {
        clearTimeout(State.inactivityTimeoutId);
        State.setInactivityTimeoutId(null);
    }

    // Compute appropriate timeout for inactivity and set main timer
    const timeoutMs = computeInactivityTimeout();
    const id = setTimeout(transitionToStep3AndReset, timeoutMs);
    State.setInactivityTimeoutId(id);
    console.log(`[sessionLogic] Inactivity timer started/reset for ${timeoutMs / 1000}s (id: ${id}).`);

    // // ALSO start secondary video-duration timer that will invoke sendHolding after State.VIDEO_DURATION_MS
    // // Only start the secondary timer if there is a meaningful VIDEO_DURATION_MS set and we're not in holding state
    // // You might want to only start this when a video is currently playing (State.currentVideoId != HOLDING_VIDEO_ID).
    // // Here we check currentVideoId to avoid starting it unnecessarily.
    // if (State.currentVideoId !== HOLDING_VIDEO_ID) {
    //   startVideoDurationTimer();
    // } else {
    //   // If in holding state, ensure secondary timer is cleared
    //   clearVideoDurationTimer();
    // }
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
 * When a video button is pressed, call this to update the runtime VIDEO_DURATION_MS
 * based on that button's "duration" attribute (assumed seconds).
 *
 * videoId is the numeric data-video-id (e.g. 1,2,3).
 * If the attribute is missing or invalid, the function does nothing.
 *
 * Returns the new VIDEO_DURATION_MS (ms) or null if unchanged.
 */
export function setVideoDurationForId(videoId) {
    const btn = getVideoButton(videoId);
    if (!btn) {
        console.warn('[sessionLogic] setVideoDurationForId: button not found for id', videoId);
        return null;
    }
    const raw = btn.getAttribute('duration');
    if (!raw) {
        console.log('[sessionLogic] setVideoDurationForId: no duration attribute on button', videoId);
        return null;
    }
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        console.warn('[sessionLogic] invalid duration attribute on button', videoId, raw);
        return null;
    }

    const ms = Math.round(seconds * 1000);
    State.setVideoDuration(ms); // update appState mutable variable

    // IMPORTANT: read back from State to show the actual live value
    console.log('[sessionLogic] VIDEO_DURATION_MS now (from State):', State.VIDEO_DURATION_MS, 'ms for videoId', videoId);
    return State.VIDEO_DURATION_MS;
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
            showAndEnableButton(button);
        }
    }
}
