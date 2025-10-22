// ---------- Constants & State ----------
export const HOLDING_VIDEO_ID = 0;
export const PASSWORD_TIMEOUT_MS = 15_000;
export const LEFTOVER_TIMEOUT_MS = 10_000; // Duration to wait before allowing next video (20 seconds)
// export let INACTIVITY_TIMEOUT_MS = LEFTOVER_TIMEOUT_MS; // 90 seconds (for Step 2 inactivity)
export const TAP_THRESHOLD = 5;
export const TAP_TIME_LIMIT = 500; // ms between taps to count

// Timers
export let passwordTimeoutId = null;
export let inactivityTimeoutId = null; 

// Tap unlock state
export let tapCount = 0;
export let lastTapTime = 0;

// Local state to track the last video command sent
export let currentVideoId = HOLDING_VIDEO_ID; 

// --- NEW STATE FOR LEAD DATA LOGGING ---
// Lead Form data captured during Step 1 submit
export let capturedLeadData = {
    name: '',
    nationality: '',
    email: '',
    phone: '',
};

// Button status tracked during Step 2 (booleans show if a button was pressed). Dynamically populated.
export let buttonStatus = {}; 


// ---------- Mutators (Used by AppLogic) ----------
export function setPasswordTimeoutId(id) { passwordTimeoutId = id; }
export function setInactivityTimeoutId(id) { inactivityTimeoutId = id; }
export function setTapCount(count) { tapCount = count; }
export function setLastTapTime(time) { lastTapTime = time; }
export function setCurrentVideoId(id) { currentVideoId = id; }
export function setCapturedLeadData(data) { capturedLeadData = data; }
export function setButtonStatus(status) { buttonStatus = status; }
