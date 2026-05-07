import html2canvas from 'html2canvas';

// ── Public interface ──────────────────────────────────────────────────────────

export interface StoryEvent {
  event_date: string;
  image_url?: string | null;
  event_name?: string | null;
  club_name?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DW = 360; // display width  — scale:3 → 1080px output
const DH = 640; // display height — scale:3 → 1920px output

const COLS = 5;
const SIDE_PAD = 10; // 5*64 + 4*5 + 2*10 = 360 ✓
const COL_GAP = 5;
const CELL_W = 64;   // (DW - SIDE_PAD*2 - COL_GAP*(COLS-1)) / COLS = 64
const ROW_GAP = 5;

const ACCENT = '#F53D04';
const DAY_ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MAX_EVENTS = 30; // 6 rows × 5 cols

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(): { mondayStr: string; sundayStr: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { mondayStr: fmt(monday), sundayStr: fmt(sunday) };
}

export function filterThisWeek(events: StoryEvent[]): StoryEvent[] {
  const { mondayStr, sundayStr } = getWeekBounds();
  return events
    .filter(e => e.event_date && e.event_date >= mondayStr && e.event_date <= sundayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const url =
      src.startsWith('/') || src.startsWith(window.location.origin)
        ? src
        : `/api/admin/image-proxy?url=${encodeURIComponent(src)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

function formatWeekRange(mondayStr: string, sundayStr: string): string {
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const mon = new Date(`${mondayStr}T12:00:00`);
  const sun = new Date(`${sundayStr}T12:00:00`);
  if (mon.getMonth() === sun.getMonth()) {
    return `${MONTHS[mon.getMonth()]} ${mon.getDate()} – ${sun.getDate()}, ${sun.getFullYear()}`;
  }
  return `${MONTHS[mon.getMonth()]} ${mon.getDate()} – ${MONTHS[sun.getMonth()]} ${sun.getDate()}, ${sun.getFullYear()}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateWeeklyStory(
  events: StoryEvent[],
  darkMode = true
): Promise<void> {
  const weekEvents = filterThisWeek(events).slice(0, MAX_EVENTS);
  const { mondayStr } = getWeekBounds();

  // Theme colours
  const BG    = darkMode ? '#0B0B0D' : '#FFFFFF';
  const TEXT  = darkMode ? '#FFFFFF' : '#111111';
  const MUTED = darkMode ? '#6E6E73' : '#8C8C92';
  const CELL_BG = darkMode ? '#111111' : '#F0F0F3';
  const SEP   = darkMode ? '#1A1A1E' : '#E5E5EA';

  // ── Pre-fetch: logo + all poster images ────────────────────────────────────
  const [logoDataUrl, ...posterUrls] = await Promise.all([
    toDataUrl('/logo-1.png'),
    ...weekEvents.map(e => (e.image_url ? toDataUrl(e.image_url) : Promise.resolve(null))),
  ]);

  // Compute logo display dimensions (keep aspect ratio, cap to container)
  let logoW = 0, logoH = 0;
  if (logoDataUrl) {
    const dim = await getImageDimensions(logoDataUrl);
    const MAX_LOGO_H = 40;
    const MAX_LOGO_W = DW - SIDE_PAD * 2;
    logoH = MAX_LOGO_H;
    logoW = Math.round(dim.w * MAX_LOGO_H / dim.h);
    if (logoW > MAX_LOGO_W) {
      logoW = MAX_LOGO_W;
      logoH = Math.round(dim.h * MAX_LOGO_W / dim.w);
    }
  }

  // Header layout: top-pad + logo + gap + heading + gap + separator + post-sep-pad
  const HEADER_TOP_PAD  = 14;
  const LOGO_TO_HEADING = 9;
  const HEADING_H       = 20; // font:12px, lh:1.5
  const HEADING_TO_SEP  = 8;
  const SEP_TO_GRID     = 6;
  const GRID_TOP =
    HEADER_TOP_PAD + logoH + LOGO_TO_HEADING + HEADING_H + HEADING_TO_SEP + 1 + SEP_TO_GRID;

  // Grid sizing: IMAGE_H adapts so all rows fit in available area
  const GRID_BOTTOM_PAD = 8;
  const GRID_AREA_H = DH - GRID_TOP - GRID_BOTTOM_PAD;

  const count = weekEvents.length;
  const rows = count > 0 ? Math.ceil(count / COLS) : 0;

  let IMAGE_H = 85;
  let TEXT_H  = 22; // date (8px) + 3px gap + name (8px) + 3px pad
  let CELL_H  = IMAGE_H + TEXT_H;

  if (rows > 0) {
    const rawCellH = Math.floor((GRID_AREA_H - (rows - 1) * ROW_GAP) / rows);
    IMAGE_H = Math.min(90, rawCellH - TEXT_H);
    if (IMAGE_H < 40) IMAGE_H = 40; // safety floor
    CELL_H = IMAGE_H + TEXT_H;
  }

  // ── Build DOM container ────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    `width:${DW}px`,
    `height:${DH}px`,
    `background:${BG}`,
    'overflow:hidden',
    'box-sizing:border-box',
  ].join(';');

  // Logo
  if (logoDataUrl && logoW > 0) {
    const logoEl = document.createElement('img');
    logoEl.src = logoDataUrl;
    logoEl.style.cssText = [
      'position:absolute',
      `top:${HEADER_TOP_PAD}px`,
      `left:${Math.round((DW - logoW) / 2)}px`,
      `width:${logoW}px`,
      `height:${logoH}px`,
      'display:block',
    ].join(';');
    container.appendChild(logoEl);
  }

  // Heading
  const headingTop = HEADER_TOP_PAD + logoH + LOGO_TO_HEADING;
  const headingEl = document.createElement('div');
  headingEl.textContent = "YOUR WEEKLY LINEUP";
  headingEl.style.cssText = [
    'position:absolute',
    `top:${headingTop}px`,
    'left:0',
    `width:${DW}px`,
    'text-align:center',
    `color:${TEXT}`,
    'font-size:13px',
    'font-weight:900',
    'font-family:system-ui,-apple-system,sans-serif',
    'text-transform:uppercase',
    'letter-spacing:0.06em',
    'line-height:1.5',
  ].join(';');
  container.appendChild(headingEl);

  // Separator
  const sepTop = headingTop + HEADING_H + HEADING_TO_SEP;
  const sepEl = document.createElement('div');
  sepEl.style.cssText = [
    'position:absolute',
    `top:${sepTop}px`,
    `left:${SIDE_PAD}px`,
    `width:${DW - SIDE_PAD * 2}px`,
    'height:1px',
    `background:${SEP}`,
  ].join(';');
  container.appendChild(sepEl);

  // No-events state
  if (count === 0) {
    const msg = document.createElement('div');
    msg.textContent = 'NO EVENTS THIS WEEK';
    msg.style.cssText = [
      'position:absolute',
      `top:${Math.round(DH / 2 - 8)}px`,
      'left:0',
      `width:${DW}px`,
      'text-align:center',
      `color:${MUTED}`,
      'font-size:10px',
      'font-weight:700',
      'font-family:ui-monospace,monospace',
      'letter-spacing:0.12em',
      'text-transform:uppercase',
    ].join(';');
    container.appendChild(msg);
  }

  // Poster grid
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / COLS);
    const rowStart = row * COLS;
    const rowCount = Math.min(COLS, count - rowStart);
    const colInRow = i - rowStart;

    // Centre each row (including incomplete last row)
    const rowTotalW = rowCount * CELL_W + (rowCount - 1) * COL_GAP;
    const x = Math.round(SIDE_PAD + (DW - SIDE_PAD * 2 - rowTotalW) / 2 + colInRow * (CELL_W + COL_GAP));
    const y = GRID_TOP + row * (CELL_H + ROW_GAP);

    const event = weekEvents[i];
    const dataUrl = posterUrls[i];

    // Cell wrapper
    const cell = document.createElement('div');
    cell.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${CELL_W}px`,
      `height:${CELL_H}px`,
    ].join(';');

    // Image area
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      `width:${CELL_W}px`,
      `height:${IMAGE_H}px`,
      'overflow:hidden',
      `background:${CELL_BG}`,
    ].join(';');

    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      imgWrap.appendChild(img);
    }
    cell.appendChild(imgWrap);

    // Text area (below image)
    const textWrap = document.createElement('div');
    textWrap.style.cssText = [
      'position:absolute',
      `top:${IMAGE_H + 3}px`,
      'left:0',
      `width:${CELL_W}px`,
    ].join(';');

    // Date: "Fri 12"
    const dateObj = new Date(`${event.event_date}T12:00:00`);
    const dateStr = `${DAY_ABBR[dateObj.getDay()]} ${dateObj.getDate()}`;
    const dateEl = document.createElement('div');
    dateEl.textContent = dateStr;
    dateEl.style.cssText = [
      `color:${ACCENT}`,
      'font-size:8.5px',
      'font-weight:700',
      'font-family:ui-monospace,Menlo,monospace',
      'text-transform:uppercase',
      'letter-spacing:0.04em',
      'white-space:nowrap',
      'overflow:hidden',
      `width:${CELL_W}px`,
      'line-height:1.4',
    ].join(';');
    textWrap.appendChild(dateEl);

    // Event name (truncated)
    const rawName = (event.event_name || 'EVENT').toUpperCase();
    const MAX_CHARS = 10; // ~64px / 7px per char at 8px font
    const name = rawName.length > MAX_CHARS ? rawName.slice(0, MAX_CHARS - 1) + '…' : rawName;
    const nameEl = document.createElement('div');
    nameEl.textContent = name;
    nameEl.style.cssText = [
      `color:${TEXT}`,
      'font-size:8px',
      'font-weight:900',
      'font-family:system-ui,-apple-system,sans-serif',
      'text-transform:uppercase',
      'letter-spacing:0.02em',
      'white-space:nowrap',
      'overflow:hidden',
      `width:${CELL_W}px`,
      'line-height:1.2',
      'margin-top:2px',
    ].join(';');
    textWrap.appendChild(nameEl);

    cell.appendChild(textWrap);
    container.appendChild(cell);
  }

  document.body.appendChild(container);

  // ── Render with html2canvas → download ────────────────────────────────────
  try {
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: false,   // all images are data URLs — no CORS needed
      backgroundColor: BG,
      width: DW,
      height: DH,
      logging: false,
      imageTimeout: 0,
    });

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('toBlob returned null')); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `weekly-schedule-${mondayStr}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          resolve();
        },
        'image/jpeg',
        0.94
      );
    });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Lineup Story (curated, 3-col, returns Blob for native share) ──────────────

export async function generateLineupStory(
  selectedEvents: StoryEvent[],
  darkMode = true
): Promise<Blob> {
  const DW = 360, DH = 640;
  const SIDE_PAD = 14, COL_GAP = 8, ROW_GAP = 8;

  const BG     = darkMode ? '#0B0B0D' : '#FFFFFF';
  const TEXT   = darkMode ? '#FFFFFF' : '#111111';
  const MUTED  = darkMode ? '#6E6E73' : '#8C8C92';
  const CELL_BG = darkMode ? '#111111' : '#F0F0F3';
  const SEP    = darkMode ? '#1A1A1E' : '#E5E5EA';

  // ── Pre-fetch all images as data URLs ─────────────────────────────────────
  const [logoDataUrl, ...posterUrls] = await Promise.all([
    toDataUrl('/logo-1.png'),
    ...selectedEvents.map(e => (e.image_url ? toDataUrl(e.image_url) : Promise.resolve(null))),
  ]);

  // Logo — compact height for horizontal header row
  let logoW = 0, logoH = 0;
  if (logoDataUrl) {
    const dim = await getImageDimensions(logoDataUrl);
    const TARGET_H = 40;
    const MAX_LOGO_W = Math.floor(DW * 0.40); // cap at ~40% of canvas width
    logoH = TARGET_H;
    logoW = Math.round(dim.w * TARGET_H / dim.h);
    if (logoW > MAX_LOGO_W) { logoW = MAX_LOGO_W; logoH = Math.round(dim.h * MAX_LOGO_W / dim.w); }
  }

  // ── Layout — horizontal header: logo left, week range right ──────────────
  const { mondayStr: wkMon, sundayStr: wkSun } = getWeekBounds();
  const weekRangeLabel = formatWeekRange(wkMon, wkSun);

  const HEADER_TOP_PAD = 14;
  const HEADER_ROW_H   = 56;  // single row containing logo + title side-by-side
  const HEADER_TO_SEP  = 10;
  const SEP_TO_GRID    = 10;
  const SEP_Y   = HEADER_TOP_PAD + HEADER_ROW_H + HEADER_TO_SEP; // 80
  const GRID_TOP = SEP_Y + 1 + SEP_TO_GRID;                        // 91


  // Text row layout: [Image] → [Event Title] → [Date]
  const TEXT_TOP_PAD = 5;   // gap between image bottom and title
  const NAME_LINE_H  = 16;  // 9px font × 1.4 lh
  const NAME_TO_DATE = 3;
  const DATE_LINE_H  = 20;  // 9px font × 1.5 lh + 5px descender pad
  const TEXT_H = TEXT_TOP_PAD + NAME_LINE_H + NAME_TO_DATE + DATE_LINE_H; // 44

  const FOOTER_H    = 24;
  const GRID_AREA_H = DH - GRID_TOP - FOOTER_H;

  const count = selectedEvents.length;

  // Strict grid dimensions keyed to selection count
  // n=1 → 1×1 | n=2 → 2×1 | n=3–4 → 2×2 | n=5–9 → 3×3
  const cols   = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rows   = count <= 2 ? 1 : count <= 4 ? 2 : 3;
  const CELL_W = cols === 1
    ? DW - SIDE_PAD * 2
    : Math.floor((DW - SIDE_PAD * 2 - COL_GAP * (cols - 1)) / cols);

  // Measure natural aspect ratio of each poster and use the median as imageH
  const posterDims = await Promise.all(
    posterUrls.map(url => url ? getImageDimensions(url) : Promise.resolve({ w: 1, h: 1 }))
  );
  const validHs = posterUrls
    .map((url, i) => url && posterDims[i].w > 0
      ? Math.round(CELL_W * posterDims[i].h / posterDims[i].w)
      : null)
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  const medianH   = validHs.length > 0 ? validHs[Math.floor(validHs.length / 2)] : CELL_W;
  const maxImageH = Math.floor((GRID_AREA_H - ROW_GAP * (rows - 1)) / rows) - TEXT_H;
  const imageH    = Math.max(50, Math.min(maxImageH, medianH));

  const CELL_H      = imageH + TEXT_H;
  const gridBlockH  = rows * CELL_H + (rows - 1) * ROW_GAP;
  const gridOffsetY = count > 0
    ? Math.round((GRID_AREA_H - gridBlockH) / 2)
    : 0;

  // ── Build DOM container ────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    `width:${DW}px`, `height:${DH}px`, `background:${BG}`,
    'overflow:hidden', 'box-sizing:border-box',
  ].join(';');

  // Logo — left side of header row, vertically centered
  if (logoDataUrl && logoW > 0) {
    const logoEl = document.createElement('img');
    logoEl.src = logoDataUrl;
    const logoTop = HEADER_TOP_PAD + Math.round((HEADER_ROW_H - logoH) / 2);
    logoEl.style.cssText = [
      'position:absolute',
      `top:${logoTop}px`,
      `left:${SIDE_PAD}px`,
      `width:${logoW}px`,
      `height:${logoH}px`,
      'display:block',
    ].join(';');
    container.appendChild(logoEl);
  }

  // Title — right side of header row, vertically centered
  const titleLeft  = SIDE_PAD + logoW + 12;
  const titleWidth = DW - titleLeft - SIDE_PAD;
  const HEADING_FONT_H = 32; // Two lines: ~14px + ~14px + gap
  const titleTop = HEADER_TOP_PAD + Math.round((HEADER_ROW_H - HEADING_FONT_H) / 2);
  
  const headingEl = document.createElement('div');
  headingEl.style.cssText = [
    'position:absolute',
    `top:${titleTop}px`,
    `left:${titleLeft}px`,
    `width:${titleWidth}px`,
    'text-align:right',
    `color:${TEXT}`,
    'font-family:ui-monospace,Menlo,monospace',
    'text-transform:uppercase',
    'line-height:1.2',
  ].join(';');

  const labelTop = document.createElement('div');
  labelTop.textContent = "MY SCENE THIS WEEK";
  labelTop.style.cssText = [
    'font-size:10px',
    'font-weight:900',
    'letter-spacing:0.04em',
    `color:${MUTED}`,
  ].join(';');
  headingEl.appendChild(labelTop);

  const labelBottom = document.createElement('div');
  labelBottom.textContent = weekRangeLabel;
  labelBottom.style.cssText = [
    'font-size:12px',
    'font-weight:900',
    'letter-spacing:0.02em',
    `color:${ACCENT}`,
    'margin-top:2px',
  ].join(';');
  headingEl.appendChild(labelBottom);
  
  container.appendChild(headingEl);

  // Separator
  const sepEl = document.createElement('div');
  sepEl.style.cssText = [
    'position:absolute',
    `top:${SEP_Y}px`,
    `left:${SIDE_PAD}px`,
    `width:${DW - SIDE_PAD * 2}px`,
    'height:1px',
    `background:${SEP}`,
  ].join(';');
  container.appendChild(sepEl);

  // Empty state
  if (count === 0) {
    const msg = document.createElement('div');
    msg.textContent = 'NO EVENTS SELECTED';
    msg.style.cssText = [
      'position:absolute', `top:${Math.round(DH / 2 - 8)}px`, 'left:0', `width:${DW}px`,
      'text-align:center', `color:${MUTED}`,
      'font-size:10px', 'font-weight:700',
      'font-family:ui-monospace,monospace', 'letter-spacing:0.12em', 'text-transform:uppercase',
    ].join(';');
    container.appendChild(msg);
  }

  // Poster grid
  for (let i = 0; i < count; i++) {
    const row      = Math.floor(i / cols);
    const rowStart = row * cols;
    const rowCount = Math.min(cols, count - rowStart);
    const colInRow = i - rowStart;

    const rowTotalW = rowCount * CELL_W + (rowCount - 1) * COL_GAP;
    const x = Math.round(SIDE_PAD + (DW - SIDE_PAD * 2 - rowTotalW) / 2 + colInRow * (CELL_W + COL_GAP));
    const y = GRID_TOP + gridOffsetY + row * (CELL_H + ROW_GAP);

    const event   = selectedEvents[i];
    const dataUrl = posterUrls[i];

    const cell = document.createElement('div');
    cell.style.cssText = [
      'position:absolute', `left:${x}px`, `top:${y}px`,
      `width:${CELL_W}px`, `height:${CELL_H}px`,
    ].join(';');

    // Image — strict overflow:hidden
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `width:${CELL_W}px`, `height:${imageH}px`,
      'overflow:hidden', `background:${CELL_BG}`,
    ].join(';');
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      imgWrap.appendChild(img);
    }
    cell.appendChild(imgWrap);

    // Event name — one line with ellipsis (title above date)
    const rawName = (event.event_name || 'EVENT').toUpperCase();
    const MAX_NAME_CHARS = Math.floor(CELL_W / 6.5); // ~16 chars for 105px cell
    const displayName = rawName.length > MAX_NAME_CHARS
      ? rawName.slice(0, MAX_NAME_CHARS - 1) + '…'
      : rawName;
    const nameEl = document.createElement('div');
    nameEl.textContent = displayName;
    nameEl.style.cssText = [
      'position:absolute',
      `top:${imageH + TEXT_TOP_PAD}px`,
      'left:0',
      `width:${CELL_W}px`,
      `height:${NAME_LINE_H}px`,
      `color:${TEXT}`,
      'font-size:9px', 'font-weight:900',
      'font-family:system-ui,-apple-system,sans-serif',
      'text-transform:uppercase', 'letter-spacing:0.02em',
      'line-height:1.4',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';');
    cell.appendChild(nameEl);

    // Date: "SAT 09" — orange, below title, with descender room
    const dateObj = new Date(`${event.event_date}T12:00:00`);
    const dateStr = `${DAY_ABBR[dateObj.getDay()]} ${String(dateObj.getDate()).padStart(2, '0')}`;
    const dateEl = document.createElement('div');
    dateEl.textContent = dateStr;
    dateEl.style.cssText = [
      'position:absolute',
      `top:${imageH + TEXT_TOP_PAD + NAME_LINE_H + NAME_TO_DATE}px`,
      'left:0',
      `width:${CELL_W}px`,
      `min-height:${DATE_LINE_H}px`,
      `color:${ACCENT}`,
      'font-size:9px', 'font-weight:700',
      'font-family:ui-monospace,Menlo,monospace',
      'text-transform:uppercase', 'letter-spacing:0.05em',
      'white-space:nowrap', 'overflow:hidden',
      'line-height:1.5', 'padding-bottom:5px',
    ].join(';');
    cell.appendChild(dateEl);

    container.appendChild(cell);
  }

  // Footer branding
  const footerEl = document.createElement('div');
  footerEl.textContent = '@AFTERFIVEPH';
  footerEl.style.cssText = [
    'position:absolute', `top:${DH - FOOTER_H + 6}px`, 'left:0', `width:${DW}px`,
    'text-align:center', `color:${MUTED}`,
    'font-size:8px', 'font-weight:500',
    'font-family:ui-monospace,Menlo,monospace',
    'letter-spacing:0.1em', 'text-transform:uppercase',
  ].join(';');
  container.appendChild(footerEl);

  document.body.appendChild(container);

  // ── Render → return Blob ──────────────────────────────────────────────────
  try {
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: false,
      backgroundColor: BG,
      width: DW,
      height: DH,
      logging: false,
      imageTimeout: 0,
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('toBlob returned null')); return; }
          resolve(blob);
        },
        'image/jpeg',
        0.94
      );
    });
  } finally {
    document.body.removeChild(container);
  }
}
