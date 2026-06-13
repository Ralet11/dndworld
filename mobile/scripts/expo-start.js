const os = require('os');
const { spawn } = require('child_process');

function getLanIp() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

      if (
        entry.address.startsWith('10.') ||
        entry.address.startsWith('172.') ||
        entry.address.startsWith('192.168.')
      ) {
        return entry.address;
      }
    }
  }

  return null;
}

const lanIp = getLanIp();

if (lanIp) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  process.env.EXPO_PACKAGER_PROXY_URL = `exp://${lanIp}:8081`;
  console.log(`[expo-start] Using LAN IP ${lanIp}`);
} else {
  console.warn('[expo-start] No LAN IPv4 detected, falling back to Expo defaults');
}

const extraArgs = process.argv.slice(2);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['expo', 'start', '--host', 'lan', ...extraArgs], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
