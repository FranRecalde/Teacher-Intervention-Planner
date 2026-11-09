// Seating Layout Configurations and Slot Generators
// Room canvas: Width = 1080px, Height = 650px.
// Left Tray: x in [0, 224). Room Area: x in [224, 1080] (span = 856px), y in [0, 650].
// Teaching Area at Front: y in [0, 70] (Door, Whiteboard, Teacher Desk).
// Seats Area: y in [76, 640].

export type LayoutType =
  | 'rows-8x4'
  | 'rows-4x8'
  | 'rows-6x5'
  | 'rows-5x6'
  | 'rows-6x4'
  | 'pairs-4x4'
  | 'tables-8x4'
  | 'horseshoe-30'
  | 'custom';

export interface LayoutOption {
  id: LayoutType;
  label: string;
  totalSeats: number;
  description: string;
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'rows-8x4',
    label: 'Rows 8 x 4 (32 seats, default)',
    totalSeats: 32,
    description: '8 desks across, 4 rows deep',
  },
  {
    id: 'rows-4x8',
    label: 'Rows 4 x 8 (4 across, 8 deep, 32 seats)',
    totalSeats: 32,
    description: '4 desks across, 8 rows deep',
  },
  {
    id: 'rows-6x5',
    label: 'Rows 6 x 5 (30 seats)',
    totalSeats: 30,
    description: '6 desks across, 5 rows deep',
  },
  {
    id: 'rows-5x6',
    label: 'Rows 5 x 6 (30 seats)',
    totalSeats: 30,
    description: '5 desks across, 6 rows deep',
  },
  {
    id: 'rows-6x4',
    label: 'Rows 6 x 4 (24 seats)',
    totalSeats: 24,
    description: '6 desks across, 4 rows deep',
  },
  {
    id: 'pairs-4x4',
    label: 'Pairs: 4 pairs across, 4 rows deep (32 seats)',
    totalSeats: 32,
    description: '4 partnered pairs across, 4 rows deep with aisle gaps',
  },
  {
    id: 'tables-8x4',
    label: 'Table groups: 8 tables of 4 seats (32 seats)',
    totalSeats: 32,
    description: '8 collaborative table pods of 4 desks',
  },
  {
    id: 'horseshoe-30',
    label: 'Horseshoe (U shape): 30 seats',
    totalSeats: 30,
    description: 'Open U-shape facing front whiteboard: 8 left, 14 back, 8 right',
  },
  {
    id: 'custom',
    label: 'Custom: user columns & rows (max 32)',
    totalSeats: 32,
    description: 'Custom grid entered by teacher (up to 32 seats)',
  },
];

export interface Slot {
  id: string; // e.g. "slot-0", "slot-1"
  index: number;
  label: string; // e.g. "R1-S1", "T1-A"
  x: number; // pixels relative to canvas top-left
  y: number;
  width: number;
  height: number;
}

export const TRAY_WIDTH = 224;
export const CANVAS_DEFAULT_WIDTH = 1080;
export const CANVAS_DEFAULT_HEIGHT = 650;

export const SEND_CODE_MAP: Record<string, { code: string; label: string }> = {
  'Hearing impairment': { code: 'HI', label: 'Hearing impairment' },
  'HI': { code: 'HI', label: 'Hearing impairment' },
  'Autism spectrum condition': { code: 'ASD', label: 'Autism spectrum condition' },
  'Autism': { code: 'ASD', label: 'Autism spectrum condition' },
  'ASD': { code: 'ASD', label: 'Autism spectrum condition' },
  'Dyslexia': { code: 'Dyslexia', label: 'Dyslexia' },
  'ADHD': { code: 'ADHD', label: 'Attention Deficit Hyperactivity Disorder' },
  'Visual impairment': { code: 'VI', label: 'Visual impairment' },
  'VI': { code: 'VI', label: 'Visual impairment' },
  'SEMH': { code: 'SEMH', label: 'Social, Emotional & Mental Health' },
  'SLCN': { code: 'SLCN', label: 'Speech, Language & Communication Needs' },
  'MLD': { code: 'MLD', label: 'Moderate Learning Difficulties' },
  'Physical disability': { code: 'Physical', label: 'Physical disability' },
};

export function getSendInfo(sendArea?: string): { code: string; label: string } | null {
  if (!sendArea) return null;
  const trimmed = sendArea.trim();
  if (SEND_CODE_MAP[trimmed]) return SEND_CODE_MAP[trimmed];
  for (const [k, v] of Object.entries(SEND_CODE_MAP)) {
    if (trimmed.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return { code: trimmed.length > 8 ? trimmed.substring(0, 7) + '.' : trimmed, label: trimmed };
}

/**
 * Computes slot positions for the chosen classroom layout
 */
export function computeLayoutSlots(
  layoutType: LayoutType,
  customCols: number = 7,
  customRows: number = 4
): Slot[] {
  const roomLeft = 236;
  const roomRight = 1068;
  const roomWidth = roomRight - roomLeft; // 832px
  const startY = 82;

  switch (layoutType) {
    case 'rows-8x4': {
      const cols = 8;
      const rows = 4;
      const slotW = 94;
      const slotH = 52;
      const colGap = (roomWidth - cols * slotW) / (cols - 1); // ~11.4px
      const rowGap = 34;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(roomLeft + c * (slotW + colGap)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'rows-4x8': {
      const cols = 4;
      const rows = 8;
      const slotW = 110;
      const slotH = 48;
      // Center the 4 columns
      const totalGridW = cols * slotW + (cols - 1) * 36;
      const leftOffset = roomLeft + (roomWidth - totalGridW) / 2;
      const rowGap = 16;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(leftOffset + c * (slotW + 36)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'rows-6x5': {
      const cols = 6;
      const rows = 5;
      const slotW = 100;
      const slotH = 50;
      const totalGridW = cols * slotW + (cols - 1) * 26;
      const leftOffset = roomLeft + (roomWidth - totalGridW) / 2;
      const rowGap = 24;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(leftOffset + c * (slotW + 26)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'rows-5x6': {
      const cols = 5;
      const rows = 6;
      const slotW = 104;
      const slotH = 50;
      const totalGridW = cols * slotW + (cols - 1) * 32;
      const leftOffset = roomLeft + (roomWidth - totalGridW) / 2;
      const rowGap = 20;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(leftOffset + c * (slotW + 32)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'rows-6x4': {
      const cols = 6;
      const rows = 4;
      const slotW = 104;
      const slotH = 52;
      const totalGridW = cols * slotW + (cols - 1) * 28;
      const leftOffset = roomLeft + (roomWidth - totalGridW) / 2;
      const rowGap = 36;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(leftOffset + c * (slotW + 28)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'pairs-4x4': {
      // 4 pairs across (8 desks), 4 rows deep = 32 seats
      // Each pair has 2 desks side-by-side with 4px gap, and 24px aisle between pairs
      const numPairs = 4;
      const rows = 4;
      const slotW = 90;
      const slotH = 52;
      const pairGap = 4;
      const aisleGap = 24;
      const pairTotalW = slotW * 2 + pairGap; // 184px
      const totalGridW = numPairs * pairTotalW + (numPairs - 1) * aisleGap; // 184*4 + 72 = 808px
      const leftOffset = roomLeft + (roomWidth - totalGridW) / 2;
      const rowGap = 34;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let p = 0; p < numPairs; p++) {
          const pairLeft = leftOffset + p * (pairTotalW + aisleGap);
          // Desk A of pair
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `P${p + 1}A-R${r + 1}`,
            x: Math.round(pairLeft),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
          // Desk B of pair
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `P${p + 1}B-R${r + 1}`,
            x: Math.round(pairLeft + slotW + pairGap),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    case 'tables-8x4': {
      // 8 tables of 4 seats = 32 seats.
      // Arranged as 4 tables across, 2 rows deep.
      // Each table is a 2x2 pod of desks: Top-Left, Top-Right, Bottom-Left, Bottom-Right.
      const tablesAcross = 4;
      const tableRows = 2;
      const deskW = 86;
      const deskH = 50;
      const internalGapX = 4;
      const internalGapY = 4;
      const tableW = deskW * 2 + internalGapX; // 176px
      const tableH = deskH * 2 + internalGapY; // 104px
      const aisleX = 26;
      const aisleY = 48;

      const totalW = tablesAcross * tableW + (tablesAcross - 1) * aisleX; // 176*4 + 78 = 782px
      const leftOffset = roomLeft + (roomWidth - totalW) / 2;
      const topOffset = startY + 12;

      const slots: Slot[] = [];
      let idx = 0;
      let tableNum = 1;

      for (let tr = 0; tr < tableRows; tr++) {
        for (let tc = 0; tc < tablesAcross; tc++) {
          const tX = leftOffset + tc * (tableW + aisleX);
          const tY = topOffset + tr * (tableH + aisleY);

          // Seat 1: Top Left
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `T${tableNum}-A`,
            x: Math.round(tX),
            y: Math.round(tY),
            width: deskW,
            height: deskH,
          });
          idx++;

          // Seat 2: Top Right
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `T${tableNum}-B`,
            x: Math.round(tX + deskW + internalGapX),
            y: Math.round(tY),
            width: deskW,
            height: deskH,
          });
          idx++;

          // Seat 3: Bottom Left
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `T${tableNum}-C`,
            x: Math.round(tX),
            y: Math.round(tY + deskH + internalGapY),
            width: deskW,
            height: deskH,
          });
          idx++;

          // Seat 4: Bottom Right
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `T${tableNum}-D`,
            x: Math.round(tX + deskW + internalGapX),
            y: Math.round(tY + deskH + internalGapY),
            width: deskW,
            height: deskH,
          });
          idx++;

          tableNum++;
        }
      }
      return slots;
    }

    case 'horseshoe-30': {
      // Horseshoe (U-shape): 30 seats
      // 8 seats down left wing, 14 seats across back (2 rows of 7), 8 seats up right wing = 30 seats.
      const deskW = 88;
      const deskH = 46;
      const slots: Slot[] = [];
      let idx = 0;

      // 1. Left Wing: 8 seats going down from y = 82 to y = 460
      const leftWingX = roomLeft + 12; // 248
      const wingGapY = 8;
      for (let i = 0; i < 8; i++) {
        slots.push({
          id: `slot-${idx}`,
          index: idx,
          label: `L${i + 1}`,
          x: leftWingX,
          y: Math.round(startY + i * (deskH + wingGapY)),
          width: deskW,
          height: deskH,
        });
        idx++;
      }

      // 2. Back Row: 14 seats across (2 rows of 7) positioned between left and right wings
      // Left edge of back section is after left wing: 248 + 88 + 16 = 352
      // Right edge of back section is before right wing: 980 - 16 = 964
      // Available width: 612px
      const backCols = 7;
      const backDeskW = 76;
      const backGapX = (612 - backCols * backDeskW) / (backCols - 1); // ~13.3px
      const backStartX = leftWingX + deskW + 16;
      const backStartY = startY + 8 * (deskH + wingGapY) + 6; // ~520px

      for (let br = 0; br < 2; br++) {
        for (let bc = 0; bc < backCols; bc++) {
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `B${br + 1}-${bc + 1}`,
            x: Math.round(backStartX + bc * (backDeskW + backGapX)),
            y: Math.round(backStartY + br * (deskH + 10)),
            width: backDeskW,
            height: deskH,
          });
          idx++;
        }
      }

      // 3. Right Wing: 8 seats going from back up to front
      const rightWingX = roomRight - deskW - 12; // 968
      for (let i = 0; i < 8; i++) {
        slots.push({
          id: `slot-${idx}`,
          index: idx,
          label: `R${i + 1}`,
          x: rightWingX,
          y: Math.round(startY + (7 - i) * (deskH + wingGapY)),
          width: deskW,
          height: deskH,
        });
        idx++;
      }

      return slots;
    }

    case 'custom': {
      const cols = Math.max(1, Math.min(8, customCols || 7));
      const rows = Math.max(1, Math.min(8, customRows || 4));
      const total = cols * rows;
      const maxAllowed = Math.min(32, total);

      const slotW = cols > 6 ? 94 : cols > 4 ? 104 : 116;
      const slotH = rows > 6 ? 48 : 52;
      const totalGridW = cols * slotW + (cols - 1) * 20;
      const leftOffset = roomLeft + Math.max(0, (roomWidth - totalGridW) / 2);
      const rowGap = rows > 5 ? 18 : 30;

      const slots: Slot[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (idx >= maxAllowed) break;
          slots.push({
            id: `slot-${idx}`,
            index: idx,
            label: `R${r + 1}-S${c + 1}`,
            x: Math.round(leftOffset + c * (slotW + 20)),
            y: Math.round(startY + r * (slotH + rowGap)),
            width: slotW,
            height: slotH,
          });
          idx++;
        }
      }
      return slots;
    }

    default:
      return computeLayoutSlots('rows-8x4');
  }
}

/**
 * Get coordinates for a slot inside the unplaced tray
 */
export function getTraySlot(index: number) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 8 + col * 105,
    y: 46 + row * 44,
  };
}
