import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:4000';
const KNUST_CAMPUS_ID = 'fbdaddcc-8d85-4569-9d17-6c15734a1e0b';

async function runTest() {
  const socketAma = io(SERVER_URL);
  const socketKofi = io(SERVER_URL);

  // Helper promise to ensure connection establishes before emitting
  const waitForConnect = (socket: any, name: string) =>
    new Promise<void>((resolve) => {
      socket.on('connect', () => {
        console.log(`[${name}] Connected with Socket ID: ${socket.id}`);
        resolve();
      });
    });

  // 1. Wait for both socket connections to establish
  await Promise.all([
    waitForConnect(socketAma, 'Ama'),
    waitForConnect(socketKofi, 'Kofi')
  ]);

  // 2. Attach broadcast event listeners to Ama's client
  socketAma.on('playerJoined', (data) => {
    console.log(`[Ama Client] Broadcast Received -> ${data.username} joined channel!`);
  });

  socketAma.on('playerMoved', (data) => {
    console.log(`[Ama Client] Broadcast Received -> ${data.socketId} moved to X: ${data.x}, Y: ${data.y}`);
  });

  // 3. Ama joins KNUST campus channel first
  socketAma.emit('joinCampus', {
    playerId: 'ama-player-id-456',
    username: 'Ama_Dev',
    campusId: KNUST_CAMPUS_ID
  });

  await new Promise((res) => setTimeout(res, 500));

  // 4. Kofi joins KNUST campus channel (Ama will catch this broadcast)
  socketKofi.emit('joinCampus', {
    playerId: 'df30390a-2059-4769-9e27-cffd73ee75e3',
    username: 'Kofi_Dev',
    campusId: KNUST_CAMPUS_ID
  });

  await new Promise((res) => setTimeout(res, 1000));

  // 5. Kofi moves on 2D grid
  console.log('\n--- Simulating Kofi walking across 2D grid ---');
  socketKofi.emit('playerMove', { x: 12.5, y: 34.0 });

  await new Promise((res) => setTimeout(res, 1000));

  console.log('\n--- Test Complete: Disconnecting clients ---');
  socketKofi.disconnect();
  socketAma.disconnect();
  process.exit(0);
}

runTest();