import * as DOM from './dom.js';
import * as Net from './networking.js';
import * as State from './appState.js';
import { getVideoButton, enableAllVideoButtons } from './helper/domHelpers.js';
import { initializeButtonStatus, resetInactivityTimer, checkAllVideosSentAndReset, clearInactivityTimer, startInactivityTimer, handleVideoCommandError } from './helper/sessionLogic.js';
import { handlePasswordResult, submitPassword, setTarget, setTargetAndTest } from './helper/authAndConfig.js';
import { setupEventListeners } from './helper/eventHandlers.js';

// Destructure common state and constants for cleaner access
const { HOLDING_VIDEO_ID } = State;

// Expose setupEventListeners for main.js bootstrap
export { setupEventListeners };

// ---------- Server Message Handling ----------

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
            // Watch for /@3/20 ["wtm", N] messages and update main UI state
            if (data.address === '/@3/20' && Array.isArray(data.args) && data.args.length >= 2 && data.args[0] === 'wtm') {
                const videoNum = parseInt(data.args[1], 10);
                if (Number.isInteger(videoNum) && videoNum >= HOLDING_VIDEO_ID) { 
                    State.setCurrentVideoId(videoNum);
                    Net.updateMainStatus(State.currentVideoId);
                    
                    if (videoNum !== HOLDING_VIDEO_ID) {
                        checkAllVideosSentAndReset();
                    } else {
                        enableAllVideoButtons();
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

        default:
            // ignore unknown types
            break;
    }
}

// Attach the handler to the networking module
Net.setOnMessageCallback(handleServerMessage);

// ---------- OSC / UI actions (Exported) ----------

// Re-export Auth/Config methods to maintain a flat API for main.js
export { submitPassword, setTarget, setTargetAndTest };


export function send(n) {
    // Disable only the specific button pressed
    const button = getVideoButton(n);
    if (button) {
        button.disabled = true;
    }

    // --- TRACK BUTTON PRESS ---
    const buttonKey = button.getAttribute('value');
    if (State.buttonStatus.hasOwnProperty(buttonKey)) {
        State.buttonStatus[buttonKey] = true;
    }
    // --------------------------
    
    // Update local state for error recovery and send command
    State.setCurrentVideoId(n);
    Net.sendVideoCommand(n);
    resetInactivityTimer(); // Reset timer on interaction
}

export function sendHolding() {
    // Update local state for error recovery
    State.setCurrentVideoId(HOLDING_VIDEO_ID);
    Net.sendVideoCommand(HOLDING_VIDEO_ID);
    resetInactivityTimer(); // Reset timer on interaction
}

// ---------- Lead form logic (Step 1 to Step 2 transition) ----------

export function submitLeadForm() {
    const name = DOM.nameInputEl.value.trim();
    const email = DOM.emailInputEl.value.trim();

    // Basic validation
    if (!name || !email) {
        DOM.leadStatusEl.textContent = 'Name and Email are required.';
        DOM.leadStatusEl.classList.remove('hidden');
        return;
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        DOM.leadStatusEl.textContent = 'Please enter a valid email address.';
        DOM.leadStatusEl.classList.remove('hidden');
        return;
    }

    // --- CAPTURE DATA AND DYNAMICALLY INITIALIZE BUTTON STATUS ---
    State.setCapturedLeadData({ name, email });
    State.setButtonStatus(initializeButtonStatus());
    // --------------------------------------------

    // Success message before transition
    DOM.leadStatusEl.textContent = 'Details captured. Accessing controls...';
    DOM.leadStatusEl.classList.remove('hidden');

    // Transition to step 2 (video controls) after a brief moment
    setTimeout(() => {
        showMainContent(); // Use local function for navigation
        DOM.leadStatusEl.classList.add('hidden'); // Clear status after transition
    }, 500);
}


// ---------- Navigation Functions (Exported via main.js) ----------

export function showMainContent() {
    // clearPasswordTimeout is handled within authAndConfig and showStartScreen
    DOM.showMainContent();
    Net.updateMainStatus(State.currentVideoId);
    enableAllVideoButtons(); 
    startInactivityTimer(); // <--- START TIMER WHEN ENTERING STEP 2
};

export function showStartScreen() {
    // clearPasswordTimeout is handled within authAndConfig
    clearInactivityTimer(); // <--- Use the dedicated clear function
    DOM.showStartScreen();
    // Clear lead form inputs when returning to Step 1
    if (DOM.nameInputEl) DOM.nameInputEl.value = '';
    if (DOM.emailInputEl) DOM.emailInputEl.value = '';
};


// ---------- Initialization ----------

export function initApp() {
    DOM.showStartScreen();
    Net.updateConfigStatus();
    Net.populateCurrentTargetFromServer();
}
