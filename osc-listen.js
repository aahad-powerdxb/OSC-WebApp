// osc-listen.js
const { Server } = require('node-osc');
const PORT = 57120;
const s = new Server(PORT, '0.0.0.0', () => {
  console.log('Listening for OSC on port', PORT);
});
s.on('message', (msg, rinfo) => {
  console.log('OSC Message:', msg);
});