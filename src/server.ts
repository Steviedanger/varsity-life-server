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

// 4. Lecture Check-In Route
app.post('/api/lectures/check-in', async (req, res) => {
  const { playerId, lectureId } = req.body;

  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { course: true }
    });

    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    const now = new Date();
    if (now < lecture.startTime || now > lecture.endTime) {
      return res.status(400).json({ error: 'Lecture is not currently active' });
    }

    // Check if player already checked in
    const existingAttendance = await prisma.attendance.findFirst({
      where: { playerId, lectureId }
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'Already checked in for this lecture' });
    }

    // Record attendance
    const attendance = await prisma.attendance.create({
      data: {
        playerId,
        lectureId,
        attended: true
      }
    });

    // Boost academic score based on player's campus grading system (CWA: +0.5 vs GPA: +0.05)
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { campus: true }
    });

    if (player) {
      const increment = player.campus.gradingSystem === 'CWA' ? 0.5 : 0.05;
      await prisma.player.update({
        where: { id: playerId },
        data: { academicScore: player.academicScore + increment }
      });
    }

    res.status(201).json({ message: 'Attendance recorded successfully', attendance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// 5. Automated Decay Interval (Runs every 60s)
setInterval(async () => {
  try {
    const now = new Date();

    // Find lectures that ended in the last minute
    const recentlyEndedLectures = await prisma.lecture.findMany({
      where: {
        endTime: {
          lte: now,
          gte: new Date(now.getTime() - 60000)
        }
      },
      include: { course: true }
    });

    for (const lecture of recentlyEndedLectures) {
      const campusPlayers = await prisma.player.findMany({
        where: { campusId: lecture.course.campusId },
        include: { campus: true }
      });

      for (const player of campusPlayers) {
        const attended = await prisma.attendance.findFirst({
          where: { playerId: player.id, lectureId: lecture.id }
        });

        if (!attended) {
          const penalty = player.campus.gradingSystem === 'CWA' ? 1.0 : 0.1;
          const newScore = Math.max(0, player.academicScore - penalty);

          await prisma.player.update({
            where: { id: player.id },
            data: { academicScore: newScore }
          });

          console.log(`[Academic Decay] Player ${player.username} missed lecture. Updated Score: ${newScore}`);
        }
      }
    }
  } catch (err) {
    console.error('Error running academic decay job:', err);
  }
}, 60000);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Varsity Life server running on port ${PORT}`);
});