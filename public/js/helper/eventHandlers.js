import * as DOM from '../dom.js';
import * as State from '../appState.js';
import { showPasswordWallWithTimeout, setTarget, submitPassword } from './authAndConfig.js';
import { submitLeadForm } from '../appLogic.js'; // Call main logic entry points

const { TAP_THRESHOLD, TAP_TIME_LIMIT } = State;

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
    document.getElementById('targetForm').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setTarget();
        }
    });

    // --- Password Form Enter handler ---
    document.getElementById('passwordForm').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitPassword();
        }
    });

    // --- Lead Form Enter handler (Step 1) ---
    document.getElementById('leadForm').addEventListener('keydown', (e) => {
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
