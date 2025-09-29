import * as DOM from '../dom.js';
import { HOLDING_VIDEO_ID } from '../appState.js';

/**
 * Gets an array of video IDs (numbers, 1+) present in the Step 2 control panel.
 * @returns {number[]} Array of active video IDs.
 */
export function getActiveVideoIds() {
    // NOTE: Assumes DOM.formStep2El exists and contains the video control buttons
    const videoButtons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button[data-video-id]') : [];
    
    // Filter to only include buttons with IDs > 0 (i.e., not the holding video ID)
    const playButtonIds = Array.from(videoButtons)
        .map(btn => parseInt(btn.getAttribute('data-video-id'), 10))
        .filter(id => Number.isInteger(id) && id > HOLDING_VIDEO_ID);
        
    return [...new Set(playButtonIds)];
}

/**
 * Finds the specific video button element based on its data-video-id attribute.
 * @param {number} n - The video number (1-4).
 * @returns {HTMLElement | null} The button element or null if not found.
 */
export function getVideoButton(n) {
    if (!DOM.formStep2El) return null;
    return DOM.formStep2El.querySelector(`button[data-video-id="${n}"]`);
}

/**
 * Ensures all video buttons are enabled. Used when loading Step 2 or on reset.
 */
export function enableAllVideoButtons() {
    const buttons = DOM.formStep2El ? DOM.formStep2El.querySelectorAll('.buttons-row button') : [];
    buttons.forEach(btn => {
        btn.disabled = false;
    });
}
