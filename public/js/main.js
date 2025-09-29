import * as AppLogic from './appLogic.js';
import * as State from './appState.js';

// Initialization IIFE
(() => {
    // 1. Set up all core event listeners (forms, taps, etc.)
    AppLogic.setupEventListeners();

    // 2. Attach functions used by inline HTML onclicks to the window for accessibility
    window.send = AppLogic.send;
    window.sendHolding = AppLogic.sendHolding;
    window.setTarget = AppLogic.setTarget;
    window.setTargetAndTest = AppLogic.setTargetAndTest;
    window.submitPassword = AppLogic.submitPassword;
    window.submitLeadForm = AppLogic.submitLeadForm;

    // 3. Navigation functions (must be exposed as they are called by DOM functions)
    // NOTE: These are wrapped functions in the original code, now centralized in AppLogic
    window.showMainContent = AppLogic.showMainContent;
    window.showStartScreen = AppLogic.showStartScreen;

    // 4. Start the application
    AppLogic.initApp();
})();
