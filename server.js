// server.js
require('dotenv').config(); // loads .env if present

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const dgram = require('dgram');
const { Server: WebSocketServer } = require('ws');
const { Client, Server: OSCServer } = require('node-osc');

const CONFIG_FILE = path.join(__dirname, 'osc-config.json');
const LOG_FILE = path.join(__dirname, 'data.csv'); // New log file path

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const PASSWORD = process.env.PASSWORD || null; // if set, clients must authenticate

// Use a dedicated listen port for incoming OSC broadcasts.
// Defaults to OSC_PORT if OSC_LISTEN_PORT not provided.
const OSC_LISTEN_PORT = parseInt(process.env.OSC_LISTEN_PORT || process.env.OSC_PORT || '57120', 10);

let OSC_HOST = process.env.OSC_HOST || '127.0.0.1';
let OSC_PORT = parseInt(process.env.OSC_PORT || '57120', 10);

// --- CSV Logging Functions ---

let BASE_CSV_HEADERS = [
    'timestamp', 
    'name',
    'nationality', 
    'email',
    'phone'
];

/**
 * Appends a log entry to data.csv, creating the file and headers if it doesn't exist.
 * @param {Object} data - The data object received from the client.
 */
// Updated logToCSV implementation:
function logToCSV(data) {
  // Build list of extra keys (anything not in base headers)
  const extraKeys = Object.keys(data)
    .filter(k => !BASE_CSV_HEADERS.includes(k))
    // sort: keep videoN numeric order if possible, otherwise alphabetical
    .sort((a, b) => {
      const ma = a.match(/^video(\d+)$/i);
      const mb = b.match(/^video(\d+)$/i);
      if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10);
      if (ma) return -1; // put videoN before other extras
      if (mb) return 1;
      return a.localeCompare(b);
    });

  const desiredHeaders = BASE_CSV_HEADERS.concat(extraKeys);

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
      const lines = raw.split(/\r?\n/);
      const existingHeaderLine = lines[0] || '';
      const existingHeaders = existingHeaderLine.length ? existingHeaderLine.split(',') : [];

      // Find new headers that aren't in existingHeaders
      const missing = desiredHeaders.filter(h => !existingHeaders.includes(h));
      if (missing.length > 0) {
        const newHeader = existingHeaders.concat(missing);
        lines[0] = newHeader.join(',');
        fs.writeFileSync(LOG_FILE, lines.join('\n'), 'utf8');
        console.log('Updated CSV header to include new columns:', missing);
      }
    }

    // Read the current headers (after any update)
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

// --------------------
// Minimal OSC parser + UDP listener (dgram)
// --------------------
let udpServer = null;

function readPaddedString(buf, offset) {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  const str = buf.toString('utf8', offset, end);
  const total = end - offset + 1;
  const pad = (4 - (total % 4)) % 4;
  const nextOffset = end + 1 + pad;
  return { value: str, nextOffset };
}

function parseMessageBuffer(buf, baseOffset = 0) {
  let offset = baseOffset;
  const { value: address, nextOffset: addrNext } = readPaddedString(buf, offset);
  offset = addrNext;

  const { value: typeTagString, nextOffset: tagsNext } = readPaddedString(buf, offset);
  offset = tagsNext;
  if (!typeTagString || typeTagString[0] !== ',') {
    return { address, args: [], nextOffset: offset };
  }
  const tags = typeTagString.slice(1).split('');
  const args = [];

  for (const t of tags) {
    switch (t) {
      case 'i': {
        const val = buf.readInt32BE(offset);
        args.push(val);
        offset += 4;
        break;
      }
      case 'f': {
        const val = buf.readFloatBE(offset);
        args.push(val);
        offset += 4;
        break;
      }
      case 's':
      case 'S': {
        const { value: s, nextOffset } = readPaddedString(buf, offset);
        args.push(s);
        offset = nextOffset;
        break;
      }
      case 'h': {
        try {
          const val = buf.readBigInt64BE(offset);
          args.push(val);
        } catch (e) {
          try {
            const hi = buf.readUInt32BE(offset);
            const lo = buf.readUInt32BE(offset + 4);
            const combined = (BigInt(hi) << 32n) | BigInt(lo);
            args.push(combined);
          } catch (e2) {
            args.push(null);
          }
        }
        offset += 8;
        break;
      }
      case 'd': {
        const val = buf.readDoubleBE(offset);
        args.push(val);
        offset += 8;
        break;
      }
      case 't': {
        try {
          const val = buf.readBigInt64BE(offset);
          args.push(val);
        } catch (e) {
          args.push(buf.readDoubleBE(offset));
        }
        offset += 8;
        break;
      }
      case 'b': {
        const size = buf.readInt32BE(offset);
        offset += 4;
        const blob = buf.slice(offset, offset + size);
        args.push(blob);
        const pad = (4 - (size % 4)) % 4;
        offset += size + pad;
        break;
      }
      case 'T': {
        args.push(true);
        break;
      }
      case 'F': {
        args.push(false);
        break;
      }
      case 'N': {
        args.push(null);
        break;
      }
      case 'I': {
        args.push('Impulse');
        break;
      }
      default: {
        console.warn('Unknown OSC type tag encountered:', t);
        break;
      }
    }
  }

  return { address, args, nextOffset: offset };
}

function parseOSCBuffer(buf) {
  const header = buf.toString('utf8', 0, Math.min(8, buf.length));
  if (header.startsWith('#bundle')) {
    let offset = 8;
    while (offset % 4 !== 0) offset++;
    offset += 8;
    const messages = [];
    while (offset + 4 <= buf.length) {
      const size = buf.readInt32BE(offset);
      offset += 4;
      if (size <= 0 || offset + size > buf.length) break;
      const slice = buf.slice(offset, offset + size);
      const parsed = parseMessageBuffer(slice, 0);
      messages.push(parsed);
      offset += size;
    }
    return { type: 'bundle', elements: messages };
  } else {
    const parsed = parseMessageBuffer(buf, 0);
    return { type: 'message', message: parsed };
  }
}

function listLocalAddresses() {
  const netifs = os.networkInterfaces();
  const addrs = [];
  Object.keys(netifs).forEach(name => {
    netifs[name].forEach(info => {
      if (!info.internal) addrs.push({ if: name, family: info.family, address: info.address });
    });
  });
  return addrs;
}

function startUdpListener() {
  if (udpServer) {
    try { udpServer.close(); } catch (e) { /* ignore */ }
    udpServer = null;
  }

  udpServer = dgram.createSocket('udp4');

  udpServer.on('error', (err) => {
    console.error('UDP server error (socket):', err && err.code ? `${err.code} - ${err.message}` : err);
  });

  udpServer.on('message', (msg, rinfo) => {
    let parsed;
    try {
      parsed = parseOSCBuffer(msg);
    } catch (err) {
      console.error('Error parsing OSC buffer:', err && err.message ? err.message : err);
      return;
    }

    if (parsed.type === 'message' && parsed.message) {
      const { address, args } = parsed.message;
      const payload = { type: 'osc', address, args, info: { from: rinfo.address, port: rinfo.port } };
      const json = JSON.stringify(payload, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
      console.log('Received OSC -> forwarding to clients:', payload);
      wss.clients.forEach(client => {
        if (client.readyState === WS_OPEN) client.send(json);
      });
    } else if (parsed.type === 'bundle') {
      for (const el of parsed.elements) {
        const { address, args } = el;
        const payload = { type: 'osc', address, args, info: { from: rinfo.address, port: rinfo.port } };
        const json = JSON.stringify(payload, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
        console.log('Received OSC bundle element -> forwarding to clients:', payload);
        wss.clients.forEach(client => {
          if (client.readyState === WS_OPEN) client.send(json);
        });
      }
    } else {
      console.warn('Parsed OSC buffer unrecognized format:', parsed);
    }
  });

  console.log('Attempting UDP bind. OSC_HOST:', OSC_HOST, 'OSC_LISTEN_PORT:', OSC_LISTEN_PORT);
  console.log('Local non-internal network interfaces:', listLocalAddresses());

  function tryBind(hostToUse) {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        udpServer.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        udpServer.removeListener('error', onError);
        console.log(`UDP OSC listener bound to ${hostToUse}:${OSC_LISTEN_PORT}`);
        resolve();
      };
      udpServer.once('error', onError);
      udpServer.once('listening', onListening);
      try {
        udpServer.bind(OSC_LISTEN_PORT, hostToUse);
      } catch (bindErr) {
        udpServer.removeListener('error', onError);
        udpServer.removeListener('listening', onListening);
        reject(bindErr);
      }
    });
  }

  (async () => {
    try {
      await tryBind(OSC_HOST);
    } catch (err) {
      const code = err && err.code ? err.code : err;
      console.warn(`Failed to bind UDP to ${OSC_HOST}:${OSC_LISTEN_PORT} — ${code}. Falling back to 0.0.0.0`);
      try {
        await tryBind('0.0.0.0');
      } catch (err2) {
        console.error('Failed to bind UDP to 0.0.0.0 as fallback:', err2);
      }
    }
  })();
}

// start listener
startUdpListener();


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

        try {
          if (udpServer) {
            try { udpServer.close(); } catch (e) { /* ignore */ }
            udpServer = null;
          }
          startUdpListener();
        } catch (e) {
          console.warn('Failed to restart UDP listener after set_target:', e);
        }

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
