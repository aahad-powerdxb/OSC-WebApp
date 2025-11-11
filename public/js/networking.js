// networking.js
import {
    statusEl,
    showStatus,
    hideStatusImmediately,
    hostInput,
    portInput,
    setTargetBtn,
    setTargetTestBtn,
    configFormContainerEl,
    configStatusEl,
    getActiveStatusEl,

} from './dom.js';

// Constants
const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;

// State
export let lastKnownTarget = { host: null, port: null };
export let lastKnownVideo = 0; // 0 = holding/reset, 1... = videos
export let lastKnownVideoLabel = '';

// const oscListeners = new Set();

export function resetVideoStatus()
{
    lastKnownVideo = 0;
    lastKnownVideoLabel = '';
}

// WebSocket instance
export const ws = new WebSocket(WS_URL);

// Callbacks for main.js to hook into network events
let onMessageCallback = () => {};
export function setOnMessageCallback(callback) {
    onMessageCallback = callback;
}

// ---------- OSC Listener (client-side API) ----------

/**
 * Register a callback to be called when an OSC message is received
 * @param {(msg:Object)=>void} cb - receives an object like { type:'osc', address:'/foo', args:[...], info: {...} }
 */
export function addOSCListener(cb) {
    oscListeners.add(cb);
}

/** Remove a previously added OSC listener */
export function removeOSCListener(cb) {
    oscListeners.delete(cb);
}

// ---------- UI Status Updates ----------

/** Updates the user-facing status on the main controller screen. */
export function updateMainStatus() {
    if (ws.readyState !== WebSocket.OPEN) {
        // statusEl.textContent = 'Disconnected from OSC Forwarder.';
        return;
    }

    if (lastKnownVideo !== 0) {
        // statusEl.textContent = `Playing Video ${lastKnownVideo}!`;
        showStatus(statusEl, `You're viewing the ${lastKnownVideoLabel} experience`, 2000);
    } else {
        // statusEl.textContent = 'Playback Reset';
        // showStatus(statusEl, 'Playback Reset', 2000);
    }
}

/**
 * Updates the developer/network status on the configuration screen.
 * @param {string} [extra=''] - Additional message.
 */
export function updateConfigStatus(extra = '') {
    if (ws.readyState === WebSocket.OPEN) {
        configStatusEl.textContent = `Connected to Forwarder. Target: ${lastKnownTarget.host || '—'}:${lastKnownTarget.port || '—'}` + (extra ? ` — ${extra}` : '');
    } else if (ws.readyState === WebSocket.CLOSED) {
        configStatusEl.textContent = 'Disconnected from Forwarder.';
    } else {
        configStatusEl.textContent = 'Connecting...';
    }
    updateButtons();
}

/** Enables/Disables buttons based on WebSocket state. */
function updateButtons() {
    const disabled = ws.readyState !== WebSocket.OPEN;
    if (setTargetBtn) setTargetBtn.disabled = disabled;
    if (setTargetTestBtn) setTargetTestBtn.disabled = disabled;
}


// ---------- Communication ----------

/**
 * Send a JavaScript object over the WebSocket (stringified).
 * If socket is not open, writes a message into the active status area.
 * @param {Object} obj
 */
export function sendJSON(obj) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
    } else {
        getActiveStatusEl().textContent = 'Socket not open. Retry after connection.';
    }
}

/**
 * Sends a command to play a video (or reset).
 * @param {number} n - Video number (0 for holding/reset, 1-4 for videos).
 */
export function sendVideoCommand(n, label = "") {
    // Optimistic UI update
    lastKnownVideo = n;
    lastKnownVideoLabel = label;  // <-- STORE THE LABEL
    updateMainStatus();

    const msg = { address: '/@3/20', args: ['Autoplay', n] };
    sendJSON(msg);
}

/**
 * Sends lead form and button usage data to the server for logging (e.g., to a CSV file).
 * The server is expected to write this data to a file like data.csv upon receiving the 'data_log' type.
 * @param {object} data - The data payload (name, email, button booleans).
 */
export function logLeadData(data) {
    const payload = {
        type: 'data_log', // Explicitly signaling the server to log this data
        timestamp: new Date().toISOString(),
        ...data // Includes name, email, button booleans (e.g., button1pushed: true)
    };
    sendJSON(payload);
    console.log("Logging data payload sent:", payload);
}

// ---------- Server Target Fetch on Load ----------

/** Fetches server's current-target to pre-populate placeholders. */
export function populateCurrentTargetFromServer() {
    fetch('/current-target', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : Promise.reject('no current-target'))
        .then((j) => {
            if (j && j.host && j.port) {
                lastKnownTarget.host = j.host;
                lastKnownTarget.port = j.port;
                hostInput.placeholder = j.host;
                portInput.placeholder = j.port;
                updateConfigStatus();
            }
        })
        .catch(() => {
            // Ignore silently
        });
}


// ---------- WebSocket Handlers ----------

ws.addEventListener('open', () => {
    updateConfigStatus();
    updateMainStatus();
});

ws.addEventListener('close', () => {
    configStatusEl.textContent = 'Disconnected from Forwarder.';
    updateMainStatus();
    updateButtons();
});

ws.addEventListener('error', () => {
    configStatusEl.textContent = 'WebSocket error (check server).';
    updateMainStatus();
    updateButtons();
});

ws.addEventListener('message', (evt) => {
    let data;
    try { data = JSON.parse(evt.data); } catch { return; }
    onMessageCallback(data); // Pass message to main.js

    // If this is an OSC-forward message from the server, notify OSC listeners
    // Expectation: server forwards OSC as { type: 'osc', address: '...', args: [...], info: {...} }
    try {
        if (data && data.type === 'osc') {
            oscListeners.forEach(cb => {
                try { cb(data); } catch (err) { console.error('OSC listener error', err); }
            });
        }
    } catch (e) {
        // defensive: don't allow listener errors to break the socket
        console.error('Error handling incoming OSC message', e);
    }
});
