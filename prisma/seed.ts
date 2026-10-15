import { PrismaClient, GradingSystem } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.campus.upsert({
    where: { name: 'KNUST' },
    update: {},
    create: {
      name: 'KNUST',
      country: 'Ghana',
      gradingSystem: GradingSystem.CWA,
    },
  });

  await prisma.campus.upsert({
    where: { name: 'University of Ghana (Legon)' },
    update: {},
    create: {
      name: 'University of Ghana (Legon)',
      country: 'Ghana',
      gradingSystem: GradingSystem.GPA,
    },
  });

  await prisma.campus.upsert({
    where: { name: 'Unilag' },
    update: {},
    create: {
      name: 'Unilag',
      country: 'Nigeria',
      gradingSystem: GradingSystem.GPA,
    },
  });

  console.log('Seeded campuses successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());