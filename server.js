// server.js
require('dotenv').config(); // loads .env if present

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server: WebSocketServer } = require('ws');
const { Client } = require('node-osc');

const CONFIG_FILE = path.join(__dirname, 'osc-config.json');
const LOG_FILE = path.join(__dirname, 'data.csv'); // New log file path

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const PASSWORD = process.env.PASSWORD || null; // if set, clients must authenticate

let OSC_HOST = process.env.OSC_HOST || '127.0.0.1';
let OSC_PORT = parseInt(process.env.OSC_PORT || '57120', 10);

// --- CSV Logging Functions ---

let BASE_CSV_HEADERS = [
    'timestamp', 
    'name', 
    'email'
];

/**
 * Appends a log entry to data.csv, creating the file and headers if it doesn't exist.
 * @param {Object} data - The data object received from the client.
 */
// Updated logToCSV implementation:
function logToCSV(data) {
  // Helper: get video keys sorted (video1, video2, ...)
  const videoKeys = Object.keys(data)
    .filter(k => /^video\d+$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.replace('video',''), 10);
      const nb = parseInt(b.replace('video',''), 10);
      return na - nb;
    });

  // Final headers we want for this row (base + any detected video keys)
  const desiredHeaders = BASE_CSV_HEADERS.concat(videoKeys);

  // Ensure LOG_FILE exists and the header matches desired headers (or extend it)
  const fileExists = fs.existsSync(LOG_FILE);

  try {
    if (!fileExists) {
      // Create file and write header
      const headerLine = desiredHeaders.join(',') + '\n';
      fs.writeFileSync(LOG_FILE, headerLine, 'utf8');
      console.log('Created data.csv with headers:', desiredHeaders);
    } else {
      // File exists: read current header and extend if needed
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      // Split into lines safely for CRLF / LF
      const lines = raw.split(/\r?\n/);
      const existingHeaderLine = lines[0] || '';
      const existingHeaders = existingHeaderLine.length ? existingHeaderLine.split(',') : [];

      // Find new headers that aren't in existingHeaders
      const missing = desiredHeaders.filter(h => !existingHeaders.includes(h));
      if (missing.length > 0) {
        // Merge headers by appending missing columns at the end
        const newHeader = existingHeaders.concat(missing);
        lines[0] = newHeader.join(',');
        // Write entire file back with updated header (previous rows remain but will lack values for new columns)
        fs.writeFileSync(LOG_FILE, lines.join('\n'), 'utf8');
        console.log('Updated CSV header to include new columns:', missing);
      }
    }

    // Now compute the row using the CSV header currently in the file (read it fresh)
    const currentRaw = fs.readFileSync(LOG_FILE, 'utf8');
    const currentFirstLine = currentRaw.split(/\r?\n/)[0] || '';
    const currentHeaders = currentFirstLine.length ? currentFirstLine.split(',') : BASE_CSV_HEADERS.slice();

    // Build row values in the same order as currentHeaders
    const rowValues = currentHeaders.map(header => {
      let value = data.hasOwnProperty(header) ? data[header] : '';

      // normalize booleans to 1/0
      if (typeof value === 'boolean') value = value ? 1 : 0;

      // ensure strings containing commas/quotes/newlines are quoted for CSV
      if (typeof value === 'string') {
        if (value.includes('"')) value = value.replace(/"/g, '""');
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
      }

      // convert undefined/null to empty string
      if (value === null || typeof value === 'undefined') value = '';

      return String(value);
    }).join(',');

    // Append the row
    fs.appendFileSync(LOG_FILE, rowValues + '\n', 'utf8');
    console.log('Logged data to CSV:', rowValues);

  } catch (err) {
    console.error('ERROR logging data to CSV:', err);
  }
}


// --- Config Persistence Functions ---

// Try to load persisted config (overrides resolved defaults)
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const obj = JSON.parse(raw);
      if (obj.host) OSC_HOST = obj.host;
      if (obj.port) OSC_PORT = parseInt(obj.port, 10);
      console.log('Loaded persisted config:', obj);
    }
  } catch (err) {
    console.warn('Could not load config file:', err.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ host: OSC_HOST, port: OSC_PORT }, null, 2), 'utf8');
    console.log('Persisted config to', CONFIG_FILE);
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

// load persisted config if exists
loadConfig();

// debug output of env + resolved values
console.log('=== ENV VALUES ===');
console.log('process.env.OSC_HOST:', process.env.OSC_HOST);
console.log('process.env.OSC_PORT:', process.env.OSC_PORT);
console.log('process.env.HTTP_PORT:', process.env.HTTP_PORT);
console.log('process.env.PASSWORD:', PASSWORD ? 'SET' : 'NOT SET');
console.log('Resolved values -> OSC_HOST:', OSC_HOST, 'OSC_PORT:', OSC_PORT, 'HTTP_PORT:', HTTP_PORT);
console.log('==================');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Expose current target to clients on load
app.get('/current-target', (req, res) => {
  res.json({ host: OSC_HOST, port: OSC_PORT });
});

const server = http.createServer(app);
server.listen(HTTP_PORT, () => {
  console.log(`HTTP server: http://localhost:${HTTP_PORT}`);
  console.log(`Initial OSC target: ${OSC_HOST}:${OSC_PORT}`);
});

const wss = new WebSocketServer({ server });
const WS_OPEN = 1;

// Regex to accept simple IPv4 or hostname (basic validation)
const validHostRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9\-\._]+$/;

wss.on('connection', (ws, req) => {
  console.log('WS client connected', req.socket.remoteAddress);
  ws.isAuthenticated = false; // per-connection auth flag

  // Send initial authoritative target to the client
  ws.send(JSON.stringify({ type: 'target_set', host: OSC_HOST, port: OSC_PORT }));

  ws.on('message', (raw) => {
    // DEBUG: raw WS message
    let rawText = raw.toString();
    console.log('RAW WS MESSAGE:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
      console.log('PARSED WS MESSAGE:', data);
    } catch (e) {
      console.error('Invalid JSON from WS:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
      return;
    }

    // --- New Handler for Data Logging ---
    if (data?.type === 'data_log') {
        logToCSV(data);
        return; // Logging handled, do not proceed to other checks
    }
    // ------------------------------------

    // Password checking
    if (data?.type === 'check_password') {
      const success = !!PASSWORD && data.password === PASSWORD;
      if (success) {
        ws.isAuthenticated = true;
      }
      console.log(`Password check from ${req.socket.remoteAddress}: ${success ? 'SUCCESS' : 'FAIL'}`);
      ws.send(JSON.stringify({ type: 'password_result', success }));
      return;
    }

    // Handle set_target -- require auth if PASSWORD is set
    if (data?.type === 'set_target') {
      // If a password is configured, require this connection to be authenticated
      if (PASSWORD && !ws.isAuthenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'unauthorized' }));
        return;
      }

      if (typeof data.host === 'string' && Number.isInteger(data.port)) {
        if (!validHostRegex.test(data.host)) {
          ws.send(JSON.stringify({ type: 'error', message: 'invalid host format' }));
          return;
        }

        const oldHost = OSC_HOST, oldPort = OSC_PORT;
        OSC_HOST = data.host;
        OSC_PORT = data.port;
        console.log(`OSC target updated -> ${oldHost}:${oldPort} -> ${OSC_HOST}:${OSC_PORT}`);

        // persist to disk so it survives restarts
        saveConfig();

        // Broadcast to all connected clients so everyone updates their UI
        const broadcastMsg = JSON.stringify({ type: 'target_set', host: OSC_HOST, port: OSC_PORT });
        wss.clients.forEach((client) => {
          if (client.readyState === WS_OPEN) {
            client.send(broadcastMsg);
          }
        });

        // Also acknowledge to the original requester
        ws.send(JSON.stringify({ type: 'target_set', host: OSC_HOST, port: OSC_PORT }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid host/port' }));
      }
      return;
    }

    // Normal forward: expect { address: '/@3/20', args: ['wtm', 1] }
    if (data?.address && Array.isArray(data.args)) {
      console.log(`Forwarding OSC to ${OSC_HOST}:${OSC_PORT} -> ${data.address} ${JSON.stringify(data.args)}`);

      const client = new Client(OSC_HOST, OSC_PORT);
      client.send(data.address, ...data.args, (err) => {
        if (err) {
          console.error('OSC send error:', err);
          ws.send(JSON.stringify({ type: 'error', message: String(err) }));
        } else {
          ws.send(JSON.stringify({ type: 'sent', address: data.address, args: data.args }));
        }
        client.close();
      });
    }
  });

  ws.on('close', () => {
    console.log('WS client disconnected');
  });
});
