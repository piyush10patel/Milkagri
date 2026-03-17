import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────
  const defaultPassword = await hashPassword('Admin@123');
  const agentPassword = await hashPassword('Agent@123');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@milkdelivery.local' },
    update: {},
    create: {
      email: 'admin@milkdelivery.local',
      passwordHash: defaultPassword,
      name: 'Super Admin',
      role: 'super_admin',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'manager@milkdelivery.local' },
    update: {},
    create: {
      email: 'manager@milkdelivery.local',
      passwordHash: defaultPassword,
      name: 'Branch Manager',
      role: 'admin',
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@milkdelivery.local' },
    update: {},
    create: {
      email: 'agent1@milkdelivery.local',
      passwordHash: agentPassword,
      name: 'Ravi Kumar',
      role: 'delivery_agent',
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@milkdelivery.local' },
    update: {},
    create: {
      email: 'agent2@milkdelivery.local',
      passwordHash: agentPassword,
      name: 'Suresh Patel',
      role: 'delivery_agent',
    },
  });

  const billingStaff = await prisma.user.upsert({
    where: { email: 'billing@milkdelivery.local' },
    update: {},
    create: {
      email: 'billing@milkdelivery.local',
      passwordHash: defaultPassword,
      name: 'Priya Sharma',
      role: 'billing_staff',
    },
  });

  console.log('  ✓ Users seeded');

  // ── Routes ─────────────────────────────────────────────────────────────
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

  console.log('  ✓ Routes seeded');

  // ── Customers ──────────────────────────────────────────────────────────
  const customerData = [
    { phone: '9876543210', name: 'Amit Verma', routeId: route1.id },
    { phone: '9876543211', name: 'Neha Gupta', routeId: route1.id },
    { phone: '9876543212', name: 'Rajesh Singh', routeId: route1.id },
    { phone: '9876543213', name: 'Sunita Devi', routeId: route2.id },
    { phone: '9876543214', name: 'Vikram Joshi', routeId: route2.id },
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.upsert>>[] = [];
  for (const c of customerData) {
    const customer = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        name: c.name,
        phone: c.phone,
        status: 'active',
        routeId: c.routeId,
      },
    });
    customers.push(customer);
  }

  // Addresses for each customer
  for (const [i, customer] of customers.entries()) {
    const existing = await prisma.customerAddress.findFirst({
      where: { customerId: customer.id, isPrimary: true },
    });
    if (!existing) {
      await prisma.customerAddress.create({
        data: {
          customerId: customer.id,
          addressLine1: `${100 + i}, Block ${String.fromCharCode(65 + i)}`,
          addressLine2: `Sector ${i < 3 ? 15 : 22}`,
          city: 'Noida',
          state: 'Uttar Pradesh',
          pincode: '201301',
          isPrimary: true,
        },
      });
    }
  }

  console.log('  ✓ Customers and addresses seeded');

  // ── Products, Variants, Prices ─────────────────────────────────────────
  // Cow Milk
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

  // Buffalo Milk
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

  // Curd
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

  // Prices (effective from 30 days ago)
  const priceDate = new Date();
  priceDate.setDate(priceDate.getDate() - 30);
  const priceDateStr = priceDate.toISOString().split('T')[0];

  const priceEntries = [
    { variantId: cowMilk500ml.id, price: 30, date: priceDateStr },
    { variantId: cowMilk1L.id, price: 56, date: priceDateStr },
    { variantId: buffaloMilk1L.id, price: 70, date: priceDateStr },
    { variantId: curd500g.id, price: 40, date: priceDateStr },
  ];

  for (const p of priceEntries) {
    const existing = await prisma.productPrice.findFirst({
      where: {
        productVariantId: p.variantId,
        effectiveDate: new Date(p.date),
        branch: null,
      },
    });
    if (!existing) {
      await prisma.productPrice.create({
        data: {
          productVariantId: p.variantId,
          price: p.price,
          effectiveDate: new Date(p.date),
        },
      });
    }
  }

  console.log('  ✓ Products, variants, and prices seeded');

  // ── Subscriptions ──────────────────────────────────────────────────────
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 14); // started 2 weeks ago

  // Daily subscription - Amit gets cow milk 1L every day
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

  // Alternate day subscription - Neha gets buffalo milk every other day
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

  // Custom weekday subscription - Rajesh gets curd on Mon, Wed, Fri
  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      customerId: customers[2].id,
      productVariantId: curd500g.id,
      quantity: 2,
      frequencyType: 'custom_weekday',
      weekdays: [1, 3, 5], // Mon, Wed, Fri
      startDate,
      status: 'active',
    },
  });

  console.log('  ✓ Subscriptions seeded');

  // ── Route Customers (sequence assignments) ─────────────────────────────
  const routeCustomerAssignments = [
    { routeId: route1.id, customerId: customers[0].id, seq: 1 },
    { routeId: route1.id, customerId: customers[1].id, seq: 2 },
    { routeId: route1.id, customerId: customers[2].id, seq: 3 },
    { routeId: route2.id, customerId: customers[3].id, seq: 1 },
    { routeId: route2.id, customerId: customers[4].id, seq: 2 },
  ];

  for (const rc of routeCustomerAssignments) {
    const existing = await prisma.routeCustomer.findFirst({
      where: { routeId: rc.routeId, customerId: rc.customerId },
    });
    if (!existing) {
      await prisma.routeCustomer.create({
        data: {
          routeId: rc.routeId,
          customerId: rc.customerId,
          sequenceOrder: rc.seq,
        },
      });
    }
  }

  // ── Route Agents ───────────────────────────────────────────────────────
  const routeAgentAssignments = [
    { routeId: route1.id, userId: agent1.id },
    { routeId: route2.id, userId: agent2.id },
  ];

  for (const ra of routeAgentAssignments) {
    const existing = await prisma.routeAgent.findFirst({
      where: { routeId: ra.routeId, userId: ra.userId },
    });
    if (!existing) {
      await prisma.routeAgent.create({
        data: { routeId: ra.routeId, userId: ra.userId },
      });
    }
  }

  console.log('  ✓ Route assignments seeded');

  // ── Holidays ───────────────────────────────────────────────────────────
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const holiday1Date = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15);
  const holiday2Date = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 26);

  const existingHoliday1 = await prisma.holiday.findFirst({
    where: { holidayDate: holiday1Date, isSystemWide: true },
  });
  if (!existingHoliday1) {
    await prisma.holiday.create({
      data: {
        holidayDate: holiday1Date,
        description: 'Independence Day',
        isSystemWide: true,
        createdBy: superAdmin.id,
      },
    });
  }

  const existingHoliday2 = await prisma.holiday.findFirst({
    where: { holidayDate: holiday2Date, isSystemWide: true },
  });
  if (!existingHoliday2) {
    await prisma.holiday.create({
      data: {
        holidayDate: holiday2Date,
        description: 'Republic Day',
        isSystemWide: true,
        createdBy: superAdmin.id,
      },
    });
  }

  console.log('  ✓ Holidays seeded');

  // ── System Settings ────────────────────────────────────────────────────
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

  console.log('  ✓ System settings seeded');
  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
