// launch-prod.js
// Launches both backend and frontend (production build) for TailwindsStatus

const { spawn } = require('child_process');

// Start backend
const backend = spawn('node', ['src/backend/backend.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});


backend.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

