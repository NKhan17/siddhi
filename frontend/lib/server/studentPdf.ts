/**
 * Single-student PDF export (v3: maroon + light-blue palette, graphs first).
 *
 * How it works (top to bottom of this file):
 *   1. exportStudentPdf() checks who is asking and loads the student's data by calling
 *      the EXISTING getData() function. getData() already applies every access rule
 *      (guardian links, staff assignments, hidden diagnosis, guardian-visible-only rows),
 *      so this file never writes its own SQL and cannot leak anything getData() would not.
 *   2. createWriter() is a small layout engine on top of pdf-lib: it tracks the current
 *      page and the current "cursor" y-position, wraps text, and starts a new page when
 *      the next block would not fit.
 *   3. The writer has helpers for tables, stat tiles, callout boxes and charts (donut and
 *      line). Charts are drawn with plain shapes, so there are no images and no font files.
 *
 * PDF coordinates start at the BOTTOM-left of the page, so "y" goes up. We start at the
 * top and move y downward as we add content.
 *
 * COLOURS: every colour lives in the PALETTE block below, as [red, green, blue] numbers
 * from 0 to 1. To re-skin the report later, change ACCENT / ACCENT_SOFT (and SERIES) only.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { getData, requireActor } from './data';

type Row = Record<string, any>;

// Same error shape the rest of the API uses: route.ts reads error.status.
function fail(status: number, detail: string): never {
  const error = new Error(detail) as Error & { status: number };
  error.status = status;
  throw error;
}

// ---------------------------------------------------------------- palette
type RGB3 = [number, number, number];
const col = (c: RGB3) => rgb(c[0], c[1], c[2]);
// Mix a colour with white: amount 0 = original, 1 = white. Used for soft backgrounds.
const tint = (c: RGB3, amount = 0.86) => rgb(c[0] + (1 - c[0]) * amount, c[1] + (1 - c[1]) * amount, c[2] + (1 - c[2]) * amount);

const ACCENT: RGB3 = [0.439, 0.098, 0.137]; // MAROON #701923 (sampled from the Reussir Trust website): header band, table headers, section bars
const ACCENT_SOFT: RGB3 = [0.9, 0.95, 0.99]; // LIGHT BLUE: stat tiles
const INK: RGB3 = [0.1, 0.1, 0.12];
const MUTED: RGB3 = [0.42, 0.44, 0.5];
const GRID: RGB3 = [0.86, 0.87, 0.9];
const ZEBRA: RGB3 = [0.953, 0.972, 0.992]; // very light blue table stripes
const WHITE: RGB3 = [1, 1, 1];
const GOOD: RGB3 = [0.09, 0.64, 0.29];
const BAD: RGB3 = [0.86, 0.21, 0.27];
const WARN: RGB3 = [0.92, 0.52, 0.05];
const INFO: RGB3 = [0.2, 0.5, 0.85];
const NEUTRAL: RGB3 = [0.55, 0.57, 0.62];
// Chart line/slice colours, in order: maroon, sky blue, brand red-orange #C43F30, deep blue, gold, teal, purple, grey.
const SERIES: RGB3[] = [
  [0.439, 0.098, 0.137], [0.3, 0.6, 0.85], [0.769, 0.247, 0.188], [0.18, 0.36, 0.62],
  [0.85, 0.6, 0.2], [0.35, 0.65, 0.55], [0.55, 0.4, 0.7], [0.4, 0.4, 0.4],
];

// ---------------------------------------------------------------- constants
const PAGE_W = 595.28; // A4 in PDF points (1 pt = 1/72 inch)
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BANNER_H = 92;

const TERMS = ['baseline', 'term_1', 'term_2', 'term_3', 'final'] as const;
const TERM_LABELS = ['Baseline', 'Term 1', 'Term 2', 'Term 3', 'Final'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_RATING = 4; // progress ratings are 0..4 in the database

// ---------------------------------------------------------------- text helpers
// pdf-lib's built-in Helvetica can only encode WinAnsi (Latin) characters, and it THROWS on
// anything else (including newlines). clean() flattens whitespace and swaps unsupported
// characters (e.g. Devanagari) for '?', so one odd character can never crash the export.
const WIN_ANSI_EXTRA = new Set(['\u2018', '\u2019', '\u201C', '\u201D', '\u2013', '\u2014', '\u2022', '\u2026', '\u20AC']);
function clean(value: unknown): string {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      const ok = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch);
      return ok ? ch : '?';
    })
    .join('');
}

// Database dates arrive as JS Date objects (pg's default) or as 'YYYY-MM-DD...' strings
// (inside json_agg). Handle both and print like "15 Apr 2017".
function fmtDate(value: unknown): string {
  if (!value) return '-';
  let y: number, m: number, d: number;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '-';
    y = value.getFullYear(); m = value.getMonth(); d = value.getDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!match) return clean(value) || '-';
    y = Number(match[1]); m = Number(match[2]) - 1; d = Number(match[3]);
  }
  return `${d} ${MONTHS[m] ?? '?'} ${y}`;
}

// 'speech_therapy' -> 'Speech Therapy'
const titleCase = (value: unknown) =>
  clean(value).split(/[_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || '-';

const truncate = (value: unknown, max: number) => {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

const toNum = (value: unknown): number | null => (value == null || value === '' ? null : Number(value));

// Shorten text until it fits a pixel width (used for labels).
function fit(text: string, font: PDFFont, size: number, maxW: number): string {
  let out = clean(text);
  while (out.length > 4 && font.widthOfTextAtSize(out, size) > maxW) out = `${out.slice(0, -4)}...`;
  return out;
}

// Colour for a goal status. Unknown statuses fall back to grey instead of failing.
function statusColor(status: unknown): RGB3 {
  const s = String(status ?? '').toLowerCase();
  if (s.includes('achiev') || s.includes('complete')) return GOOD;
  if (s.includes('progress') || s.includes('active')) return INFO;
  if (s.includes('hold') || s.includes('revis') || s.includes('review')) return WARN;
  if (s.includes('discontinu') || s.includes('cancel')) return BAD;
  return NEUTRAL;
}
// Colour for a 0-4 rating: low = red, middle = amber, high = green.
const ratingColor = (r: number): RGB3 => (r >= 3 ? GOOD : r >= 2 ? WARN : BAD);

// An SVG-style polygon for one pie slice. Angles are in radians measured clockwise from
// 12 o'clock. The arc is approximated by short straight steps (about 4 degrees each), which
// is visually a smooth curve and avoids SVG arc commands. y is negative because drawSvgPath
// uses SVG coordinates (y points down) and flips them onto the PDF page for us.
function slicePath(radius: number, a0: number, a1: number): string {
  const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 90));
  let d = 'M 0 0';
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    d += ` L ${(radius * Math.sin(a)).toFixed(2)} ${(-radius * Math.cos(a)).toFixed(2)}`;
  }
  return `${d} Z`;
}

// ---------------------------------------------------------------- layout engine
function createWriter(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN; // the cursor: where the next block starts (moves DOWN the page)

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  // Make sure `height` points fit on this page; if not, start a new one.
  const ensure = (height: number) => {
    if (y - height < MARGIN) newPage();
  };
  // Draw text horizontally centred on `cx`.
  const centered = (text: string, cx: number, baseline: number, size: number, font: PDFFont, color: RGB3) => {
    const t = clean(text);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y: baseline, size, font, color: col(color) });
  };

  // Greedy word wrap: pdf-lib does not wrap text for us, so we measure each word.
  function wrap(value: unknown, font: PDFFont, size: number, maxW: number): string[] {
    const text = clean(value);
    if (!text) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      let w = word;
      // A single word wider than the line (e.g. a long URL): chop it into pieces.
      while (font.widthOfTextAtSize(w, size) > maxW) {
        let n = w.length;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxW) n--;
        if (line) { lines.push(line); line = ''; }
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxW) line = candidate;
      else { if (line) lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function paragraph(value: unknown, opts: { size?: number; bold?: boolean; color?: RGB3; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? bold : regular;
    const lineHeight = size * 1.35;
    for (const line of wrap(value, font, size, CONTENT_W)) {
      ensure(lineHeight);
      page.drawText(line, { x: MARGIN, y: y - size, size, font, color: col(opts.color ?? INK) });
      y -= lineHeight;
    }
    y -= opts.gap ?? 4;
  }

  // The coloured band at the top of page 1.
  function banner(kicker: string, title: string, subline: string, rightText: string) {
    page.drawRectangle({ x: 0, y: PAGE_H - BANNER_H, width: PAGE_W, height: BANNER_H, color: col(ACCENT) });
    page.drawText(clean(kicker.toUpperCase()), { x: MARGIN, y: PAGE_H - 28, size: 8.5, font: bold, color: tint(ACCENT, 0.7) });
    page.drawText(fit(title, bold, 22, CONTENT_W), { x: MARGIN, y: PAGE_H - 54, size: 22, font: bold, color: col(WHITE) });
    page.drawText(fit(subline, regular, 9.5, CONTENT_W), { x: MARGIN, y: PAGE_H - 74, size: 9.5, font: regular, color: tint(ACCENT, 0.8) });
    const right = clean(rightText);
    page.drawText(right, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(right, 8.5), y: PAGE_H - 28, size: 8.5, font: regular, color: tint(ACCENT, 0.7) });
    y = PAGE_H - BANNER_H - 18;
  }

  // Row of "big number + label" tiles (the "at a glance" strip).
  function statTiles(items: { value: string; label: string }[]) {
    const gap = 8, h = 56;
    const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
    ensure(h + 10);
    items.forEach((item, i) => {
      const x = MARGIN + i * (w + gap);
      page.drawRectangle({ x, y: y - h, width: w, height: h, color: col(ACCENT_SOFT) });
      page.drawRectangle({ x, y: y - 3, width: w, height: 3, color: col(ACCENT) });
      centered(item.value, x + w / 2, y - 32, 18, bold, ACCENT);
      centered(item.label, x + w / 2, y - 47, 8, regular, MUTED);
    });
    y -= h + 12;
  }

  // Section heading: coloured bar + title + thin rule. `keepWith` = height of the block that
  // follows, so a heading is never left alone at the bottom of a page.
  function heading(text: string, keepWith = 40) {
    ensure(30 + keepWith);
    y -= 10;
    page.drawRectangle({ x: MARGIN, y: y - 15, width: 4, height: 17, color: col(ACCENT) });
    page.drawText(clean(text), { x: MARGIN + 11, y: y - 12, size: 13, font: bold, color: col(INK) });
    y -= 22;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: col(GRID) });
    y -= 8;
  }

  // `keepWith` = height of the block that follows, so a chart title is never separated from its chart.
  const subtitle = (text: string, keepWith = 0) => {
    ensure(keepWith + 18);
    paragraph(text, { size: 10, bold: true, gap: 3 });
  };
  const caption = (text: string) => paragraph(text, { size: 8, color: MUTED, gap: 8 });

  // Two-column "label: value" grid used for the profile facts.
  function keyValues(pairs: [string, unknown][]) {
    const colW = CONTENT_W / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const cells = pairs.slice(i, i + 2).map(([label, value]) => ({ label, lines: wrap(value || '-', regular, 10, colW - 12) }));
      const rowH = 12 + Math.max(...cells.map((c) => c.lines.length)) * 13 + 4;
      ensure(rowH);
      cells.forEach((cell, c) => {
        const x = MARGIN + c * colW;
        page.drawText(clean(cell.label), { x, y: y - 8, size: 8, font: regular, color: col(MUTED) });
        cell.lines.forEach((line, j) => page.drawText(line, { x, y: y - 21 - j * 13, size: 10, font: regular, color: col(INK) }));
      });
      y -= rowH;
    }
    y -= 4;
  }

  // Soft coloured box with a thick left edge (used for strengths / needs / diagnosis).
  function callout(label: string, value: unknown, color: RGB3) {
    const size = 9.5, lineH = 13, pad = 8;
    const lines = wrap(truncate(value, 700), regular, size, CONTENT_W - pad * 2 - 6);
    const h = pad * 2 + 8 + lines.length * lineH;
    ensure(h + 6);
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: tint(color, 0.9) });
    page.drawRectangle({ x: MARGIN, y: y - h, width: 3.5, height: h, color: col(color) });
    page.drawText(clean(label.toUpperCase()), { x: MARGIN + pad + 4, y: y - pad - 7, size: 7.5, font: bold, color: col(color) });
    lines.forEach((line, j) => page.drawText(line, { x: MARGIN + pad + 4, y: y - pad - 11 - size - j * lineH + 3, size, font: regular, color: col(INK) }));
    y -= h + 8;
  }

  // Generic table. Each column declares a header, a pixel width and how to read a value from
  // a row. A column may instead draw a coloured `badge` (status chip) or a `rating` bar.
  type Col = {
    header: string;
    width: number;
    value: (row: Row) => unknown;
    badge?: (row: Row) => { text: string; color: RGB3 } | null;
    rating?: (row: Row) => number | null;
  };
  function table(cols: Col[], data: Row[]) {
    const size = 8.5, lineH = 11, padX = 4, padY = 4;
    const headerH = lineH + padY * 2;
    const drawHeader = () => {
      page.drawRectangle({ x: MARGIN, y: y - headerH, width: CONTENT_W, height: headerH, color: col(ACCENT) });
      let x = MARGIN;
      for (const c of cols) {
        page.drawText(clean(c.header), { x: x + padX, y: y - padY - size, size, font: bold, color: col(WHITE) });
        x += c.width;
      }
      y -= headerH;
    };
    ensure(headerH + 44);
    drawHeader();
    data.forEach((row, rowIndex) => {
      // Wrap every text cell first, so we know how tall this row will be.
      const cells = cols.map((c) => (c.badge || c.rating ? [''] : wrap(c.value(row), regular, size, c.width - padX * 2)));
      const rowH = Math.max(...cells.map((lines) => lines.length)) * lineH + padY * 2;
      if (y - rowH < MARGIN) { newPage(); drawHeader(); } // repeat the header on the new page
      if (rowIndex % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: col(ZEBRA) });
      let x = MARGIN;
      cols.forEach((c, i) => {
        const cx = x + padX;
        if (c.badge) {
          const b = c.badge(row);
          if (b) {
            const text = fit(b.text, bold, 7.5, c.width - padX * 2 - 10);
            page.drawRectangle({ x: cx, y: y - padY - 10.5, width: bold.widthOfTextAtSize(text, 7.5) + 10, height: 12, color: tint(b.color) });
            page.drawText(text, { x: cx + 5, y: y - padY - 8, size: 7.5, font: bold, color: col(b.color) });
          }
        } else if (c.rating) {
          const r = c.rating(row);
          const trackW = c.width - padX * 2 - 30;
          if (r == null) {
            page.drawText('-', { x: cx, y: y - padY - size, size, font: regular, color: col(MUTED) });
          } else {
            const fill = (Math.min(Math.max(r, 0), MAX_RATING) / MAX_RATING) * trackW;
            page.drawRectangle({ x: cx, y: y - padY - 8, width: trackW, height: 6, color: col(GRID) });
            if (fill > 0) page.drawRectangle({ x: cx, y: y - padY - 8, width: fill, height: 6, color: col(ratingColor(r)) });
            page.drawText(`${r}/${MAX_RATING}`, { x: cx + trackW + 4, y: y - padY - size, size, font: regular, color: col(INK) });
          }
        } else {
          cells[i].forEach((line, j) => page.drawText(line, { x: cx, y: y - padY - size - j * lineH, size, font: regular, color: col(INK) }));
        }
        x += c.width;
      });
      y -= rowH;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: col(GRID) });
    });
    y -= 8;
  }

  // ---- Chart 1: line chart, one line per series across categories (used for progress by term).
  function lineChart(categories: string[], series: { name: string; values: (number | null)[] }[], yMax: number) {
    const plotH = 130, labelW = 22;
    const legendRows = Math.ceil(series.length / 2);
    ensure(6 + plotH + 24 + legendRows * 13 + 6);

    const left = MARGIN + labelW;
    const width = CONTENT_W - labelW - 10;
    const bottom = y - 6 - plotH; // y of the 0 line
    // Horizontal gridlines + y-axis numbers (0..yMax).
    for (let v = 0; v <= yMax; v++) {
      const gy = bottom + (v / yMax) * plotH;
      page.drawLine({ start: { x: left, y: gy }, end: { x: left + width, y: gy }, thickness: 0.5, color: col(GRID) });
      page.drawText(String(v), { x: MARGIN + 6, y: gy - 3, size: 8, font: regular, color: col(MUTED) });
    }
    // x position of category i, spread evenly with some padding at both ends.
    const xAt = (i: number) => left + 20 + (categories.length === 1 ? 0 : (i / (categories.length - 1)) * (width - 40));
    categories.forEach((label, i) => centered(label, xAt(i), bottom - 12, 8, regular, MUTED));
    // Each series: connect its non-empty points with lines, then put a dot on every point.
    series.forEach((s, si) => {
      const color = col(SERIES[si % SERIES.length]);
      const points: { x: number; y: number }[] = [];
      s.values.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) return; // missing term: skip, line joins neighbours
        points.push({ x: xAt(i), y: bottom + (Math.min(Math.max(v, 0), yMax) / yMax) * plotH });
      });
      for (let i = 1; i < points.length; i++) page.drawLine({ start: points[i - 1], end: points[i], thickness: 1.6, color });
      points.forEach((p) => page.drawCircle({ x: p.x, y: p.y, size: 2.6, color })); // size = radius
    });
    // Legend, two columns under the chart.
    series.forEach((s, si) => {
      const x = MARGIN + (si % 2) * (CONTENT_W / 2);
      const ly = bottom - 28 - Math.floor(si / 2) * 13;
      page.drawRectangle({ x, y: ly, width: 7, height: 7, color: col(SERIES[si % SERIES.length]) });
      page.drawText(fit(s.name, regular, 8, CONTENT_W / 2 - 16), { x: x + 11, y: ly, size: 8, font: regular, color: col(INK) });
    });
    y = bottom - 28 - legendRows * 13 - 2;
  }

  // ---- Chart 2: donut (ring-shaped pie) chart with a legend on the right.
  // Each slice is a filled polygon; a white circle on top makes the hole in the middle,
  // where we print a headline number.
  type Segment = { label: string; value: number; color: RGB3; note?: string };
  function donutChart(segments: Segment[], centerTop: string, centerBottom: string) {
    const R = 48, r = 29, rowH = 16;
    const live = segments.filter((s) => s.value > 0);
    const total = live.reduce((sum, s) => sum + s.value, 0);
    const blockH = Math.max(R * 2 + 8, live.length * rowH + 4);
    ensure(blockH + 8);
    if (total <= 0) { paragraph('Nothing to chart yet.', { color: MUTED }); return; }

    const cx = MARGIN + R + 6;
    const cy = y - 4 - R;
    let angle = 0;
    for (const s of live) {
      const next = angle + (s.value / total) * Math.PI * 2;
      page.drawSvgPath(slicePath(R, angle, next), { x: cx, y: cy, color: col(s.color), borderColor: rgb(1, 1, 1), borderWidth: 1 });
      angle = next;
    }
    page.drawCircle({ x: cx, y: cy, size: r, color: rgb(1, 1, 1) });
    centered(centerTop, cx, cy - 2, 14, bold, INK);
    centered(centerBottom, cx, cy - 12, 7, regular, MUTED);

    // Legend: coloured square, bold label, then a grey note such as "6 (40.0%)".
    const lx = MARGIN + R * 2 + 30;
    const top = y - Math.max(0, (blockH - live.length * rowH) / 2);
    live.forEach((s, i) => {
      const ly = top - i * rowH - 11;
      const pct = `${s.value} (${((s.value / total) * 100).toFixed(1)}%)`;
      const label = fit(s.label, bold, 9, CONTENT_W - (lx - MARGIN) - 130);
      page.drawRectangle({ x: lx, y: ly, width: 8, height: 8, color: col(s.color) });
      page.drawText(label, { x: lx + 13, y: ly, size: 9, font: bold, color: col(INK) });
      page.drawText(fit(s.note ? `${pct}  |  ${s.note}` : pct, regular, 8.5, CONTENT_W - (lx - MARGIN) - 13 - bold.widthOfTextAtSize(label, 9) - 10), {
        x: lx + 13 + bold.widthOfTextAtSize(label, 9) + 8, y: ly, size: 8.5, font: regular, color: col(MUTED),
      });
    });
    y -= blockH + 8;
  }

  return { paragraph, banner, statTiles, heading, subtitle, caption, keyValues, callout, table, lineChart, donutChart };
}

// ---------------------------------------------------------------- the export
export async function exportStudentPdf(studentId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  // 1) Who is asking? Mirrors the Excel export: student logins cannot export.
  const actor = await requireActor();
  if (actor.active_role === 'student') fail(403, 'Student accounts cannot export school records');
  // Reject malformed ids early so Postgres never raises an "invalid uuid" 500.
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) fail(400, 'A valid student_id is required');

  // 2) Load data through getData(). It only reads the URL's query string, which we leave empty.
  const request = new Request('http://localhost/internal');
  const get = (...path: string[]) => getData(path, request);

  // Student first: this call performs the access check (404/403 for anyone not allowed),
  // so nothing else is loaded for an unauthorised user.
  const student: Row = await get('students', studentId);
  const [progress, therapy, attendance, assessments]: [Row[], Row[], Row | null, Row[]] = await Promise.all([
    get('students', studentId, 'progress'),
    get('students', studentId, 'therapy-sessions'),
    get('students', studentId, 'attendance', 'summary'),
    get('students', studentId, 'assessments'),
  ]);

  // 3) Build the document.
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Student Profile - ${clean(student.full_name)}`);
  doc.setProducer('Siddhi');
  const w = createWriter(doc, regular, bold);

  const todayLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

  // --- Header band
  w.banner(
    'Student Profile Report',
    student.full_name,
    [student.admission_number && `Admission No. ${student.admission_number}`, student.grade_class, student.disability_category].filter(Boolean).join('   |   '),
    `Generated ${todayLabel}`,
  );

  // --- At a glance (numbers computed from the same data shown below)
  const ratings = progress.map((g) => toNum(g.latest_rating)).filter((n): n is number => n != null);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const achieved = progress.filter((g) => /achiev|complete/i.test(String(g.goal_status ?? ''))).length;
  const hasAttendance = !!attendance && Number(attendance.total_days) > 0;
  w.statTiles([
    { value: String(progress.length), label: 'IEP goals' },
    { value: String(achieved), label: 'Goals achieved' },
    { value: avgRating == null ? '-' : `${avgRating.toFixed(1)}/${MAX_RATING}`, label: 'Average rating' },
    { value: String(therapy.length), label: 'Therapy sessions' },
    { value: hasAttendance ? `${Number(attendance!.attendance_pct)}%` : '-', label: 'Attendance' },
  ]);

  // --- Progress overview: the graphs come first, right under the summary tiles
  w.heading('Progress Overview', 240);
  if (!progress.length) {
    w.paragraph('No IEP goals have been recorded yet.', { color: MUTED });
  } else {
    // Chart A: each goal's rating at every term (only goals that have at least one rating).
    const ratedAll = progress.filter((g) => TERMS.some((t) => toNum(g[t]) != null));
    const rated = ratedAll.slice(0, 8);
    if (rated.length) {
      w.subtitle('Progress by term (rating 0-4, one line per goal)');
      w.lineChart(
        TERM_LABELS,
        rated.map((g, i) => ({ name: `${i + 1}. ${titleCase(g.domain)}`, values: TERMS.map((t) => toNum(g[t])) })),
        MAX_RATING,
      );
      w.caption('Rating scale: 0 Not achieved | 1 Full support | 2 Moderate support | 3 Minimal support | 4 Independent.'
        + (ratedAll.length > 8 ? ' Chart shows the first 8 goals with ratings.' : ''));
    } else {
      w.caption('No progress ratings have been recorded yet, so there is no progress chart.');
    }

    // Chart B: share of goals in each status.
    const statusCounts = new Map<string, number>();
    for (const g of progress) statusCounts.set(g.goal_status, (statusCounts.get(g.goal_status) ?? 0) + 1);
    w.subtitle('Goals by status', 120);
    w.donutChart(
      [...statusCounts.entries()].map(([status, count]) => ({ label: titleCase(status), value: count, color: statusColor(status) })),
      String(progress.length), progress.length === 1 ? 'goal' : 'goals',
    );
  }

  // --- Profile (facts and the four boxes sit below the graphs)
  w.heading('Student Profile', 150);
  w.keyValues([
    ['Admission No.', student.admission_number],
    ['Grade / Class', student.grade_class],
    ['Date of Birth', fmtDate(student.date_of_birth)],
    ['Gender', student.gender],
    ['Disability Category', student.disability_category],
    ['Enrolment Date', fmtDate(student.enrollment_date)],
    ['Languages', student.languages_known],
    ['Assistive Devices', student.assistive_devices],
  ]);
  // getData() already blanks `diagnosis` for roles that may not see it, so we simply print what we got.
  if (student.strengths) w.callout('Strengths', student.strengths, GOOD);
  if (student.areas_of_need) w.callout('Areas of need', student.areas_of_need, WARN);
  if (student.learning_style) w.callout('Learning style', student.learning_style, INFO);
  if (student.diagnosis) w.callout('Diagnosis', student.diagnosis, ACCENT);

  // --- Goal details table
  if (progress.length) {
    w.heading('IEP Goal Details', 100);
    w.table(
      [
        { header: 'Domain', width: 85, value: (g) => titleCase(g.domain) },
        { header: 'Annual goal', width: 235, value: (g) => truncate(g.annual_goal, 220) },
        { header: 'Status', width: 90, value: (g) => g.goal_status, badge: (g) => ({ text: titleCase(g.goal_status), color: statusColor(g.goal_status) }) },
        { header: 'Latest rating', width: 105.28, value: (g) => g.latest_rating, rating: (g) => toNum(g.latest_rating) },
      ],
      progress,
    );
  }

  // --- Therapy
  w.heading('Therapy Sessions', 160);
  if (!therapy.length) {
    w.paragraph('No therapy sessions have been recorded yet.', { color: MUTED });
  } else {
    // Group by provider so a child seen by several therapists shows each one separately.
    const byProvider = new Map<string, { sessions: number; minutes: number }>();
    for (const t of therapy) {
      const key = clean(t.therapist_name) || 'Unknown provider';
      const entry = byProvider.get(key) ?? { sessions: 0, minutes: 0 };
      entry.sessions += 1;
      entry.minutes += Number(t.duration_minutes) || 0;
      byProvider.set(key, entry);
    }
    w.subtitle(`Sessions by therapist (${byProvider.size} ${byProvider.size === 1 ? 'therapist' : 'therapists'})`, 120);
    w.donutChart(
      [...byProvider.entries()].map(([name, e], i) => ({ label: name, value: e.sessions, color: SERIES[i % SERIES.length], note: `${e.minutes} min` })),
      String(therapy.length), therapy.length === 1 ? 'session' : 'sessions',
    );
    w.subtitle(`Recent sessions${therapy.length > 8 ? ' (latest 8)' : ''}`, 70);
    w.table(
      [
        { header: 'Date', width: 62, value: (t) => fmtDate(t.session_date) },
        { header: 'Therapist', width: 90, value: (t) => t.therapist_name },
        { header: 'Type', width: 80, value: (t) => titleCase(t.therapy_type) },
        { header: 'Min', width: 30, value: (t) => t.duration_minutes },
        { header: 'Outcome / notes', width: 253.28, value: (t) => truncate(t.outcome || t.progress_notes, 200) },
      ],
      therapy.slice(0, 8), // getData() returns newest first
    );
  }

  // --- Attendance
  w.heading('Attendance', 110);
  if (!hasAttendance) {
    w.paragraph('No attendance has been recorded yet.', { color: MUTED });
  } else {
    w.paragraph(`${attendance!.total_days} days recorded`, { gap: 4 });
    w.donutChart(
      [
        { label: 'Present', value: Number(attendance!.present) || 0, color: GOOD },
        { label: 'Absent', value: Number(attendance!.absent) || 0, color: BAD },
        { label: 'Leave', value: Number(attendance!.leave) || 0, color: WARN },
        { label: 'Other', value: Number(attendance!.other) || 0, color: NEUTRAL },
      ],
      `${Number(attendance!.attendance_pct)}%`, 'attendance',
    );
  }

  // --- Assessments
  w.heading('Assessments', 80);
  if (!assessments.length) {
    w.paragraph('No assessments have been recorded yet.', { color: MUTED });
  } else {
    w.table(
      [
        { header: 'Date', width: 62, value: (a) => fmtDate(a.assessment_date) },
        { header: 'Type', width: 90, value: (a) => titleCase(a.assessment_type) },
        { header: 'Domain', width: 80, value: (a) => titleCase(a.domain) },
        { header: 'Summary', width: 283.28, value: (a) => truncate(a.summary, 240) },
      ],
      assessments.slice(0, 6),
    );
  }

  // 4) Footer on every page (added last because only now do we know the page count).
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_W - MARGIN, y: 34 }, thickness: 0.5, color: col(GRID) });
    page.drawText(clean(`Confidential - ${student.full_name}`), { x: MARGIN, y: 22, size: 8, font: regular, color: col(MUTED) });
    const label = `Page ${i + 1} of ${pages.length}`;
    page.drawText(label, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 8), y: 22, size: 8, font: regular, color: col(MUTED) });
  });

  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replaceAll('-', '');
  const slug = clean(student.full_name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Student';
  return { bytes: await doc.save(), filename: `Siddhi_Student_${slug}_${stamp}.pdf` };
}
