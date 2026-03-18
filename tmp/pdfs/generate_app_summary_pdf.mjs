import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const outDir = path.resolve('output/pdf');
fs.mkdirSync(outDir, { recursive: true });

const outputPath = path.join(outDir, 'milkagri-app-summary.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margin: 36,
  info: {
    Title: 'Milkagri App Summary',
    Author: 'Codex',
    Subject: 'One-page repository summary',
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  ink: '#172033',
  muted: '#566074',
  accent: '#1f6f5f',
  line: '#d7e0dc',
  chip: '#e9f4f0',
};

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const left = doc.page.margins.left;
const right = pageWidth - doc.page.margins.right;
const top = doc.page.margins.top;
const contentWidth = right - left;
const gap = 20;
const colWidth = (contentWidth - gap) / 2;

function hr(y) {
  doc
    .strokeColor(colors.line)
    .lineWidth(1)
    .moveTo(left, y)
    .lineTo(right, y)
    .stroke();
}

function sectionTitle(x, y, text) {
  doc
    .fillColor(colors.accent)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(text.toUpperCase(), x, y, { width: colWidth });
  return doc.y + 3;
}

function bodyText(x, y, text, options = {}) {
  doc
    .fillColor(colors.ink)
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size ?? 8.7)
    .text(text, x, y, {
      width: options.width ?? colWidth,
      lineGap: options.lineGap ?? 1.6,
    });
  return doc.y;
}

function bulletList(x, y, items, options = {}) {
  const width = options.width ?? colWidth;
  const bulletGap = 9;
  const textWidth = width - bulletGap;
  let cursor = y;
  for (const item of items) {
    doc
      .fillColor(colors.accent)
      .font('Helvetica-Bold')
      .fontSize(options.size ?? 8.5)
      .text('-', x, cursor, { width: bulletGap });
    doc
      .fillColor(colors.ink)
      .font('Helvetica')
      .fontSize(options.size ?? 8.5)
      .text(item, x + bulletGap, cursor, {
        width: textWidth,
        lineGap: options.lineGap ?? 1.4,
      });
    cursor = doc.y + 2;
  }
  return cursor;
}

doc
  .fillColor(colors.ink)
  .font('Helvetica-Bold')
  .fontSize(20)
  .text('Milkagri App Summary', left, top, { width: contentWidth });

doc
  .roundedRect(left, top + 28, 154, 18, 9)
  .fill(colors.chip);
doc
  .fillColor(colors.accent)
  .font('Helvetica-Bold')
  .fontSize(8)
  .text('Repo-based summary only', left + 10, top + 33, { width: 134, align: 'center' });

doc
  .fillColor(colors.muted)
  .font('Helvetica')
  .fontSize(8.5)
  .text(
    'Source basis: README, package.json, docker-compose.yml, Prisma schema, Express entrypoint, job wiring, and client routes.',
    left,
    top + 56,
    { width: contentWidth, lineGap: 1.4 },
  );

hr(top + 82);

let y = top + 94;
const description =
  'Milkagri is a self-hosted web application for running a milk or dairy delivery business. The repo shows a React frontend and Express API that cover customer onboarding, recurring delivery operations, billing, reporting, and administration.';
doc
  .fillColor(colors.accent)
  .font('Helvetica-Bold')
  .fontSize(10)
  .text('WHAT IT IS', left, y);
doc
  .fillColor(colors.ink)
  .font('Helvetica')
  .fontSize(9)
  .text(description, left + 88, y, { width: contentWidth - 88, lineGap: 1.5 });

y = doc.y + 8;
doc
  .fillColor(colors.accent)
  .font('Helvetica-Bold')
  .fontSize(10)
  .text("WHO IT'S FOR", left, y);
doc
  .fillColor(colors.ink)
  .font('Helvetica')
  .fontSize(9)
  .text(
    'Primary persona: a milk delivery business operator or back-office admin; the repo also includes dedicated roles and UI flows for delivery agents and billing staff.',
    left + 88,
    y,
    { width: contentWidth - 88, lineGap: 1.5 },
  );

const leftX = left;
const rightX = left + colWidth + gap;
let leftY = doc.y + 16;
let rightY = leftY;

leftY = sectionTitle(leftX, leftY, 'What it does');
leftY = bulletList(leftX, leftY + 2, [
  'Manages customers, delivery addresses, products, and product variants.',
  'Supports recurring subscriptions with daily, alternate-day, and custom weekday frequencies.',
  'Generates and tracks delivery orders, route assignments, and delivery manifests.',
  'Creates invoices, records payments, and maintains per-customer ledger history.',
  'Provides operational and financial reports, including revenue, outstanding balances, and missed deliveries.',
  'Includes inventory, notifications, audit logs, user management, and settings screens.',
], { size: 8.35 });

leftY += 8;
leftY = sectionTitle(leftX, leftY, 'How to run');
leftY = bulletList(leftX, leftY + 2, [
  'Run `npm install`.',
  'Copy `.env.example` to `.env` and set at least `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CSRF_SECRET`, and `POSTGRES_PASSWORD`.',
  'Start Postgres and Redis with `docker compose up -d postgres redis`.',
  'Apply schema and seed data: `npx prisma migrate deploy` and `npm run db:seed`.',
  'Start the app with `npm run dev:server` and `npm run dev:client`.',
], { size: 8.35 });

rightY = sectionTitle(rightX, rightY, 'How it works');
rightY = bulletList(rightX, rightY + 2, [
  'Client: React SPA with route-based pages for customers, products, subscriptions, orders, delivery, billing, payments, inventory, reports, users, notifications, audit logs, and settings.',
  'API: Express server mounts feature routers under `/api` and `/api/v1`, with middleware for Helmet, CORS, JSON parsing, Redis-backed sessions, CSRF, rate limiting, and centralized error handling.',
  'Data: Prisma ORM persists domain models in PostgreSQL, including users, customers, subscriptions, delivery orders, routes, invoices, payments, ledger entries, holidays, notifications, job executions, and inventory records.',
  'Background work: BullMQ queues and workers use Redis to register and process scheduled daily order generation and daily invoice generation jobs.',
  'Deployment: `docker-compose.yml` defines `postgres`, `redis`, `app`, `worker`, `nginx`, and `backup`; the app health-checks `/api/health`, and production startup runs `prisma migrate deploy` before serving traffic.',
], { size: 8.2, lineGap: 1.25 });

rightY += 8;
rightY = sectionTitle(rightX, rightY, 'Repo gaps');
rightY = bulletList(rightX, rightY + 2, [
  'Mobile apps: Not found in repo.',
  'External paid SaaS dependencies required for core operation: Not found in repo.',
], { size: 8.3 });

const footerY = pageHeight - doc.page.margins.bottom - 18;
hr(footerY - 8);
doc
  .fillColor(colors.muted)
  .font('Helvetica')
  .fontSize(7.5)
  .text('Generated from repository evidence on 2026-03-18.', left, footerY, {
    width: contentWidth,
    align: 'right',
  });

doc.end();

