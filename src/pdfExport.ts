import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Pupil,
  PupilAnalysis,
  WholeClassPriority,
  InterventionGroup,
} from './types';
import { findStrategyById } from './strategiesByYear';
import {
  SeatingPosition,
  INTERVENTION_PALETTE,
} from './SeatingPlan';
import {
  LayoutType,
  computeLayoutSlots,
  Slot,
  SEND_CODE_MAP,
  getSendInfo,
  TRAY_WIDTH,
  CANVAS_DEFAULT_WIDTH,
  CANVAS_DEFAULT_HEIGHT,
} from './seatingLayouts';

export interface GeneratePdfOptions {
  pupils: Pupil[];
  pupilAnalyses: Map<string, PupilAnalysis>;
  priorities: WholeClassPriority[];
  interventionGroups: InterventionGroup[];
  seatingPositions: Record<string, SeatingPosition>;
  showGroupColors: boolean;
  metrics: {
    totalPupils: number;
    flaggedCount: number;
    belowTargetCount: number;
    sendCount: number;
  };
  classCode?: string;
  departmentName?: string;
  planTitle?: string;
  layoutType?: LayoutType;
  customCols?: number;
  customRows?: number;
}

export interface GenerateSeatingOnlyPdfOptions {
  pupils: Pupil[];
  pupilAnalyses: Map<string, PupilAnalysis>;
  interventionGroups: InterventionGroup[];
  seatingPositions: Record<string, SeatingPosition>;
  showGroupColors: boolean;
  classCode?: string;
  layoutType?: LayoutType;
  customCols?: number;
  customRows?: number;
}

/**
 * Calculates effective position of any object or pupil card,
 * falling back to default coordinates if not yet positioned.
 */
export function getEffectivePosition(
  id: string,
  seatingPositions: Record<string, SeatingPosition>,
  pupils: Pupil[],
  index?: number
): SeatingPosition {
  if (seatingPositions[id]) return seatingPositions[id];
  if (id === 'obj-board') return { x: 480, y: 14 };
  if (id === 'obj-desk') return { x: 880, y: 14 };
  if (id === 'obj-door') return { x: 236, y: 14 };

  const idx = index !== undefined ? index : pupils.findIndex((p) => p.id === id);
  const col = (idx >= 0 ? idx : 0) % 2;
  const row = Math.floor((idx >= 0 ? idx : 0) / 2);
  return {
    x: 8 + col * 105,
    y: 46 + row * 44,
  };
}

/**
 * Hex to RGB helper for jsPDF drawing
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
    return [r, g, b];
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return [r, g, b];
}

/**
 * Draws the complete Seating Plan page onto the current page of a landscape A4 jsPDF instance.
 */
export function drawSeatingPlanPage(
  doc: jsPDF,
  options: {
    pupils: Pupil[];
    pupilAnalyses: Map<string, PupilAnalysis>;
    interventionGroups: InterventionGroup[];
    seatingPositions: Record<string, SeatingPosition>;
    showGroupColors: boolean;
    classCode?: string;
    layoutType?: LayoutType;
    customCols?: number;
    customRows?: number;
  }
): void {
  const {
    pupils,
    pupilAnalyses,
    interventionGroups,
    seatingPositions,
    showGroupColors,
    classCode = '11A/Sp1',
    layoutType = 'rows-8x4',
    customCols = 7,
    customRows = 4,
  } = options;

  // British formatted date
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate layout slots
  const layoutSlots = computeLayoutSlots(layoutType, customCols, customRows);

  // Match pupils to slots based on coordinates
  const slotToPupil = new Map<string, Pupil>();
  const placedPupilIds = new Set<string>();

  layoutSlots.forEach((slot) => {
    const matched = pupils.find((p, idx) => {
      const pos = getEffectivePosition(p.id, seatingPositions, pupils, idx);
      return Math.abs(pos.x - slot.x) < 18 && Math.abs(pos.y - slot.y) < 18;
    });
    if (matched) {
      slotToPupil.set(slot.id, matched);
      placedPupilIds.add(matched.id);
    }
  });

  const unplacedPupils = pupils.filter((p) => !placedPupilIds.has(p.id));
  const hasUnplaced = unplacedPupils.length > 0;

  // Page Dimensions
  const pageWidth = 297;
  const pageHeight = 210;
  const marginLeft = 14;
  const marginRight = 14;
  const marginTop = 11;

  // Header Bar (y = 11 to 23 mm)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(58, 93, 51); // #3A5D33
  doc.text('DEPARTMENT OF MODERN FOREIGN LANGUAGES', marginLeft, marginTop + 2);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 36, 33);
  doc.text('GCSE Spanish - Year 11 Classroom Seating Plan', marginLeft, marginTop + 7.5);

  // Right Header Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(`Class: ${classCode}  |  ${dateStr}`, pageWidth - marginRight, marginTop + 2.5, {
    align: 'right',
  });
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Placed: ${placedPupilIds.size}  |  Unplaced: ${unplacedPupils.length}`,
    pageWidth - marginRight,
    marginTop + 7.5,
    { align: 'right' }
  );

  // Divider line under header
  doc.setDrawColor(58, 93, 51);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, marginTop + 10, pageWidth - marginRight, marginTop + 10);

  // Geometry
  const roomOriginX = TRAY_WIDTH; // 224
  const roomSpanX = CANVAS_DEFAULT_WIDTH - TRAY_WIDTH; // 856
  const roomSpanY = CANVAS_DEFAULT_HEIGHT; // 650
  const roomTopY = marginTop + 13; // 24mm

  let roomBoxX: number;
  let roomBoxWidth: number;
  let roomBoxHeight: number;
  let scale: number;

  if (hasUnplaced) {
    roomBoxX = marginLeft;
    roomBoxWidth = 184;
    roomBoxHeight = 136;
    scale = roomBoxWidth / roomSpanX;
  } else {
    roomBoxWidth = 220;
    roomBoxHeight = 142;
    roomBoxX = marginLeft + (pageWidth - marginLeft - marginRight - roomBoxWidth) / 2;
    scale = roomBoxWidth / roomSpanX;
  }

  // Draw Classroom Boundary Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.roundedRect(roomBoxX, roomTopY, roomBoxWidth, roomBoxHeight, 2, 2, 'FD');

  const toPdfCoord = (screenX: number, screenY: number) => {
    const rx = screenX - roomOriginX;
    const ry = screenY;
    const px = roomBoxX + rx * scale;
    const py = roomTopY + ry * scale;
    return {
      x: Math.max(roomBoxX + 1, Math.min(roomBoxX + roomBoxWidth - 10, px)),
      y: Math.max(roomTopY + 4, Math.min(roomTopY + roomBoxHeight - 12, py)),
    };
  };

  // 1. Draw Door
  const doorPt = toPdfCoord(236, 14);
  const doorW = 86 * scale;
  const doorH = 38 * scale;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.roundedRect(doorPt.x, doorPt.y, doorW, doorH, 1, 1, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('Door', doorPt.x + doorW / 2, doorPt.y + doorH / 2 + 1.8, { align: 'center' });

  // 2. Draw Interactive Whiteboard
  const boardPt = toPdfCoord(480, 14);
  const boardW = 260 * scale;
  const boardH = 38 * scale;
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.roundedRect(boardPt.x, boardPt.y, boardW, boardH, 1, 1, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Interactive whiteboard', boardPt.x + boardW / 2, boardPt.y + boardH / 2 + 2, {
    align: 'center',
  });

  // 3. Draw Teacher Desk
  const deskPt = toPdfCoord(880, 14);
  const deskW = 140 * scale;
  const deskH = 38 * scale;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.roundedRect(deskPt.x, deskPt.y, deskW, deskH, 1, 1, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Teacher desk', deskPt.x + deskW / 2, deskPt.y + deskH / 2 + 1.8, { align: 'center' });

  // Active SEND Codes for bottom key
  const activeSendCodes = new Map<string, string>();

  // Draw All Layout Slots
  layoutSlots.forEach((slot) => {
    const slotPt = toPdfCoord(slot.x, slot.y);
    const slotW = slot.width * scale;
    const slotH = slot.height * scale;
    const seatedPupil = slotToPupil.get(slot.id);

    if (!seatedPupil) {
      // Empty slot with dashed outline
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.roundedRect(slotPt.x, slotPt.y, slotW, slotH, 1, 1, 'FD');
      doc.setLineDashPattern([], 0); // reset line dash

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(slot.label, slotPt.x + slotW / 2, slotPt.y + slotH / 2 + 1, { align: 'center' });
    } else {
      // Occupied slot - Desk card
      const analysis = pupilAnalyses.get(seatedPupil.id);
      const isFlagged = analysis?.isFlagged;
      const groupIdx = interventionGroups.findIndex((g) => g.pupilIds.includes(seatedPupil.id));
      const groupPalette =
        groupIdx !== -1 ? INTERVENTION_PALETTE[groupIdx % INTERVENTION_PALETTE.length] : null;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(184, 186, 187);
      doc.setLineWidth(0.35);
      doc.roundedRect(slotPt.x, slotPt.y, slotW, slotH, 1, 1, 'FD');

      // Group Stripe
      if (showGroupColors && groupPalette) {
        const [r, g, b] = hexToRgb(groupPalette.border);
        doc.setFillColor(r, g, b);
        doc.rect(slotPt.x, slotPt.y, 1.4, slotH, 'F');
      }

      // Priority Dot
      if (isFlagged) {
        doc.setFillColor(217, 119, 6);
      } else {
        doc.setFillColor(58, 93, 51);
      }
      const dotX = slotPt.x + (showGroupColors && groupPalette ? 2.8 : 2.2);
      const dotY = slotPt.y + 2.8;
      doc.circle(dotX, dotY, 0.75, 'F');

      // Full pupil name (8 pt, wrapped onto 2 lines if long without ellipsis)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 36, 33);
      const nameLines = doc.splitTextToSize(seatedPupil.name, slotW - 5.5);
      const textX = dotX + 1.8;

      if (nameLines.length === 1) {
        doc.text(nameLines[0], textX, slotPt.y + 3.6);
      } else {
        doc.text(nameLines[0], textX, slotPt.y + 3.2);
        doc.text(nameLines[1], textX, slotPt.y + 6.2);
      }

      // Bottom Row: Grade + SEND badge
      const bottomY = slotPt.y + slotH - 1.6;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text(`G${seatedPupil.currentGrade}/T${seatedPupil.targetGrade}`, slotPt.x + 2, bottomY);

      if (seatedPupil.sendArea) {
        const sendInfo = getSendInfo(seatedPupil.sendArea);
        if (sendInfo) {
          activeSendCodes.set(sendInfo.code, sendInfo.label);
          doc.setFillColor(233, 239, 233);
          const badgeW = doc.getTextWidth(sendInfo.code) + 2;
          const badgeX = slotPt.x + slotW - badgeW - 1.2;
          doc.roundedRect(badgeX, bottomY - 2.8, badgeW, 3.4, 0.4, 0.4, 'F');
          doc.setTextColor(58, 93, 51);
          doc.setFontSize(6);
          doc.text(sendInfo.code, badgeX + 1, bottomY - 0.4);
        }
      }
    }
  });

  // 5. Draw Unplaced Pupils Panel if unplaced pupils exist
  if (hasUnplaced) {
    const unplacedBoxX = roomBoxX + roomBoxWidth + 4;
    const unplacedBoxW = pageWidth - marginRight - unplacedBoxX;
    const unplacedBoxH = roomBoxHeight;

    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.4);
    doc.roundedRect(unplacedBoxX, roomTopY, unplacedBoxW, unplacedBoxH, 1.5, 1.5, 'FD');

    // Header of unplaced panel
    doc.setFillColor(243, 244, 246);
    doc.rect(unplacedBoxX, roomTopY, unplacedBoxW, 6.5, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.line(unplacedBoxX, roomTopY + 6.5, unplacedBoxX + unplacedBoxW, roomTopY + 6.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(`Unplaced pupils (${unplacedPupils.length})`, unplacedBoxX + 3.5, roomTopY + 4.5);

    // List of unplaced pupils
    const itemStartY = roomTopY + 10;
    const colW = (unplacedBoxW - 6) / 2;
    const itemH = 7.5;
    const maxItemsPerCol = Math.floor((unplacedBoxH - 12) / itemH);

    unplacedPupils.forEach((pupil, idx) => {
      const col = Math.floor(idx / maxItemsPerCol);
      const row = idx % maxItemsPerCol;
      if (col > 1) return;

      const itemX = unplacedBoxX + 2.5 + col * colW;
      const itemY = itemStartY + row * itemH;

      const analysis = pupilAnalyses.get(pupil.id);
      const isFlagged = analysis?.isFlagged;

      doc.setFillColor(isFlagged ? 217 : 58, isFlagged ? 119 : 93, isFlagged ? 6 : 51);
      doc.circle(itemX + 1.2, itemY + 1.2, 0.7, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      const truncName = doc.splitTextToSize(pupil.name, colW - 18)[0] || pupil.name;
      doc.text(truncName, itemX + 3, itemY + 2.2);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`G${pupil.currentGrade}/T${pupil.targetGrade}`, itemX + colW - 2, itemY + 2.2, {
        align: 'right',
      });
    });
  }

  // 6. Comprehensive Legend Panel (y = 163 to 196 mm)
  const legendTopY = roomTopY + roomBoxHeight + 3;
  const legendHeight = 28;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, legendTopY, pageWidth - marginLeft - marginRight, legendHeight, 1, 1, 'FD');

  // Legend Row 1: Priority Dots & Grade Format
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Key & Legend:', marginLeft + 2.5, legendTopY + 4.2);

  doc.setFillColor(58, 93, 51);
  doc.circle(marginLeft + 26, legendTopY + 3.6, 1.1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.text('Green = On Track', marginLeft + 29, legendTopY + 4.2);

  doc.setFillColor(217, 119, 6);
  doc.circle(marginLeft + 60, legendTopY + 3.6, 1.1, 'F');
  doc.text('Orange = Flagged for Review', marginLeft + 63, legendTopY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.text('Grade format:', marginLeft + 115, legendTopY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('G4 / T5 = current grade 4, target grade 5', marginLeft + 138, legendTopY + 4.2);

  // Legend Row 2: SEND Codes Key
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('SEND Key:', marginLeft + 2.5, legendTopY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  const sendKeyText =
    Array.from(activeSendCodes.entries())
      .map(([code, label]) => `${code} = ${label}`)
      .join('   |   ') || 'No specific SEND accommodations recorded for placed pupils.';
  doc.text(sendKeyText, marginLeft + 20, legendTopY + 10.5, {
    maxWidth: pageWidth - marginLeft - marginRight - 22,
  });

  // Legend Row 3 & 4: Group Colours (Shown ONLY when Group Colours is ON)
  if (showGroupColors && interventionGroups.length > 0) {
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Intervention Groups (Left Bar):', marginLeft + 2.5, legendTopY + 17);

    doc.setFont('helvetica', 'italic');
    doc.setTextColor(107, 114, 128);
    doc.text(
      'Colours show which interventions each pupil is in, so seating can pair pupils for support.',
      marginLeft + 50,
      legendTopY + 17
    );

    let groupX = marginLeft + 2.5;
    const groupY = legendTopY + 22.5;

    interventionGroups.forEach((grp, idx) => {
      if (groupX > pageWidth - marginRight - 40) return;
      const pal = INTERVENTION_PALETTE[idx % INTERVENTION_PALETTE.length];
      const [r, g, b] = hexToRgb(pal.border);

      doc.setFillColor(r, g, b);
      doc.rect(groupX, groupY - 2.5, 3, 3, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(31, 41, 55);
      doc.text(grp.name, groupX + 4.2, groupY - 0.3);
      groupX += doc.getTextWidth(grp.name) + 8;
    });
  }
}

/**
 * Generates the complete multi-page Landscape A4 PDF:
 * Page 1+: Whole-Class Curricular Priorities, Targeted Intervention Cohorts, Pupil Register
 * Final Page: The Seating Plan
 */
export async function generateInterventionPlanPdf(options: GeneratePdfOptions): Promise<void> {
  const {
    pupils,
    pupilAnalyses,
    priorities,
    interventionGroups,
    seatingPositions,
    showGroupColors,
    metrics,
    classCode = '11A/Sp1',
    departmentName = 'Department of Modern Foreign Languages',
    planTitle = 'GCSE Spanish • Year 11 Intervention Action Plan',
    layoutType = 'rows-8x4',
    customCols = 7,
    customRows = 4,
  } = options;

  // 1. Initialize Landscape A4 jsPDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginLeft = 14;
  const marginRight = 14;
  const printableWidth = pageWidth - marginLeft - marginRight; // 269 mm

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let cursorY = 14;

  // --- HEADER BLOCK (Page 1) ---
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(58, 93, 51); // #3A5D33
  doc.text(departmentName.toUpperCase(), marginLeft, cursorY);
  cursorY += 6;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 36, 33); // #1C2421
  doc.text(planTitle, marginLeft, cursorY);

  // Right-aligned class details in header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(`Class Code: ${classCode}`, pageWidth - marginRight, cursorY - 5, { align: 'right' });
  doc.text(`Date Generated: ${dateStr}`, pageWidth - marginRight, cursorY, { align: 'right' });
  cursorY += 5;

  // Metadata badges line
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Total Pupils: ${metrics.totalPupils}   |   Below Target: ${metrics.belowTargetCount}   |   SEND Support: ${metrics.sendCount}   |   Flagged for Review: ${metrics.flaggedCount}`,
    marginLeft,
    cursorY
  );
  cursorY += 4;

  // Green header divider line
  doc.setDrawColor(58, 93, 51);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, cursorY, pageWidth - marginRight, cursorY);
  cursorY += 8;

  // --- SECTION 1: CURRICULAR PRIORITIES ---
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 36, 33);
  doc.text('1. Curricular Priorities (Whole-Class Reteach)', marginLeft, cursorY);
  cursorY += 4;

  const acceptedPriorities = priorities.filter((p) => p.accepted);

  if (acceptedPriorities.length === 0) {
    // Prompt rule: "If no priorities have been accepted, show one short line saying so instead of an empty table."
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(107, 114, 128);
    doc.text('No curricular priorities have been accepted for this cycle.', marginLeft, cursorY + 2);
    cursorY += 8;
  } else {
    const priorityRows = acceptedPriorities.map((p) => [
      p.topic,
      `${p.weakPct}%`,
      p.suggestedStrategy,
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [['Topic / Grammar Focus', '% Class Weak', 'Agreed Department Strategy']],
      body: priorityRows,
      margin: { left: marginLeft, right: marginRight, top: 14, bottom: 16 },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: [28, 36, 33],
      },
      headStyles: {
        fillColor: [58, 93, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: 28, halign: 'center', textColor: [217, 119, 6], fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- SECTION 2: TARGETED INTERVENTION COHORTS ---
  // Keep heading with content (prevent heading alone at bottom of page)
  if (cursorY > pageHeight - 45) {
    doc.addPage();
    cursorY = 16;
  }

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 36, 33);
  doc.text('2. Targeted Intervention Cohorts', marginLeft, cursorY);
  cursorY += 5;

  if (interventionGroups.length === 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(107, 114, 128);
    doc.text('No targeted intervention cohorts configured.', marginLeft, cursorY + 2);
    cursorY += 8;
  } else {
    // Render each cohort card without splitting across pages
    for (const group of interventionGroups) {
      const pupilNamesList = group.pupilIds
        .map((id) => pupils.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      const pupilNamesText = pupilNamesList || 'None assigned';

      doc.setFontSize(8);
      const stratLines = doc.splitTextToSize(`Strategy: ${group.strategy}`, printableWidth - 10);
      const pupilLines = doc.splitTextToSize(`Pupils: ${pupilNamesText}`, printableWidth - 10);

      const cardHeight = 8 + stratLines.length * 3.6 + pupilLines.length * 3.6 + 4;

      // Check if cohort card fits on the page; if not, move whole card to next page
      if (cursorY + cardHeight > pageHeight - 16) {
        doc.addPage();
        cursorY = 16;
      }

      // Card Background & Border
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginLeft, cursorY, printableWidth, cardHeight, 1.5, 1.5, 'FD');

      // Left Accent Stripe
      doc.setFillColor(58, 93, 51);
      doc.rect(marginLeft, cursorY, 2.5, cardHeight, 'F');

      // Card Header: Name + Focus + Pupil Count
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 36, 33);
      doc.text(`${group.name} (${group.skillOrFocus})`, marginLeft + 5, cursorY + 5.5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`${group.pupilIds.length} pupils`, pageWidth - marginRight - 4, cursorY + 5.5, {
        align: 'right',
      });

      // Strategy
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(75, 85, 99);
      let textLineY = cursorY + 9.5;
      stratLines.forEach((l: string) => {
        doc.text(l, marginLeft + 5, textLineY);
        textLineY += 3.6;
      });

      // Pupils list
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      pupilLines.forEach((l: string, idx: number) => {
        if (idx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.text('Pupils: ', marginLeft + 5, textLineY);
          doc.setFont('helvetica', 'normal');
          doc.text(l.replace(/^Pupils:\s*/, ''), marginLeft + 16, textLineY);
        } else {
          doc.text(l, marginLeft + 5, textLineY);
        }
        textLineY += 3.6;
      });

      cursorY += cardHeight + 3.5;
    }
  }

  // --- SECTION 3: INDIVIDUAL PUPIL INTERVENTION REGISTER ---
  // Ensure heading is not alone at the bottom
  if (cursorY > pageHeight - 45) {
    doc.addPage();
    cursorY = 16;
  }

  cursorY += 4;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 36, 33);
  doc.text('3. Individual Pupil Intervention Register', marginLeft, cursorY);
  cursorY += 4;

  const pupilRows = pupils.map((p) => {
    const analysis = pupilAnalyses.get(p.id);
    const isFlagged = analysis?.isFlagged;

    // Pupil Name with FLAGGED tag if flagged
    const nameCell = isFlagged ? `${p.name} [FLAGGED]` : p.name;
    const gradeCell = `G${p.currentGrade} / G${p.targetGrade}`;
    const whyFlaggedCell =
      analysis?.flagReasons && analysis.flagReasons.length > 0
        ? analysis.flagReasons.join('; ')
        : 'On track (at or above target)';

    const sendCell = p.sendArea
      ? `${p.sendArea}: ${p.sendStrategy || 'Universal adjustments'}`
      : '-';

    // Strategies and notes
    const stratParts: string[] = [];
    if (p.chosenStrategies && p.chosenStrategies.length > 0) {
      p.chosenStrategies.forEach((sId) => {
        const s = findStrategyById(sId);
        if (s) {
          stratParts.push(`• ${s.strategy} [${s.technique}]`);
        }
      });
    }

    if (p.teacherNotes && p.teacherNotes.trim()) {
      stratParts.push(`Note: ${p.teacherNotes.trim()}`);
    }

    if (stratParts.length === 0) {
      stratParts.push('Monitor next assessment cycle.');
    }

    const stratNotesCell = stratParts.join('\n');

    return [nameCell, gradeCell, whyFlaggedCell, sendCell, stratNotesCell];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        'Pupil Name',
        'Grades (Cur/Tgt)',
        'Why Flagged?',
        'SEND / Specific Adjustments',
        'Teaching Strategy & Notes',
      ],
    ],
    body: pupilRows,
    margin: { left: marginLeft, right: marginRight, top: 14, bottom: 16 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      overflow: 'linebreak',
      textColor: [28, 36, 33],
      valign: 'top',
    },
    headStyles: {
      fillColor: [58, 93, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 54 },
      3: { cellWidth: 50 },
      4: { cellWidth: 'auto' }, // ~97mm
    },
  });

  // --- FINAL PAGE: SEATING PLAN (ALWAYS ON A NEW PAGE ON ITS OWN) ---
  doc.addPage();
  drawSeatingPlanPage(doc, {
    pupils,
    pupilAnalyses,
    interventionGroups,
    seatingPositions,
    showGroupColors,
    classCode,
    layoutType,
    customCols,
    customRows,
  });

  // --- FOOTER ON EVERY PAGE ---
  // Requirement: "Add a footer on every page: 'Confidential pupil progress document', page X of Y, and the class code."
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    const footerY = 202;
    doc.text('Confidential pupil progress document', marginLeft, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Class: ${classCode}`, pageWidth - marginRight, footerY, { align: 'right' });
  }

  // --- SAVE FILE ---
  // Filename: Intervention-Plan-[ClassCode]-[YYYY-MM-DD].pdf
  const safeClassCode = (classCode || '11A-Sp1').replace(/[\/\\]/g, '-');
  const fileDateStr = new Date().toISOString().split('T')[0];
  const filename = `Intervention-Plan-${safeClassCode}-${fileDateStr}.pdf`;

  doc.save(filename);
}

/**
 * Generates a single-page landscape A4 PDF for just the Seating Plan.
 * Adheres to the exact same layout rules (A4 landscape, 1 page, no clipping, min 8pt).
 */
export async function generateSeatingPlanPdf(
  options: GenerateSeatingOnlyPdfOptions
): Promise<void> {
  const {
    pupils,
    pupilAnalyses,
    interventionGroups,
    seatingPositions,
    showGroupColors,
    classCode = '11A/Sp1',
    layoutType = 'rows-8x4',
    customCols = 7,
    customRows = 4,
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  drawSeatingPlanPage(doc, {
    pupils,
    pupilAnalyses,
    interventionGroups,
    seatingPositions,
    showGroupColors,
    classCode,
    layoutType,
    customCols,
    customRows,
  });

  // Footer
  const footerY = 202;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Confidential pupil progress document', 14, footerY);
  doc.text('Page 1 of 1', 148.5, footerY, { align: 'center' });
  doc.text(`Class: ${classCode}`, 283, footerY, { align: 'right' });

  const safeClassCode = (classCode || '11A-Sp1').replace(/[\/\\]/g, '-');
  const fileDateStr = new Date().toISOString().split('T')[0];
  const filename = `Seating-Plan-${safeClassCode}-${fileDateStr}.pdf`;

  doc.save(filename);
}
