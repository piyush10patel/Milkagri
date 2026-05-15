import fs from 'fs';

let billingContent = fs.readFileSync('src/server/modules/billing/billing.service.ts', 'utf8');

billingContent = billingContent.replace(
  /  const customerIds = distinctCustomers\.map\(dc => dc\.customerId\);\n  const invoicesCreated: string\[\] = \[\];\n\n  \/\/ Use Promise\.all with concurrency limit or chunking if needed\.\n  \/\/ We'll process sequentially as it is memory optimal\.\n  for \(const customerId of customerIds\) \{/g,
  `  const customerIds = distinctCustomers.map(dc => dc.customerId);
  const invoicesCreated: string[] = [];

  // We'll process sequentially as it is memory optimal.
  for (const customerId of customerIds) {`
);

fs.writeFileSync('src/server/modules/billing/billing.service.ts', billingContent);
