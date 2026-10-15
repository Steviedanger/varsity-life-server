import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// 1. Fetch available campuses (KNUST, UG, Unilag, etc.)
app.get('/api/campuses', async (req, res) => {
  try {
    const campuses = await prisma.campus.findMany();
    res.json(campuses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campuses' });
  }
});

// 2. Character Creation & Admission Route
app.post('/api/players/admit', async (req, res) => {
  const { username, campusId } = req.body;
  try {
    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });

    // Set initial academic score based on institution grading system (CWA: 70.0 vs GPA: 3.0)
    const initialScore = campus.gradingSystem === 'CWA' ? 70.0 : 3.0;

    const player = await prisma.player.create({
      data: {
        username,
        campusId,
        academicScore: initialScore
      },
      include: { campus: true }
    });

    res.status(201).json(player);
  } catch (err) {
    res.status(400).json({ error: 'Player creation failed' });
  }
});

// 3. Real-Time Socket.io Connection & Tilemap Movement
const activePlayers = new Map<string, { x: number; y: number; username: string; campusId: string }>();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Join designated campus channel
  socket.on('joinCampus', ({ playerId, username, campusId }) => {
    socket.join(campusId);
    activePlayers.set(socket.id, { x: 0, y: 0, username, campusId });

    io.to(campusId).emit('playerJoined', { socketId: socket.id, username });
  });

  // Sync 2D movement across connected campus players
  socket.on('playerMove', (data: { x: number; y: number }) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      socket.to(player.campusId).emit('playerMoved', {
        socketId: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('disconnect', () => {
    const player = activePlayers.get(socket.id);
    if (player) {
      io.to(player.campusId).emit('playerLeft', { socketId: socket.id });
      activePlayers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Varsity Life server running on port ${PORT}`);
});