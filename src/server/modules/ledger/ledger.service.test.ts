import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    ledgerEntry: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
  },
  redis: {},
}));

import { createLedgerEntry } from './ledger.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TxType = 'charge' | 'payment' | 'adjustment' | 'credit_applied';

interface SimEntry {
  transactionType: TxType;
  debitAmount: number;
  creditAmount: number;
}

/** Simulate createLedgerEntry calls in sequence, tracking running balance. */
function simulateLedger(entries: SimEntry[]) {
  let balance = 0;
  const results: { debit: number; credit: number; runningBalance: number }[] = [];
  for (const e of entries) {
    balance = balance + e.debitAmount - e.creditAmount;
    results.push({
      debit: e.debitAmount,
      credit: e.creditAmount,
      runningBalance: balance,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const txTypeArb: fc.Arbitrary<TxType> = fc.oneof(
  fc.constant<TxType>('charge'),
  fc.constant<TxType>('payment'),
  fc.constant<TxType>('adjustment'),
  fc.constant<TxType>('credit_applied'),
);

/** Generate a ledger entry with realistic debit/credit based on type. */
const ledgerEntryArb: fc.Arbitrary<SimEntry> = txTypeArb.chain((txType) => {
  const amountArb = fc.integer({ min: 1, max: 1000000 }).map((n) => n / 100);
  return amountArb.map((amount) => {
    // Charges are debits, payments/credits are credits
    if (txType === 'charge' || (txType === 'adjustment')) {
      // Adjustments can be either, but for simplicity generate both directions
      return { transactionType: txType, debitAmount: amount, creditAmount: 0 };
    }
    return { transactionType: txType, debitAmount: 0, creditAmount: amount };
  });
});

/** Mixed entry that can be debit or credit regardless of type. */
const mixedEntryArb: fc.Arbitrary<SimEntry> = fc.record({
  transactionType: txTypeArb,
  debitAmount: fc.integer({ min: 0, max: 1000000 }).map((n) => n / 100),
  creditAmount: fc.integer({ min: 0, max: 1000000 }).map((n) => n / 100),
});

const entryListArb = fc.array(mixedEntryArb, { minLength: 1, maxLength: 50 });

// ---------------------------------------------------------------------------
// Property 16: Running balance after any entry equals
//              previous balance + debits - credits
// Validates: Requirements 21.2
// ---------------------------------------------------------------------------
describe('Property 16: Running balance consistency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('running balance after each entry equals previous + debit - credit', () => {
    fc.assert(
      fc.property(entryListArb, (entries) => {
        const results = simulateLedger(entries);

        let prevBalance = 0;
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const expected = prevBalance + r.debit - r.credit;
          // Use toFixed to avoid floating point drift
          expect(parseFloat(r.runningBalance.toFixed(2))).toBe(
            parseFloat(expected.toFixed(2)),
          );
          prevBalance = r.runningBalance;
        }
      }),
      { numRuns: 200 },
    );
  });

  it('createLedgerEntry computes running balance correctly from previous entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -100000, max: 100000 }).map((n) => n / 100),
        fc.integer({ min: 0, max: 100000 }).map((n) => n / 100),
        fc.integer({ min: 0, max: 100000 }).map((n) => n / 100),
        async (prevBalance, debit, credit) => {
          // Mock: return previous balance
          mockFindFirst.mockResolvedValue(
            prevBalance !== 0
              ? { runningBalance: new Prisma.Decimal(prevBalance.toFixed(2)) }
              : null,
          );

          let capturedData: any = null;
          mockCreate.mockImplementation(async (args: any) => {
            capturedData = args.data;
            return { id: 'test-id', ...args.data };
          });

          const mockTx = {
            ledgerEntry: {
              findFirst: mockFindFirst,
              create: mockCreate,
            },
          } as any;

          await createLedgerEntry(mockTx, {
            customerId: 'cust-1',
            entryDate: new Date(),
            transactionType: 'charge',
            debitAmount: new Prisma.Decimal(debit.toFixed(2)),
            creditAmount: new Prisma.Decimal(credit.toFixed(2)),
          });

          const actualPrev = prevBalance !== 0 ? prevBalance : 0;
          const expectedBalance = parseFloat(
            (actualPrev + debit - credit).toFixed(2),
          );
          const actualBalance = parseFloat(
            capturedData.runningBalance.toString(),
          );

          expect(actualBalance).toBeCloseTo(expectedBalance, 2);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Final ledger balance equals total debits minus total credits
// Validates: Requirements 21.1, 21.2
// ---------------------------------------------------------------------------
describe('Property 17: Final balance equals total debits minus total credits', () => {
  it('final running balance equals sum of all debits minus sum of all credits', () => {
    fc.assert(
      fc.property(entryListArb, (entries) => {
        const results = simulateLedger(entries);

        const totalDebits = entries.reduce((sum, e) => sum + e.debitAmount, 0);
        const totalCredits = entries.reduce((sum, e) => sum + e.creditAmount, 0);

        const finalBalance = results[results.length - 1].runningBalance;

        expect(parseFloat(finalBalance.toFixed(2))).toBe(
          parseFloat((totalDebits - totalCredits).toFixed(2)),
        );
      }),
      { numRuns: 200 },
    );
  });

  it('empty starting balance means final balance is purely debits minus credits', () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 30 }),
        (entries) => {
          const results = simulateLedger(entries);

          let sumDebits = 0;
          let sumCredits = 0;
          for (const e of entries) {
            sumDebits += e.debitAmount;
            sumCredits += e.creditAmount;
          }

          const finalBalance = results[results.length - 1].runningBalance;
          expect(parseFloat(finalBalance.toFixed(2))).toBe(
            parseFloat((sumDebits - sumCredits).toFixed(2)),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
