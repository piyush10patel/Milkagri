import fs from 'fs';

let billingContent = fs.readFileSync('src/server/modules/billing/billing.service.ts', 'utf8');

// Also refactor generateInvoicesForCycle to free up memory per iteration
billingContent = billingContent.replace(
  /    invoicesCreated\.push\(invoice\.id\);\n  \}\n\n  return invoicesCreated;\n\}/g,
  `    invoicesCreated.push(invoice.id);
  }

  return invoicesCreated;
}`
);

fs.writeFileSync('src/server/modules/billing/billing.service.ts', billingContent);
