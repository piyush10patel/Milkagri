import { prisma } from '../../index.js';
import { NotFoundError } from '../../lib/errors.js';
import type { CreateHandoverNoteInput, HandoverQuery } from './handover.types.js';

export async function listHandoverNotes(query: HandoverQuery) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Default: rolling 7-day window (3 days back, today, 3 days forward)
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 3);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 3);

  const startDate = query.startDate ? new Date(query.startDate + 'T00:00:00.000Z') : defaultStart;
  const endDate = query.endDate ? new Date(query.endDate + 'T00:00:00.000Z') : defaultEnd;

  const notes = await prisma.handoverNote.findMany({
    where: {
      noteDate: { gte: startDate, lte: endDate },
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ noteDate: 'desc' }, { createdAt: 'desc' }],
  });

  return { notes, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) };
}

export async function createHandoverNote(input: CreateHandoverNoteInput, userId: string) {
  return prisma.handoverNote.create({
    data: {
      noteDate: new Date(input.noteDate + 'T00:00:00.000Z'),
      content: input.content.trim(),
      createdBy: userId,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function deleteHandoverNote(id: string, userId: string) {
  const note = await prisma.handoverNote.findUnique({ where: { id } });
  if (!note) throw new NotFoundError('Handover note not found');
  await prisma.handoverNote.delete({ where: { id } });
  return { id };
}
