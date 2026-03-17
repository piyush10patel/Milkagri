import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockCustomerFindUnique = vi.fn();
const mockPaymentCreate = vi.fn();
const mockInvoiceFindUnique = vi.fn();
const mockInvoiceUpdate = vi.fn();
const mockInvoiceFindMany = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    customer: {
      findUnique: (...args: any[]) => mockCustomerFindUnique(...args),
    },
    payment: {
      create: (...args: any[]) => mockPaymentCreate(...args),
      findMany: (...args: any[]) => mockPaymentFindMany(...args),
    },
    invoice: {
      findUnique: (...args: any[]) => mockInvoiceFindUnique(...args),
      findMany: (...args: any[]) => mockInvoiceFindMany(...args),
      update: (...args: any[]) => mockInvoiceUpdate(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
  redis: {},
}));

const mockCreateLedgerEntry = vi.fn().mockResolvedValue({});
vi.mock('../ledger/ledger.service.js', () => ({
  createLedgerEntry: (...args: any[]) => mockCreateLedgerEntry(...args),
}));

import { recordPayment, recordCollection, getCollectionReconciliation, getOutstandingSummary } from './payments.service.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseInvoice = {
  id: 'inv-1',
  customerId: 'cust-1',
  isCurrent: true,
  openingBalance: new Prisma.Decimal('100'),
  totalCharges: new Prisma.Decimal('500'),
  totalDiscounts: new Prisma.Decimal('0'),
  totalAdjustments: new Prisma.Decimal('0'),
  totalPayments: new Prisma.Decimal('0'),
  closingBalance: new Prisma.Decimal('600'),
  paymentStatus: 'unpaid',
  billingCycleStart: new Date('2024-01-01'),
  billingCycleEnd: new Date('2024-01-31'),
};

function setupTransaction() {
  mockTransaction.mockImplementation(async (fn: Function) => {
    const tx = {
      payment: {
        create: mockPaymentCreate,
      },
      invoice: {
        findUnique: mockInvoiceFindUnique,
        update: mockInvoiceUpdate,
      },
    };
    return fn(tx);
  });
}

// ---------------------------------------------------------------------------
// Test: Partial payment updates invoice status to 'partial' (Req 10.3)
// ---------------------------------------------------------------------------
describe('recordPayment — partial payment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates invoice status to partial when payment is less than closing balance', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: 'cust-1' });
    setupTransaction();

    mockPaymentCreate.mockResolvedValueOnce({
      id: 'pay-1',
      customerId: 'cust-1',
      invoiceId: 'inv-1',
      amount: new Prisma.Decimal('200'),
    });

    // applyPaymentToInvoice will look up the invoice
    mockInvoiceFindUnique.mockResolvedValueOnce({ ...baseInvoice });
    mockInvoiceUpdate.mockResolvedValueOnce({});

    await recordPayment(
      {
        customerId: 'cust-1',
        invoiceId: 'inv-1',
        amount: 200,
        paymentMethod: 'cash',
        paymentDate: '2024-02-01',
      },
      'user-1',
    );

    // totalPayments = 0 + 200 = 200
    // closingBalance = 100 + 500 - 0 + 0 - 200 = 400 (> 0, payments > 0 → partial)
    expect(mockInvoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          totalPayments: new Prisma.Decimal('200'),
          closingBalance: new Prisma.Decimal('400'),
          paymentStatus: 'partial',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Test: Full payment updates invoice status to 'paid' (Req 10.3)
// ---------------------------------------------------------------------------
describe('recordPayment — full payment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates invoice status to paid when payment covers closing balance', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: 'cust-1' });
    setupTransaction();

    mockPaymentCreate.mockResolvedValueOnce({
      id: 'pay-1',
      customerId: 'cust-1',
      invoiceId: 'inv-1',
      amount: new Prisma.Decimal('600'),
    });

    mockInvoiceFindUnique.mockResolvedValueOnce({ ...baseInvoice });
    mockInvoiceUpdate.mockResolvedValueOnce({});

    await recordPayment(
      {
        customerId: 'cust-1',
        invoiceId: 'inv-1',
        amount: 600,
        paymentMethod: 'upi',
        paymentDate: '2024-02-01',
      },
      'user-1',
    );

    // totalPayments = 0 + 600 = 600
    // closingBalance = 100 + 500 - 0 + 0 - 600 = 0 (≤ 0 → paid)
    expect(mockInvoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          totalPayments: new Prisma.Decimal('600'),
          closingBalance: new Prisma.Decimal('0'),
          paymentStatus: 'paid',
        }),
      }),
    );
  });

  it('updates invoice status to paid when overpayment makes closing balance negative', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: 'cust-1' });
    setupTransaction();

    mockPaymentCreate.mockResolvedValueOnce({
      id: 'pay-1',
      amount: new Prisma.Decimal('700'),
    });

    mockInvoiceFindUnique.mockResolvedValueOnce({ ...baseInvoice });
    mockInvoiceUpdate.mockResolvedValueOnce({});

    await recordPayment(
      {
        customerId: 'cust-1',
        invoiceId: 'inv-1',
        amount: 700,
        paymentMethod: 'bank_transfer',
        paymentDate: '2024-02-01',
      },
      'user-1',
    );

    // closingBalance = 100 + 500 - 0 + 0 - 700 = -100 (≤ 0 → paid)
    expect(mockInvoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalPayments: new Prisma.Decimal('700'),
          closingBalance: new Prisma.Decimal('-100'),
          paymentStatus: 'paid',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Test: Advance payment (no invoice) creates payment record (Req 10.4)
// ---------------------------------------------------------------------------
describe('recordPayment — advance payment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates payment without invoiceId for advance payments', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: 'cust-1' });
    setupTransaction();

    const createdPayment = {
      id: 'pay-adv',
      customerId: 'cust-1',
      invoiceId: null,
      amount: new Prisma.Decimal('500'),
      isFieldCollection: false,
    };
    mockPaymentCreate.mockResolvedValueOnce(createdPayment);

    const result = await recordPayment(
      {
        customerId: 'cust-1',
        amount: 500,
        paymentMethod: 'cash',
        paymentDate: '2024-02-01',
      },
      'user-1',
    );

    expect(result.invoiceId).toBeNull();
    // No invoice update should happen for advance payments
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: Field collection by delivery agent (Req 10.6, 10.7)
// ---------------------------------------------------------------------------
describe('recordCollection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a field collection payment with isFieldCollection=true and collectedBy set', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: 'cust-1' });
    setupTransaction();

    const createdPayment = {
      id: 'pay-coll',
      customerId: 'cust-1',
      invoiceId: null,
      amount: new Prisma.Decimal('100'),
      isFieldCollection: true,
      collectedBy: 'agent-1',
      recordedBy: 'agent-1',
    };
    mockPaymentCreate.mockResolvedValueOnce(createdPayment);

    const result = await recordCollection(
      {
        customerId: 'cust-1',
        amount: 100,
        paymentMethod: 'cash',
        paymentDate: '2024-02-01',
      },
      'agent-1',
    );

    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isFieldCollection: true,
          collectedBy: 'agent-1',
          recordedBy: 'agent-1',
        }),
      }),
    );
    expect(result.isFieldCollection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Customer not found
// ---------------------------------------------------------------------------
describe('recordPayment — validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when customer does not exist', async () => {
    mockCustomerFindUnique.mockResolvedValueOnce(null);
    await expect(
      recordPayment(
        {
          customerId: 'nonexistent',
          amount: 100,
          paymentMethod: 'cash',
          paymentDate: '2024-02-01',
        },
        'user-1',
      ),
    ).rejects.toThrow('Customer not found');
  });
});

// ---------------------------------------------------------------------------
// Test: Reconciliation groups collections by agent (Req 10.8)
// ---------------------------------------------------------------------------
describe('getCollectionReconciliation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('groups field collections by agent and calculates totals', async () => {
    mockPaymentFindMany.mockResolvedValueOnce([
      {
        id: 'p1',
        amount: new Prisma.Decimal('100'),
        collectedBy: 'agent-1',
        collector: { id: 'agent-1', name: 'Agent One' },
        customer: { id: 'c1', name: 'Cust 1', phone: '111' },
      },
      {
        id: 'p2',
        amount: new Prisma.Decimal('200'),
        collectedBy: 'agent-1',
        collector: { id: 'agent-1', name: 'Agent One' },
        customer: { id: 'c2', name: 'Cust 2', phone: '222' },
      },
      {
        id: 'p3',
        amount: new Prisma.Decimal('150'),
        collectedBy: 'agent-2',
        collector: { id: 'agent-2', name: 'Agent Two' },
        customer: { id: 'c3', name: 'Cust 3', phone: '333' },
      },
    ]);

    const result = await getCollectionReconciliation('2024-02-01');

    expect(result.agents).toHaveLength(2);

    const agent1 = result.agents.find((a) => a.agent.id === 'agent-1');
    expect(agent1).toBeDefined();
    expect(agent1!.totalCollected.eq(new Prisma.Decimal('300'))).toBe(true);
    expect(agent1!.collectionCount).toBe(2);

    const agent2 = result.agents.find((a) => a.agent.id === 'agent-2');
    expect(agent2).toBeDefined();
    expect(agent2!.totalCollected.eq(new Prisma.Decimal('150'))).toBe(true);
    expect(agent2!.collectionCount).toBe(1);

    expect(result.grandTotal.eq(new Prisma.Decimal('450'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Outstanding summary (Req 10.9)
// ---------------------------------------------------------------------------
describe('getOutstandingSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates outstanding invoices by customer', async () => {
    mockInvoiceFindMany.mockResolvedValueOnce([
      {
        id: 'inv-1',
        customerId: 'cust-1',
        closingBalance: new Prisma.Decimal('300'),
        billingCycleStart: new Date('2024-01-01'),
        customer: { id: 'cust-1', name: 'Customer A', phone: '111' },
      },
      {
        id: 'inv-2',
        customerId: 'cust-1',
        closingBalance: new Prisma.Decimal('200'),
        billingCycleStart: new Date('2024-02-01'),
        customer: { id: 'cust-1', name: 'Customer A', phone: '111' },
      },
      {
        id: 'inv-3',
        customerId: 'cust-2',
        closingBalance: new Prisma.Decimal('150'),
        billingCycleStart: new Date('2024-01-01'),
        customer: { id: 'cust-2', name: 'Customer B', phone: '222' },
      },
    ]);

    const result = await getOutstandingSummary({});

    expect(result.data).toHaveLength(2);

    // Default sort: by outstanding desc → cust-1 (500) first, cust-2 (150) second
    const first = result.data[0];
    expect(first.customer.id).toBe('cust-1');
    expect(first.totalOutstanding.eq(new Prisma.Decimal('500'))).toBe(true);
    expect(first.invoiceCount).toBe(2);

    const second = result.data[1];
    expect(second.customer.id).toBe('cust-2');
    expect(second.totalOutstanding.eq(new Prisma.Decimal('150'))).toBe(true);
    expect(second.invoiceCount).toBe(1);
  });
});
