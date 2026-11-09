import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  Palette,
  RotateCcw,
  Printer,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Grid3X3,
  Sparkles,
  UploadCloud,
  DoorOpen,
  Presentation,
  UserCheck,
  Trash2,
  Shuffle,
  Info,
} from 'lucide-react';
import { Pupil, PupilAnalysis, InterventionGroup } from './types';
import { findStrategyById } from './strategiesByYear';
import { SEND_STRATEGIES } from './rulesAndData';
import { generateSeatingPlanPdf } from './pdfExport';
import {
  LayoutType,
  LAYOUT_OPTIONS,
  computeLayoutSlots,
  getTraySlot,
  getSendInfo,
  SEND_CODE_MAP,
  TRAY_WIDTH,
  CANVAS_DEFAULT_WIDTH,
  CANVAS_DEFAULT_HEIGHT,
  Slot,
} from './seatingLayouts';

export { TRAY_WIDTH, CANVAS_DEFAULT_WIDTH, CANVAS_DEFAULT_HEIGHT };

export interface SeatingPosition {
  x: number;
  y: number;
}

export const INTERVENTION_PALETTE = [
  { name: 'Blue', border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8' },
  { name: 'Purple', border: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9' },
  { name: 'Emerald', border: '#059669', bg: '#ECFDF5', text: '#047857' },
  { name: 'Amber', border: '#D97706', bg: '#FFFBEB', text: '#B45309' },
  { name: 'Rose', border: '#E11D48', bg: '#FFF1F2', text: '#BE123C' },
  { name: 'Cyan', border: '#0891B2', bg: '#ECFEFF', text: '#0E7490' },
  { name: 'Indigo', border: '#4F46E5', bg: '#EEF2FF', text: '#4338CA' },
];

export interface SeatingPlanProps {
  pupils: Pupil[];
  pupilAnalyses: Map<string, PupilAnalysis>;
  interventionGroups: InterventionGroup[];
  seatingPositions: Record<string, SeatingPosition>;
  setSeatingPositions: React.Dispatch<
    React.SetStateAction<Record<string, SeatingPosition>>
  >;
  selectedPupilId: string | null;
  setSelectedPupilId: (id: string | null) => void;
  showGroupColors: boolean;
  setShowGroupColors: (show: boolean) => void;
  onUpdateTeacherNotes: (pupilId: string, notes: string) => void;
  onLoadSampleData?: () => void;
  onGoToUpload?: () => void;
  layoutType?: LayoutType;
  setLayoutType?: (layout: LayoutType) => void;
  customCols?: number;
  setCustomCols?: (cols: number) => void;
  customRows?: number;
  setCustomRows?: (rows: number) => void;
}

interface DragSession {
  pupilId: string;
  pointerId: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
  origSlotId: string | null;
  cardW: number;
  cardH: number;
  targetElem: HTMLElement | null;
}

export const SeatingPlan: React.FC<SeatingPlanProps> = ({
  pupils,
  pupilAnalyses,
  interventionGroups,
  seatingPositions,
  setSeatingPositions,
  selectedPupilId,
  setSelectedPupilId,
  showGroupColors,
  setShowGroupColors,
  onUpdateTeacherNotes,
  onLoadSampleData,
  onGoToUpload,
  layoutType: propLayoutType,
  setLayoutType: propSetLayoutType,
  customCols: propCustomCols,
  setCustomCols: propSetCustomCols,
  customRows: propCustomRows,
  setCustomRows: propSetCustomRows,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Layout State (use props if provided, otherwise internal fallback)
  const [internalLayout, setInternalLayout] = useState<LayoutType>('rows-8x4');
  const [internalCustomCols, setInternalCustomCols] = useState<number>(7);
  const [internalCustomRows, setInternalCustomRows] = useState<number>(4);

  const currentLayout = propLayoutType ?? internalLayout;
  const setActualLayout = propSetLayoutType ?? setInternalLayout;
  const currentCustomCols = propCustomCols ?? internalCustomCols;
  const setActualCustomCols = propSetCustomCols ?? setInternalCustomCols;
  const currentCustomRows = propCustomRows ?? internalCustomRows;
  const setActualCustomRows = propSetCustomRows ?? setInternalCustomRows;

  // Confirmation modal state when changing layout with seated pupils
  const [pendingLayout, setPendingLayout] = useState<LayoutType | null>(null);

  // Export warning modal state if unplaced pupils exist
  const [unplacedModalCount, setUnplacedModalCount] = useState<number | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Dragging state
  const [draggedPupilId, setDraggedPupilId] = useState<string | null>(null);
  const [dragGhostPos, setDragGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [isHoveringTray, setIsHoveringTray] = useState(false);

  const dragSessionRef = useRef<DragSession | null>(null);
  const lastTapRef = useRef<{ pupilId: string; time: number } | null>(null);

  // Generate slots for current layout
  const slots: Slot[] = useMemo(() => {
    return computeLayoutSlots(currentLayout, currentCustomCols, currentCustomRows);
  }, [currentLayout, currentCustomCols, currentCustomRows]);

  // Map each slot to a pupil (if any)
  // A pupil is in a slot if their position is within 18px of slot.x and slot.y
  const slotToPupilMap = useMemo(() => {
    const map = new Map<string, Pupil>();
    pupils.forEach((p, idx) => {
      const pos = seatingPositions[p.id] || getTraySlot(idx);
      if (pos.x >= TRAY_WIDTH - 15) {
        const matchedSlot = slots.find(
          (s) => Math.abs(s.x - pos.x) < 18 && Math.abs(s.y - pos.y) < 18
        );
        if (matchedSlot) {
          map.set(matchedSlot.id, p);
        }
      }
    });
    return map;
  }, [pupils, seatingPositions, slots]);

  // Inverted map: pupilId -> slotId
  const pupilToSlotMap = useMemo(() => {
    const map = new Map<string, string>();
    slotToPupilMap.forEach((pupil, slotId) => {
      map.set(pupil.id, slotId);
    });
    return map;
  }, [slotToPupilMap]);

  // Unplaced pupils (not assigned to any slot)
  const unplacedPupils = useMemo(() => {
    return pupils.filter((p) => !pupilToSlotMap.has(p.id));
  }, [pupils, pupilToSlotMap]);

  const placedCount = pupils.length - unplacedPupils.length;
  const unplacedCount = unplacedPupils.length;

  // Custom capacity warning
  const customTotalSeats = currentCustomCols * currentCustomRows;
  const isCustomOverflow = currentLayout === 'custom' && customTotalSeats > 32;

  // Capacity vs pupils warning
  const layoutCapacityWarning =
    slots.length < pupils.length
      ? `This layout has ${slots.length} seats for ${pupils.length} pupils. Extra pupils will stay in the Unplaced tray.`
      : null;

  // Change Layout Handler with Confirmation if seated pupils exist
  const handleSelectLayout = (newLayout: LayoutType) => {
    if (newLayout === currentLayout) return;

    if (placedCount > 0) {
      setPendingLayout(newLayout);
    } else {
      setActualLayout(newLayout);
    }
  };

  const confirmLayoutChange = () => {
    if (!pendingLayout) return;
    const newSlots = computeLayoutSlots(
      pendingLayout,
      currentCustomCols,
      currentCustomRows
    );

    // Get currently seated pupils in order of their previous slots (front left to back right)
    const currentlySeatedPupils: Pupil[] = [];
    slots.forEach((s) => {
      const p = slotToPupilMap.get(s.id);
      if (p) currentlySeatedPupils.push(p);
    });

    const newPositions: Record<string, SeatingPosition> = {
      'obj-board': { x: 500, y: 16 },
      'obj-desk': { x: 880, y: 16 },
      'obj-door': { x: 236, y: 16 },
    };

    // Assign seated pupils into new slots from front left
    const unplacedList: Pupil[] = [...unplacedPupils];
    currentlySeatedPupils.forEach((p, idx) => {
      if (idx < newSlots.length) {
        newPositions[p.id] = { x: newSlots[idx].x, y: newSlots[idx].y };
      } else {
        unplacedList.push(p);
      }
    });

    // Reposition unplaced pupils neatly in the tray
    unplacedList.forEach((p, idx) => {
      newPositions[p.id] = getTraySlot(idx);
    });

    setSeatingPositions(newPositions);
    setActualLayout(pendingLayout);
    setPendingLayout(null);
  };

  // Auto Fill: Arranges all pupils in alphabetical order from front-left
  const handleAutoFill = () => {
    const sortedPupils = [...pupils].sort((a, b) => a.name.localeCompare(b.name));
    const newPositions: Record<string, SeatingPosition> = {
      'obj-board': { x: 500, y: 16 },
      'obj-desk': { x: 880, y: 16 },
      'obj-door': { x: 236, y: 16 },
    };

    let unplacedIdx = 0;
    sortedPupils.forEach((p, idx) => {
      if (idx < slots.length) {
        newPositions[p.id] = { x: slots[idx].x, y: slots[idx].y };
      } else {
        newPositions[p.id] = getTraySlot(unplacedIdx++);
      }
    });

    setSeatingPositions(newPositions);
  };

  // Clear all seats: Moves every pupil to the unplaced tray
  const handleClearAllSeats = () => {
    const newPositions: Record<string, SeatingPosition> = {
      'obj-board': { x: 500, y: 16 },
      'obj-desk': { x: 880, y: 16 },
      'obj-door': { x: 236, y: 16 },
    };
    pupils.forEach((p, idx) => {
      newPositions[p.id] = getTraySlot(idx);
    });
    setSeatingPositions(newPositions);
    setSelectedPupilId(null);
  };

  // Reset Layout: Resets layout to default Rows 8x4 and unplaces all pupils
  const handleResetLayout = () => {
    setActualLayout('rows-8x4');
    handleClearAllSeats();
  };

  // Clean up all drag states
  const cleanupDragState = useCallback(() => {
    dragSessionRef.current = null;
    setDraggedPupilId(null);
    setDragGhostPos(null);
    setHoveredSlotId(null);
    setIsHoveringTray(false);
  }, []);

  // Cancel Drag (on Escape, cancel, or lost capture)
  const cancelDrag = useCallback(
    (reason: string) => {
      const session = dragSessionRef.current;
      if (!session) return;
      const { pupilId, origSlotId, targetElem, pointerId } = session;

      try {
        if (targetElem && targetElem.hasPointerCapture(pointerId)) {
          targetElem.releasePointerCapture(pointerId);
        }
      } catch {
        // safe ignore
      }

      console.log('[Drag End]', { pupilId, result: `cancelled_${reason}` });

      if (origSlotId) {
        const origSlot = slots.find((s) => s.id === origSlotId);
        if (origSlot) {
          setSeatingPositions((prev) => ({
            ...prev,
            [pupilId]: { x: origSlot.x, y: origSlot.y },
          }));
        }
      } else {
        setSeatingPositions((prev) => ({
          ...prev,
          [pupilId]: getTraySlot(0),
        }));
      }

      cleanupDragState();
    },
    [slots, setSeatingPositions, cleanupDragState]
  );

  // Double Click or Double Tap Handler:
  // - If pupil is in tray: seat them into the first available empty slot
  // - If pupil is in a slot: unplace them back to the tray
  const handleDoubleClickOrTap = useCallback(
    (pupilId: string) => {
      const isSeated = pupilToSlotMap.has(pupilId);
      if (isSeated) {
        console.log('[Double Click/Tap] Unseating pupil to tray:', pupilId);
        setSeatingPositions((prev) => ({
          ...prev,
          [pupilId]: getTraySlot(unplacedPupils.length),
        }));
      } else {
        const firstEmptySlot = slots.find((s) => !slotToPupilMap.has(s.id));
        if (firstEmptySlot) {
          console.log('[Double Click/Tap] Seating pupil into empty slot:', {
            pupilId,
            slotId: firstEmptySlot.id,
          });
          setSeatingPositions((prev) => ({
            ...prev,
            [pupilId]: { x: firstEmptySlot.x, y: firstEmptySlot.y },
          }));
        } else {
          console.log(
            '[Double Click/Tap] No empty slots available in current layout for:',
            pupilId
          );
        }
      }
    },
    [pupilToSlotMap, slots, slotToPupilMap, setSeatingPositions, unplacedPupils.length]
  );

  // Pointer Down on a Pupil Card
  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    pupilId: string,
    width: number,
    height: number
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();

    const origSlotId = pupilToSlotMap.get(pupilId) || null;

    dragSessionRef.current = {
      pupilId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      origSlotId,
      cardW: width,
      cardH: height,
      targetElem: e.currentTarget,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    console.log('[Drag Start]', {
      pupilId,
      from: origSlotId ? `slot:${origSlotId}` : 'tray',
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // Pointer Move processing (called from window and element)
  const processPointerMove = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const session = dragSessionRef.current;
      if (!session) return;
      if (pointerId !== undefined && session.pointerId !== pointerId) return;

      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const dist = Math.hypot(dx, dy);

      if (dist > 4 && !session.hasMoved) {
        session.hasMoved = true;
        setDraggedPupilId(session.pupilId);
      }

      if (session.hasMoved) {
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          setDragGhostPos({
            x: clientX - canvasRect.left - session.cardW / 2,
            y: clientY - canvasRect.top - session.cardH / 2,
          });

          // Detect hover target via elementFromPoint (ghost has pointer-events: none)
          const hit = document.elementFromPoint(clientX, clientY);
          const slotEl = hit?.closest<HTMLElement>('[data-slot="true"]');
          const slotIdFromHit = slotEl?.getAttribute('data-slot-id') || null;
          const isTrayFromHit = !!hit?.closest<HTMLElement>(
            '[data-unplaced-tray="true"]'
          );

          let nextHoveredSlotId: string | null = slotIdFromHit;
          let nextHoveringTray: boolean = isTrayFromHit;

          // Coordinate fallback within canvas
          const canvasX = clientX - canvasRect.left;
          const canvasY = clientY - canvasRect.top;

          if (
            canvasX >= 0 &&
            canvasX < TRAY_WIDTH &&
            canvasY >= 0 &&
            canvasY <= CANVAS_DEFAULT_HEIGHT
          ) {
            nextHoveringTray = true;
            nextHoveredSlotId = null;
          } else if (!nextHoveredSlotId && canvasX >= TRAY_WIDTH) {
            const match = slots.find(
              (s) =>
                canvasX >= s.x - 10 &&
                canvasX <= s.x + s.width + 10 &&
                canvasY >= s.y - 10 &&
                canvasY <= s.y + s.height + 10
            );
            if (match) {
              nextHoveredSlotId = match.id;
              nextHoveringTray = false;
            }
          }

          if (nextHoveringTray) {
            nextHoveredSlotId = null;
          }

          setHoveredSlotId((prev) => {
            if (prev !== nextHoveredSlotId) {
              console.log('[Drag Over Slot]', {
                pupilId: session.pupilId,
                slotId: nextHoveredSlotId,
                isTray: nextHoveringTray,
              });
            }
            return nextHoveredSlotId;
          });

          setIsHoveringTray(nextHoveringTray);
        }
      }
    },
    [slots]
  );

  // Pointer Up / Drop processing (called from window and element)
  const processPointerUp = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const session = dragSessionRef.current;
      if (!session) return;
      if (pointerId !== undefined && session.pointerId !== pointerId) return;

      const { pupilId, hasMoved, origSlotId, targetElem, pointerId: sessPointerId } =
        session;

      try {
        if (targetElem && targetElem.hasPointerCapture(sessPointerId)) {
          targetElem.releasePointerCapture(sessPointerId);
        }
      } catch {
        // safe ignore
      }

      if (!hasMoved) {
        // Simple click / tap:
        // Support double-click / double-tap detection (< 350ms on same card)
        const now = Date.now();
        const lastTap = lastTapRef.current;
        if (lastTap && lastTap.pupilId === pupilId && now - lastTap.time < 350) {
          handleDoubleClickOrTap(pupilId);
          lastTapRef.current = null;
        } else {
          lastTapRef.current = { pupilId, time: now };
          setSelectedPupilId(pupilId);
          console.log('[Drag End]', { pupilId, result: 'click_selected' });
        }
        cleanupDragState();
        return;
      }

      // Drag completion / Drop:
      const canvas = canvasRef.current;
      let targetSlotId: string | null = null;
      let isTrayDrop = false;

      if (canvas) {
        const hit = document.elementFromPoint(clientX, clientY);
        const slotEl = hit?.closest<HTMLElement>('[data-slot="true"]');
        targetSlotId = slotEl?.getAttribute('data-slot-id') || null;
        isTrayDrop = !!hit?.closest<HTMLElement>('[data-unplaced-tray="true"]');

        const canvasRect = canvas.getBoundingClientRect();
        const canvasX = clientX - canvasRect.left;
        const canvasY = clientY - canvasRect.top;

        if (
          canvasX >= 0 &&
          canvasX < TRAY_WIDTH &&
          canvasY >= 0 &&
          canvasY <= CANVAS_DEFAULT_HEIGHT
        ) {
          isTrayDrop = true;
          targetSlotId = null;
        } else if (!targetSlotId && canvasX >= TRAY_WIDTH) {
          const match = slots.find(
            (s) =>
              canvasX >= s.x - 10 &&
              canvasX <= s.x + s.width + 10 &&
              canvasY >= s.y - 10 &&
              canvasY <= s.y + s.height + 10
          );
          if (match) {
            targetSlotId = match.id;
            isTrayDrop = false;
          }
        }
      }

      if (isTrayDrop) {
        targetSlotId = null;
      }

      // Action 1: Dropped onto a slot
      if (targetSlotId) {
        const targetSlot = slots.find((s) => s.id === targetSlotId);
        if (targetSlot) {
          const occupant = slotToPupilMap.get(targetSlotId);

          if (occupant && occupant.id !== pupilId) {
            // Occupied slot: SWAP!
            if (origSlotId) {
              // Dragged from another slot: swap both pupils
              const origSlot = slots.find((s) => s.id === origSlotId);
              console.log('[Drop]', {
                pupilId,
                target: `slot:${targetSlotId}`,
                action: `swap_with_${occupant.id}`,
              });
              setSeatingPositions((prev) => ({
                ...prev,
                [pupilId]: { x: targetSlot.x, y: targetSlot.y },
                [occupant.id]: origSlot
                  ? { x: origSlot.x, y: origSlot.y }
                  : getTraySlot(unplacedPupils.length),
              }));
            } else {
              // Dragged from tray: occupant returns to tray, pupil gets slot
              console.log('[Drop]', {
                pupilId,
                target: `slot:${targetSlotId}`,
                action: `displace_${occupant.id}_to_tray`,
              });
              setSeatingPositions((prev) => ({
                ...prev,
                [pupilId]: { x: targetSlot.x, y: targetSlot.y },
                [occupant.id]: getTraySlot(unplacedPupils.length),
              }));
            }
          } else {
            // Empty slot: snap pupil into slot
            console.log('[Drop]', {
              pupilId,
              target: `slot:${targetSlotId}`,
              action: 'placed_in_empty_slot',
            });
            setSeatingPositions((prev) => ({
              ...prev,
              [pupilId]: { x: targetSlot.x, y: targetSlot.y },
            }));
          }
          console.log('[Drag End]', { pupilId, result: 'placed_in_slot' });
        }
      } else if (isTrayDrop) {
        // Action 2: Dropped into tray: Unplace pupil
        console.log('[Drop]', {
          pupilId,
          target: 'tray',
          action: 'unplaced_to_tray',
        });
        setSeatingPositions((prev) => ({
          ...prev,
          [pupilId]: getTraySlot(unplacedPupils.length),
        }));
        console.log('[Drag End]', { pupilId, result: 'unplaced_to_tray' });
      } else {
        // Action 3: Dropped outside any slot: Return to origin
        console.log('[Drop]', {
          pupilId,
          target: 'outside',
          action: 'returned_to_origin',
        });
        if (origSlotId) {
          const origSlot = slots.find((s) => s.id === origSlotId);
          if (origSlot) {
            setSeatingPositions((prev) => ({
              ...prev,
              [pupilId]: { x: origSlot.x, y: origSlot.y },
            }));
          }
        } else {
          setSeatingPositions((prev) => ({
            ...prev,
            [pupilId]: getTraySlot(0),
          }));
        }
        console.log('[Drag End]', { pupilId, result: 'returned_to_origin' });
      }

      cleanupDragState();
    },
    [
      slots,
      slotToPupilMap,
      unplacedPupils.length,
      setSeatingPositions,
      handleDoubleClickOrTap,
      cleanupDragState,
      setSelectedPupilId,
    ]
  );

  // Global window listeners for pointermove, pointerup, pointercancel, and keydown
  useEffect(() => {
    const handleWinPointerMove = (e: PointerEvent) => {
      if (dragSessionRef.current) {
        processPointerMove(e.clientX, e.clientY, e.pointerId);
      }
    };

    const handleWinPointerUp = (e: PointerEvent) => {
      if (dragSessionRef.current) {
        processPointerUp(e.clientX, e.clientY, e.pointerId);
      }
    };

    const handleWinPointerCancel = (e: PointerEvent) => {
      if (
        dragSessionRef.current &&
        dragSessionRef.current.pointerId === e.pointerId
      ) {
        cancelDrag('pointercancel');
      }
    };

    const handleWinKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragSessionRef.current) {
        e.preventDefault();
        cancelDrag('escape_key');
      }
    };

    window.addEventListener('pointermove', handleWinPointerMove);
    window.addEventListener('pointerup', handleWinPointerUp);
    window.addEventListener('pointercancel', handleWinPointerCancel);
    window.addEventListener('keydown', handleWinKeyDown);

    return () => {
      window.removeEventListener('pointermove', handleWinPointerMove);
      window.removeEventListener('pointerup', handleWinPointerUp);
      window.removeEventListener('pointercancel', handleWinPointerCancel);
      window.removeEventListener('keydown', handleWinKeyDown);
    };
  }, [processPointerMove, processPointerUp, cancelDrag]);

  // Helper to get intervention group styling
  const getPupilGroupInfo = (pupilId: string) => {
    const groupIndex = interventionGroups.findIndex((g) =>
      g.pupilIds.includes(pupilId)
    );
    if (groupIndex === -1) return null;
    const group = interventionGroups[groupIndex];
    const palette =
      INTERVENTION_PALETTE[groupIndex % INTERVENTION_PALETTE.length];
    return { group, palette };
  };

  // Print / Export PDF Handler with Unplaced Warning Check
  const handlePrintSeatingPlanPdfClick = () => {
    if (unplacedCount > 0) {
      setUnplacedModalCount(unplacedCount);
      return;
    }
    executePdfExport();
  };

  const executePdfExport = async () => {
    setUnplacedModalCount(null);
    try {
      setIsExportingPdf(true);
      await new Promise((r) => setTimeout(r, 60));
      await generateSeatingPlanPdf({
        pupils,
        pupilAnalyses,
        interventionGroups,
        seatingPositions,
        showGroupColors,
        classCode: '11A/Sp1',
        layoutType: currentLayout,
        customCols: currentCustomCols,
        customRows: currentCustomRows,
      });
    } catch (e) {
      console.error('Failed to export seating plan PDF:', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const selectedPupil = pupils.find((p) => p.id === selectedPupilId);
  const selectedAnalysis = selectedPupil
    ? pupilAnalyses.get(selectedPupil.id)
    : null;
  const selectedGroupInfo = selectedPupil
    ? getPupilGroupInfo(selectedPupil.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Seating Plan Toolbar (Hidden during browser print) */}
      <div className="flex flex-col gap-3 bg-white p-3.5 rounded-lg border border-[#B8BABB] shadow-2xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Grid3X3 className="w-5 h-5 text-[#3A5D33]" />
              <h2 className="text-base font-bold font-heading text-[#1C2421]">
                Classroom Seating Plan
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose your room layout and drag pupils into fixed desk slots. Cards snap neatly without overlap.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Placed / Unplaced Count */}
            <div className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded text-gray-700 flex items-center space-x-1.5 mr-1">
              <span className="text-[#3A5D33]">
                Placed: <strong>{placedCount}</strong>
              </span>
              <span className="text-gray-300">&bull;</span>
              <span
                className={
                  unplacedCount > 0 ? 'text-[#D97706]' : 'text-gray-500'
                }
              >
                Unplaced: <strong>{unplacedCount}</strong>
              </span>
            </div>

            {/* Layout Dropdown */}
            <div className="flex items-center space-x-1.5 bg-gray-50 px-2 py-1 rounded border border-[#B8BABB]">
              <label
                htmlFor="layout-select"
                className="text-xs font-bold text-gray-700 whitespace-nowrap"
              >
                Layout:
              </label>
              <select
                id="layout-select"
                value={currentLayout}
                onChange={(e) =>
                  handleSelectLayout(e.target.value as LayoutType)
                }
                className="text-xs font-semibold bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
              >
                {LAYOUT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Grid Inputs if Custom Layout selected */}
            {currentLayout === 'custom' && (
              <div className="flex items-center space-x-1.5 bg-gray-50 px-2 py-1 rounded border border-[#B8BABB] text-xs">
                <span className="font-semibold text-gray-700">Cols:</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={currentCustomCols}
                  onChange={(e) =>
                    setActualCustomCols(
                      Math.max(1, Math.min(8, parseInt(e.target.value) || 1))
                    )
                  }
                  className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold"
                />
                <span className="font-semibold text-gray-700">Rows:</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={currentCustomRows}
                  onChange={(e) =>
                    setActualCustomRows(
                      Math.max(1, Math.min(8, parseInt(e.target.value) || 1))
                    )
                  }
                  className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold"
                />
                <span className="text-[11px] font-bold text-gray-500">
                  ({customTotalSeats} seats)
                </span>
              </div>
            )}

            {/* Auto Fill Button */}
            <button
              onClick={handleAutoFill}
              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] bg-white text-gray-700 hover:border-[#3A5D33] hover:text-[#3A5D33] flex items-center transition-colors"
              title="Auto fill all seats in alphabetical order (A to Z) from front left"
            >
              <Shuffle className="w-3.5 h-3.5 mr-1 text-[#3A5D33]" />
              Auto fill
            </button>

            {/* Clear All Seats Button */}
            <button
              onClick={handleClearAllSeats}
              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] bg-white text-gray-700 hover:border-red-400 hover:text-red-700 flex items-center transition-colors"
              title="Return all placed pupils to the unplaced tray"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1 text-gray-500" />
              Clear all seats
            </button>

            {/* Reset Layout Button */}
            <button
              onClick={handleResetLayout}
              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] bg-white text-gray-700 hover:border-[#3A5D33] hover:text-[#3A5D33] flex items-center transition-colors"
              title="Reset layout to default Rows 8x4 and clear seats"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Layout
            </button>

            {/* Group Colours Toggle */}
            <button
              onClick={() => setShowGroupColors(!showGroupColors)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border flex items-center transition-colors ${
                showGroupColors
                  ? 'bg-[#3A5D33] text-white border-[#3A5D33]'
                  : 'bg-white text-gray-700 border-[#B8BABB] hover:border-[#3A5D33]'
              }`}
              title="Toggle colored borders representing intervention groups"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Group Colours: {showGroupColors ? 'ON' : 'OFF'}
            </button>

            {/* Print Seating Plan Button */}
            <button
              onClick={handlePrintSeatingPlanPdfClick}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] flex items-center transition-colors shadow-xs disabled:opacity-60"
              title="Export clean landscape A4 PDF of classroom seating plan"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isExportingPdf ? 'Exporting PDF...' : 'Print Seating Plan'}
            </button>
          </div>
        </div>

        {/* Warning Banners */}
        {isCustomOverflow && (
          <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              Maximum total is 32 seats. Current selection has {customTotalSeats}{' '}
              seats. Please adjust columns or rows.
            </span>
          </div>
        )}

        {layoutCapacityWarning && !isCustomOverflow && (
          <div className="flex items-center space-x-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-semibold">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
            <span>{layoutCapacityWarning}</span>
          </div>
        )}
      </div>

      {/* Classroom Canvas Container (Scrollable and Scalable) */}
      <div className="overflow-x-auto overflow-y-auto pb-2 border border-gray-200 rounded-lg bg-gray-100 p-2">
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => e.preventDefault()}
          className="relative bg-white rounded-lg border-2 border-gray-300 shadow-xs seating-print-canvas overflow-hidden select-none mx-auto"
          style={{
            width: CANVAS_DEFAULT_WIDTH,
            height: CANVAS_DEFAULT_HEIGHT,
            minWidth: CANVAS_DEFAULT_WIDTH,
            minHeight: CANVAS_DEFAULT_HEIGHT,
          }}
        >
          {/* Subtle Classroom Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#9CA3AF 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* 1. Unplaced Pupils Tray on Left of Canvas (Hidden during print) */}
          <div
            data-unplaced-tray="true"
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
            className={`absolute left-0 top-0 bottom-0 bg-gray-50/95 border-r-2 border-dashed transition-colors z-10 p-2.5 flex flex-col no-print ${
              isHoveringTray
                ? 'border-[#3A5D33] bg-[#E9EFE9]/60'
                : 'border-gray-300'
            }`}
            style={{ width: TRAY_WIDTH }}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 mb-2 shrink-0">
              <span className="font-heading font-bold text-xs text-gray-700 flex items-center">
                <UserCheck className="w-3.5 h-3.5 mr-1 text-[#3A5D33]" />
                Unplaced pupils
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  unplacedCount > 0
                    ? 'badge-amber'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {unplacedCount}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 italic mb-2 shrink-0">
              Drag card onto a desk slot, or double-click to auto-seat.
            </div>

            {/* Unplaced cards rendered inside the tray in a scrollable 2-column grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-1.5">
                {unplacedPupils.map((pupil) => {
                  const isSelected = selectedPupilId === pupil.id;
                  const isDragged = draggedPupilId === pupil.id;
                  const analysis = pupilAnalyses.get(pupil.id);
                  const isFlagged = analysis?.isFlagged;
                  const groupInfo = getPupilGroupInfo(pupil.id);
                  const sendInfo = getSendInfo(pupil.sendArea);

                  return (
                    <div
                      key={pupil.id}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onPointerDown={(e) =>
                        handleCardPointerDown(e, pupil.id, 98, 50)
                      }
                      onDoubleClick={() => handleDoubleClickOrTap(pupil.id)}
                      style={{
                        touchAction: 'none',
                        borderLeftColor:
                          showGroupColors && groupInfo
                            ? groupInfo.palette.border
                            : undefined,
                        borderLeftWidth:
                          showGroupColors && groupInfo ? 4 : undefined,
                      }}
                      className={`select-none cursor-grab active:cursor-grabbing bg-white rounded border border-[#B8BABB] shadow-2xs hover:border-[#3A5D33] px-1.5 py-1 flex flex-col justify-between min-h-[50px] transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-[#3A5D33] border-[#3A5D33]'
                          : ''
                      } ${
                        isDragged
                          ? 'opacity-30 border-dashed border-gray-400 bg-gray-100'
                          : ''
                      }`}
                    >
                      {/* Top row: Priority dot + wrapped pupil name */}
                      <div className="flex items-start space-x-1 overflow-hidden leading-none">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                            isFlagged ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                          }`}
                          title={isFlagged ? 'Flagged for review' : 'On track'}
                        />
                        <span className="text-[10px] font-bold font-heading text-[#1C2421] leading-tight break-words">
                          {pupil.name}
                        </span>
                      </div>

                      {/* Bottom row: Grade + SEND badge */}
                      <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-gray-100 mt-1">
                        <span className="font-semibold text-gray-600 bg-gray-100 px-1 py-0.5 rounded text-[8.5px]">
                          G{pupil.currentGrade}/T{pupil.targetGrade}
                        </span>
                        {sendInfo ? (
                          <span
                            className="font-bold px-1 py-0.5 rounded bg-[#E9EFE9] text-[#3A5D33] text-[8px] whitespace-nowrap"
                            title={`SEND: ${sendInfo.label}`}
                          >
                            {sendInfo.code}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Empty State Banner if no pupils loaded */}
          {pupils.length === 0 && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#E9EFE9] flex items-center justify-center text-[#3A5D33] mb-1">
                <Grid3X3 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1C2421]">
                No Pupils Loaded in Seating Plan
              </h3>
              <p className="text-xs text-gray-500 max-w-sm">
                Upload files or load sample data to begin.
              </p>
              <div className="flex items-center gap-2 pt-2">
                {onLoadSampleData && (
                  <button
                    onClick={onLoadSampleData}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Load Sample Data
                  </button>
                )}
                {onGoToUpload && (
                  <button
                    onClick={onGoToUpload}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    Go to Upload
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Fixed Room Labels at the Front of the Classroom */}
          {/* 1. Door */}
          <div
            style={{
              transform: 'translate3d(236px, 14px, 0)',
              width: 86,
              height: 38,
            }}
            className="absolute left-0 top-0 select-none z-10 bg-amber-50 text-amber-900 rounded border-2 border-dashed border-[#D97706] shadow-2xs flex items-center justify-center space-x-1.5 px-2 pointer-events-none"
          >
            <DoorOpen className="w-4 h-4 text-[#D97706]" />
            <span className="font-heading font-bold text-xs">Door</span>
          </div>

          {/* 2. Interactive Whiteboard */}
          <div
            style={{
              transform: 'translate3d(480px, 14px, 0)',
              width: 260,
              height: 38,
            }}
            className="absolute left-0 top-0 select-none z-10 bg-slate-800 text-white rounded border-2 border-slate-900 shadow-sm flex items-center justify-center space-x-2 px-3 pointer-events-none"
          >
            <Presentation className="w-4 h-4 text-emerald-400" />
            <span className="font-heading font-bold text-xs tracking-wide">
              Interactive whiteboard
            </span>
          </div>

          {/* 3. Teacher Desk */}
          <div
            style={{
              transform: 'translate3d(880px, 14px, 0)',
              width: 140,
              height: 38,
            }}
            className="absolute left-0 top-0 select-none z-10 bg-slate-100 text-slate-800 rounded border-2 border-dashed border-slate-400 shadow-2xs flex items-center justify-center space-x-1.5 px-2 pointer-events-none"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-1" />
            <span className="font-heading font-semibold text-xs">
              Teacher desk
            </span>
          </div>

          {/* FIXED DESK SLOTS */}
          {slots.map((slot) => {
            const seatedPupil = slotToPupilMap.get(slot.id);
            const isHovered = hoveredSlotId === slot.id;
            const isDragged =
              seatedPupil && draggedPupilId === seatedPupil.id;

            return (
              <div
                key={slot.id}
                data-slot="true"
                data-slot-id={slot.id}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                style={{
                  position: 'absolute',
                  left: slot.x,
                  top: slot.y,
                  width: slot.width,
                  height: slot.height,
                }}
                className={`transition-all duration-75 select-none rounded ${
                  isHovered
                    ? 'ring-2 ring-[#3A5D33] border-[#3A5D33] bg-[#E9EFE9]/70 scale-[1.02]'
                    : ''
                }`}
              >
                {/* Empty Slot Placeholder */}
                {(!seatedPupil || isDragged) && (
                  <div className="w-full h-full border-2 border-dashed border-gray-300 rounded bg-gray-50/60 flex flex-col items-center justify-center p-1 text-center pointer-events-none">
                    <span className="text-[9px] font-bold text-gray-400 leading-tight">
                      {slot.label}
                    </span>
                    <span className="text-[8px] text-gray-300">Empty desk</span>
                  </div>
                )}

                {/* Seated Pupil Card (Snaps tightly to slot) */}
                {seatedPupil && (() => {
                  const isSelected = selectedPupilId === seatedPupil.id;
                  const analysis = pupilAnalyses.get(seatedPupil.id);
                  const isFlagged = analysis?.isFlagged;
                  const groupInfo = getPupilGroupInfo(seatedPupil.id);
                  const sendInfo = getSendInfo(seatedPupil.sendArea);

                  return (
                    <div
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onPointerDown={(e) =>
                        handleCardPointerDown(
                          e,
                          seatedPupil.id,
                          slot.width,
                          slot.height
                        )
                      }
                      onDoubleClick={() => handleDoubleClickOrTap(seatedPupil.id)}
                      style={{
                        position: isDragged ? 'absolute' : 'relative',
                        inset: isDragged ? 0 : undefined,
                        width: '100%',
                        height: '100%',
                        touchAction: 'none',
                        borderLeftColor:
                          showGroupColors && groupInfo
                            ? groupInfo.palette.border
                            : undefined,
                        borderLeftWidth:
                          showGroupColors && groupInfo ? 4 : undefined,
                      }}
                      className={`cursor-grab active:cursor-grabbing bg-white rounded border border-[#B8BABB] shadow-2xs hover:border-[#3A5D33] hover:shadow-xs px-2 py-1 flex flex-col justify-between transition-shadow z-10 ${
                        isSelected
                          ? 'ring-2 ring-[#3A5D33] border-[#3A5D33]'
                          : ''
                      } ${
                        isDragged ? 'opacity-25 pointer-events-none' : ''
                      }`}
                    >
                      {/* Name & Priority Dot (Wraps onto 2 lines if long without ellipsis) */}
                      <div className="flex items-start space-x-1.5 overflow-hidden leading-tight">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                            isFlagged ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                          }`}
                          title={isFlagged ? 'Flagged for review' : 'On track'}
                        />
                        <span className="text-[10px] font-bold font-heading text-[#1C2421] leading-tight break-words">
                          {seatedPupil.name}
                        </span>
                      </div>

                      {/* Grades & SEND Badge */}
                      <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-gray-100">
                        <span className="font-semibold text-gray-600 bg-gray-100 px-1 py-0.5 rounded text-[8.5px]">
                          G{seatedPupil.currentGrade} / T{seatedPupil.targetGrade}
                        </span>

                        {sendInfo ? (
                          <span
                            className="font-bold px-1.5 py-0.5 rounded bg-[#E9EFE9] text-[#3A5D33] text-[8px] whitespace-nowrap"
                            title={`SEND: ${sendInfo.label}`}
                          >
                            {sendInfo.code}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* Actively Dragged Floating Card (Follows Cursor smoothly with pointer-events: none) */}
          {draggedPupilId && dragGhostPos && (() => {
            const pupil = pupils.find((p) => p.id === draggedPupilId);
            if (!pupil) return null;
            const analysis = pupilAnalyses.get(pupil.id);
            const isFlagged = analysis?.isFlagged;
            const groupInfo = getPupilGroupInfo(pupil.id);
            const sendInfo = getSendInfo(pupil.sendArea);
            const cardW = dragSessionRef.current?.cardW || 96;
            const cardH = dragSessionRef.current?.cardH || 50;

            return (
              <div
                style={{
                  position: 'absolute',
                  left: dragGhostPos.x,
                  top: dragGhostPos.y,
                  width: cardW,
                  height: cardH,
                  pointerEvents: 'none',
                  borderLeftColor:
                    showGroupColors && groupInfo
                      ? groupInfo.palette.border
                      : undefined,
                  borderLeftWidth: showGroupColors && groupInfo ? 4 : undefined,
                  zIndex: 100,
                }}
                className="bg-white rounded border-2 border-[#3A5D33] shadow-2xl px-2 py-1 flex flex-col justify-between opacity-95 scale-105 select-none"
              >
                <div className="flex items-start space-x-1.5 overflow-hidden leading-tight">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                      isFlagged ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                    }`}
                  />
                  <span className="text-[10px] font-bold font-heading text-[#1C2421] leading-tight break-words">
                    {pupil.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-600 bg-gray-100 px-1 py-0.5 rounded text-[8.5px]">
                    G{pupil.currentGrade} / T{pupil.targetGrade}
                  </span>
                  {sendInfo ? (
                    <span className="font-bold px-1.5 py-0.5 rounded bg-[#E9EFE9] text-[#3A5D33] text-[8px]">
                      {sendInfo.code}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })()}

          {/* Side Drawer: Shown on pupil card click (Hidden during print) */}
          {selectedPupil && (
            <div className="absolute right-4 top-4 bottom-4 w-80 bg-white rounded-lg border border-[#B8BABB] shadow-xl z-40 p-4 flex flex-col justify-between overflow-y-auto no-print">
              <div className="space-y-3">
                {/* Side Drawer Header */}
                <div className="flex items-start justify-between pb-2 border-b border-gray-200">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          selectedAnalysis?.isFlagged
                            ? 'bg-[#D97706]'
                            : 'bg-[#3A5D33]'
                        }`}
                      />
                      <h3 className="font-heading font-bold text-sm text-[#1C2421]">
                        {selectedPupil.name}
                      </h3>
                    </div>
                    <span className="text-xs text-gray-500">
                      Class 11A/Sp1 &bull; ID: {selectedPupil.id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedPupilId(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Grade & Status Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-gray-50 rounded border border-gray-100">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">
                      Grade Profile
                    </span>
                    <span className="font-bold text-gray-800 text-sm">
                      G{selectedPupil.currentGrade} / T{selectedPupil.targetGrade}
                    </span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded border border-gray-100">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">
                      Academic Trajectory
                    </span>
                    <span
                      className={`font-bold text-xs ${
                        selectedAnalysis?.isFlagged
                          ? 'text-[#D97706]'
                          : 'text-[#3A5D33]'
                      }`}
                    >
                      {selectedAnalysis?.isFlagged
                        ? 'Flagged for Review'
                        : 'On Track'}
                    </span>
                  </div>
                </div>

                {/* Seating Placement Status */}
                <div className="p-2 bg-gray-50 rounded border border-gray-100 text-xs flex items-center justify-between">
                  <span className="text-gray-500 text-[10px] uppercase font-bold">
                    Seating Status:
                  </span>
                  {pupilToSlotMap.has(selectedPupil.id) ? (
                    <span className="badge-green font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Seated in {pupilToSlotMap.get(selectedPupil.id)}
                    </span>
                  ) : (
                    <span className="badge-amber font-bold px-2 py-0.5 rounded-full text-[10px]">
                      Unplaced in tray
                    </span>
                  )}
                </div>

                {/* Intervention Group Membership */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Intervention Group
                  </span>
                  {selectedGroupInfo ? (
                    <div
                      className="p-2 rounded border text-xs flex items-center space-x-2"
                      style={{
                        borderColor: selectedGroupInfo.palette.border,
                        backgroundColor: selectedGroupInfo.palette.bg,
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: selectedGroupInfo.palette.border,
                        }}
                      />
                      <span
                        className="font-bold"
                        style={{ color: selectedGroupInfo.palette.text }}
                      >
                        {selectedGroupInfo.group.name}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Not assigned to any specific clinic cohort.
                    </p>
                  )}
                </div>

                {/* SEND Accommodation Strategy */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    SEND Accommodation Strategy
                  </span>
                  {selectedPupil.sendArea ? (() => {
                    const libStrats =
                      SEND_STRATEGIES[
                        selectedPupil.sendArea as keyof typeof SEND_STRATEGIES
                      ];
                    return (
                      <div className="p-2 bg-[#E9EFE9]/50 rounded border border-[#3A5D33]/20 text-xs space-y-1">
                        <span className="font-bold text-[#3A5D33] block">
                          {selectedPupil.sendArea}:
                        </span>
                        {selectedPupil.sendStrategy && (
                          <p className="text-[11px] text-gray-800 font-medium leading-relaxed">
                            {selectedPupil.sendStrategy}
                          </p>
                        )}
                        {libStrats && libStrats.length > 0 && (
                          <div
                            className={
                              selectedPupil.sendStrategy
                                ? 'pt-1 border-t border-[#3A5D33]/15'
                                : ''
                            }
                          >
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                              Library guidance:
                            </span>
                            <p className="text-[10px] text-gray-600 italic">
                              {libStrats.join(' ')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <p className="text-xs text-gray-500 italic">
                      No specific SEND profile recorded.
                    </p>
                  )}
                </div>

                {/* Chosen Teaching Strategies */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Chosen Teaching Strategies
                  </span>
                  {selectedPupil.chosenStrategies &&
                  selectedPupil.chosenStrategies.length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {selectedPupil.chosenStrategies.map((stratId) => {
                        const strat = findStrategyById(stratId);
                        if (!strat) return null;
                        return (
                          <div
                            key={stratId}
                            className="p-2 bg-[#E9EFE9] rounded border border-[#3A5D33]/25 text-[11px]"
                          >
                            <p className="font-semibold text-gray-900 leading-tight">
                              {strat.strategy}
                            </p>
                            <span className="badge-green text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase inline-block mt-1">
                              {strat.technique}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic mb-2">
                      No strategies chosen yet.
                    </p>
                  )}

                  {/* Teacher Notes (Editable) */}
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Teacher Notes &amp; Observations
                  </label>
                  <textarea
                    value={selectedPupil.teacherNotes || ''}
                    onChange={(e) =>
                      onUpdateTeacherNotes(selectedPupil.id, e.target.value)
                    }
                    placeholder="Add strategy notes, seating cues, or observations..."
                    rows={3}
                    className="w-full text-xs p-2 border border-[#B8BABB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedPupilId(null)}
                  className="px-3 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Close Details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. COMPREHENSIVE LEGEND PANEL (Visible on screen and in PDF) */}
      <div className="bg-white p-4 rounded-lg border border-[#B8BABB] shadow-2xs space-y-3">
        <div className="flex items-center space-x-1.5 pb-2 border-b border-gray-200">
          <Info className="w-4 h-4 text-[#3A5D33]" />
          <h3 className="text-xs font-bold font-heading text-[#1C2421] uppercase tracking-wider">
            Seating Plan Legend &amp; Key
          </h3>
        </div>

        {/* Legend Row 1: Priority Dots & Grade Format */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          {/* Dot Colours */}
          <div className="flex items-center space-x-4">
            <span className="font-bold text-gray-700">Status Dots:</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3A5D33]" />
              <span className="text-gray-800">Green = On Track</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
              <span className="text-gray-800">Orange = Flagged for Review</span>
            </div>
          </div>

          {/* Grade Format */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-gray-200">
            <span className="font-bold text-gray-700">Grade format:</span>
            <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 font-mono text-[11px]">
              G4 / T5 = current grade 4, target grade 5
            </span>
          </div>
        </div>

        {/* Legend Row 2: SEND Codes Key */}
        <div className="text-xs space-y-1 pt-1 border-t border-gray-100">
          <span className="font-bold text-gray-700 block">
            SEND Accommodation Codes:
          </span>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {Object.entries(SEND_CODE_MAP)
              .filter(
                ([k, v], idx, arr) =>
                  arr.findIndex((x) => x[1].code === v.code) === idx
              )
              .map(([_, v]) => (
                <div
                  key={v.code}
                  className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-200"
                >
                  <span className="font-bold text-[#3A5D33]">{v.code}</span>
                  <span className="text-gray-400">=</span>
                  <span className="text-gray-700">{v.label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Legend Row 3: Group Colours (Shown ONLY when Group Colours is ON) */}
        {showGroupColors && (
          <div className="text-xs space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700">
                Intervention Group Colours (Left Bar):
              </span>
              <span className="text-[11px] text-gray-500 italic">
                Colours show which interventions each pupil is in, so seating can
                pair pupils for support.
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {interventionGroups.map((grp, idx) => {
                const palette =
                  INTERVENTION_PALETTE[idx % INTERVENTION_PALETTE.length];
                return (
                  <div
                    key={grp.id}
                    className="flex items-center space-x-2 px-2.5 py-1 rounded border shadow-2xs"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: palette.bg,
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: palette.border }}
                    />
                    <span
                      className="font-bold text-xs"
                      style={{ color: palette.text }}
                    >
                      {grp.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal when Changing Layout with currently seated pupils */}
      {pendingLayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center space-x-2.5 text-[#1C2421]">
              <AlertTriangle className="w-5 h-5 text-[#D97706]" />
              <h3 className="font-heading font-bold text-base">
                Confirm Layout Change
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Changing layout will arrange currently seated pupils from the front
              left into the new slots. Any pupils exceeding the new layout's
              capacity will return to the unplaced tray.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setPendingLayout(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLayoutChange}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943]"
              >
                Confirm &amp; Change Layout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unplaced Pupils Warning Modal on Export */}
      {unplacedModalCount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center space-x-2.5 text-[#1C2421]">
              <AlertTriangle className="w-5 h-5 text-[#D97706]" />
              <h3 className="font-heading font-bold text-base">
                Unplaced Pupils Notice
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {unplacedModalCount} pupils are not placed yet. They will be listed
              as unplaced.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setUnplacedModalCount(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executePdfExport}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943]"
              >
                Continue Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
