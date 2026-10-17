import { PrismaClient, GradingSystem } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const knust = await prisma.campus.upsert({
    where: { name: 'KNUST' },
    update: {},
    create: {
      name: 'KNUST',
      country: 'Ghana',
      gradingSystem: GradingSystem.CWA,
    },
  });

  const location = await prisma.location.create({
    data: {
      name: 'Great Hall Auditorium',
      type: 'LECTURE_HALL',
      campusId: knust.id
    }
  });

  const course = await prisma.course.create({
    data: {
      code: 'CSM 251',
      title: 'Data Structures and Algorithms',
      creditHours: 3,
      campusId: knust.id
    }
  });

  // Active lecture setup (starts 5 min ago, ends 30 min from now)
  const now = new Date();
  await prisma.lecture.create({
    data: {
      courseId: course.id,
      locationId: location.id,
      startTime: new Date(now.getTime() - 5 * 60000),
      endTime: new Date(now.getTime() + 30 * 60000)
    }
  });

  console.log('Seeded course and active lecture for KNUST!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());