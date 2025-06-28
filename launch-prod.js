// launch-prod.js
// Launches both backend and frontend (production build) for TailwindsStatus

const { spawn } = require('child_process');
const path = require('path');

// Start backend
const backend = spawn('node', ['backend.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});


backend.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

