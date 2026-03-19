import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function envOrFallback(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

async function main() {
  console.log('Seeding database...');

  const adminPasswordPlain = envOrFallback('SEED_ADMIN_PASSWORD', crypto.randomBytes(9).toString('base64url'));
  const agentPasswordPlain = envOrFallback('SEED_AGENT_PASSWORD', crypto.randomBytes(9).toString('base64url'));
  const adminPasswordHash = await hashPassword(adminPasswordPlain);
  const agentPasswordHash = await hashPassword(agentPasswordPlain);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@milkdelivery.local' },
    update: {},
    create: {
      email: 'admin@milkdelivery.local',
      passwordHash: adminPasswordHash,
      name: 'Super Admin',
      role: 'super_admin',
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@milkdelivery.local' },
    update: {},
    create: {
      email: 'manager@milkdelivery.local',
      passwordHash: adminPasswordHash,
      name: 'Branch Manager',
      role: 'admin',
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@milkdelivery.local' },
    update: {},
    create: {
      email: 'agent1@milkdelivery.local',
      passwordHash: agentPasswordHash,
      name: 'Ravi Kumar',
      role: 'delivery_agent',
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@milkdelivery.local' },
    update: {},
    create: {
      email: 'agent2@milkdelivery.local',
      passwordHash: agentPasswordHash,
      name: 'Suresh Patel',
      role: 'delivery_agent',
    },
  });

  await prisma.user.upsert({
    where: { email: 'billing@milkdelivery.local' },
    update: {},
    create: {
      email: 'billing@milkdelivery.local',
      passwordHash: adminPasswordHash,
      name: 'Priya Sharma',
      role: 'billing_staff',
    },
  });

  const route1 = await prisma.route.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Route A - Sector 15',
      description: 'Morning route covering Sector 15 and nearby areas',
    },
  });

  const route2 = await prisma.route.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Route B - Sector 22',
      description: 'Morning route covering Sector 22 and market area',
    },
  });

  const customerData = [
    { phone: '9876543210', name: 'Amit Verma', routeId: route1.id },
    { phone: '9876543211', name: 'Neha Gupta', routeId: route1.id },
    { phone: '9876543212', name: 'Rajesh Singh', routeId: route1.id },
    { phone: '9876543213', name: 'Sunita Devi', routeId: route2.id },
    { phone: '9876543214', name: 'Vikram Joshi', routeId: route2.id },
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.upsert>>[] = [];
  for (const entry of customerData) {
    const customer = await prisma.customer.upsert({
      where: { phone: entry.phone },
      update: {},
      create: {
        name: entry.name,
        phone: entry.phone,
        status: 'active',
        routeId: entry.routeId,
      },
    });
    customers.push(customer);
  }

  for (const [index, customer] of customers.entries()) {
    const existingAddress = await prisma.customerAddress.findFirst({
      where: { customerId: customer.id, isPrimary: true },
    });

    if (!existingAddress) {
      await prisma.customerAddress.create({
        data: {
          customerId: customer.id,
          addressLine1: `${100 + index}, Block ${String.fromCharCode(65 + index)}`,
          addressLine2: `Sector ${index < 3 ? 15 : 22}`,
          city: 'Noida',
          state: 'Uttar Pradesh',
          pincode: '201301',
          isPrimary: true,
        },
      });
    }
  }

  const cowMilk = await prisma.product.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Cow Milk',
      category: 'Milk',
      description: 'Fresh farm cow milk',
    },
  });

  const cowMilk500ml = await prisma.productVariant.upsert({
    where: { sku: 'COW-500ML' },
    update: {},
    create: {
      productId: cowMilk.id,
      unitType: 'milliliters',
      quantityPerUnit: 500,
      sku: 'COW-500ML',
    },
  });

  const cowMilk1L = await prisma.productVariant.upsert({
    where: { sku: 'COW-1L' },
    update: {},
    create: {
      productId: cowMilk.id,
      unitType: 'liters',
      quantityPerUnit: 1,
      sku: 'COW-1L',
    },
  });

  const buffaloMilk = await prisma.product.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'Buffalo Milk',
      category: 'Milk',
      description: 'Rich and creamy buffalo milk',
    },
  });

  const buffaloMilk1L = await prisma.productVariant.upsert({
    where: { sku: 'BUF-1L' },
    update: {},
    create: {
      productId: buffaloMilk.id,
      unitType: 'liters',
      quantityPerUnit: 1,
      sku: 'BUF-1L',
    },
  });

  const curd = await prisma.product.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      name: 'Curd',
      category: 'Dairy',
      description: 'Fresh homemade curd',
    },
  });

  const curd500g = await prisma.productVariant.upsert({
    where: { sku: 'CURD-500G' },
    update: {},
    create: {
      productId: curd.id,
      unitType: 'kilograms',
      quantityPerUnit: 0.5,
      sku: 'CURD-500G',
    },
  });

  const priceDate = new Date();
  priceDate.setDate(priceDate.getDate() - 30);
  const effectiveDate = new Date(priceDate.toISOString().split('T')[0] as string);

  const priceEntries = [
    { productVariantId: cowMilk500ml.id, price: 30 },
    { productVariantId: cowMilk1L.id, price: 56 },
    { productVariantId: buffaloMilk1L.id, price: 70 },
    { productVariantId: curd500g.id, price: 40 },
  ];

  for (const entry of priceEntries) {
    const existingPrice = await prisma.productPrice.findFirst({
      where: {
        productVariantId: entry.productVariantId,
        effectiveDate,
        branch: null,
      },
    });

    if (!existingPrice) {
      await prisma.productPrice.create({
        data: {
          productVariantId: entry.productVariantId,
          price: entry.price,
          effectiveDate,
        },
      });
    }
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      customerId: customers[0].id,
      productVariantId: cowMilk1L.id,
      quantity: 1,
      frequencyType: 'daily',
      weekdays: [],
      startDate,
      status: 'active',
    },
  });

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      customerId: customers[1].id,
      productVariantId: buffaloMilk1L.id,
      quantity: 1,
      frequencyType: 'alternate_day',
      weekdays: [],
      startDate,
      status: 'active',
    },
  });

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      customerId: customers[2].id,
      productVariantId: curd500g.id,
      quantity: 2,
      frequencyType: 'custom_weekday',
      weekdays: [1, 3, 5],
      startDate,
      status: 'active',
    },
  });

  const routeCustomerAssignments = [
    { routeId: route1.id, customerId: customers[0].id, sequenceOrder: 1 },
    { routeId: route1.id, customerId: customers[1].id, sequenceOrder: 2 },
    { routeId: route1.id, customerId: customers[2].id, sequenceOrder: 3 },
    { routeId: route2.id, customerId: customers[3].id, sequenceOrder: 1 },
    { routeId: route2.id, customerId: customers[4].id, sequenceOrder: 2 },
  ];

  for (const entry of routeCustomerAssignments) {
    const existingAssignment = await prisma.routeCustomer.findFirst({
      where: { routeId: entry.routeId, customerId: entry.customerId },
    });

    if (!existingAssignment) {
      await prisma.routeCustomer.create({
        data: entry,
      });
    }
  }

  const routeAgentAssignments = [
    { routeId: route1.id, userId: agent1.id },
    { routeId: route2.id, userId: agent2.id },
  ];

  for (const entry of routeAgentAssignments) {
    const existingAssignment = await prisma.routeAgent.findFirst({
      where: { routeId: entry.routeId, userId: entry.userId },
    });

    if (!existingAssignment) {
      await prisma.routeAgent.create({ data: entry });
    }
  }

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const holidayDates = [
    { date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15), description: 'Holiday 1' },
    { date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 26), description: 'Holiday 2' },
  ];

  for (const holiday of holidayDates) {
    const existingHoliday = await prisma.holiday.findFirst({
      where: { holidayDate: holiday.date, isSystemWide: true },
    });

    if (!existingHoliday) {
      await prisma.holiday.create({
        data: {
          holidayDate: holiday.date,
          description: holiday.description,
          isSystemWide: true,
          createdBy: superAdmin.id,
        },
      });
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'billing_cycle_start_day' },
    update: {},
    create: {
      key: 'billing_cycle_start_day',
      value: 1,
      description: 'Day of month when billing cycle starts (1-28)',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'cutoff_time' },
    update: {},
    create: {
      key: 'cutoff_time',
      value: '21:00',
      description: 'Time after which subscription changes apply to next delivery (HH:mm)',
    },
  });

  console.log('Seed complete.');
  console.log('Seed credentials used for this run:');
  console.log(`  Admin/Billing password: ${adminPasswordPlain}`);
  console.log(`  Delivery Agent password: ${agentPasswordPlain}`);
  console.log('Set SEED_ADMIN_PASSWORD and SEED_AGENT_PASSWORD to control these values explicitly.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
