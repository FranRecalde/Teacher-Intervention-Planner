import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  UploadCloud,
  LayoutDashboard,
  ClipboardList,
  Grid3X3,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  FileSpreadsheet,
  Download,
  SlidersHorizontal,
  MoveRight,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  DoorOpen,
  Tv,
  RotateCcw,
  Palette,
  Settings,
  ShieldCheck,
  FileDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import {
  SkillName,
  SKILL_NAMES,
  Pupil,
  PupilAnalysis,
  WholeClassPriority,
  InterventionGroup,
  ThresholdSettings,
} from './types';
import {
  STRATEGIES_BY_YEAR,
  findStrategyById,
  gapMatchesSkills,
  YearGroupNumber,
} from './strategiesByYear';
import {
  DEFAULT_THRESHOLDS,
  SAMPLE_PUPILS,
  SAMPLE_TEST_PUPILS,
  STRATEGY_LIBRARY,
  SEND_STRATEGIES,
  GENERAL_STRATEGIES,
  normalizeName,
  namesMatch,
  computeClassAverages,
  analyzePupil,
  identifyWholeClassPriorities,
  buildInterventionGroups,
  readSpreadsheetFile,
  parseSpreadsheetFile,
  matchHeaderToField,
  FIELD_DISPLAY_NAMES,
  generateSampleCsv,
  detectBestColumnsForBox,
  cleanCellName,
  DetectedFieldMapping,
} from './rulesAndData';
import { SeatingPlan, SeatingPosition } from './SeatingPlan';
import {
  generateInterventionPlanPdf,
  getEffectivePosition,
} from './pdfExport';
import {
  LayoutType,
  computeLayoutSlots,
  getTraySlot,
  SEND_CODE_MAP,
  getSendInfo,
  LAYOUT_OPTIONS,
} from './seatingLayouts';
import {
  SendRecord,
  SendReviewState,
  STANDARD_SEND_AREAS,
  extractTextFromPdf,
  extractTextFromDocx,
  matchPupilsFromText,
  generateSampleSendPdf,
  generateSampleSendDocx,
} from './sendParser';

const INTERVENTION_PALETTE = [
  { name: 'Blue', border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8' },
  { name: 'Purple', border: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9' },
  { name: 'Emerald', border: '#059669', bg: '#ECFDF5', text: '#047857' },
  { name: 'Amber', border: '#D97706', bg: '#FFFBEB', text: '#B45309' },
  { name: 'Rose', border: '#E11D48', bg: '#FFF1F2', text: '#BE123C' },
  { name: 'Cyan', border: '#0891B2', bg: '#ECFEFF', text: '#0E7490' },
  { name: 'Indigo', border: '#4F46E5', bg: '#EEF2FF', text: '#4338CA' },
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'upload' | 'overview' | 'planner' | 'seating' | 'print'
  >('dashboard');

  // Core Data in memory only
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);
  const [yearGroup, setYearGroup] = useState<YearGroupNumber>(11);
  const [strategyRosterPupilId, setStrategyRosterPupilId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState<string>('');

  // Upload States
  const [uploadedFiles, setUploadedFiles] = useState<{
    classList: boolean;
    sendInfo: boolean;
    assessmentSnapshot: boolean;
    qla: boolean;
  }>({
    classList: false,
    sendInfo: false,
    assessmentSnapshot: false,
    qla: false,
  });

  // Detailed per-box upload feedback (status, messages, row counts, detected columns)
  const [boxFeedback, setBoxFeedback] = useState<
    Record<
      'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla',
      {
        status: 'idle' | 'reading' | 'success' | 'error';
        message: string;
        rowCount?: number;
        matchedCount?: number;
        detectedFieldLines?: DetectedFieldMapping[];
        previewNames?: string[];
        detectedColumns?: Array<{ original: string; mappedTo: string }>;
        rawHeaders?: string[];
        rawRows?: Array<Record<string, unknown>>;
        fileName?: string;
        missingRequired?: string[];
      }
    >
  >({
    classList: { status: 'idle', message: '' },
    sendInfo: { status: 'idle', message: '' },
    assessmentSnapshot: { status: 'idle', message: '' },
    qla: { status: 'idle', message: '' },
  });

  // Session column mapping overrides (remembers teacher selection for unrecognised headers)
  const [sessionColumnOverrides, setSessionColumnOverrides] = useState<
    Record<'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla', Record<string, string>>
  >({
    classList: {},
    sendInfo: {},
    assessmentSnapshot: {},
    qla: {},
  });

  const [unmatchedWarnings, setUnmatchedWarnings] = useState<string[]>([]);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // SEND Information Review Step State (for .pdf & .docx files)
  const [sendReviewState, setSendReviewState] = useState<SendReviewState | null>(null);
  const [showUnmatchedText, setShowUnmatchedText] = useState(false);
  const [selectedAddPupilName, setSelectedAddPupilName] = useState<string>('');

  // Raw file caches for 4-box upload flow
  const fileCacheRef = useRef<{
    classList?: Array<{
      name: string;
      targetGrade?: number;
      currentGrade?: number;
      yearGroup?: number;
      sendArea?: string;
    }>;
    sendInfo?: Array<{ name: string; sendArea: string; sendStrategy?: string }>;
    assessmentSnapshot?: Array<{
      name: string;
      currentGrade?: number;
      previousGrade?: number;
      targetGrade?: number;
    }>;
    qla?: Array<{ name: string; scores: Partial<Record<SkillName, number>> }>;
  }>({});

  // Intervention Planner generated states (customizable / editable)
  const [customPriorities, setCustomPriorities] = useState<WholeClassPriority[] | null>(null);
  const [customGroups, setCustomGroups] = useState<InterventionGroup[] | null>(null);

  // Filters & search on Planner
  const [pupilFilter, setPupilFilter] = useState<'all' | 'flagged' | 'belowTarget' | 'send'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing whole class priority state
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editedPriorityStrategy, setEditedPriorityStrategy] = useState('');

  // Adding custom priority modal/form
  const [newPriorityTopic, setNewPriorityTopic] = useState<string>('');
  const [newPriorityStrategy, setNewPriorityStrategy] = useState<string>('');
  const [showAddPriorityModal, setShowAddPriorityModal] = useState(false);

  // Adding new group modal/form
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSkill, setNewGroupSkill] = useState('');
  const [newGroupStrategy, setNewGroupStrategy] = useState('');

  // Drag and drop state for groups
  const [draggedPupilId, setDraggedPupilId] = useState<string | null>(null);
  const [dragSourceGroupId, setDragSourceGroupId] = useState<string | null>(null);

  // Seating Plan State (persisted in React state across tab switches)
  const [seatingPositions, setSeatingPositions] = useState<Record<string, SeatingPosition>>({});
  const [selectedPupilIdForSeating, setSelectedPupilIdForSeating] = useState<string | null>(null);
  const [showGroupColorsOnSeating, setShowGroupColorsOnSeating] = useState<boolean>(true);
  const [seatingLayout, setSeatingLayout] = useState<LayoutType>('rows-8x4');
  const [customCols, setCustomCols] = useState<number>(7);
  const [customRows, setCustomRows] = useState<number>(4);

  // Expandable Why Flagged state for pupil cards
  const [expandedFlagInfo, setExpandedFlagInfo] = useState<Record<string, boolean>>({});

  const toggleFlagExpanded = (pupilId: string) => {
    setExpandedFlagInfo((prev) => ({
      ...prev,
      [pupilId]: !prev[pupilId],
    }));
  };

  // Export Plan PDF states & warning modal
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);
  const [unplacedWarningCount, setUnplacedWarningCount] = useState<number | null>(null);

  const handleExportPlanClick = () => {
    // Count unplaced pupils (x < TRAY_WIDTH - 15)
    const unplaced = pupils.filter((p, idx) => {
      const pos = seatingPositions[p.id] || getTraySlot(idx);
      return pos.x < 224 - 15;
    });

    if (unplaced.length > 0) {
      setUnplacedWarningCount(unplaced.length);
    } else {
      executeExportPdf();
    }
  };

  const executeExportPdf = async () => {
    setUnplacedWarningCount(null);
    try {
      setIsExportingPdf(true);
      setPdfExportError(null);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await generateInterventionPlanPdf({
        pupils,
        pupilAnalyses,
        priorities,
        interventionGroups,
        seatingPositions,
        showGroupColors: showGroupColorsOnSeating,
        metrics,
        classCode: '11A/Sp1',
        layoutType: seatingLayout,
        customCols,
        customRows,
      });
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      setPdfExportError(err?.message || 'Failed to generate PDF document.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export Plan as a clean, self-contained printable HTML document
  const handleExportPlanHtml = () => {
    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const prioritiesRows = priorities
      .filter((p) => p.accepted)
      .map(
        (p) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 600;">${p.topic}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 700; color: #d97706; text-align: center;">${p.weakPct}%</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; color: #374151;">${p.suggestedStrategy}</td>
      </tr>`
      )
      .join('');

    const groupsHtml = interventionGroups
      .map(
        (g) => `
      <div style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; background: #f9fafb; margin-bottom: 8px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; color: #1c2421;">
          <span>${g.name} (${g.skillOrFocus})</span>
          <span style="font-size: 11px; color: #6b7280;">${g.pupilIds.length} pupils</span>
        </div>
        <div style="font-size: 11px; color: #4b5563; font-style: italic; margin-top: 4px;">Strategy: ${g.strategy}</div>
        <div style="font-size: 11px; color: #1f2937; margin-top: 6px;">
          <strong>Pupils: </strong>${
            g.pupilIds
              .map((id) => pupils.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(', ') || 'None assigned'
          }
        </div>
      </div>`
      )
      .join('');

    const pupilsRows = pupils
      .map((p) => {
        const a = pupilAnalyses.get(p.id);
        const isFlagged = a?.isFlagged;
        return `
      <tr style="page-break-inside: avoid; background-color: ${isFlagged ? '#fffbeb' : '#ffffff'};">
        <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 600;">
          ${p.name}
          ${isFlagged ? '<span style="display:inline-block; font-size:9px; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:9999px; margin-left:6px; font-weight:700;">FLAGGED</span>' : ''}
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;">G${p.currentGrade} / G${p.targetGrade}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; color: #92400e; font-size: 11px;">
          ${a?.flagReasons.join('; ') || 'On track (at or above target)'}
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db; color: #374151; font-size: 11px;">
          ${p.sendArea ? `<strong>${p.sendArea}:</strong> ${p.sendStrategy || ''}` : '-'}
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db; color: #1f2937; font-size: 11px;">
          ${
            p.chosenStrategies && p.chosenStrategies.length > 0
              ? `<div style="margin-bottom: 4px;">${p.chosenStrategies
                  .map((id) => {
                    const st = findStrategyById(id);
                    return st
                      ? `<div style="margin-bottom: 3px;"><strong>${st.strategy}</strong> <span style="font-size: 9px; background: #e9efe9; color: #3a5d33; padding: 1px 5px; border-radius: 9999px; font-weight: bold;">${st.technique}</span></div>`
                      : '';
                  })
                  .join('')}</div>`
              : ''
          }
          <div style="font-style: italic; color: #4b5563;">${p.teacherNotes || (p.chosenStrategies && p.chosenStrategies.length > 0 ? '' : 'Monitor next cycle.')}</div>
        </td>
      </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GCSE Spanish Year 11 - Intervention Action Plan</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1c2421; line-height: 1.4; }
    h1, h2, h3 { font-family: 'Montserrat', sans-serif; color: #1c2421; margin: 0 0 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 24px; font-size: 12px; }
    th { background: #f3f4f6; color: #374151; padding: 8px; border: 1px solid #d1d5db; text-align: left; }
    .header-bar { border-bottom: 3px solid #3a5d33; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3a5d33; letter-spacing: 0.05em; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { border: 1px solid #d1d5db; padding: 10px; border-radius: 6px; background: #fafafa; border-top: 3px solid #3a5d33; }
    .stat-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
    @media print {
      body { margin: 15px; }
      .no-print { display: none; }
      @page { size: portrait; margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="background: #3a5d33; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer;">Print Document</button>
  </div>
  <div class="header-bar">
    <div>
      <div class="badge">Department of Modern Foreign Languages</div>
      <h1>GCSE Spanish &bull; Year 11 Intervention Action Plan</h1>
      <div style="font-size: 12px; color: #4b5563;">Confidential Departmental Progress &amp; Intervention Tracker &bull; Generated: ${dateStr}</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #4b5563;">
      <strong>Class:</strong> 11A/Sp1<br>
      <strong>Cohort:</strong> GCSE 2026<br>
      <strong>Session:</strong> Term 2 Cycle
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Total Pupils</div>
      <div class="stat-val">${pupils.length}</div>
    </div>
    <div class="stat-card" style="border-top-color: #d97706;">
      <div style="font-size: 11px; text-transform: uppercase; color: #d97706; font-weight: 700;">Below Target</div>
      <div class="stat-val" style="color: #d97706;">${metrics.belowTargetCount}</div>
    </div>
    <div class="stat-card">
      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700;">SEND Support</div>
      <div class="stat-val">${metrics.sendCount}</div>
    </div>
    <div class="stat-card" style="border-top-color: #d97706;">
      <div style="font-size: 11px; text-transform: uppercase; color: #d97706; font-weight: 700;">Flagged Review</div>
      <div class="stat-val" style="color: #d97706;">${metrics.flaggedCount}</div>
    </div>
  </div>

  <h3>1. Whole Class Curricular Priorities</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Topic / Grammar Focus</th>
        <th style="width: 15%; text-align: center;">% Class Weak</th>
        <th>Agreed Department Strategy</th>
      </tr>
    </thead>
    <tbody>${prioritiesRows}</tbody>
  </table>

  <h3>2. Targeted Intervention Cohorts</h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
    ${groupsHtml}
  </div>

  <h3>3. Pupil Progress &amp; Intervention Register</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Pupil Name</th>
        <th style="width: 14%; text-align: center;">Grades (Cur/Tgt)</th>
        <th style="width: 28%;">Why Flagged?</th>
        <th style="width: 18%;">SEND Accommodations</th>
        <th>Teacher Action Note</th>
      </tr>
    </thead>
    <tbody>${pupilsRows}</tbody>
  </table>

  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280;">
    <div>Teacher Signature: _______________________</div>
    <div>Date: _______________________</div>
    <div>Head of Department Review: _______________________</div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GCSE_Spanish_Year11_Intervention_Plan.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // COMPUTED / DERIVED DATA (Deterministic Rules)
  // -------------------------------------------------------------
  const classAverages = useMemo(() => computeClassAverages(pupils), [pupils]);

  const pupilAnalyses = useMemo(() => {
    const map = new Map<string, PupilAnalysis>();
    pupils.forEach((p) => {
      map.set(p.id, analyzePupil(p, classAverages, thresholds));
    });
    return map;
  }, [pupils, classAverages, thresholds]);

  // Default whole class priorities calculated from rules
  const defaultPriorities = useMemo(() => {
    const analysesList = Array.from(pupilAnalyses.values());
    return identifyWholeClassPriorities(pupils, analysesList, classAverages, thresholds);
  }, [pupils, pupilAnalyses, classAverages, thresholds]);

  // Active priorities (using custom if edited, else default)
  const priorities: WholeClassPriority[] = customPriorities ?? defaultPriorities;

  // Default groups calculated from rules
  const defaultGroups = useMemo(() => {
    const analysesList = Array.from(pupilAnalyses.values());
    return buildInterventionGroups(pupils, analysesList, thresholds);
  }, [pupils, pupilAnalyses, thresholds]);

  // Active groups (using custom if modified, else default)
  const interventionGroups: InterventionGroup[] = customGroups ?? defaultGroups;

  // Summary metrics for Overview and Dashboard
  const metrics = useMemo(() => {
    const totalPupils = pupils.length;
    let belowTargetCount = 0;
    let sendCount = 0;
    let flaggedCount = 0;

    pupilAnalyses.forEach((analysis, pupilId) => {
      const p = pupils.find((item) => item.id === pupilId);
      if (analysis.isBelowTarget) belowTargetCount++;
      if (analysis.isFlagged) flaggedCount++;
      if (p?.sendArea) sendCount++;
    });

    return { totalPupils, belowTargetCount, sendCount, flaggedCount };
  }, [pupils, pupilAnalyses]);

  // -------------------------------------------------------------
  // ACTIONS & HANDLERS
  // -------------------------------------------------------------

  // Load sample data directly into memory
  const handleLoadSampleData = () => {
    const loadedPupils: Pupil[] = JSON.parse(JSON.stringify(SAMPLE_PUPILS)).map((p: Pupil) => ({
      ...p,
      yearGroup: 11,
    }));
    setPupils(loadedPupils);
    setYearGroup(11);
    setUploadedFiles({
      classList: true,
      sendInfo: true,
      assessmentSnapshot: true,
      qla: true,
    });
    setUnmatchedWarnings([]);
    setCustomPriorities(null);
    setCustomGroups(null);
    setActiveTab('planner');
  };

  // Reset planner to default generated plan
  const handleRegeneratePlan = () => {
    setCustomPriorities(null);
    setCustomGroups(null);
  };

  // Process raw rows for a box with column detection, fuzzy matching, and session overrides
  const processSpreadsheetRows = (
    boxType: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla',
    rawRows: Array<Record<string, unknown>>,
    fileName: string,
    overrides: Record<string, string> = {}
  ) => {
    if (!rawRows || rawRows.length === 0) {
      setBoxFeedback((prev) => ({
        ...prev,
        [boxType]: {
          status: 'error',
          message: 'File contains no data rows.',
          fileName,
        },
      }));
      return false;
    }

    const rawHeaders = Object.keys(rawRows[0] || {});

    // Stage 3: Columns mapped using scored matching, blocklist enforcement, and pupil name priority
    const detection = detectBestColumnsForBox(boxType, rawHeaders, overrides);
    const {
      firstNameCol,
      lastNameCol,
      nameCol,
      targetGradeCol,
      currentGradeCol,
      previousGradeCol,
      yearGroupCol,
      sendAreaCol,
      sendStrategyCol,
      skillCols,
      detectedFieldLines,
    } = detection;

    console.log('[handleFile] Columns mapped:', {
      boxType,
      detectedFieldLines,
      headers: rawHeaders,
      overrides,
    });

    // Helper to extract pupil name (supports single name or combined First + Surname)
    // If the cell contains several lines or extra text, uses only the first line
    const extractName = (row: Record<string, unknown>): string => {
      if (nameCol && row[nameCol] !== undefined) {
        return cleanCellName(row[nameCol]);
      }
      if (firstNameCol || lastNameCol) {
        const fn = firstNameCol ? cleanCellName(row[firstNameCol]) : '';
        const ln = lastNameCol ? cleanCellName(row[lastNameCol]) : '';
        const combined = `${fn} ${ln}`.trim();
        if (combined) return combined;
      }
      return '';
    };

    // Collect preview of the first 3 parsed names
    const allParsedNames: string[] = [];
    rawRows.forEach((row) => {
      const n = extractName(row);
      if (n) allParsedNames.push(n);
    });
    const previewNames = allParsedNames.slice(0, 3);

    // Verify required columns
    const hasName = Boolean(nameCol || (firstNameCol && lastNameCol) || firstNameCol || lastNameCol);
    if (!hasName) {
      setBoxFeedback((prev) => ({
        ...prev,
        [boxType]: {
          status: 'error',
          message: "Required column 'Pupil name' not recognised. Select it below.",
          rowCount: rawRows.length,
          matchedCount: 0,
          detectedFieldLines,
          previewNames,
          rawHeaders,
          rawRows,
          fileName,
          missingRequired: ['name'],
        },
      }));
      return false;
    }

    if (boxType === 'sendInfo' && !sendAreaCol) {
      setBoxFeedback((prev) => ({
        ...prev,
        sendInfo: {
          status: 'error',
          message: "Required column 'Area of need' not recognised. Select it below.",
          rowCount: rawRows.length,
          matchedCount: 0,
          detectedFieldLines,
          previewNames,
          rawHeaders,
          rawRows,
          fileName,
          missingRequired: ['sendArea'],
        },
      }));
      return false;
    }

    // Populate data for the specific boxType
    if (boxType === 'classList') {
      const list: Array<{
        name: string;
        targetGrade?: number;
        currentGrade?: number;
        yearGroup?: number;
        sendArea?: string;
      }> = [];
      let detectedYear: YearGroupNumber | undefined;

      rawRows.forEach((row) => {
        const name = extractName(row);
        if (!name) return;

        let targetGrade: number | undefined;
        if (targetGradeCol && row[targetGradeCol] !== undefined) {
          const val = Number(row[targetGradeCol]);
          if (!isNaN(val) && val > 0) targetGrade = val;
        }

        let currentGrade: number | undefined;
        if (currentGradeCol && row[currentGradeCol] !== undefined) {
          const val = Number(row[currentGradeCol]);
          if (!isNaN(val) && val > 0) currentGrade = val;
        }

        let rowYear: number | undefined;
        if (yearGroupCol && row[yearGroupCol] !== undefined) {
          const parsed = parseInt(String(row[yearGroupCol]).replace(/[^0-9]/g, ''), 10);
          if (parsed >= 7 && parsed <= 11) {
            rowYear = parsed;
            if (!detectedYear) detectedYear = parsed as YearGroupNumber;
          }
        }

        // Requirement 5: "SEN" on the class list maps to area of need only
        let sendArea: string | undefined;
        if (sendAreaCol && row[sendAreaCol] !== undefined) {
          const rawArea = String(row[sendAreaCol]).trim();
          if (rawArea) sendArea = rawArea;
        }

        list.push({ name, targetGrade, currentGrade, yearGroup: rowYear, sendArea });
      });

      fileCacheRef.current.classList = list;
      if (detectedYear) setYearGroup(detectedYear);
      setUploadedFiles((prev) => ({ ...prev, classList: true }));
    } else if (boxType === 'sendInfo') {
      const list: Array<{ name: string; sendArea: string; sendStrategy?: string }> = [];
      rawRows.forEach((row) => {
        const name = extractName(row);
        if (!name) return;

        const rawArea = sendAreaCol ? String(row[sendAreaCol] ?? '').trim() : '';
        const sendStrategy = sendStrategyCol ? String(row[sendStrategyCol] ?? '').trim() : undefined;
        if (rawArea) {
          list.push({ name, sendArea: rawArea, sendStrategy });
        }
      });
      fileCacheRef.current.sendInfo = list;
      setUploadedFiles((prev) => ({ ...prev, sendInfo: true }));
    } else if (boxType === 'assessmentSnapshot') {
      const list: Array<{
        name: string;
        currentGrade?: number;
        previousGrade?: number;
        targetGrade?: number;
      }> = [];
      rawRows.forEach((row) => {
        const name = extractName(row);
        if (!name) return;

        let currentGrade: number | undefined;
        if (currentGradeCol && row[currentGradeCol] !== undefined) {
          const val = Number(row[currentGradeCol]);
          if (!isNaN(val) && val > 0) currentGrade = val;
        }
        let previousGrade: number | undefined;
        if (previousGradeCol && row[previousGradeCol] !== undefined) {
          const val = Number(row[previousGradeCol]);
          if (!isNaN(val) && val > 0) previousGrade = val;
        }
        let targetGrade: number | undefined;
        if (targetGradeCol && row[targetGradeCol] !== undefined) {
          const val = Number(row[targetGradeCol]);
          if (!isNaN(val) && val > 0) targetGrade = val;
        }

        list.push({ name, currentGrade, previousGrade, targetGrade });
      });
      fileCacheRef.current.assessmentSnapshot = list;
      setUploadedFiles((prev) => ({ ...prev, assessmentSnapshot: true }));
    } else if (boxType === 'qla') {
      const list: Array<{ name: string; scores: Partial<Record<SkillName, number>> }> = [];
      rawRows.forEach((row) => {
        const name = extractName(row);
        if (!name) return;

        const scores: Partial<Record<SkillName, number>> = {};
        SKILL_NAMES.forEach((skill) => {
          const col = skillCols[skill];
          if (col && row[col] !== undefined) {
            const val = Number(row[col]);
            if (!isNaN(val)) scores[skill] = val;
          }
        });
        list.push({ name, scores });
      });
      fileCacheRef.current.qla = list;
      setUploadedFiles((prev) => ({ ...prev, qla: true }));
    }

    // Calculate matched pupils
    let matchedCount = 0;
    const unmatchedNames: string[] = [];
    if (boxType === 'classList') {
      matchedCount = (fileCacheRef.current.classList || []).length;
    } else {
      const classPupils = fileCacheRef.current.classList || [];
      const currentList =
        boxType === 'sendInfo'
          ? fileCacheRef.current.sendInfo || []
          : boxType === 'assessmentSnapshot'
          ? fileCacheRef.current.assessmentSnapshot || []
          : fileCacheRef.current.qla || [];

      if (classPupils.length > 0) {
        currentList.forEach((item) => {
          const found = classPupils.some((cp) => namesMatch(cp.name, item.name));
          if (found) {
            matchedCount++;
          } else {
            unmatchedNames.push(item.name);
          }
        });
      } else {
        matchedCount = currentList.length;
      }
    }

    // Stage 4 logging: pupils matched
    console.log('[handleFile] Pupils matched:', {
      boxType,
      matchedCount,
      totalRows: rawRows.length,
      unmatchedNames,
    });

    setBoxFeedback((prev) => ({
      ...prev,
      [boxType]: {
        status: 'success',
        message: `${rawRows.length} rows read, ${matchedCount} pupils matched`,
        rowCount: rawRows.length,
        matchedCount,
        detectedFieldLines,
        previewNames,
        rawHeaders,
        rawRows,
        fileName,
        missingRequired: undefined,
      },
    }));

    // If Class List was just uploaded, re-evaluate matched counts for other already uploaded boxes
    if (boxType === 'classList') {
      (['sendInfo', 'assessmentSnapshot', 'qla'] as const).forEach((otherBox) => {
        const cachedOther = boxFeedback[otherBox];
        if (cachedOther.rawRows && cachedOther.rawRows.length > 0 && cachedOther.status === 'success') {
          const classPupils = fileCacheRef.current.classList || [];
          const currentList =
            otherBox === 'sendInfo'
              ? fileCacheRef.current.sendInfo || []
              : otherBox === 'assessmentSnapshot'
              ? fileCacheRef.current.assessmentSnapshot || []
              : fileCacheRef.current.qla || [];

          let otherMatched = 0;
          currentList.forEach((item) => {
            if (classPupils.some((cp) => namesMatch(cp.name, item.name))) {
              otherMatched++;
            }
          });

          setBoxFeedback((latest) => ({
            ...latest,
            [otherBox]: {
              ...latest[otherBox],
              matchedCount: otherMatched,
              message: `${cachedOther.rawRows!.length} rows read, ${otherMatched} pupils matched`,
            },
          }));
        }
      });
    }

    return true;
  };

  // 1. Unified shared handler for all 4 upload boxes
  const handleFile = async (
    boxType: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla',
    file: File
  ) => {
    // Stage 1 logging: file chosen
    console.log('[handleFile] File chosen:', {
      boxType,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Requirement 3: Visible immediate feedback: "Reading file..."
    setBoxFeedback((prev) => ({
      ...prev,
      [boxType]: {
        status: 'reading',
        message: 'Reading file...',
        fileName: file.name,
      },
    }));

    try {
      const ext = file.name.toLowerCase().split('.').pop() || '';

      // Special handling for SEND box: supports .pdf, .docx, .xlsx, .xls, .csv
      if (boxType === 'sendInfo') {
        if (ext === 'doc' || !['pdf', 'docx', 'xlsx', 'xls', 'csv'].includes(ext)) {
          throw new Error('Please save this as .docx, .pdf, .xlsx or .csv and upload it again.');
        }

        // Keep PDF and Word handling for SEND box with comprehensive try/catch
        if (ext === 'pdf' || ext === 'docx') {
          try {
            let extractedText = '';
            if (ext === 'pdf') {
              extractedText = await extractTextFromPdf(file);
            } else {
              extractedText = await extractTextFromDocx(file);
            }

            const availablePupils: string[] =
              fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0
                ? fileCacheRef.current.classList.map((p) => p.name)
                : pupils.length > 0
                ? pupils.map((p) => p.name)
                : SAMPLE_TEST_PUPILS.map((p) => p.name);

            const { records, unmatchedText, totalCount } = matchPupilsFromText(
              extractedText,
              availablePupils
            );

            console.log('[handleFile] Rows parsed (PDF/Word):', {
              boxType,
              count: records.length,
              totalPupils: totalCount,
            });

            const previewNames = records.slice(0, 3).map((r) => r.pupilName);

            setSendReviewState({
              file,
              records,
              unmatchedText,
              totalPupils: totalCount,
            });
            setShowUnmatchedText(false);
            setSelectedAddPupilName('');
            setUploadFeedback(null);

            setBoxFeedback((prev) => ({
              ...prev,
              sendInfo: {
                status: 'success',
                message: `Document read. Found SEND info for ${records.length} of ${totalCount} pupils.`,
                rowCount: records.length,
                matchedCount: records.length,
                previewNames,
                fileName: file.name,
              },
            }));
            return;
          } catch (docErr) {
            console.error('[handleFile] SEND PDF/Word parsing error:', docErr);
            setSendReviewState(null);
            setBoxFeedback((prev) => ({
              ...prev,
              sendInfo: {
                status: 'error',
                message: (docErr as Error).message || 'Failed to parse SEND document.',
                fileName: file.name,
              },
            }));
            return;
          }
        }
      } else {
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
          throw new Error('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
        }
      }

      // Read spreadsheet rows: SheetJS for .xlsx/.xls, PapaParse for .csv
      const rawRows = await readSpreadsheetFile(file);
      if (!rawRows || rawRows.length === 0) {
        throw new Error('File appears empty or contains no data rows.');
      }

      // Stage 2 logging: rows parsed
      console.log('[handleFile] Rows parsed:', {
        boxType,
        count: rawRows.length,
        firstRow: rawRows[0],
      });

      processSpreadsheetRows(
        boxType,
        rawRows,
        file.name,
        sessionColumnOverrides[boxType] || {}
      );
    } catch (err) {
      const errMsg = (err as Error).message || 'Error reading file';
      console.error('[handleFile] Error:', err);
      setBoxFeedback((prev) => ({
        ...prev,
        [boxType]: {
          status: 'error',
          message: errMsg,
          fileName: file.name,
        },
      }));
    }
  };

  // Column mapping fallback handler
  const handleOverrideColumn = (
    boxType: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla',
    fieldKey: string,
    chosenHeader: string
  ) => {
    const updated = {
      ...sessionColumnOverrides,
      [boxType]: {
        ...sessionColumnOverrides[boxType],
        [fieldKey]: chosenHeader,
      },
    };
    setSessionColumnOverrides(updated);

    const currentBox = boxFeedback[boxType];
    if (currentBox.rawRows && currentBox.rawRows.length > 0) {
      processSpreadsheetRows(
        boxType,
        currentBox.rawRows,
        currentBox.fileName || 'file',
        updated[boxType]
      );
    }
  };

  // Render feedback, detected columns (one line per field + Change dropdown), and 3-name preview for a box
  const renderBoxFeedback = (boxType: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla') => {
    const feedback = boxFeedback[boxType];
    const overrides = sessionColumnOverrides[boxType] || {};

    if (feedback.status === 'reading') {
      return (
        <div className="mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded flex items-center space-x-2 text-xs text-blue-800">
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-medium">Reading file...</span>
        </div>
      );
    }

    if (feedback.status === 'success') {
      return (
        <div className="mt-2.5 space-y-2">
          {/* Green tick with summary */}
          <div className="p-2 bg-[#E9EFE9] border border-[#3A5D33]/30 rounded flex items-center space-x-2 text-xs text-[#3A5D33]">
            <CheckCircle2 className="w-4 h-4 text-[#3A5D33] shrink-0" />
            <span className="font-semibold">{feedback.message}</span>
          </div>

          {/* Detected columns: ONE LINE PER FIELD with a Change dropdown beside each */}
          {feedback.detectedFieldLines && feedback.detectedFieldLines.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs space-y-1.5 font-mono">
              <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Detected columns
              </div>
              {feedback.detectedFieldLines.map((field) => (
                <div
                  key={field.fieldKey}
                  className="flex flex-wrap items-center justify-between gap-2 py-0.5 border-b border-gray-200/60 last:border-0 font-sans text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-800">{field.fieldLabel}</span>
                    <span className="text-gray-400">&gt;</span>
                    <span className="text-[#3A5D33] font-semibold">{field.columnDisplay}</span>
                  </div>
                  {feedback.rawHeaders && feedback.rawHeaders.length > 0 && (
                    <div className="flex items-center gap-1">
                      <label
                        htmlFor={`override-${boxType}-${field.fieldKey}`}
                        className="text-[10px] text-gray-500 font-sans"
                      >
                        Change:
                      </label>
                      <select
                        id={`override-${boxType}-${field.fieldKey}`}
                        value={overrides[field.fieldKey] || ''}
                        onChange={(e) =>
                          handleOverrideColumn(boxType, field.fieldKey, e.target.value)
                        }
                        className="text-[11px] py-0.5 px-1.5 border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                      >
                        <option value="">(Auto: {field.columnDisplay})</option>
                        {feedback.rawHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview of first 3 parsed names */}
          {feedback.previewNames && feedback.previewNames.length > 0 && (
            <div className="p-2 bg-white border border-gray-200 rounded text-xs flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700">Preview:</span>
              <span className="text-gray-900 font-medium">
                {feedback.previewNames.join(', ')}
                {feedback.rowCount && feedback.rowCount > feedback.previewNames.length
                  ? ` (+${feedback.rowCount - feedback.previewNames.length} more)`
                  : ''}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (feedback.status === 'error') {
      return (
        <div className="mt-2.5 space-y-2">
          <div className="p-2 bg-red-50 border border-red-200 rounded flex items-start space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">{feedback.message}</span>
              {feedback.fileName && (
                <span className="text-[10px] text-red-500">File: {feedback.fileName}</span>
              )}
            </div>
          </div>

          {feedback.missingRequired && feedback.rawHeaders && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
              <span className="font-semibold text-amber-900 block">Column mapping fallback:</span>
              {feedback.missingRequired.map((fieldKey) => (
                <div key={fieldKey} className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-gray-700">
                    {FIELD_DISPLAY_NAMES[fieldKey] || fieldKey}:
                  </label>
                  <select
                    value={overrides[fieldKey] || ''}
                    onChange={(e) => handleOverrideColumn(boxType, fieldKey, e.target.value)}
                    className="p-1 border border-gray-300 rounded text-xs bg-white text-gray-800"
                  >
                    <option value="">Select column...</option>
                    {feedback.rawHeaders?.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {feedback.previewNames && feedback.previewNames.length > 0 && (
            <div className="p-2 bg-white border border-gray-200 rounded text-xs flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700">Preview:</span>
              <span className="text-gray-800">{feedback.previewNames.join(', ')}</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const handleUpdateSendReviewRecord = (
    index: number,
    field: 'pupilName' | 'sendArea' | 'sendStrategy',
    value: string
  ) => {
    if (!sendReviewState) return;
    const updated = [...sendReviewState.records];
    updated[index] = { ...updated[index], [field]: value };
    setSendReviewState({ ...sendReviewState, records: updated });
  };

  const handleRemoveSendReviewRecord = (index: number) => {
    if (!sendReviewState) return;
    const updated = sendReviewState.records.filter((_, i) => i !== index);
    setSendReviewState({ ...sendReviewState, records: updated });
  };

  const handleAddSendReviewPupil = (pupilName: string) => {
    if (!sendReviewState || !pupilName) return;
    if (sendReviewState.records.some((r) => r.pupilName === pupilName)) return;
    const newRecord: SendRecord = {
      pupilName,
      sendArea: 'SEN support',
      sendStrategy: '',
    };
    setSendReviewState({
      ...sendReviewState,
      records: [...sendReviewState.records, newRecord],
    });
    setSelectedAddPupilName('');
  };

  const handleConfirmSendReview = () => {
    if (!sendReviewState) return;
    fileCacheRef.current.sendInfo = sendReviewState.records.map((r) => ({
      name: r.pupilName,
      sendArea: r.sendArea,
      sendStrategy: r.sendStrategy,
    }));
    setUploadedFiles((prev) => ({ ...prev, sendInfo: true }));
    setBoxFeedback((prev) => ({
      ...prev,
      sendInfo: {
        status: 'success',
        message: `${sendReviewState.records.length} SEND accommodations confirmed`,
        rowCount: sendReviewState.records.length,
        matchedCount: sendReviewState.records.length,
        previewNames: sendReviewState.records.slice(0, 3).map((r) => r.pupilName),
        fileName: sendReviewState.file.name,
      },
    }));
    setUploadFeedback(
      `Confirmed SEND information for ${sendReviewState.records.length} pupils.`
    );
    setSendReviewState(null);
  };

  const handleCancelSendReview = () => {
    setSendReviewState(null);
  };

  // Merge uploaded files into the main pupils state and detect unmatched warnings
  const handleGeneratePlanFromUploads = () => {
    const cache = fileCacheRef.current;
    const warnings: string[] = [];

    // Map of normalized name to consolidated pupil data
    const pupilMap = new Map<string, Pupil>();

    // 1. Ingest Class List (Required)
    if (!cache.classList || cache.classList.length === 0) {
      setUploadFeedback('Please upload at least a Class List before generating an intervention plan.');
      return;
    }

    cache.classList.forEach((item, idx) => {
      const norm = normalizeName(item.name);
      const blankScores: Record<SkillName, number> = {} as Record<SkillName, number>;
      SKILL_NAMES.forEach((s) => (blankScores[s] = 50));

      pupilMap.set(norm, {
        id: `p-upload-${idx + 1}`,
        name: item.name,
        currentGrade: item.currentGrade || 5,
        targetGrade: item.targetGrade || 6,
        previousGrade: item.currentGrade || 5,
        scores: blankScores,
        yearGroup: item.yearGroup || yearGroup,
        sendArea: item.sendArea || undefined,
        sendStrategy: item.sendArea
          ? (SEND_STRATEGIES[item.sendArea as keyof typeof SEND_STRATEGIES]?.[0] || 'SEN support')
          : undefined,
      });
    });

    // Say what is missing if any optional files are not provided
    const missingNotes: string[] = [];
    if (!cache.sendInfo || cache.sendInfo.length === 0) {
      missingNotes.push('SEND Information not uploaded (no SEND accommodations flagged)');
    }
    if (!cache.assessmentSnapshot || cache.assessmentSnapshot.length === 0) {
      missingNotes.push('Assessment Snapshot not uploaded (using current grades as prior baseline)');
    }
    if (!cache.qla || cache.qla.length === 0) {
      missingNotes.push('QLA spreadsheet not uploaded (baseline 50% grammar & skill scores applied)');
    }
    if (missingNotes.length > 0) {
      warnings.push(`Note: Plan generated with available data. Missing: ${missingNotes.join('; ')}.`);
    }

    // 2. Merge Assessment Snapshot
    if (cache.assessmentSnapshot) {
      cache.assessmentSnapshot.forEach((item) => {
        let matchedPupil: Pupil | undefined;
        for (const [_, pupil] of pupilMap.entries()) {
          if (namesMatch(pupil.name, item.name)) {
            matchedPupil = pupil;
            break;
          }
        }

        if (matchedPupil) {
          if (item.currentGrade) matchedPupil.currentGrade = item.currentGrade;
          if (item.targetGrade) matchedPupil.targetGrade = item.targetGrade;
          if (item.previousGrade) matchedPupil.previousGrade = item.previousGrade;
        } else {
          warnings.push(`Assessment Snapshot lists "${item.name}" who was not found in the Class List.`);
        }
      });
    }

    // 3. Merge SEND Info
    if (cache.sendInfo) {
      cache.sendInfo.forEach((item) => {
        let matchedPupil: Pupil | undefined;
        for (const [_, pupil] of pupilMap.entries()) {
          if (namesMatch(pupil.name, item.name)) {
            matchedPupil = pupil;
            break;
          }
        }

        if (matchedPupil) {
          matchedPupil.sendArea = item.sendArea;
          matchedPupil.sendStrategy =
            item.sendStrategy ||
            (SEND_STRATEGIES[item.sendArea as keyof typeof SEND_STRATEGIES]
              ? SEND_STRATEGIES[item.sendArea as keyof typeof SEND_STRATEGIES][0]
              : undefined);
        } else {
          warnings.push(`SEND Information file lists "${item.name}" who was not found in the Class List.`);
        }
      });
    }

    // 4. Merge QLA
    if (cache.qla) {
      cache.qla.forEach((item) => {
        let matchedPupil: Pupil | undefined;
        for (const [_, pupil] of pupilMap.entries()) {
          if (namesMatch(pupil.name, item.name)) {
            matchedPupil = pupil;
            break;
          }
        }

        if (matchedPupil) {
          SKILL_NAMES.forEach((skill) => {
            if (item.scores[skill] !== undefined) {
              matchedPupil.scores[skill] = item.scores[skill]!;
            }
          });
        } else {
          warnings.push(`QLA spreadsheet lists "${item.name}" who was not found in the Class List.`);
        }
      });
    }

    const consolidated = Array.from(pupilMap.values());
    if (consolidated.length === 0) {
      setUploadFeedback('No valid pupil data found. Please upload files or load sample data.');
      return;
    }

    setPupils(consolidated);
    setUnmatchedWarnings(warnings);
    setCustomPriorities(null);
    setCustomGroups(null);
    setActiveTab('planner');
  };

  // Download sample CSVs
  const handleDownloadSampleCsv = (type: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla') => {
    const csvContent = generateSampleCsv(type);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Inline edit teacher notes on pupil card
  const handleUpdateTeacherNotes = (pupilId: string, notes: string) => {
    setPupils((prev) =>
      prev.map((p) => (p.id === pupilId ? { ...p, teacherNotes: notes } : p))
    );
  };

  // Add or toggle strategy for a pupil (no duplicates)
  const handleTogglePupilStrategy = (pupilId: string, strategyId: string) => {
    setPupils((prev) =>
      prev.map((p) => {
        if (p.id !== pupilId) return p;
        const current = p.chosenStrategies || [];
        const exists = current.includes(strategyId);
        const updated = exists
          ? current.filter((id) => id !== strategyId)
          : [...current, strategyId];
        return { ...p, chosenStrategies: updated };
      })
    );
  };

  // Remove chosen strategy chip from pupil
  const handleRemovePupilStrategy = (pupilId: string, strategyId: string) => {
    setPupils((prev) =>
      prev.map((p) => {
        if (p.id !== pupilId) return p;
        const current = p.chosenStrategies || [];
        return {
          ...p,
          chosenStrategies: current.filter((id) => id !== strategyId),
        };
      })
    );
  };

  // Inline edit grades on pupil card
  const handleUpdatePupilGrades = (
    pupilId: string,
    currentGrade: number,
    targetGrade: number
  ) => {
    setPupils((prev) =>
      prev.map((p) =>
        p.id === pupilId ? { ...p, currentGrade, targetGrade } : p
      )
    );
  };

  // Whole Class Priority Actions
  const handleRemovePriority = (id: string) => {
    const updated = priorities.filter((p) => p.id !== id);
    setCustomPriorities(updated);
  };

  const handleToggleAcceptPriority = (id: string) => {
    const updated = priorities.map((p) =>
      p.id === id ? { ...p, accepted: !p.accepted } : p
    );
    setCustomPriorities(updated);
  };

  const handleSaveEditedPriority = (id: string) => {
    const updated = priorities.map((p) =>
      p.id === id ? { ...p, suggestedStrategy: editedPriorityStrategy } : p
    );
    setCustomPriorities(updated);
    setEditingPriorityId(null);
  };

  const handleAddCustomPriority = () => {
    if (!newPriorityTopic.trim()) return;
    const newP: WholeClassPriority = {
      id: `wcp-custom-${Date.now()}`,
      topic: newPriorityTopic.trim(),
      weakCount: 0,
      weakPct: 0,
      classAvg: 0,
      suggestedStrategy:
        newPriorityStrategy.trim() ||
        'Focus on structured daily micro-practice and exemplar modeling.',
      accepted: true,
      isCustom: true,
    };
    setCustomPriorities([...priorities, newP]);
    setNewPriorityTopic('');
    setNewPriorityStrategy('');
    setShowAddPriorityModal(false);
  };

  // Drag and drop between groups
  const handleDropPupil = (
    pupilId: string,
    targetGroupId: string,
    sourceGroupId?: string | null
  ) => {
    const updatedGroups = interventionGroups.map((group) => {
      let pupilIds = [...group.pupilIds];

      // Remove from source or any other group if moving
      if (group.id === sourceGroupId || (sourceGroupId === undefined && group.pupilIds.includes(pupilId))) {
        pupilIds = pupilIds.filter((id) => id !== pupilId);
      }

      // Add to target group if not already present
      if (group.id === targetGroupId) {
        if (!pupilIds.includes(pupilId)) {
          pupilIds.push(pupilId);
        }
      }

      return { ...group, pupilIds };
    });

    setCustomGroups(updatedGroups);
    setDraggedPupilId(null);
    setDragSourceGroupId(null);
  };

  // Remove pupil from a specific group
  const handleRemovePupilFromGroup = (groupId: string, pupilId: string) => {
    const updatedGroups = interventionGroups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          pupilIds: group.pupilIds.filter((id) => id !== pupilId),
        };
      }
      return group;
    });
    setCustomGroups(updatedGroups);
  };

  // Remove entire intervention group
  const handleRemoveGroup = (groupId: string) => {
    const updatedGroups = interventionGroups.filter((g) => g.id !== groupId);
    setCustomGroups(updatedGroups);
  };

  // Add custom intervention group
  const handleAddCustomGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: InterventionGroup = {
      id: `group-custom-${Date.now()}`,
      name: newGroupName.trim(),
      skillOrFocus: newGroupSkill.trim() || 'General Revision',
      strategy:
        newGroupStrategy.trim() || 'Small group targeted guided practice.',
      pupilIds: [],
    };
    setCustomGroups([...interventionGroups, newGroup]);
    setNewGroupName('');
    setNewGroupSkill('');
    setNewGroupStrategy('');
    setShowAddGroupModal(false);
  };

  // Filtered pupils list for the pupil cards section
  const filteredPupils = useMemo(() => {
    return pupils.filter((p) => {
      const analysis = pupilAnalyses.get(p.id);

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesNotes = p.teacherNotes?.toLowerCase().includes(q);
        const matchesSend = p.sendArea?.toLowerCase().includes(q);
        if (!matchesName && !matchesNotes && !matchesSend) return false;
      }

      // Tab filter
      if (pupilFilter === 'flagged') {
        return analysis?.isFlagged;
      }
      if (pupilFilter === 'belowTarget') {
        return analysis?.isBelowTarget;
      }
      if (pupilFilter === 'send') {
        return Boolean(p.sendArea);
      }
      return true;
    });
  }, [pupils, pupilAnalyses, pupilFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#1C2421] flex flex-col font-sans">
      {/* Top Header / Brand Bar (Hidden during print) */}
      <header className="bg-white border-b border-[#B8BABB] sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded bg-[#3A5D33] flex items-center justify-center text-white font-bold font-heading text-lg shadow-sm">
                ES
              </div>
              <div>
                <h1 className="text-lg font-bold font-heading text-[#1C2421] leading-tight">
                  Teacher Intervention Planner
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  Year 11 GCSE Spanish &bull; In-Memory Session
                </p>
              </div>
            </div>

            {/* Quick Status Pill & Thresholds Toggle */}
            <div className="flex items-center space-x-3">
              {pupils.length > 0 ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#E9EFE9] text-[#3A5D33] border border-[#3A5D33]/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  {pupils.length} Pupils Loaded
                </span>
              ) : (
                <button
                  onClick={handleLoadSampleData}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors shadow-sm flex items-center"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Data
                </button>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors flex items-center shadow-xs ${
                  showSettings
                    ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50'
                    : 'border-[#B8BABB] hover:border-[#3A5D33] text-gray-700 hover:text-[#3A5D33] bg-white'
                }`}
                title="Settings: Edit rule thresholds"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5 text-[#3A5D33]" />
                Settings
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-4 border-t border-gray-100 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              1. Dashboard
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'upload'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              2. Upload
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              3. Class Overview
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'planner'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              4. Intervention Planner
            </button>

            <button
              onClick={() => setActiveTab('seating')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'seating'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              5. Seating Plan
            </button>

            <button
              onClick={() => setActiveTab('print')}
              className={`px-3 py-2 text-sm font-semibold rounded-t flex items-center whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'print'
                  ? 'border-[#3A5D33] text-[#3A5D33] bg-green-50/50'
                  : 'border-transparent text-gray-600 hover:text-[#1C2421] hover:border-gray-300'
              }`}
            >
              <Printer className="w-4 h-4 mr-2" />
              6. Print / Export
            </button>
          </nav>
        </div>
      </header>

      {/* Thresholds Settings Drawer / Modal (Hidden during print) */}
      {showSettings && (
        <div className="bg-white border-b border-[#B8BABB] shadow-md px-4 py-3 max-w-7xl mx-auto w-full no-print">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-[#3A5D33]" />
              <div>
                <h3 className="text-xs font-bold font-heading text-[#1C2421]">
                  Rules Engine Threshold Settings
                </h3>
                <p className="text-[11px] text-gray-500">
                  Configure weak skill percentage, whole class trigger percentage, and minimum group size.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* 1. Weak Skill Percentage */}
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <label className="block font-bold text-gray-800 mb-1">
                Weak Skill Percentage (%)
              </label>
              <input
                type="number"
                min="10"
                max="90"
                value={thresholds.weakSkillMaxScore}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    weakSkillMaxScore: Number(e.target.value) || 50,
                  })
                }
                className="w-full px-2.5 py-1 border border-[#B8BABB] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33] font-semibold"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Scores below {thresholds.weakSkillMaxScore}% are marked as skill gaps.
              </span>
            </div>

            {/* 2. Whole Class Percentage */}
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <label className="block font-bold text-gray-800 mb-1">
                Whole Class Percentage (%)
              </label>
              <input
                type="number"
                min="20"
                max="80"
                value={thresholds.wholeClassPriorityWeakPct}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    wholeClassPriorityWeakPct: Number(e.target.value) || 40,
                  })
                }
                className="w-full px-2.5 py-1 border border-[#B8BABB] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33] font-semibold"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Topics with &ge;{thresholds.wholeClassPriorityWeakPct}% weak become class priorities.
              </span>
            </div>

            {/* 3. Group Size */}
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <label className="block font-bold text-gray-800 mb-1">
                Group Size (Min Pupils)
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={thresholds.groupInterventionMinPupils}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    groupInterventionMinPupils: Number(e.target.value) || 3,
                  })
                }
                className="w-full px-2.5 py-1 border border-[#B8BABB] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33] font-semibold"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                &ge;{thresholds.groupInterventionMinPupils} pupils sharing a gap creates an intervention cohort.
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => {
                setShowSettings(false);
                handleRegeneratePlan();
              }}
              className="px-3 py-1 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943]"
            >
              Apply Thresholds
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {/* ============================================================== */}
        {/* SCREEN 1: DASHBOARD */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="card-top-stripe p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="badge-green text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Secondary Modern Foreign Languages
                  </span>
                  <h2 className="text-2xl font-bold font-heading text-[#1C2421] mt-2">
                    Year 11 Spanish (GCSE 2026 Cohort)
                  </h2>
                  <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                    Deterministic intervention and progress tracking. In-memory browser execution with zero server transmission.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLoadSampleData}
                    className="px-4 py-2 text-sm font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors shadow-sm flex items-center"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Load Sample Data (28 Pupils)
                  </button>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 text-sm font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                  >
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload My Files
                  </button>
                </div>
              </div>

              {/* Status summary if data loaded */}
              {pupils.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div className="bg-[#F3F4F6] p-4 rounded-lg border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Enrolled Pupils
                    </p>
                    <p className="text-2xl font-bold font-heading text-[#1C2421] mt-1">
                      {metrics.totalPupils}
                    </p>
                    <span className="text-xs text-gray-600">Active class size</span>
                  </div>

                  <div className="bg-[#F3F4F6] p-4 rounded-lg border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Below Target
                    </p>
                    <p className="text-2xl font-bold font-heading text-[#D97706] mt-1">
                      {metrics.belowTargetCount}
                    </p>
                    <span className="text-xs text-amber-700 font-medium">
                      &ge;1 grade below target
                    </span>
                  </div>

                  <div className="bg-[#F3F4F6] p-4 rounded-lg border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Flagged For Review
                    </p>
                    <p className="text-2xl font-bold font-heading text-[#D97706] mt-1">
                      {metrics.flaggedCount}
                    </p>
                    <span className="text-xs text-gray-600">Urgent action required</span>
                  </div>

                  <div className="bg-[#F3F4F6] p-4 rounded-lg border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      SEND Support
                    </p>
                    <p className="text-2xl font-bold font-heading text-[#3A5D33] mt-1">
                      {metrics.sendCount}
                    </p>
                    <span className="text-xs text-[#3A5D33] font-medium">
                      Tailored strategies mapped
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Upload files or load sample data to begin.
                  </p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Click <strong>&quot;Load Sample Data&quot;</strong> to inspect the ready-made Year 11 Spanish dataset, or proceed to <strong>Upload</strong> to import your class spreadsheets.
                  </p>
                </div>
              )}
            </div>

            {/* Quick overview of flow */}
            <div className="planner-card p-6">
              <h3 className="text-base font-bold font-heading text-[#1C2421] mb-3">
                Teacher Intervention Workflow
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-white rounded border border-gray-200">
                  <span className="text-xs font-bold text-[#3A5D33]">STEP 1</span>
                  <h4 className="font-heading font-semibold text-sm mt-1">Upload</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts Class List, SEND info, Snapshot &amp; QLA (.xlsx / .csv).
                  </p>
                </div>
                <div className="p-3 bg-white rounded border border-gray-200">
                  <span className="text-xs font-bold text-[#3A5D33]">STEP 2</span>
                  <h4 className="font-heading font-semibold text-sm mt-1">Analyse</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Deterministic rules evaluate gaps, drops, and SEND areas.
                  </p>
                </div>
                <div className="p-3 bg-white rounded border border-gray-200">
                  <span className="text-xs font-bold text-[#3A5D33]">STEP 3</span>
                  <h4 className="font-heading font-semibold text-sm mt-1">Plan</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Class priorities, intervention columns, and flagged cards.
                  </p>
                </div>
                <div className="p-3 bg-white rounded border border-gray-200">
                  <span className="text-xs font-bold text-[#3A5D33]">STEP 4</span>
                  <h4 className="font-heading font-semibold text-sm mt-1">Edit</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Drag pupils between groups, add custom priorities &amp; notes.
                  </p>
                </div>
                <div className="p-3 bg-white rounded border border-gray-200">
                  <span className="text-xs font-bold text-[#3A5D33]">STEP 5</span>
                  <h4 className="font-heading font-semibold text-sm mt-1">Print</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Export high-clarity printable sheets for meetings &amp; files.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 2: UPLOAD */}
        {/* ============================================================== */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-heading text-[#1C2421]">
                  Upload Class Spreadsheets
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Upload up to four files (.xlsx or .csv). Column headers are automatically recognized using fuzzy matching. Pupils are matched by normalized full name.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleLoadSampleData}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Files (28 Pupils)
                </button>
              </div>
            </div>

            {uploadFeedback && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-center justify-between">
                <span>{uploadFeedback}</span>
                <button
                  onClick={() => setUploadFeedback(null)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Privacy Note */}
            <div className="p-3 bg-[#E9EFE9] border border-[#3A5D33]/30 rounded-lg flex items-center space-x-2.5 text-xs text-[#1C2421] shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#3A5D33] shrink-0" />
              <span className="font-semibold">
                Files are processed in your browser. Nothing is uploaded or stored.
              </span>
            </div>

            {/* 4 Upload Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Class List */}
              <div className="card-top-stripe p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-bold text-sm text-[#1C2421] flex items-center">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-[#3A5D33]" />
                      1. Class List
                    </h3>
                    {uploadedFiles.classList ? (
                      <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center">
                        <Check className="w-3 h-3 mr-1" /> Ready
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Required</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Pupil names, current working grades, and GCSE target grades.
                  </p>
                  <div className="border border-dashed border-[#B8BABB] rounded-lg p-4 text-center hover:border-[#3A5D33] bg-gray-50/50 transition-colors">
                    <input
                      type="file"
                      id="upload-class-list"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile('classList', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="upload-class-list"
                      className="cursor-pointer flex flex-col items-center justify-center"
                    >
                      <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-semibold text-[#3A5D33]">
                        Select or Drop .xlsx / .csv
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Detects name, pupil, target, expected, current, forename, surname
                      </span>
                    </label>
                  </div>

                  {/* Immediate Feedback, Detected Columns (per field with Change), and Preview */}
                  {renderBoxFeedback('classList')}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleDownloadSampleCsv('classList')}
                    className="text-[11px] text-gray-600 hover:text-[#3A5D33] flex items-center"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                  </button>
                </div>
              </div>

              {/* Box 2: SEND Information */}
              <div
                className={`card-top-stripe p-5 flex flex-col justify-between transition-all ${
                  sendReviewState ? 'md:col-span-2 ring-2 ring-[#3A5D33]/30 shadow-md' : ''
                }`}
              >
                {sendReviewState ? (
                  <div className="space-y-4">
                    {/* Review Step Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="badge-amber text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                            Review &bull; Step 2 of 2
                          </span>
                          <h3 className="font-heading font-bold text-base text-[#1C2421]">
                            Review SEND Information ({sendReviewState.file.name})
                          </h3>
                        </div>
                        <p className="text-xs font-semibold text-[#3A5D33] mt-1">
                          Found SEND information for {sendReviewState.records.length} of {sendReviewState.totalPupils} pupils.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelSendReview}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                        >
                          Cancel / Re-upload
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmSendReview}
                          className="px-4 py-1.5 text-xs font-bold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Confirm and use
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      Check each extracted pupil need and accommodation strategy below before applying. The plan only uses confirmed data.
                    </p>

                    {/* Editable Table */}
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#E9EFE9] text-[#1C2421] font-heading font-bold">
                          <tr>
                            <th className="p-2.5 w-1/4 border-b border-gray-200">Pupil</th>
                            <th className="p-2.5 w-1/4 border-b border-gray-200">Area of Need</th>
                            <th className="p-2.5 w-5/12 border-b border-gray-200">Strategy Text</th>
                            <th className="p-2.5 w-1/12 text-center border-b border-gray-200">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {sendReviewState.records.map((record, idx) => {
                            const pupilOptions =
                              fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0
                                ? fileCacheRef.current.classList.map((p) => p.name)
                                : pupils.length > 0
                                ? pupils.map((p) => p.name)
                                : SAMPLE_TEST_PUPILS.map((p) => p.name);

                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-2.5 align-top">
                                  <select
                                    value={record.pupilName}
                                    onChange={(e) =>
                                      handleUpdateSendReviewRecord(idx, 'pupilName', e.target.value)
                                    }
                                    className="w-full p-1.5 border border-gray-300 rounded text-xs font-semibold text-[#1C2421] bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                                  >
                                    {pupilOptions.map((name) => (
                                      <option key={name} value={name}>
                                        {name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2.5 align-top">
                                  <select
                                    value={record.sendArea}
                                    onChange={(e) =>
                                      handleUpdateSendReviewRecord(idx, 'sendArea', e.target.value)
                                    }
                                    className="w-full p-1.5 border border-gray-300 rounded text-xs font-semibold text-[#3A5D33] bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                                  >
                                    {STANDARD_SEND_AREAS.map((area) => (
                                      <option key={area} value={area}>
                                        {area}
                                      </option>
                                    ))}
                                    {!STANDARD_SEND_AREAS.includes(record.sendArea) && (
                                      <option value={record.sendArea}>{record.sendArea}</option>
                                    )}
                                  </select>
                                </td>
                                <td className="p-2.5 align-top">
                                  <div className="space-y-1">
                                    <textarea
                                      value={record.sendStrategy}
                                      maxLength={600}
                                      rows={2}
                                      onChange={(e) =>
                                        handleUpdateSendReviewRecord(idx, 'sendStrategy', e.target.value)
                                      }
                                      placeholder="Enter or edit classroom accommodation strategy (up to 600 chars)..."
                                      className="w-full p-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                                    />
                                    <div className="text-[10px] text-gray-400 text-right">
                                      {record.sendStrategy.length} / 600 chars
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2.5 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSendReviewRecord(idx)}
                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                    title="Remove pupil from SEND list"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {sendReviewState.records.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-xs text-gray-500 italic">
                                No pupils in the review list. Use &quot;Add pupil&quot; below to add records.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Add Pupil Row */}
                    {(() => {
                      const allPupils =
                        fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0
                          ? fileCacheRef.current.classList.map((p) => p.name)
                          : pupils.length > 0
                          ? pupils.map((p) => p.name)
                          : SAMPLE_TEST_PUPILS.map((p) => p.name);
                      const unassigned = allPupils.filter(
                        (name) =>
                          !sendReviewState.records.some((r) => r.pupilName === name)
                      );

                      return (
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-xs font-semibold text-gray-700">Add pupil:</span>
                          <select
                            value={selectedAddPupilName}
                            onChange={(e) => setSelectedAddPupilName(e.target.value)}
                            className="p-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                          >
                            <option value="">Select a class pupil to add...</option>
                            {unassigned.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddSendReviewPupil(selectedAddPupilName)}
                            disabled={!selectedAddPupilName}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] disabled:opacity-40 disabled:cursor-not-allowed flex items-center shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Pupil
                          </button>
                        </div>
                      );
                    })()}

                    {/* Unmatched Text Collapsible Section */}
                    {sendReviewState.unmatchedText ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowUnmatchedText(!showUnmatchedText)}
                          className="w-full px-3 py-2 bg-gray-50 text-xs font-medium text-gray-700 flex items-center justify-between hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center">
                            <span className="font-semibold text-gray-800 mr-1.5">Unmatched text</span>
                            <span className="text-[11px] text-gray-500">
                              (Text in document not linked to a pupil anchor)
                            </span>
                          </span>
                          <span className="text-gray-400">
                            {showUnmatchedText ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </span>
                        </button>
                        {showUnmatchedText && (
                          <div className="p-3 bg-white text-xs font-mono text-gray-700 border-t border-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                            {sendReviewState.unmatchedText}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Bottom Actions Bar */}
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelSendReview}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmSendReview}
                        className="px-4 py-1.5 text-xs font-bold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        Confirm and use
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-sm text-[#1C2421] flex items-center">
                          <FileSpreadsheet className="w-4 h-4 mr-2 text-[#3A5D33]" />
                          2. SEND Information
                        </h3>
                        {uploadedFiles.sendInfo ? (
                          <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center">
                            <Check className="w-3 h-3 mr-1" /> Ready
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Optional</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Area of need (SLCN, ASD, Dyslexia, SEMH, ADHD, etc.) &amp; strategies. Accepts .pdf, .docx, .xlsx, .xls and .csv.
                      </p>
                      <div className="border border-dashed border-[#B8BABB] rounded-lg p-4 text-center hover:border-[#3A5D33] bg-gray-50/50 transition-colors">
                        <input
                          type="file"
                          id="upload-send-info"
                          accept=".pdf,.docx,.xlsx,.xls,.csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile('sendInfo', file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="upload-send-info"
                          className="cursor-pointer flex flex-col items-center justify-center"
                        >
                          <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                          <span className="text-xs font-semibold text-[#3A5D33]">
                            Select or Drop .pdf, .docx, .xlsx, .xls or .csv
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            Extracts text from PDF/Word or spreadsheet columns
                          </span>
                        </label>
                      </div>

                      {/* Immediate Feedback, Detected Columns (per field with Change), and Preview */}
                      {renderBoxFeedback('sendInfo')}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-500">Test Files:</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={generateSampleSendPdf}
                          className="text-[11px] text-[#3A5D33] hover:underline font-medium flex items-center"
                          title="Generate and download sample SEND PDF"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download sample SEND PDF
                        </button>
                        <button
                          type="button"
                          onClick={generateSampleSendDocx}
                          className="text-[11px] text-[#3A5D33] hover:underline font-medium flex items-center"
                          title="Generate and download sample SEND Word file"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download sample SEND Word file
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSampleCsv('sendInfo')}
                          className="text-[11px] text-gray-600 hover:text-[#3A5D33] flex items-center"
                        >
                          <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Box 3: Assessment Snapshot */}
              <div className="card-top-stripe p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-bold text-sm text-[#1C2421] flex items-center">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-[#3A5D33]" />
                      3. Assessment Snapshot
                    </h3>
                    {uploadedFiles.assessmentSnapshot ? (
                      <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center">
                        <Check className="w-3 h-3 mr-1" /> Ready
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Recommended</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Historical tracker with previous assessment grades to detect drops.
                  </p>
                  <div className="border border-dashed border-[#B8BABB] rounded-lg p-4 text-center hover:border-[#3A5D33] bg-gray-50/50 transition-colors">
                    <input
                      type="file"
                      id="upload-assessment"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile('assessmentSnapshot', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="upload-assessment"
                      className="cursor-pointer flex flex-col items-center justify-center"
                    >
                      <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-semibold text-[#3A5D33]">
                        Select or Drop .xlsx / .csv
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Detects baseline, mock 1, prior grade, current
                      </span>
                    </label>
                  </div>

                  {/* Immediate Feedback, Detected Columns (per field with Change), and Preview */}
                  {renderBoxFeedback('assessmentSnapshot')}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleDownloadSampleCsv('assessmentSnapshot')}
                    className="text-[11px] text-gray-600 hover:text-[#3A5D33] flex items-center"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                  </button>
                </div>
              </div>

              {/* Box 4: QLA */}
              <div className="card-top-stripe p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-bold text-sm text-[#1C2421] flex items-center">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-[#3A5D33]" />
                      4. QLA (Question Level Analysis)
                    </h3>
                    {uploadedFiles.qla ? (
                      <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center">
                        <Check className="w-3 h-3 mr-1" /> Ready
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Required for skills</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Percentage scores across the 8 GCSE Spanish grammar &amp; skill areas.
                  </p>
                  <div className="border border-dashed border-[#B8BABB] rounded-lg p-4 text-center hover:border-[#3A5D33] bg-gray-50/50 transition-colors">
                    <input
                      type="file"
                      id="upload-qla"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile('qla', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="upload-qla"
                      className="cursor-pointer flex flex-col items-center justify-center"
                    >
                      <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-semibold text-[#3A5D33]">
                        Select or Drop .xlsx / .csv
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Detects tenses, vocabulary, reading, translation
                      </span>
                    </label>
                  </div>

                  {/* Immediate Feedback, Detected Columns (per field with Change), and Preview */}
                  {renderBoxFeedback('qla')}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleDownloadSampleCsv('qla')}
                    className="text-[11px] text-gray-600 hover:text-[#3A5D33] flex items-center"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Warning list if unmatched pupils exist */}
            {unmatchedWarnings.length > 0 && (
              <div className="planner-card p-4 border-amber-300 bg-amber-50/50">
                <div className="flex items-center space-x-2 text-amber-800 font-semibold text-xs mb-2">
                  <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                  <span>Unmatched Pupil Warnings ({unmatchedWarnings.length})</span>
                </div>
                <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5">
                  {unmatchedWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 border-t border-gray-200">
              <div className="text-xs">
                {uploadedFiles.classList && fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0 ? (
                  <span className="text-[#3A5D33] font-semibold flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
                    Class List loaded ({fileCacheRef.current.classList.length} pupils). Other files are optional &mdash; defaults will be used if omitted.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600 shrink-0" />
                    Please upload at least a Class List before generating an intervention plan.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleGeneratePlanFromUploads}
                disabled={!(uploadedFiles.classList && fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0)}
                className={`px-6 py-2.5 text-sm font-semibold rounded transition-colors shadow-sm flex items-center justify-center shrink-0 ${
                  uploadedFiles.classList && fileCacheRef.current.classList && fileCacheRef.current.classList.length > 0
                    ? 'bg-[#3A5D33] text-white hover:bg-[#4C7943] cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Generate Plan
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 3: CLASS OVERVIEW */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          pupils.length === 0 ? (
            <div className="card-top-stripe p-8 text-center max-w-lg mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#E9EFE9] flex items-center justify-center text-[#3A5D33]">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1C2421]">
                Class Overview Unavailable
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Upload files or load sample data to begin.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={handleLoadSampleData}
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Data
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Go to Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading text-[#1C2421]">
                    Class Overview &bull; Year 11 Spanish
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    High-level cohort diagnostics and top whole-class curricular priorities.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('planner')}
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors shadow-sm flex items-center self-start"
                >
                  Go to Intervention Planner
                  <MoveRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>

              {/* 4 Metric Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-top-stripe p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Total Pupils
                  </span>
                  <p className="text-3xl font-bold font-heading text-[#1C2421] mt-1">
                    {metrics.totalPupils}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">GCSE Class Roster</p>
                </div>

                <div className="card-top-stripe-amber p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#D97706]">
                    Below Target Grade
                  </span>
                  <p className="text-3xl font-bold font-heading text-[#D97706] mt-1">
                    {metrics.belowTargetCount}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {metrics.totalPupils > 0
                      ? Math.round((metrics.belowTargetCount / metrics.totalPupils) * 100)
                      : 0}
                    % of the cohort
                  </p>
                </div>

                <div className="card-top-stripe p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    SEND Support
                  </span>
                  <p className="text-3xl font-bold font-heading text-[#3A5D33] mt-1">
                    {metrics.sendCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Specific access needs</p>
                </div>

                <div className="card-top-stripe-amber p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#D97706]">
                    Flagged For Review
                  </span>
                  <p className="text-3xl font-bold font-heading text-[#D97706] mt-1">
                    {metrics.flaggedCount}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Multiple gaps or grade drop
                  </p>
                </div>
              </div>

              {/* Top 3 Whole Class Priorities */}
              <div className="planner-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold font-heading text-[#1C2421]">
                      Top 3 Whole Class Priorities
                    </h3>
                    <p className="text-xs text-gray-500">
                      Determined where &ge;{thresholds.wholeClassPriorityWeakPct}% of pupils fall below threshold.
                    </p>
                  </div>
                  <span className="badge-amber text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase">
                    Classwide Gaps
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {priorities.slice(0, 3).map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-[#B8BABB] bg-white relative flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#3A5D33] uppercase">
                            Priority #{idx + 1}
                          </span>
                          <span className="badge-amber text-xs font-bold px-2 py-0.5 rounded-full">
                            {item.weakPct}% Weak
                          </span>
                        </div>
                        <h4 className="font-heading font-bold text-sm text-[#1C2421] mt-2">
                          {item.topic}
                        </h4>
                        <p className="text-xs text-gray-600 mt-2 italic bg-[#F3F4F6] p-2.5 rounded">
                          &quot;{item.suggestedStrategy}&quot;
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
                        <span>{item.weakCount} pupils affected</span>
                        <span>Class average: {item.classAvg}%</span>
                      </div>
                    </div>
                  ))}

                  {priorities.length === 0 && (
                    <div className="col-span-3 text-center py-6 text-xs text-gray-500">
                      No whole-class priorities detected at current threshold ({thresholds.wholeClassPriorityWeakPct}%).
                    </div>
                  )}
                </div>
              </div>

              {/* QLA Class Averages Skill Breakdown */}
              <div className="planner-card p-6">
                <h3 className="text-base font-bold font-heading text-[#1C2421] mb-4">
                  Classwide QLA Averages by Skill
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {SKILL_NAMES.map((skill) => {
                    const avg = classAverages[skill] ?? 0;
                    const isWeak = avg < thresholds.weakSkillMaxScore;
                    return (
                      <div
                        key={skill}
                        className="p-3 rounded border border-gray-200 bg-white"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-gray-700 truncate pr-2">
                            {skill}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              isWeak ? 'text-[#D97706]' : 'text-[#3A5D33]'
                            }`}
                          >
                            {avg}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              isWeak ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, avg))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

        {/* ============================================================== */}
        {/* SCREEN 4: INTERVENTION PLANNER (MAIN SCREEN) */}
        {/* ============================================================== */}
        {activeTab === 'planner' && (
          pupils.length === 0 ? (
            <div className="card-top-stripe p-8 text-center max-w-lg mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#E9EFE9] flex items-center justify-center text-[#3A5D33]">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1C2421]">
                No Intervention Plan Generated
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Upload files or load sample data to begin.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={handleLoadSampleData}
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Data
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Go to Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold font-heading text-[#1C2421]">
                    Intervention Planner &bull; Year {yearGroup} Spanish
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Answers four key pedagogical questions: Who needs help? What do they need help with? What should I do? How will I organise it?
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Small Year group override dropdown ("Year group: 7 to 11") */}
                  <div className="flex items-center space-x-1.5 bg-white border border-[#B8BABB] rounded px-2.5 py-1 text-xs shadow-xs" title="Year group: 7 to 11">
                    <span className="font-semibold text-gray-700 whitespace-nowrap">Year group: 7 to 11</span>
                    <select
                      value={yearGroup}
                      onChange={(e) => setYearGroup(Number(e.target.value) as YearGroupNumber)}
                      className="bg-transparent font-bold text-[#3A5D33] focus:outline-none cursor-pointer border-l border-gray-200 pl-1.5 ml-1"
                      aria-label="Year group: 7 to 11"
                    >
                      <option value={7}>Year 7</option>
                      <option value={8}>Year 8</option>
                      <option value={9}>Year 9</option>
                      <option value={10}>Year 10</option>
                      <option value={11}>Year 11</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExportPlanHtml}
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center shadow-xs"
                    title="Download clean printable HTML action plan"
                  >
                    <FileDown className="w-3.5 h-3.5 mr-1.5" />
                    Export Plan
                  </button>
                  <button
                    onClick={handleRegeneratePlan}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-[#B8BABB] hover:border-[#3A5D33] text-gray-700 hover:text-[#3A5D33] bg-white transition-colors flex items-center"
                    title="Reset modifications and re-evaluate deterministic rules"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Reset to Rules
                  </button>
                  <button
                    onClick={() => setActiveTab('print')}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    Print Plan
                  </button>
                </div>
              </div>

              {/* SECTION A: WHOLE CLASS PRIORITIES (What should I do?) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="badge-green text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                        Section A
                      </span>
                      <h3 className="text-base font-bold font-heading text-[#1C2421]">
                        Whole Class Priorities
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Curriculum topics where &ge;{thresholds.wholeClassPriorityWeakPct}% of pupils are weak. Teacher can Accept, Edit, Remove, or Add.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddPriorityModal(true)}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Priority
                  </button>
                </div>

                {/* Priority Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {priorities.map((item) => {
                    const isEditing = editingPriorityId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`card-top-stripe p-4 flex flex-col justify-between ${
                          !item.accepted ? 'opacity-60 bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="badge-amber text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                {item.weakPct}% of Class Weak
                              </span>
                              <h4 className="font-heading font-bold text-sm text-[#1C2421] mt-1.5">
                                {item.topic}
                              </h4>
                            </div>

                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  if (isEditing) {
                                    handleSaveEditedPriority(item.id);
                                  } else {
                                    setEditingPriorityId(item.id);
                                    setEditedPriorityStrategy(item.suggestedStrategy);
                                  }
                                }}
                                className="text-gray-400 hover:text-[#3A5D33] p-1 rounded"
                                title={isEditing ? 'Save edits' : 'Edit strategy'}
                              >
                                {isEditing ? (
                                  <Check className="w-3.5 h-3.5 text-[#3A5D33]" />
                                ) : (
                                  <Edit3 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleRemovePriority(item.id)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded"
                                title="Remove priority"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">
                              Suggested Strategy
                            </label>
                            {isEditing ? (
                              <textarea
                                value={editedPriorityStrategy}
                                onChange={(e) => setEditedPriorityStrategy(e.target.value)}
                                rows={3}
                                className="w-full text-xs p-2 border border-[#3A5D33] rounded focus:outline-none"
                              />
                            ) : (
                              <p className="text-xs text-gray-700 bg-[#F3F4F6] p-2.5 rounded border border-gray-200">
                                {item.suggestedStrategy}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500">
                            {item.weakCount} pupils affected
                          </span>
                          <button
                            onClick={() => handleToggleAcceptPriority(item.id)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                              item.accepted
                                ? 'bg-[#3A5D33] text-white hover:bg-[#4C7943]'
                                : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {item.accepted ? 'Accepted' : 'Mark Accept'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {priorities.length === 0 && (
                    <div className="col-span-full planner-card p-6 text-center text-xs text-gray-500">
                      No whole-class priorities currently set. Click &quot;Add Priority&quot; to define a custom whole class focus.
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION B: INTERVENTION GROUPS (How will I organise it?) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="badge-green text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                        Section B
                      </span>
                      <h3 className="text-base font-bold font-heading text-[#1C2421]">
                        Intervention Groups
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Columns of pupils grouped by shared gap (&ge;{thresholds.groupInterventionMinPupils} pupils with common need). Drag pupils between groups or remove them.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddGroupModal(true)}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Intervention Group
                  </button>
                </div>

                {/* Group Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 items-start">
                  {interventionGroups.map((group) => {
                    return (
                      <div
                        key={group.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const pId = e.dataTransfer.getData('text/plain') || draggedPupilId;
                          const sId = e.dataTransfer.getData('sourceGroupId') || dragSourceGroupId;
                          if (pId) {
                            handleDropPupil(pId, group.id, sId);
                          }
                        }}
                        className="planner-card p-3.5 bg-white flex flex-col min-h-[260px] max-h-[460px] shadow-xs hover:border-[#3A5D33] transition-colors"
                      >
                        {/* Column Header */}
                        <div className="flex items-start justify-between pb-2 mb-2 border-b border-gray-200">
                          <div>
                            <span className="text-[10px] font-bold text-[#3A5D33] uppercase">
                              Focus: {group.skillOrFocus}
                            </span>
                            <h4 className="font-heading font-bold text-sm text-[#1C2421] leading-tight mt-0.5">
                              {group.name}
                            </h4>
                            <span className="text-[11px] text-gray-500">
                              {group.pupilIds.length} pupils assigned
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveGroup(group.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Remove group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Strategy note */}
                        <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 mb-2.5 italic">
                          {group.strategy}
                        </p>

                        {/* Drop Zone / Pupil Pills */}
                        <div className="flex-1 space-y-1.5 min-h-[90px] overflow-y-auto border border-dashed border-gray-200 p-1.5 rounded bg-gray-50/40">
                          {group.pupilIds.map((pId) => {
                            const pupil = pupils.find((p) => p.id === pId);
                            if (!pupil) return null;
                            const analysis = pupilAnalyses.get(pId);
                            const isFlagged = analysis?.isFlagged;

                            return (
                              <div
                                key={pId}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedPupilId(pId);
                                  setDragSourceGroupId(group.id);
                                  e.dataTransfer.setData('text/plain', pId);
                                  e.dataTransfer.setData('sourceGroupId', group.id);
                                }}
                                className="p-2 bg-white rounded border border-[#B8BABB] shadow-xs cursor-move hover:border-[#3A5D33] transition-colors flex items-center justify-between"
                              >
                                <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                                  {isFlagged && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-[#D97706] shrink-0"
                                      title="Flagged pupil"
                                    />
                                  )}
                                  <span className="text-xs font-semibold text-[#1C2421] break-words">
                                    {pupil.name}
                                  </span>
                                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded shrink-0">
                                    G{pupil.currentGrade} &rarr; G{pupil.targetGrade}
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleRemovePupilFromGroup(group.id, pId)}
                                  className="text-gray-400 hover:text-red-500 p-0.5 ml-1"
                                  title="Remove from this group"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}

                          {group.pupilIds.length === 0 && (
                            <div className="h-full flex items-center justify-center p-3 text-center text-[11px] text-gray-400">
                              Drag pupils here or assign from below
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION C & D: PUPIL CARDS & INLINE EDITING */}
              <section className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="badge-green text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                        Section C &amp; D
                      </span>
                      <h3 className="text-base font-bold font-heading text-[#1C2421]">
                        Pupil Intervention Cards
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Individual pupil breakdown with plain English &quot;Why flagged?&quot; rules reasoning, SEND accommodations, and inline editable teacher notes.
                    </p>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search pupil name or notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border border-[#B8BABB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                      />
                    </div>

                    <div className="flex rounded border border-[#B8BABB] overflow-hidden bg-white text-xs">
                      <button
                        onClick={() => setPupilFilter('all')}
                        className={`px-2.5 py-1 font-medium ${
                          pupilFilter === 'all'
                            ? 'bg-[#3A5D33] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        All ({pupils.length})
                      </button>
                      <button
                        onClick={() => setPupilFilter('flagged')}
                        className={`px-2.5 py-1 font-medium ${
                          pupilFilter === 'flagged'
                            ? 'bg-[#3A5D33] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Flagged ({metrics.flaggedCount})
                      </button>
                      <button
                        onClick={() => setPupilFilter('belowTarget')}
                        className={`px-2.5 py-1 font-medium ${
                          pupilFilter === 'belowTarget'
                            ? 'bg-[#3A5D33] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Below Target ({metrics.belowTargetCount})
                      </button>
                      <button
                        onClick={() => setPupilFilter('send')}
                        className={`px-2.5 py-1 font-medium ${
                          pupilFilter === 'send'
                            ? 'bg-[#3A5D33] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        SEND ({metrics.sendCount})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pupil Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {filteredPupils.map((pupil) => {
                    const analysis = pupilAnalyses.get(pupil.id);
                    const isFlagged = analysis?.isFlagged;
                    const isBelow = analysis?.isBelowTarget;
                    const isWhyFlaggedOpen =
                      expandedFlagInfo[pupil.id] !== undefined
                        ? expandedFlagInfo[pupil.id]
                        : Boolean(isFlagged);

                    return (
                      <div
                        key={pupil.id}
                        className={`p-4 rounded-lg border bg-white flex flex-col justify-between ${
                          isFlagged
                            ? 'border-t-4 border-t-[#D97706] border-x-[#B8BABB] border-b-[#B8BABB]'
                            : 'border-t-4 border-t-[#3A5D33] border-x-[#B8BABB] border-b-[#B8BABB]'
                        }`}
                      >
                        <div>
                          {/* Header: Name, Grades, Badges */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-heading font-bold text-sm text-[#1C2421]">
                                  {pupil.name}
                                </h4>
                                {pupil.sendArea && (
                                  <span className="badge-green text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    SEND: {pupil.sendArea}
                                  </span>
                                )}
                                {isFlagged && (
                                  <span className="badge-amber text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    Flagged
                                  </span>
                                )}
                              </div>

                              {/* Progress & Target Indicator */}
                              <div className="flex items-center space-x-2.5 mt-1 text-xs">
                                <span className="font-semibold text-gray-700">
                                  Current:{' '}
                                  <span className="text-[#1C2421] font-bold text-xs">
                                    Grade {pupil.currentGrade}
                                  </span>
                                </span>
                                <span className="text-gray-300">&bull;</span>
                                <span className="font-semibold text-gray-700">
                                  Target:{' '}
                                  <span className="text-[#3A5D33] font-bold text-xs">
                                    Grade {pupil.targetGrade}
                                  </span>
                                </span>
                                <span className="text-gray-300">&bull;</span>
                                <span className="text-gray-500">
                                  Prior: Grade {pupil.previousGrade}
                                </span>

                                {/* Progress Pill */}
                                {isBelow ? (
                                  <span className="text-[10px] font-semibold text-[#D97706] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    -{analysis?.gradeGap} Below Target
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-[#3A5D33] bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                    On Track
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Plain English "Why Flagged?" Expandable Line for Every Pupil Card */}
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => toggleFlagExpanded(pupil.id)}
                              className={`w-full p-2 rounded text-xs flex items-center justify-between border transition-colors ${
                                isFlagged
                                  ? 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/70'
                                  : 'bg-green-50/80 border-green-200 text-[#3A5D33] hover:bg-green-100/70'
                              }`}
                            >
                              <span className="font-bold flex items-center">
                                {isFlagged ? (
                                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-[#D97706] shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#3A5D33] shrink-0" />
                                )}
                                <span>Why flagged?</span>
                                <span className="ml-1 text-[11px] font-medium opacity-85">
                                  {isFlagged
                                    ? `(${analysis?.flagReasons.length || 1} alert${(analysis?.flagReasons.length || 1) > 1 ? 's' : ''})`
                                    : '(On track — no flags)'}
                                </span>
                              </span>
                              <span className="text-gray-400">
                                {isWhyFlaggedOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </button>

                            {isWhyFlaggedOpen && (
                              <div
                                className={`p-2.5 rounded-b border-x border-b text-xs ${
                                  isFlagged
                                    ? 'bg-amber-50/40 border-amber-200 text-amber-950'
                                    : 'bg-green-50/40 border-green-200 text-gray-700'
                                }`}
                              >
                                {isFlagged && analysis?.flagReasons ? (
                                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-900">
                                    {analysis.flagReasons.map((reason, idx) => (
                                      <li key={idx}>{reason}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-gray-600">
                                    <li>
                                      Current working grade ({pupil.currentGrade}) is at or above target ({pupil.targetGrade}).
                                    </li>
                                    <li>
                                      Weak skills count is {analysis?.weakSkills.length || 0} (below review threshold of {thresholds.flagPupilWeakSkillsCount}).
                                    </li>
                                    <li>
                                      Assessment progress is stable (Grade {pupil.previousGrade} &rarr; Grade {pupil.currentGrade}).
                                    </li>
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Key Gaps List */}
                          <div className="mt-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                              Identified Skill Gaps
                            </span>
                            {analysis?.weakSkills && analysis.weakSkills.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {analysis.weakSkills.map((gap) => (
                                  <span
                                    key={gap}
                                    className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center"
                                  >
                                    {gap} ({pupil.scores[gap]}%)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500 italic">
                                No critical skill gaps identified (all scores &ge; {thresholds.weakSkillMaxScore}% or near class average).
                              </span>
                            )}
                          </div>

                          {/* SEND Accommodations Note */}
                          {pupil.sendArea && (() => {
                            const libStrategies =
                              SEND_STRATEGIES[pupil.sendArea as keyof typeof SEND_STRATEGIES];
                            return (
                              <div className="mt-3 p-2.5 bg-[#E9EFE9]/50 rounded border border-[#3A5D33]/25 text-xs space-y-1.5">
                                <span className="font-bold text-[#3A5D33] block">
                                  SEND Classroom Accommodation ({pupil.sendArea}):
                                </span>
                                {pupil.sendStrategy && (
                                  <p className="text-gray-800 text-[11px] leading-relaxed font-medium">
                                    {pupil.sendStrategy}
                                  </p>
                                )}
                                {libStrategies && libStrategies.length > 0 && (
                                  <div className={pupil.sendStrategy ? 'pt-1.5 border-t border-[#3A5D33]/15' : ''}>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                                      Department Library Strategies:
                                    </span>
                                    <ul className="list-disc pl-4 text-[10px] text-gray-600 space-y-0.5">
                                      {libStrategies.map((s, idx) => (
                                        <li key={idx}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Suggested Intervention */}
                          {analysis?.suggestedInterventions &&
                            analysis.suggestedInterventions.length > 0 && (
                              <div className="mt-3 text-xs">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                  Suggested Intervention Strategy
                                </span>
                                <div className="space-y-1">
                                  {analysis.suggestedInterventions.map((strat, i) => (
                                    <div
                                      key={i}
                                      className="p-2 bg-gray-50 rounded border border-gray-200 text-gray-800 text-[11px]"
                                    >
                                      {strat}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Teaching Strategy Section */}
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                                Teaching strategy
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setStrategyRosterPupilId(pupil.id);
                                  setRosterSearch('');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-2xs"
                                title={`Open Year ${yearGroup} strategy roster for ${pupil.name}`}
                              >
                                <BookOpen className="w-3.5 h-3.5 mr-1" />
                                Strategy roster
                              </button>
                            </div>

                            {/* Chosen strategies as removable chips */}
                            {pupil.chosenStrategies && pupil.chosenStrategies.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {pupil.chosenStrategies.map((stratId) => {
                                  const strat = findStrategyById(stratId);
                                  if (!strat) return null;
                                  return (
                                    <div
                                      key={stratId}
                                      className="inline-flex items-center gap-1.5 bg-[#E9EFE9] text-gray-900 border border-[#3A5D33]/30 px-2 py-1 rounded text-xs shadow-2xs"
                                    >
                                      <span className="text-[11px] font-medium leading-tight">
                                        {strat.strategy}
                                      </span>
                                      <span className="badge-green text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0">
                                        {strat.technique}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemovePupilStrategy(pupil.id, stratId)
                                        }
                                        className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors ml-0.5"
                                        title="Remove strategy"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 italic mb-1.5">
                                No strategies chosen yet. Click &quot;Strategy roster&quot; to assign Year {yearGroup} interventions.
                              </p>
                            )}

                            {/* Free text box for custom strategy or notes */}
                            <textarea
                              value={pupil.teacherNotes || ''}
                              onChange={(e) =>
                                handleUpdateTeacherNotes(pupil.id, e.target.value)
                              }
                              placeholder="Type custom strategy notes, cues, or pupil observations..."
                              rows={2}
                              className="w-full text-xs p-2 border border-[#B8BABB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                            />
                          </div>
                        </div>

                        {/* Quick Grade Adjuster footer */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-2">
                            <span>Adjust Working Grade:</span>
                            <select
                              value={pupil.currentGrade}
                              onChange={(e) =>
                                handleUpdatePupilGrades(
                                  pupil.id,
                                  Number(e.target.value),
                                  pupil.targetGrade
                                )
                              }
                              className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white font-semibold text-[#1C2421]"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                                <option key={g} value={g}>
                                  Grade {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span>Target:</span>
                            <select
                              value={pupil.targetGrade}
                              onChange={(e) =>
                                handleUpdatePupilGrades(
                                  pupil.id,
                                  pupil.currentGrade,
                                  Number(e.target.value)
                                )
                              }
                              className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white font-semibold text-[#3A5D33]"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                                <option key={g} value={g}>
                                  Grade {g}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredPupils.length === 0 && (
                    <div className="col-span-full planner-card p-8 text-center text-xs text-gray-500">
                      No pupils match the selected filter (&quot;{pupilFilter}&quot; / &quot;{searchQuery}&quot;).
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        )}

        {/* ============================================================== */}
        {/* SCREEN 5: SEATING PLAN */}
        {/* ============================================================== */}
        {activeTab === 'seating' && (
          <SeatingPlan
            pupils={pupils}
            pupilAnalyses={pupilAnalyses}
            interventionGroups={interventionGroups}
            seatingPositions={seatingPositions}
            setSeatingPositions={setSeatingPositions}
            selectedPupilId={selectedPupilIdForSeating}
            setSelectedPupilId={setSelectedPupilIdForSeating}
            showGroupColors={showGroupColorsOnSeating}
            setShowGroupColors={setShowGroupColorsOnSeating}
            onUpdateTeacherNotes={handleUpdateTeacherNotes}
            onLoadSampleData={handleLoadSampleData}
            onGoToUpload={() => setActiveTab('upload')}
            layoutType={seatingLayout}
            setLayoutType={setSeatingLayout}
            customCols={customCols}
            setCustomCols={setCustomCols}
            customRows={customRows}
            setCustomRows={setCustomRows}
          />
        )}

        {/* ============================================================== */}
        {/* SCREEN 6: PRINT OR EXPORT */}
        {/* ============================================================== */}
        {activeTab === 'print' && (
          pupils.length === 0 ? (
            <div className="card-top-stripe p-8 text-center max-w-lg mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#E9EFE9] flex items-center justify-center text-[#3A5D33]">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1C2421]">
                Printable Plan Unavailable
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Upload files or load sample data to begin.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={handleLoadSampleData}
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Data
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors flex items-center"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Go to Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Control Bar (Hidden when printed) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-white p-4 rounded-lg border border-[#B8BABB]">
                <div>
                  <h2 className="text-lg font-bold font-heading text-[#1C2421]">
                    Printable Intervention Plan
                  </h2>
                  <p className="text-xs text-gray-600">
                    Formatted cleanly for Department Meetings, SLT Reviews, and SEND compliance files.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportPlanClick}
                    disabled={isExportingPdf}
                    className="px-4 py-2 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors flex items-center shadow-xs disabled:opacity-60 cursor-pointer"
                    title="Download complete landscape A4 PDF with seating plan"
                  >
                    {isExportingPdf ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4 mr-1.5" />
                    )}
                    {isExportingPdf ? 'Generating PDF...' : 'Export Plan (PDF)'}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 text-xs font-semibold rounded border border-[#3A5D33] text-[#3A5D33] hover:bg-[#3A5D33]/10 transition-colors shadow-xs flex items-center cursor-pointer"
                    title="Print now using clean landscape A4 stylesheet"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print Now (Clean Stylesheet)
                  </button>
                </div>
              </div>

              {/* Error banner if PDF export fails */}
              {pdfExportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between no-print">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>PDF Generation Failed: {pdfExportError}</span>
                  </div>
                  <button
                    onClick={() => setPdfExportError(null)}
                    className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

            {/* Document To Print */}
            <div className="bg-white p-8 rounded-lg border border-[#B8BABB] shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
              {/* Document Header */}
              <div className="border-b-2 border-[#3A5D33] pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-[#3A5D33] uppercase tracking-wider">
                      Department of Modern Foreign Languages
                    </span>
                    <h1 className="text-2xl font-bold font-heading text-[#1C2421] mt-1">
                      GCSE Spanish &bull; Year 11 Intervention Action Plan
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Deterministic Rules-Based Analysis &bull; Confidential Pupil Progress Document
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p className="font-semibold text-gray-700">Class: 11A/Sp1</p>
                    <p>Total Pupils: {metrics.totalPupils}</p>
                    <p>Flagged for Review: {metrics.flaggedCount}</p>
                  </div>
                </div>
              </div>

              {/* 1. Whole Class Focus */}
              <div>
                <h3 className="text-sm font-bold font-heading text-[#1C2421] uppercase tracking-wider mb-2">
                  1. Curricular Priorities (Whole-Class Reteach)
                </h3>
                <table className="w-full text-xs text-left border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="p-2 border border-gray-300">Topic</th>
                      <th className="p-2 border border-gray-300 w-24">% Class Weak</th>
                      <th className="p-2 border border-gray-300">Agreed Classroom Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorities
                      .filter((p) => p.accepted)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 border border-gray-300 font-semibold">
                            {p.topic}
                          </td>
                          <td className="p-2 border border-gray-300 font-bold text-[#D97706]">
                            {p.weakPct}%
                          </td>
                          <td className="p-2 border border-gray-300 text-gray-700">
                            {p.suggestedStrategy}
                          </td>
                        </tr>
                      ))}
                    {priorities.filter((p) => p.accepted).length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-2 text-center text-gray-500">
                          No priorities accepted.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 2. Intervention Groups */}
              <div className="print-break-avoid">
                <h3 className="text-sm font-bold font-heading text-[#1C2421] uppercase tracking-wider mb-2">
                  2. Targeted Intervention Cohorts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {interventionGroups.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 border border-gray-300 rounded text-xs bg-gray-50/50 print-break-avoid"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold font-heading text-[#1C2421]">
                          {group.name}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500">
                          {group.pupilIds.length} pupils
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 italic mb-2">
                        {group.strategy}
                      </p>
                      <p className="text-[11px] text-gray-800">
                        <strong className="font-semibold">Pupils: </strong>
                        {group.pupilIds
                          .map((id) => pupils.find((p) => p.id === id)?.name)
                          .filter(Boolean)
                          .join(', ') || 'None assigned'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Flagged Pupils Detail */}
              <div className="print-break-avoid">
                <h3 className="text-sm font-bold font-heading text-[#1C2421] uppercase tracking-wider mb-2">
                  3. Individual Pupil Intervention Register
                </h3>
                <table className="w-full text-xs text-left border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="p-2 border border-gray-300">Pupil Name</th>
                      <th className="p-2 border border-gray-300 w-20">Grades (Cur/Tgt)</th>
                      <th className="p-2 border border-gray-300">Why Flagged?</th>
                      <th className="p-2 border border-gray-300">SEND / Specific Adjustments</th>
                      <th className="p-2 border border-gray-300">Teaching Strategy &amp; Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pupils.map((p) => {
                      const analysis = pupilAnalyses.get(p.id);
                      const isFlagged = analysis?.isFlagged;
                      return (
                        <tr
                          key={p.id}
                          className={`print-break-avoid ${
                            isFlagged ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="p-2 border border-gray-300 font-semibold align-top">
                            {p.name}
                            {isFlagged && (
                              <span className="ml-1.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full inline-block">
                                FLAGGED
                              </span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-300 align-top text-center whitespace-nowrap">
                            G{p.currentGrade} / G{p.targetGrade}
                          </td>
                          <td className="p-2 border border-gray-300 text-amber-900 align-top">
                            {analysis?.flagReasons && analysis.flagReasons.length > 0
                              ? analysis.flagReasons.join('; ')
                              : 'On track (at or above target)'}
                          </td>
                          <td className="p-2 border border-gray-300 text-gray-700 align-top">
                            {p.sendArea ? (
                              <span>
                                <strong>{p.sendArea}:</strong> {p.sendStrategy || 'Universal adjustments'}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2 border border-gray-300 text-gray-800 align-top text-xs">
                            {p.chosenStrategies && p.chosenStrategies.length > 0 && (
                              <ul className="mb-1 space-y-1">
                                {p.chosenStrategies.map((sId) => {
                                  const s = findStrategyById(sId);
                                  if (!s) return null;
                                  return (
                                    <li key={sId} className="text-[11px] leading-tight">
                                      <strong className="text-gray-900">{s.strategy}</strong>{' '}
                                      <span className="text-[#3A5D33] font-bold text-[10px]">
                                        [{s.technique}]
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {p.teacherNotes ? (
                              <p className="italic text-gray-600 text-[11px]">
                                {p.teacherNotes}
                              </p>
                            ) : !p.chosenStrategies || p.chosenStrategies.length === 0 ? (
                              <span className="italic text-gray-400">Monitor next assessment cycle.</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Sign-off footer */}
              <div className="pt-6 border-t border-gray-200 flex justify-between text-xs text-gray-500 print-break-avoid">
                <p>Teacher Signature: __________________________</p>
                <p>Date: __________________________</p>
                <p>HOD / SLT Review Date: __________________________</p>
              </div>

              {/* 4. Classroom Seating Plan (Starts on its own separate page in print) */}
              <div className="print-page-break pt-6">
                <div className="border-b-2 border-[#3A5D33] pb-2 mb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-[#3A5D33] uppercase tracking-wider">
                        Classroom Layout & Intervention Placements
                      </span>
                      <h3 className="text-lg font-bold font-heading text-[#1C2421]">
                        4. Classroom Seating Plan
                      </h3>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">Class: 11A/Sp1</p>
                      <p>
                        Placed:{' '}
                        <strong>
                          {
                            pupils.filter(
                              (p, idx) =>
                                (seatingPositions[p.id]?.x ?? getTraySlot(idx).x) >=
                                224 - 15
                            ).length
                          }
                        </strong>{' '}
                        &bull; Unplaced:{' '}
                        <strong>
                          {
                            pupils.filter(
                              (p, idx) =>
                                (seatingPositions[p.id]?.x ?? getTraySlot(idx).x) <
                                224 - 15
                            ).length
                          }
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seating Plan Printable Box */}
                {(() => {
                  const previewSlots = computeLayoutSlots(seatingLayout, customCols, customRows);
                  const slotToPupil = new Map<string, Pupil>();
                  const placedPupilIds = new Set<string>();

                  previewSlots.forEach((slot) => {
                    const matched = pupils.find((p, idx) => {
                      const pos = seatingPositions[p.id] || getTraySlot(idx);
                      return Math.abs(pos.x - slot.x) < 18 && Math.abs(pos.y - slot.y) < 18;
                    });
                    if (matched) {
                      slotToPupil.set(slot.id, matched);
                      placedPupilIds.add(matched.id);
                    }
                  });

                  const unplaced = pupils.filter((p) => !placedPupilIds.has(p.id));

                  return (
                    <div className="space-y-4 print-break-avoid">
                      <div className="relative bg-white rounded-lg border-2 border-gray-300 p-2 overflow-hidden select-none min-h-[480px]">
                        {/* Classroom grid / desks */}
                        <div className="relative w-full h-[410px]">
                          {/* Door */}
                          <div
                            style={{ left: '2%', top: '10px' }}
                            className="absolute bg-amber-50 text-amber-900 rounded border border-dashed border-[#D97706] px-2.5 py-1 text-xs font-bold flex items-center space-x-1 shadow-xs"
                          >
                            <span>Door</span>
                          </div>

                          {/* Interactive Whiteboard */}
                          <div
                            style={{ left: '34%', top: '10px' }}
                            className="absolute bg-slate-800 text-white rounded border border-slate-900 px-3 py-1.5 text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                          >
                            <span className="text-emerald-400 mr-1">&#9646;</span>
                            <span>Interactive whiteboard</span>
                          </div>

                          {/* Teacher Desk */}
                          <div
                            style={{ left: '78%', top: '10px' }}
                            className="absolute bg-slate-100 text-slate-800 rounded border border-dashed border-slate-400 px-3 py-1.5 text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-400 mr-0.5" />
                            <span>Teacher desk</span>
                          </div>

                          {/* Render all slots */}
                          {previewSlots.map((slot) => {
                            const seatedPupil = slotToPupil.get(slot.id);
                            // Convert canvas coords (x in 236..1068, y in 82..640) to relative percentages
                            const leftPct = ((slot.x - 224) / 856) * 100;
                            const topPct = (slot.y / 650) * 100;
                            const widthPct = (slot.width / 856) * 100;

                            if (!seatedPupil) {
                              return (
                                <div
                                  key={slot.id}
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: '42px',
                                  }}
                                  className="absolute border border-dashed border-gray-300 rounded bg-gray-50/50 flex flex-col items-center justify-center p-1 text-[9px] text-gray-400 font-semibold"
                                >
                                  <span>{slot.label}</span>
                                </div>
                              );
                            }

                            const analysis = pupilAnalyses.get(seatedPupil.id);
                            const isFlagged = analysis?.isFlagged;
                            const grpIdx = interventionGroups.findIndex((g) =>
                              g.pupilIds.includes(seatedPupil.id)
                            );
                            const grpPalette =
                              grpIdx !== -1
                                ? INTERVENTION_PALETTE[grpIdx % INTERVENTION_PALETTE.length]
                                : null;
                            const sendInfo = getSendInfo(seatedPupil.sendArea);

                            return (
                              <div
                                key={slot.id}
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  minHeight: '44px',
                                  borderLeftColor:
                                    showGroupColorsOnSeating && grpPalette
                                      ? grpPalette.border
                                      : undefined,
                                  borderLeftWidth:
                                    showGroupColorsOnSeating && grpPalette ? 4 : undefined,
                                }}
                                className="absolute bg-white rounded border border-[#B8BABB] shadow-2xs p-1.5 flex flex-col justify-between text-left"
                              >
                                <div className="flex items-start space-x-1 leading-tight">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                                      isFlagged ? 'bg-[#D97706]' : 'bg-[#3A5D33]'
                                    }`}
                                  />
                                  <span className="text-[10px] font-bold text-[#1C2421] leading-tight break-words">
                                    {seatedPupil.name}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[8.5px] text-gray-600 mt-1 pt-0.5 border-t border-gray-100">
                                  <span className="font-semibold">
                                    G{seatedPupil.currentGrade} / T{seatedPupil.targetGrade}
                                  </span>
                                  {sendInfo && (
                                    <span
                                      className="bg-[#E9EFE9] text-[#3A5D33] px-1 rounded font-bold"
                                      title={sendInfo.label}
                                    >
                                      {sendInfo.code}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Unplaced Pupils Section (Hidden if all placed) */}
                      {unplaced.length > 0 && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs print-break-avoid">
                          <h4 className="font-bold text-[#1C2421] mb-2 flex items-center">
                            <span>Unplaced pupils ({unplaced.length})</span>
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {unplaced.map((p) => (
                              <div
                                key={p.id}
                                className="bg-white p-2 rounded border border-gray-200 text-[11px] flex items-center justify-between gap-1"
                              >
                                <span className="font-semibold text-gray-800 break-words flex-1">
                                  {p.name}
                                </span>
                                <span className="text-gray-500 shrink-0 text-[10px] font-mono">
                                  G{p.currentGrade} / T{p.targetGrade}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comprehensive Legend Matching Tab 5 & PDF */}
                      <div className="p-3 bg-white border border-gray-200 rounded text-xs space-y-2 text-gray-700 print-break-avoid">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px]">
                          <span className="font-bold text-[#1C2421]">Key &amp; Legend:</span>
                          <span className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3A5D33]" />
                            <span>Green = On Track</span>
                          </span>
                          <span className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                            <span>Orange = Flagged for Review</span>
                          </span>
                          <span className="text-gray-500 font-mono text-[10px] bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                            G4 / T5 = current grade 4, target grade 5
                          </span>
                        </div>

                        {/* SEND Codes Key */}
                        <div className="text-[11px] pt-1 border-t border-gray-100 flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-700">SEND Codes:</span>
                          {Object.entries(SEND_CODE_MAP)
                            .filter(([k, v], idx, arr) => arr.findIndex((x) => x[1].code === v.code) === idx)
                            .map(([_, v]) => (
                              <span key={v.code} className="inline-flex items-center space-x-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
                                <strong className="text-[#3A5D33]">{v.code}</strong>
                                <span>= {v.label}</span>
                              </span>
                            ))}
                        </div>

                        {/* Intervention Group Colours (Shown only when Group Colours is ON) */}
                        {showGroupColorsOnSeating && interventionGroups.length > 0 && (
                          <div className="pt-1.5 border-t border-gray-100 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-gray-700">Intervention Groups (Left Bar):</span>
                              <span className="text-[10px] text-gray-500 italic">
                                Colours show which interventions each pupil is in, so seating can pair pupils for support.
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {interventionGroups.map((g, i) => {
                                const pal = INTERVENTION_PALETTE[i % INTERVENTION_PALETTE.length];
                                return (
                                  <span
                                    key={g.id}
                                    className="flex items-center space-x-1 px-2 py-0.5 rounded border"
                                    style={{ borderColor: pal.border, backgroundColor: pal.bg, color: pal.text }}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-xs"
                                      style={{ backgroundColor: pal.border }}
                                    />
                                    <strong className="text-[10.5px]">{g.name}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          )
        )}
      </main>

      {/* Unplaced Pupils Warning Modal */}
      {unplacedWarningCount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-[#B8BABB]">
            <div className="flex items-center space-x-2 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-heading font-bold text-base text-[#1C2421]">
                Unplaced Pupils Warning
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              <strong>{unplacedWarningCount} {unplacedWarningCount === 1 ? 'pupil is' : 'pupils are'} not placed yet.</strong> They will be listed as unplaced in the seating plan section of the PDF.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setUnplacedWarningCount(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeExportPdf}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943] transition-colors shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Whole Class Priority Modal */}
      {showAddPriorityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-[#B8BABB]">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-200">
              <h3 className="font-heading font-bold text-sm text-[#1C2421]">
                Add Custom Whole Class Priority
              </h3>
              <button
                onClick={() => setShowAddPriorityModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Topic / Skill Focus
                </label>
                <input
                  type="text"
                  placeholder="e.g., Preterite irregular verb stems (fui, hice, tuve)"
                  value={newPriorityTopic}
                  onChange={(e) => setNewPriorityTopic(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#B8BABB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Suggested Classroom Strategy
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Daily 5 minute retrieval whiteboard race focusing on 'fui' vs 'era'."
                  value={newPriorityStrategy}
                  onChange={(e) => setNewPriorityStrategy(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#B8BABB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowAddPriorityModal(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomPriority}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943]"
              >
                Save Priority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Intervention Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-[#B8BABB]">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-200">
              <h3 className="font-heading font-bold text-sm text-[#1C2421]">
                Add New Intervention Group
              </h3>
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Higher Tier Subjunctive Masterclass"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#B8BABB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Skill / Focus Area
                </label>
                <input
                  type="text"
                  placeholder="e.g., Complex Structures &amp; Grade 8/9 Stretch"
                  value={newGroupSkill}
                  onChange={(e) => setNewGroupSkill(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#B8BABB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Intervention Strategy / Activity
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Bi-weekly lunchtime workshop on 'cuando tenga...' and hypothetical clauses."
                  value={newGroupStrategy}
                  onChange={(e) => setNewGroupStrategy(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#B8BABB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomGroup}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3A5D33] text-white hover:bg-[#4C7943]"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teaching Strategy Roster Modal (Current Year Group Only) */}
      {strategyRosterPupilId && (() => {
        const pupil = pupils.find((p) => p.id === strategyRosterPupilId);
        if (!pupil) return null;
        const analysis = pupilAnalyses.get(pupil.id);
        const weakSkills = analysis?.weakSkills || [];
        const yearStrategies = STRATEGIES_BY_YEAR[yearGroup] || [];

        const filteredStrategies = yearStrategies.filter((item) => {
          if (!rosterSearch.trim()) return true;
          const q = rosterSearch.toLowerCase();
          return (
            item.gap.toLowerCase().includes(q) ||
            item.strategy.toLowerCase().includes(q) ||
            item.technique.toLowerCase().includes(q)
          );
        });

        // Rows whose gap matches one of pupil's flagged skills appear first, marked "Suggested"
        const sortedStrategies = [...filteredStrategies].sort((a, b) => {
          const aSuggested = gapMatchesSkills(a.gap, weakSkills);
          const bSuggested = gapMatchesSkills(b.gap, weakSkills);
          if (aSuggested && !bSuggested) return -1;
          if (!aSuggested && bSuggested) return 1;
          return 0; // maintain file order
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 border border-[#B8BABB] flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex justify-between items-start pb-3 border-b border-gray-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="badge-green text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Year {yearGroup} Strategies
                    </span>
                    <h3 className="font-heading font-bold text-base text-[#1C2421]">
                      Teaching Strategy Roster
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Assign in-class interventions for <strong className="text-gray-900">{pupil.name}</strong> (Working at Grade {pupil.currentGrade} &bull; Target Grade {pupil.targetGrade})
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStrategyRosterPupilId(null);
                    setRosterSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Box */}
              <div className="pt-3 pb-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search Year ${yearGroup} strategies by gap, strategy, or technique...`}
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#B8BABB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3A5D33]"
                  />
                </div>
              </div>

              {/* Strategy Rows */}
              <div className="overflow-y-auto space-y-2 flex-1 pr-1 py-1">
                {sortedStrategies.map((item) => {
                  const isAdded = pupil.chosenStrategies?.includes(item.id);
                  const isSuggested = gapMatchesSkills(item.gap, weakSkills);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleTogglePupilStrategy(pupil.id, item.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isAdded
                          ? 'border-[#3A5D33] bg-[#E9EFE9]/40 shadow-xs'
                          : 'border-gray-200 hover:border-[#3A5D33] hover:bg-gray-50'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-500 font-medium">
                            Gap: {item.gap}
                          </span>
                          {isSuggested && (
                            <span className="badge-amber text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                              Suggested
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-xs text-[#1C2421] leading-snug">
                          {item.strategy}
                        </p>
                        <div className="pt-0.5">
                          <span className="badge-green text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {item.technique}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1 shrink-0">
                        {isAdded ? (
                          <span className="inline-flex items-center text-xs font-bold text-[#3A5D33] bg-white border border-[#3A5D33] px-2.5 py-1 rounded shadow-2xs">
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-gray-500 bg-white border border-gray-300 px-2.5 py-1 rounded hover:border-[#3A5D33] hover:text-[#3A5D33]">
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sortedStrategies.length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-500">
                    No Year {yearGroup} strategies found matching &quot;{rosterSearch}&quot;.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 mt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {pupil.chosenStrategies?.length || 0} strategies selected for {pupil.name}
                </span>
                <button
                  onClick={() => {
                    setStrategyRosterPupilId(null);
                    setRosterSearch('');
                  }}
                  className="px-4 py-1.5 font-semibold text-white bg-[#3A5D33] hover:bg-[#4C7943] rounded transition-colors shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
