import { PrismaClient } from '@prisma/client';
import { getAgentCollectionDashboard } from './src/server/modules/milk-collections/milk-collections.service.js';

const prisma = new PrismaClient();

async function run() {
  const agentUser = await prisma.user.findFirst({
    where: { role: 'delivery_agent' }
  });

  if (!agentUser) {
    console.log('No delivery agent found');
    process.exit(1);
  }

  console.log('Found agent:', agentUser.email);
  
  try {
    const result = await getAgentCollectionDashboard(agentUser.id, '2026-05-14');
    console.log('Success:', JSON.stringify(result, null, 2).substring(0, 500));
  } catch (err) {
    console.error('Error in getAgentCollectionDashboard:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
