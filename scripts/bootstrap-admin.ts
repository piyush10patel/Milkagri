import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { bootstrapSuperAdmin } from '../src/server/lib/bootstrapAdmin.js';

const prisma = new PrismaClient();

async function main() {
  const email = await bootstrapSuperAdmin(prisma);
  console.log(`Super admin ready: ${email}`);
}

main()
  .catch((error) => {
    console.error('Failed to bootstrap admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
