const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, 'test-listen.log');

function log(msg) {
  fs.appendFileSync(logPath, msg + '\n');
  console.log(msg);
}

log('Starting test...');
try {
  const express = require('express');
  const app = express();
  app.get('/', (req, res) => res.send('ok'));
  log('Express imported and instantiated.');
  
  const server = app.listen(3002, () => {
    log('Server successfully listening on port 3002!');
    server.close(() => {
      log('Server closed successfully.');
      process.exit(0);
    });
  });
} catch (e) {
  log('Error occurred: ' + e.stack);
  process.exit(1);
}
