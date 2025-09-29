import * as DOM from '../dom.js';
import * as Net from '../networking.js';
import * as State from '../appState.js';
import { showStartScreen } from '../appLogic.js'; // Needed for navigation
import { clearInactivityTimer } from './sessionLogic.js'; // Needed for navigation

const { HOLDING_VIDEO_ID, PASSWORD_TIMEOUT_MS } = State;

// ---------- Password Wall Helpers ----------

/**
 * Clears the password wall timeout timer.
 */
function clearPasswordTimeout() {
    if (State.passwordTimeoutId) {
        clearTimeout(State.passwordTimeoutId);
        State.setPasswordTimeoutId(null);
    }
}

/**
 * Shows the password wall and sets a timeout for automatic return to the start screen.
 */
export function showPasswordWallWithTimeout() {
    if (!DOM.passwordWallContainerEl.classList.contains('hidden')) return;

    // CRITICAL: Stop the Step 2 inactivity timer when the config wall is opened
    clearInactivityTimer();

    DOM.showPasswordWall(() => {
        if (State.passwordTimeoutId) {
            clearTimeout(State.passwordTimeoutId);
        }
        const id = setTimeout(() => {
            if (!DOM.passwordWallContainerEl.classList.contains('hidden')) {
                DOM.passwordStatusEl.textContent = 'Time expired. Returning to start screen.';
                setTimeout(() => showStartScreen(), 2000); // Call main navigation function
            }
        }, PASSWORD_TIMEOUT_MS);
        State.setPasswordTimeoutId(id);
    });
}

/**
 * Processes the result received from the server regarding the password check.
 * @param {boolean} success - True if the password was correct.
 */
export function handlePasswordResult(success) {
    clearPasswordTimeout();

    if (success) {
        DOM.showConfigForm();
        Net.updateConfigStatus();
    } else {
        DOM.passwordStatusEl.textContent = 'Incorrect password. Try again.';
        DOM.passwordInputEl.value = '';
    }
}

// ---------- Configuration/Target Setting ----------

/**
 * Sets the target host and port based on user input.
 */
export function setTarget() {
    const host = DOM.hostInput.value.trim() || DOM.hostInput.placeholder || null;
    const portRaw = DOM.portInput.value.trim() || DOM.portInput.placeholder || null;

    if (!host) {
        DOM.configStatusEl.textContent = 'Please enter a host.';
        return;
    }
    const port = parseInt(portRaw, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        DOM.configStatusEl.textContent = 'Please enter a valid port (1-65535).';
        return;
    }

    const payload = { type: 'set_target', host, port };
    Net.sendJSON(payload);
    DOM.configStatusEl.textContent = `Setting target to ${host}:${port} ...`;

    DOM.hostInput.value = '';
    DOM.portInput.value = '';
}

/**
 * Sets the target and sends a test command.
 */
export function setTargetAndTest() {
    setTarget();
    setTimeout(() => {
        const testMsg = { address: '/@3/20', args: ['wtm', HOLDING_VIDEO_ID] };
        Net.sendJSON(testMsg);
    }, 150);
}

// ---------- Public Interface for form submits (Calling from appLogic) ----------

/**
 * Submits the entered password to the server for verification.
 */
export function submitPassword() {
    const password = DOM.passwordInputEl.value.trim();
    if (!password) {
        DOM.passwordStatusEl.textContent = 'Please enter a password.';
        return;
    }

    DOM.passwordStatusEl.textContent = 'Checking...';
    const payload = { type: 'check_password', password };
    Net.sendJSON(payload);
}
