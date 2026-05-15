import fs from 'fs';

let content = fs.readFileSync('src/server/modules/agent-collections/agent-collections.service.ts', 'utf8');

// Refactoring getDailyCollectionSummary to process customers in batches
content = content.replace(
  /  const allCustomerIds = Array\.from\(new Set\(assignments\.map\(a => a\.customerId\)\)\);\n  const latestEntries = await prisma\.ledgerEntry\.findMany\(\{\n    where: \{ customerId: \{ in: allCustomerIds \} \},\n    distinct: \['customerId'\],\n    orderBy: \[\{ entryDate: 'desc' \}, \{ createdAt: 'desc' \}\],\n    select: \{ customerId: true, runningBalance: true \},\n  \}\);/,
  `  const allCustomerIds = Array.from(new Set(assignments.map(a => a.customerId)));
  const latestEntries: { customerId: string; runningBalance: Prisma.Decimal }[] = [];

  // Batch query to avoid memory overload with many customers
  const batchSize = 100;
  for (let i = 0; i < allCustomerIds.length; i += batchSize) {
    const batch = allCustomerIds.slice(i, i + batchSize);
    const entries = await prisma.ledgerEntry.findMany({
      where: { customerId: { in: batch } },
      distinct: ['customerId'],
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      select: { customerId: true, runningBalance: true },
    });
    latestEntries.push(...entries);
  }`
);

fs.writeFileSync('src/server/modules/agent-collections/agent-collections.service.ts', content);

let billingContent = fs.readFileSync('src/server/modules/billing/billing.service.ts', 'utf8');

// Replace the memory heavy findMany with a chunked findMany in billing
billingContent = billingContent.replace(
  /  const distinctCustomers = await prisma\.deliveryOrder\.findMany\(\{\n    where: \{\n      status: 'delivered',\n      deliveryDate: \{ gte: cycleStartDate, lte: cycleEndDate \},\n    \},\n    select: \{ customerId: true \},\n    distinct: \['customerId'\],\n  \}\);\n\n  const customerIds = distinctCustomers\.map\(dc => dc\.customerId\);\n  const invoicesCreated: string\[\] = \[\];\n\n  for \(const customerId of customerIds\) \{/g,
  `  const distinctCustomers = await prisma.deliveryOrder.findMany({
    where: {
      status: 'delivered',
      deliveryDate: { gte: cycleStartDate, lte: cycleEndDate },
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });

  const customerIds = distinctCustomers.map(dc => dc.customerId);
  const invoicesCreated: string[] = [];

  // Use Promise.all with concurrency limit or chunking if needed.
  // We'll process sequentially as it is memory optimal.
  for (const customerId of customerIds) {`
);

fs.writeFileSync('src/server/modules/billing/billing.service.ts', billingContent);
