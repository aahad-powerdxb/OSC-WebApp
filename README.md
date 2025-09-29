# Interactive Kiosk Client (OSC / WebSocket Interface)

This repository contains the client-side JavaScript logic for an interactive kiosk application designed to capture lead data and control external hardware or media servers via OSC messages transmitted over a WebSocket connection.

The application operates in a simple, multi-step flow, featuring a user-facing mode and a secret, password-protected configuration mode.

---

## 🚀 Features

* **Lead Capture (Step 1)**
  Users input their Name and Email before proceeding to the interactive controls.

* **Dynamic Video Controls (Step 2)**
  Sends specific OSC commands (`/@3/20`, `"wtm"`, `N`) based on button presses to trigger media playback on a target server.

* **Session Management**

  * Tracks which video buttons (button1, button2, etc.) were pressed during the session.
  * Automatically logs captured lead data and button-press status when the session ends.

* **Inactivity Timeout**
  A session automatically times out after a fixed period of inactivity, logging data and resetting to the start screen.

* **Secret Configuration Wall**
  Access a hidden configuration screen via a secret tap gesture to set the target Host and Port for the OSC server.

---

## 📁 Project Structure

The core application logic is highly modularized, residing in the `appLogic.js` orchestrator file and a set of specialized helper modules.

```
.
├── dom.js                # Core DOM manipulation functions (e.g., show/hide screens, update status)
├── appState.js           # Global state management (timers, lead data, button status)
├── networking.js         # WebSocket connection handling, OSC sending, lead logging
├── appLogic.js           # Main application orchestrator, server message handling, and navigation
└── js/helper/
    ├── domHelpers.js     # Utilities for finding and manipulating specific control buttons
    ├── sessionLogic.js   # Manages session lifecycle, timers, logging, and completion checks
    ├── authAndConfig.js  # Handles password protection, configuration submission, and error recovery for config
    └── eventHandlers.js  # Central function for setting up all UI events (forms, buttons, secret tap)
```

---

## 🛠️ Key Logic and Flow

### 1. The User Flow

The application follows a linear progression:

1. **Start Screen (`showStartScreen`)**
   Displays the lead capture form.

2. **Lead Submission (`submitLeadForm`)**
   Captures Name and Email, dynamically initializes `State.buttonStatus` based on available buttons, and transitions to Step 2.

3. **Control Screen (`showMainContent`)**
   Video control buttons are enabled, and the Inactivity Timer is started.

4. **Video Command (`send(n)`)**

   * Disables the pressed button.
   * Logs the press in `State.buttonStatus`.
   * Sends the OSC command (`/@3/20`, `wtm`, `N`).

5. **Session End** — triggered by either:

   * The Inactivity Timer expiring, or
   * All dynamic video buttons being disabled (`checkAllVideosSentAndReset`).

6. **Data Logging & Reset (`transitionToStep3AndReset`)**
   Logs the `capturedLeadData` combined with the final `buttonStatus` using `Net.logLeadData`, shows the "Thank You" screen (Step 3), and resets the app to Step 1 after 5 seconds.

---

### 2. Configuration Access

Configuration is protected by a hidden mechanism:

* **Secret Tap**
  Tapping the designated `tapTargetEl` (likely the main screen area) 5 times within a short time window triggers `showPasswordWallWithTimeout`.

* **Inactivity Pause**
  When the password wall is displayed, the Step 2 Inactivity Timer is automatically cleared to prevent a session timeout.

* **Password Validation**
  The entered password is sent to the server for validation (`{ type: 'check_password', password }`).

* **Target Setting**
  If validation succeeds, the user can set the new OSC target Host and Port, which is sent to the server (`{ type: 'set_target', host, port }`).

---

### 3. Timer Management

Two main timers are used and managed across different files:

| Timer      | Purpose                                | State Variable              | Managed By         | Condition / Notes                                                                                   |
| ---------- | -------------------------------------- | --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| Inactivity | Ends user session on Step 2            | `State.inactivityTimeoutId` | `sessionLogic.js`  | Started in `showMainContent`, cleared in `showStartScreen`, paused in `showPasswordWallWithTimeout` |
| Password   | Resets the password wall after a delay | `State.passwordTimeoutId`   | `authAndConfig.js` | Started when `showPasswordWall` is called                                                           |

---

## ⚙️ Getting Started

This project is a full-stack application relying on Node.js for both the client-side dependency management and the server-side WebSocket/OSC bridge (`server.js`).

### Step 1: Install Git and Clone the Repository

* Install Git: visit [https://git-scm.com](https://git-scm.com) and follow instructions for your OS.
* Verify:

  ```bash
  git --version
  ```
* Clone the repo:

  ```bash
  git clone <URL_of_this_repository>
  cd interactive-kiosk-client
  ```

### Step 2: Install Node.js

* Download Node.js from [https://nodejs.org](https://nodejs.org) (includes `npm`).
* Verify:

  ```bash
  node -v
  npm -v
  ```

### Step 3: Install Server Dependencies

Install dependencies listed in `package.json`:

```bash
npm install
```

Packages typically include: `dotenv`, `express`, `node-osc`, `ws`.

### Step 4: Run the Server

Start the server which serves the client files and handles WebSocket/OSC forwarding:

```bash
npm start
```

The client will be served from `http://localhost:3000` (or the port specified in your `.env` file).

### Step 5: Access the Application

Open a browser and go to:

```
http://localhost:3000
```

---

## 🔌 Backend Prerequisites

The client handles UI and WebSocket communication but requires a corresponding backend service (`server.js`) to:

* Serve the client files.
* Maintain a WebSocket connection with the client.
* Handle these custom message types:

  * `type: 'set_target'` — update the server's OSC endpoint.
  * `type: 'check_password'` — validate config access.
  * `type: 'log_lead'` — receive and store lead data.
* Forward OSC commands received from the client to the specified Host/Port.

---

## JSON Message Examples

**Client → Server**

```json
// Set OSC target
{ "type": "set_target", "host": "192.168.10.10", "port": 57120 }

// Check password
{ "type": "check_password", "password": "hunter2" }

// Forward OSC (video command)
{ "address": "/@3/20", "args": ["wtm", 3] }

// Log lead
{ "type": "log_lead", "lead": { "name": "...", "email": "..." }, "buttons": {...} }
```

**Server → Client**

```json
// Broadcast when target changes
{ "type": "target_set", "host": "192.168.10.10", "port": 57120 }

// Password verification result
{ "type": "password_result", "success": true }

// Confirm forwarded OSC was sent
{ "type": "sent", "address": "/@3/20", "args": ["wtm", 3] }

// Error
{ "type": "error", "message": "invalid host/port" }
```

---

## Suggestions / Next Steps

* **Security**: Replace simple password checks with token-based auth or TLS + JWT for production.
* **Persistence**: Persist the `set_target` configuration server-side (e.g., JSON file) to survive restarts.
* **Audit**: Add `changedBy` metadata to `target_set` broadcasts (client ID / IP + timestamp).
* **Robustness**: Add WebSocket reconnection with exponential backoff on the client.
* **Analytics**: Aggregate session logs for later review (store `lead + buttonStatus + timestamps` in DB).

---

If you'd like, I can:

* generate a README.md file with this text (ready to paste), or
* produce example server stubs (`server.js`) to match the message protocol above, or
* produce a small test script to simulate OSC receiving using `node-osc`.

Which would you like next?
