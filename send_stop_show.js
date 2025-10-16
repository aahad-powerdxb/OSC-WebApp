// send_stop_show.js
// npm i node-osc
const { Client } = require('node-osc');

const SERVER_IP = process.argv[2] || '192.168.113.83'; // put your server IP here or pass as arg
const PORT = parseInt(process.argv[3] || '8000', 10);

const client = new Client(SERVER_IP, PORT);

console.log(`Sending /@3/30 to ${SERVER_IP}:${PORT} ...`);
client.send('/@3/30', 'stop show', (err) => {
  if (err) console.error('Send error:', err);
  else console.log('Sent OK');
  client.close();
});
