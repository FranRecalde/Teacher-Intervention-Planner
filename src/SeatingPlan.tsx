import React, { useRef } from 'react';
import {
  Palette,
  RotateCcw,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Grid3X3,
  Sparkles,
  UploadCloud,
  DoorOpen,
  Presentation,
  UserCheck,
} from 'lucide-react';
import { Pupil, PupilAnalysis, InterventionGroup } from './types';
import { findStrategyById } from './strategiesByYear';
import { SEND_STRATEGIES } from './rulesAndData';

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

export const TRAY_WIDTH = 224;
export const CANVAS_DEFAULT_WIDTH = 1080;
export const CANVAS_DEFAULT_HEIGHT = 650;

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
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Active dragging reference
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    width: number;
    height: number;
    hasMoved: boolean;
  } | null>(null);

  // Helper to compute tidy grid slots inside the Unplaced Tray
  const getTraySlot = (index: number): SeatingPosition => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return {
      x: 10 + col * 104,
      y: 46 + row * 42,
    };
  };

  // Helper to get position of any item (pupil card or room object)
  const getPosition = (id: string, index?: number): SeatingPosition => {
    if (seatingPositions[id]) return seatingPositions[id];
    if (id === 'obj-board') return { x: 500, y: 16 };
    if (id === 'obj-desk') return { x: 880, y: 55 };
    if (id === 'obj-door') return { x: 236, y: 16 };
    // Default pupil position is in the tidy tray grid
    const idx =
      index !== undefined ? index : pupils.findIndex((p) => p.id === id);
    return getTraySlot(idx >= 0 ? idx : 0);
  };

  // Count unplaced pupils (cards located within tray boundaries x < TRAY_WIDTH)
  const unplacedCount = pupils.filter((p, idx) => {
    const pos = getPosition(p.id, idx);
    return pos.x < TRAY_WIDTH - 15;
  }).length;

  const placedCount = pupils.length - unplacedCount;

  // Reset layout
  const handleResetLayout = () => {
    const newPositions: Record<string, SeatingPosition> = {
      'obj-board': { x: 500, y: 16 },
      'obj-desk': { x: 880, y: 55 },
      'obj-door': { x: 236, y: 16 },
    };
    pupils.forEach((p, idx) => {
      newPositions[p.id] = getTraySlot(idx);
    });
    setSeatingPositions(newPositions);
    setSelectedPupilId(null);
  };

  // Pointer drag handlers: calls setPointerCapture on pointer down
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    id: string,
    width: number,
    height: number
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    const currentPos = getPosition(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y,
      width,
      height,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.hasMoved = true;
    }

    const canvas = canvasRef.current;
    const canvasW = canvas?.clientWidth || CANVAS_DEFAULT_WIDTH;
    const canvasH = canvas?.clientHeight || CANVAS_DEFAULT_HEIGHT;

    // Strict boundary enforcement: items stay completely inside the canvas
    const maxX = Math.max(0, canvasW - drag.width);
    const maxY = Math.max(0, canvasH - drag.height);

    const newX = Math.min(maxX, Math.max(0, drag.origX + dx));
    const newY = Math.min(maxY, Math.max(0, drag.origY + dy));

    setSeatingPositions((prev) => ({
      ...prev,
      [drag.id]: { x: Math.round(newX), y: Math.round(newY) },
    }));
  };

  const handlePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    id: string,
    isPupil: boolean
  ) => {
    const drag = dragRef.current;
    if (!drag) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe ignore
    }

    // Dragging a pupil card back into the tray unplaces it into a tidy slot
    if (isPupil) {
      const currentPos = seatingPositions[id] || {
        x: drag.origX,
        y: drag.origY,
      };
      if (currentPos.x < TRAY_WIDTH - 15) {
        const pupilIdx = pupils.findIndex((p) => p.id === id);
        const traySlot = getTraySlot(pupilIdx >= 0 ? pupilIdx : 0);
        setSeatingPositions((prev) => ({
          ...prev,
          [id]: traySlot,
        }));
      }
    }

    // Click without drag selects pupil and opens side panel
    if (!drag.hasMoved && isPupil) {
      setSelectedPupilId(id);
    }

    dragRef.current = null;
  };

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

  const selectedPupil = pupils.find((p) => p.id === selectedPupilId);
  const selectedAnalysis = selectedPupil
    ? pupilAnalyses.get(selectedPupil.id)
    : null;
  const selectedGroupInfo = selectedPupil
    ? getPupilGroupInfo(selectedPupil.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Seating Plan Toolbar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#B8BABB] no-print">
        <div>
          <h2 className="text-base font-bold font-heading text-[#1C2421]">
            Classroom Seating Plan
          </h2>
          <p className="text-xs text-gray-500">
            Free drag &amp; drop canvas for classroom arrangement. Drag cards from the Unplaced tray into desks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-medium text-gray-500 mr-2 flex items-center space-x-2">
            <span>Placed: <strong>{placedCount}</strong></span>
            <span>&bull;</span>
            <span>Unplaced: <strong>{unplacedCount}</strong></span>
          </div>

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

          <button
            onClick={handleResetLayout}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-[#B8BABB] bg-white text-gray-700 hover:border-[#3A5D33] hover:text-[#3A5D33] flex items-center transition-colors"
            title="Reset pupil cards to left tray and restore teacher desk, door, and board"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Layout
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] flex items-center transition-colors shadow-xs"
            title="Print classroom seating plan in landscape"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Seating Plan
          </button>
        </div>
      </div>

      {/* Classroom Canvas Container */}
      <div className="overflow-x-auto pb-2">
        <div
          ref={canvasRef}
          className="relative bg-white rounded-lg border-2 border-gray-300 shadow-xs seating-print-canvas overflow-hidden select-none"
          style={{
            width: CANVAS_DEFAULT_WIDTH,
            height: CANVAS_DEFAULT_HEIGHT,
            minWidth: CANVAS_DEFAULT_WIDTH,
          }}
        >
          {/* Subtle Classroom Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#9CA3AF 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Classroom Orientation Guides */}
          <div className="absolute top-2.5 right-6 text-[10px] font-bold tracking-wider text-gray-400 uppercase pointer-events-none select-none">
            FRONT OF CLASSROOM
          </div>

          {/* 1. Unplaced Pupils Tray on Left of Canvas (Hidden during print) */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gray-50/90 border-r-2 border-dashed border-gray-300 z-0 p-2.5 flex flex-col no-print"
            style={{ width: TRAY_WIDTH }}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 mb-2">
              <span className="font-heading font-bold text-xs text-gray-700 flex items-center">
                <UserCheck className="w-3.5 h-3.5 mr-1 text-[#3A5D33]" />
                Unplaced pupils
              </span>
              <span className="badge-amber text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {unplacedCount}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 italic mb-2">
              Drag onto canvas to seat. Drag back here to unplace.
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

          {/* Draggable Object 1: Interactive Whiteboard */}
          {(() => {
            const boardPos = getPosition('obj-board');
            return (
              <div
                style={{
                  touchAction: 'none',
                  transform: `translate3d(${boardPos.x}px, ${boardPos.y}px, 0)`,
                  width: 250,
                  height: 38,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'obj-board', 250, 38)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, 'obj-board', false)}
                className="absolute left-0 top-0 select-none cursor-grab active:cursor-grabbing z-10 bg-slate-800 text-white rounded border-2 border-slate-900 shadow-sm flex items-center justify-center space-x-2 px-3 hover:ring-2 hover:ring-slate-400"
              >
                <Presentation className="w-4 h-4 text-emerald-400" />
                <span className="font-heading font-bold text-xs tracking-wide">
                  Interactive whiteboard
                </span>
              </div>
            );
          })()}

          {/* Draggable Object 2: Teacher desk */}
          {(() => {
            const deskPos = getPosition('obj-desk');
            return (
              <div
                style={{
                  touchAction: 'none',
                  transform: `translate3d(${deskPos.x}px, ${deskPos.y}px, 0)`,
                  width: 140,
                  height: 48,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'obj-desk', 140, 48)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, 'obj-desk', false)}
                className="absolute left-0 top-0 select-none cursor-grab active:cursor-grabbing z-10 bg-[#E9EFE9] text-[#3A5D33] rounded border-2 border-[#3A5D33] shadow-sm flex flex-col items-center justify-center px-2 hover:ring-2 hover:ring-[#3A5D33]/40"
              >
                <span className="font-heading font-bold text-xs leading-none">
                  Teacher desk
                </span>
                <span className="text-[9px] text-gray-500 mt-0.5">Podium / Desk</span>
              </div>
            );
          })()}

          {/* Draggable Object 3: Door */}
          {(() => {
            const doorPos = getPosition('obj-door');
            return (
              <div
                style={{
                  touchAction: 'none',
                  transform: `translate3d(${doorPos.x}px, ${doorPos.y}px, 0)`,
                  width: 86,
                  height: 38,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'obj-door', 86, 38)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, 'obj-door', false)}
                className="absolute left-0 top-0 select-none cursor-grab active:cursor-grabbing z-10 bg-amber-50 text-amber-900 rounded border-2 border-dashed border-[#D97706] shadow-sm flex items-center justify-center space-x-1.5 px-2 hover:ring-2 hover:ring-[#D97706]/40"
              >
                <DoorOpen className="w-4 h-4 text-[#D97706]" />
                <span className="font-heading font-bold text-xs">Door</span>
              </div>
            );
          })()}

          {/* Draggable Pupil Cards: One per pupil */}
          {pupils.map((pupil, idx) => {
            const pos = getPosition(pupil.id, idx);
            const analysis = pupilAnalyses.get(pupil.id);
            const isFlagged = analysis?.isFlagged;
            const groupInfo = getPupilGroupInfo(pupil.id);
            const isSelected = selectedPupilId === pupil.id;

            return (
              <div
                key={pupil.id}
                style={{
                  touchAction: 'none',
                  transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                  width: 100,
                  height: 42,
                  borderLeftColor:
                    showGroupColors && groupInfo
                      ? groupInfo.palette.border
                      : undefined,
                  borderLeftWidth:
                    showGroupColors && groupInfo ? 4 : undefined,
                }}
                onPointerDown={(e) => handlePointerDown(e, pupil.id, 100, 42)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, pupil.id, true)}
                className={`absolute left-0 top-0 select-none cursor-grab active:cursor-grabbing z-10 bg-white rounded border border-[#B8BABB] shadow-2xs hover:border-[#3A5D33] hover:shadow-xs px-2 py-1 flex flex-col justify-between transition-shadow ${
                  isSelected ? 'ring-2 ring-[#3A5D33] border-[#3A5D33]' : ''
                }`}
              >
                {/* Name & Priority Dot */}
                <div className="flex items-center space-x-1 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isFlagged ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                    }`}
                    title={isFlagged ? 'Flagged for intervention' : 'On track'}
                  />
                  <span className="text-[11px] font-bold font-heading text-[#1C2421] truncate leading-none">
                    {pupil.name}
                  </span>
                </div>

                {/* Grades & SEND Badge */}
                <div className="flex items-center justify-between text-[10px] leading-none pt-0.5">
                  <span className="font-semibold text-gray-600 bg-gray-100 px-1 py-0.5 rounded text-[9px]">
                    G{pupil.currentGrade}
                  </span>

                  {pupil.sendArea ? (
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#E9EFE9] text-[#3A5D33] truncate max-w-[48px]"
                      title={`SEND: ${pupil.sendArea}`}
                    >
                      {pupil.sendArea}
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400">
                      T{pupil.targetGrade}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Side Panel: Shown on pupil card click (Hidden during print) */}
          {selectedPupil && (
            <div className="absolute right-4 top-4 bottom-4 w-80 bg-white rounded-lg border border-[#B8BABB] shadow-xl z-30 p-4 flex flex-col justify-between overflow-y-auto no-print">
              <div className="space-y-3">
                {/* Side Panel Header */}
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
                    <p className="text-xs text-gray-500 mt-0.5">
                      Working at: <strong>Grade {selectedPupil.currentGrade}</strong> &bull; Target: <strong>Grade {selectedPupil.targetGrade}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPupilId(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Priority / Why Flagged */}
                {selectedAnalysis?.isFlagged ? (
                  <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-xs">
                    <span className="font-bold text-[#D97706] block mb-1">
                      Why Flagged?
                    </span>
                    <ul className="list-disc pl-4 text-[11px] text-amber-900 space-y-0.5">
                      {selectedAnalysis.flagReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-2.5 bg-green-50 rounded border border-green-200 text-xs text-green-900">
                    <span className="font-bold text-[#3A5D33] block mb-1">
                      Why Flagged?
                    </span>
                    <p className="text-[11px] flex items-center text-gray-700">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#3A5D33] shrink-0" />
                      On track towards GCSE target grade (Grade {selectedPupil.currentGrade} vs Target {selectedPupil.targetGrade}) &mdash; no flags.
                    </p>
                  </div>
                )}

                {/* Assigned Intervention Group */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Intervention Group
                  </span>
                  {selectedGroupInfo ? (
                    <div
                      className="p-2.5 rounded border text-xs"
                      style={{
                        borderColor: selectedGroupInfo.palette.border,
                        backgroundColor: selectedGroupInfo.palette.bg,
                      }}
                    >
                      <p
                        className="font-bold text-sm"
                        style={{ color: selectedGroupInfo.palette.text }}
                      >
                        {selectedGroupInfo.group.name}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1 italic">
                        {selectedGroupInfo.group.strategy}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-200">
                      No intervention group assigned.
                    </p>
                  )}
                </div>

                {/* Key Gaps */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Key Skill Gaps
                  </span>
                  {selectedAnalysis?.weakSkills &&
                  selectedAnalysis.weakSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedAnalysis.weakSkills.map((gap) => (
                        <span
                          key={gap}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200"
                        >
                          {gap} ({selectedPupil.scores[gap]}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      No critical skill gaps identified.
                    </p>
                  )}
                </div>

                {/* SEND Strategy */}
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
                          <div className={selectedPupil.sendStrategy ? 'pt-1 border-t border-[#3A5D33]/15' : ''}>
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
    </div>
  );
};
