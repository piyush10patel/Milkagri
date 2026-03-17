import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma with vi.fn() for each method used
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();

const mockAddressFindMany = vi.fn();
const mockAddressFindFirst = vi.fn();
const mockAddressCreate = vi.fn();
const mockAddressUpdate = vi.fn();
const mockAddressUpdateMany = vi.fn();

const mockSubFindMany = vi.fn();
const mockSubUpdateMany = vi.fn();
const mockSubChangeCreateMany = vi.fn();

const mockTransaction = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    customer: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      create: (...args: any[]) => mockCreate(...args),
      update: (...args: any[]) => mockUpdate(...args),
      count: (...args: any[]) => mockCount(...args),
    },
    customerAddress: {
      findMany: (...args: any[]) => mockAddressFindMany(...args),
      findFirst: (...args: any[]) => mockAddressFindFirst(...args),
      create: (...args: any[]) => mockAddressCreate(...args),
      update: (...args: any[]) => mockAddressUpdate(...args),
      updateMany: (...args: any[]) => mockAddressUpdateMany(...args),
    },
    subscription: {
      findMany: (...args: any[]) => mockSubFindMany(...args),
      updateMany: (...args: any[]) => mockSubUpdateMany(...args),
    },
    subscriptionChange: {
      createMany: (...args: any[]) => mockSubChangeCreateMany(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
  redis: {},
}));

import { createCustomer, changeCustomerStatus, createAddress } from './customers.service.js';

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-1',
    name: 'John Doe',
    phone: '9876543210',
    email: null,
    status: 'active',
    deliveryNotes: null,
    preferredDeliveryWindow: null,
    routeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    addresses: [],
    route: null,
    ...overrides,
  };
}

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    customerId: 'cust-1',
    status: 'active',
    endDate: null,
    ...overrides,
  };
}

describe('customers.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // createCustomer
  // -----------------------------------------------------------------------
  describe('createCustomer', () => {
    it('creates customer successfully with valid data', async () => {
      const expected = makeCustomer();
      mockFindUnique.mockResolvedValue(null); // no existing phone
      mockCreate.mockResolvedValue(expected);

      const result = await createCustomer({ name: 'John Doe', phone: '9876543210' });

      expect(result).toEqual(expected);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'John Doe', phone: '9876543210' }),
        }),
      );
    });

    it('throws ConflictError when phone already exists', async () => {
      mockFindUnique.mockResolvedValue(makeCustomer()); // phone exists

      await expect(
        createCustomer({ name: 'Jane', phone: '9876543210' }),
      ).rejects.toThrow('A customer with this phone number already exists');
    });

    it('creates customer with primary address when address provided', async () => {
      const expected = makeCustomer({
        addresses: [{ id: 'addr-1', addressLine1: '123 Main St', isPrimary: true }],
      });
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(expected);

      const result = await createCustomer({
        name: 'John Doe',
        phone: '9876543210',
        address: { addressLine1: '123 Main St' },
      });

      expect(result.addresses).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            addresses: {
              create: expect.objectContaining({
                addressLine1: '123 Main St',
                isPrimary: true,
              }),
            },
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // changeCustomerStatus - pause
  // -----------------------------------------------------------------------
  describe('changeCustomerStatus - pause', () => {
    beforeEach(() => {
      mockTransaction.mockImplementation(async (cb: any) =>
        cb({
          customer: { update: mockUpdate, findUnique: mockFindUnique },
          subscription: { findMany: mockSubFindMany, updateMany: mockSubUpdateMany },
          subscriptionChange: { createMany: mockSubChangeCreateMany },
        }),
      );
    });

    it('updates customer status to paused', async () => {
      mockFindUnique
        .mockResolvedValueOnce(makeCustomer({ status: 'active' })) // existence check
        .mockResolvedValueOnce(makeCustomer({ status: 'active' })); // inside tx (unused but safe)
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockSubFindMany.mockResolvedValue([]);

      const result = await changeCustomerStatus('cust-1', { status: 'paused' }, 'user-1');

      expect(result.status).toBe('paused');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'paused' },
        }),
      );
    });

    it('suspends all active subscriptions when pausing', async () => {
      const subs = [makeSub({ id: 'sub-1' }), makeSub({ id: 'sub-2' })];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 2 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 2 });

      await changeCustomerStatus('cust-1', { status: 'paused' }, 'user-1');

      expect(mockSubUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1', status: 'active' },
          data: { status: 'paused' },
        }),
      );
    });

    it('creates subscription change records when pausing', async () => {
      const subs = [makeSub({ id: 'sub-1' })];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 1 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 1 });

      await changeCustomerStatus('cust-1', { status: 'paused' }, 'user-1');

      expect(mockSubChangeCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              subscriptionId: 'sub-1',
              changeType: 'paused',
              oldValue: 'active',
              newValue: 'paused',
              changedBy: 'user-1',
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // changeCustomerStatus - stop
  // -----------------------------------------------------------------------
  describe('changeCustomerStatus - stop', () => {
    beforeEach(() => {
      mockTransaction.mockImplementation(async (cb: any) =>
        cb({
          customer: { update: mockUpdate, findUnique: mockFindUnique },
          subscription: { findMany: mockSubFindMany, updateMany: mockSubUpdateMany },
          subscriptionChange: { createMany: mockSubChangeCreateMany },
        }),
      );
    });

    it('updates customer status to stopped', async () => {
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'stopped' }));
      mockSubFindMany.mockResolvedValue([]);

      const result = await changeCustomerStatus('cust-1', { status: 'stopped' }, 'user-1');

      expect(result.status).toBe('stopped');
    });

    it('cancels all active/paused subscriptions with endDate when stopping', async () => {
      const subs = [
        makeSub({ id: 'sub-1', status: 'active' }),
        makeSub({ id: 'sub-2', status: 'paused' }),
      ];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'stopped' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 2 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 2 });

      await changeCustomerStatus('cust-1', { status: 'stopped' }, 'user-1');

      expect(mockSubUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1', status: { in: ['active', 'paused'] } },
          data: expect.objectContaining({
            status: 'cancelled',
            endDate: expect.any(Date),
          }),
        }),
      );
    });

    it('creates subscription change records when stopping', async () => {
      const subs = [makeSub({ id: 'sub-1', status: 'active' })];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'stopped' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 1 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 1 });

      await changeCustomerStatus('cust-1', { status: 'stopped' }, 'user-1');

      expect(mockSubChangeCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              subscriptionId: 'sub-1',
              changeType: 'cancelled',
              oldValue: 'active',
              newValue: 'cancelled',
              changedBy: 'user-1',
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // changeCustomerStatus - reactivate
  // -----------------------------------------------------------------------
  describe('changeCustomerStatus - reactivate', () => {
    beforeEach(() => {
      mockTransaction.mockImplementation(async (cb: any) =>
        cb({
          customer: { update: mockUpdate, findUnique: mockFindUnique },
          subscription: { findMany: mockSubFindMany, updateMany: mockSubUpdateMany },
          subscriptionChange: { createMany: mockSubChangeCreateMany },
        }),
      );
    });

    it('updates customer status to active from paused', async () => {
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockSubFindMany.mockResolvedValue([]);

      const result = await changeCustomerStatus('cust-1', { status: 'active' }, 'user-1');

      expect(result.status).toBe('active');
    });

    it('resumes paused subscriptions without end_date when reactivating', async () => {
      const subs = [makeSub({ id: 'sub-1', status: 'paused', endDate: null })];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 1 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 1 });

      await changeCustomerStatus('cust-1', { status: 'active' }, 'user-1');

      expect(mockSubUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1', status: 'paused', endDate: null },
          data: { status: 'active' },
        }),
      );
    });

    it('creates subscription change records when reactivating', async () => {
      const subs = [makeSub({ id: 'sub-1', status: 'paused', endDate: null })];
      mockFindUnique.mockResolvedValue(makeCustomer({ status: 'paused' }));
      mockUpdate.mockResolvedValue(makeCustomer({ status: 'active' }));
      mockSubFindMany.mockResolvedValue(subs);
      mockSubUpdateMany.mockResolvedValue({ count: 1 });
      mockSubChangeCreateMany.mockResolvedValue({ count: 1 });

      await changeCustomerStatus('cust-1', { status: 'active' }, 'user-1');

      expect(mockSubChangeCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              subscriptionId: 'sub-1',
              changeType: 'resumed',
              oldValue: 'paused',
              newValue: 'active',
              changedBy: 'user-1',
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // createAddress - primary flag management
  // -----------------------------------------------------------------------
  describe('createAddress - primary flag', () => {
    it('unsets other primary addresses when isPrimary=true', async () => {
      mockFindUnique.mockResolvedValue(makeCustomer());
      mockAddressUpdateMany.mockResolvedValue({ count: 1 });
      mockAddressCreate.mockResolvedValue({
        id: 'addr-new',
        customerId: 'cust-1',
        addressLine1: '456 Oak Ave',
        isPrimary: true,
      });

      await createAddress('cust-1', { addressLine1: '456 Oak Ave', isPrimary: true });

      expect(mockAddressUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust-1', isPrimary: true },
          data: { isPrimary: false },
        }),
      );
    });

    it('does not touch other addresses when isPrimary is not set', async () => {
      mockFindUnique.mockResolvedValue(makeCustomer());
      mockAddressCreate.mockResolvedValue({
        id: 'addr-new',
        customerId: 'cust-1',
        addressLine1: '789 Pine Rd',
        isPrimary: false,
      });

      await createAddress('cust-1', { addressLine1: '789 Pine Rd' });

      expect(mockAddressUpdateMany).not.toHaveBeenCalled();
    });
  });
});
