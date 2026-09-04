const { spawn } = require('child_process');
const children = [
  spawn(process.execPath, ['server.cjs'], { stdio: 'inherit', env: process.env }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'vite:dev'], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
];
const stop = () => children.forEach(child => child.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach(child => child.on('exit', code => { if (code && code !== 0) process.exitCode = code; }));
