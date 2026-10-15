import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from 'docx';

// Configure pdfjs worker in the browser
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export interface SendRecord {
  pupilName: string;
  sendArea: string;
  sendStrategy: string;
}

export interface SendReviewState {
  file: File;
  records: SendRecord[];
  unmatchedText: string;
  totalPupils: number;
}

export const STANDARD_SEND_AREAS = [
  'SLCN',
  'ASD',
  'Dyslexia',
  'SEMH',
  'ADHD',
  'Hearing impairment',
  'Visual impairment',
  'Dyscalculia',
  'Dyspraxia',
  'Physical',
  'MLD',
  'SpLD',
  'EHCP',
  'SEN support',
];

interface SendKeywordRule {
  keywords: string[];
  label: string;
}

const SEND_KEYWORD_RULES: SendKeywordRule[] = [
  { keywords: ['speech and language', 'slcn'], label: 'SLCN' },
  { keywords: ['autism', 'autistic', 'asd'], label: 'ASD' },
  { keywords: ['dyslexia', 'dyslexic'], label: 'Dyslexia' },
  { keywords: ['semh'], label: 'SEMH' },
  { keywords: ['adhd'], label: 'ADHD' },
  { keywords: ['hearing impairment', 'hearing'], label: 'Hearing impairment' },
  { keywords: ['visual impairment', 'visual'], label: 'Visual impairment' },
  { keywords: ['dyscalculia'], label: 'Dyscalculia' },
  { keywords: ['dyspraxia'], label: 'Dyspraxia' },
  { keywords: ['physical'], label: 'Physical' },
  { keywords: ['spld'], label: 'SpLD' },
  { keywords: ['mld'], label: 'MLD' },
  { keywords: ['ehcp'], label: 'EHCP' },
  { keywords: ['sen support'], label: 'SEN support' },
];

/**
 * Normalise a string for matching: lowercase, trim, collapse spaces, ignore accents and punctuation
 */
export function normalizeForAnchor(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeRegex(str: string): string {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/-/g, '\\-');
}

/**
 * Extract text from a PDF file using pdfjs-dist.
 * Keeps line breaks. If under 50 characters, throws the required error message.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    let lastY: number | undefined;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        // Detect vertical line breaks by comparing transform matrix Y coordinate
        if (lastY !== undefined && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (
          pageText.length > 0 &&
          !pageText.endsWith('\n') &&
          !pageText.endsWith(' ')
        ) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }
    fullText += pageText + '\n\n';
  }

  const trimmed = fullText.trim();
  if (trimmed.length < 50) {
    throw new Error(
      'This PDF looks like a scan, so it has no readable text. Please upload a text PDF, Word, Excel or CSV file.'
    );
  }

  return trimmed;
}

/**
 * Extract text from a Word (.docx) file using mammoth.
 * Keeps line breaks and converts tables so each row is a line with cells separated by " | ".
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Call extractRawText in browser to satisfy mammoth extractRawText requirement
  const rawResult = await mammoth.extractRawText({ arrayBuffer });
  const rawText = rawResult.value;

  // Read tables: mammoth.convertToHtml preserves <table><tr><td>...</td></tr></table>
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = htmlResult.value;

  if (html.includes('<table') || html.includes('<tr')) {
    let processed = html.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, trContent) => {
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let m: RegExpExecArray | null;
      while ((m = cellRegex.exec(trContent)) !== null) {
        const clean = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        cells.push(clean);
      }
      return cells.join(' | ') + '\n';
    });

    processed = processed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');

    return processed
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
  }

  return rawText.trim();
}

/**
 * Match pupil names from document text, split into blocks, and extract Area of Need and Strategy.
 */
export function matchPupilsFromText(
  docText: string,
  availablePupilNames: string[]
): {
  records: SendRecord[];
  unmatchedText: string;
  foundCount: number;
  totalCount: number;
} {
  try {
    const totalCount = availablePupilNames.length;
    if (!docText.trim() || totalCount === 0) {
      return { records: [], unmatchedText: docText.trim(), foundCount: 0, totalCount };
    }

    interface AnchorMatch {
      pupilName: string;
      index: number;
      matchLength: number;
    }

    const matches: AnchorMatch[] = [];

    // Match both "First Last" and "Last, First" (and "Last First")
    for (const pName of availablePupilNames) {
      const trimmed = pName.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');

      const regexCandidates: RegExp[] = [
        // Exact First Last
        new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i'),
      ];

      if (parts.length > 1) {
        // Last, First
        regexCandidates.push(
          new RegExp(
            `\\b${escapeRegex(lastName)}\\s*,\\s*${escapeRegex(firstName)}\\b`,
            'i'
          )
        );
        // Last First
        regexCandidates.push(
          new RegExp(
            `\\b${escapeRegex(lastName)}\\s+${escapeRegex(firstName)}\\b`,
            'i'
          )
        );
      }

      let earliest: { index: number; matchLength: number } | null = null;
      for (const rgx of regexCandidates) {
        const execRes = rgx.exec(docText);
        if (execRes && (earliest === null || execRes.index < earliest.index)) {
          earliest = { index: execRes.index, matchLength: execRes[0].length };
        }
      }

      // If not found with exact characters, try normalized search
      if (!earliest) {
        const normDoc = normalizeForAnchor(docText);
        const normFirstLast = normalizeForAnchor(trimmed);
        const normLastFirst = parts.length > 1
          ? normalizeForAnchor(`${lastName} ${firstName}`)
          : normFirstLast;

        let normIdx = normDoc.indexOf(normFirstLast);
        let matchedNormLen = normFirstLast.length;
        if (normIdx === -1 && normLastFirst !== normFirstLast) {
          normIdx = normDoc.indexOf(normLastFirst);
          matchedNormLen = normLastFirst.length;
        }

        if (normIdx !== -1) {
          // Approximate position in original text
          const ratio = normIdx / (normDoc.length || 1);
          const approxIdx = Math.min(docText.length - 1, Math.round(ratio * docText.length));
          earliest = { index: approxIdx, matchLength: matchedNormLen };
        }
      }

      if (earliest) {
        matches.push({
          pupilName: trimmed,
          index: earliest.index,
          matchLength: earliest.matchLength,
        });
      }
    }

    // Sort matched anchors by appearance in the text
    matches.sort((a, b) => a.index - b.index);

    // Filter overlapping anchors
    const filteredMatches: AnchorMatch[] = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.index >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.index + m.matchLength;
      }
    }

    const records: SendRecord[] = [];
    const unmatchedParts: string[] = [];

    // Text preceding the first pupil anchor
    if (filteredMatches.length > 0 && filteredMatches[0].index > 0) {
      const preamble = docText.substring(0, filteredMatches[0].index).trim();
      if (preamble) unmatchedParts.push(preamble);
    } else if (filteredMatches.length === 0) {
      unmatchedParts.push(docText.trim());
    }

    // Extract each pupil's block
    for (let i = 0; i < filteredMatches.length; i++) {
      const cur = filteredMatches[i];
      const next = filteredMatches[i + 1];
      const blockEnd = next ? next.index : docText.length;
      const rawBlock = docText.substring(cur.index, blockEnd);

      // Remove the pupil's name from the beginning of the block
      let contentAfterName = rawBlock.substring(cur.matchLength).trim();

      // Strip leading punctuation or table delimiters e.g. "|", "-", ":" (hyphen at end of character class)
      contentAfterName = contentAfterName.replace(/^[|:,;\/\s-]+/, '').trim();

      // a. Detect Area of Need keyword (case-insensitive)
      let detectedArea = '';
      const lowerContent = contentAfterName.toLowerCase();

      for (const rule of SEND_KEYWORD_RULES) {
        const hasMatch = rule.keywords.some((kw) => {
          // Use word boundary check with escaped keyword
          const kwRegex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
          return kwRegex.test(lowerContent);
        });
        if (hasMatch) {
          detectedArea = rule.label;
          break;
        }
      }

      if (!detectedArea) {
        detectedArea = 'SEN support';
      }

      // b. Strategy text: the block with name removed, trimmed, capped at 600 characters
      let strategyText = contentAfterName;

      // If strategy starts with the detected area followed by separator, clean it up (hyphen at end of class)
      const areaPrefixRegex = new RegExp(
        `^${escapeRegex(detectedArea)}[|:,;\\s-]+`,
        'i'
      );
      if (areaPrefixRegex.test(strategyText)) {
        strategyText = strategyText.replace(areaPrefixRegex, '').trim();
      }

      strategyText = strategyText.replace(/\s+/g, ' ').slice(0, 600).trim();

      records.push({
        pupilName: cur.pupilName,
        sendArea: detectedArea,
        sendStrategy: strategyText,
      });
    }

    return {
      records,
      unmatchedText: unmatchedParts.join('\n\n---\n\n'),
      foundCount: records.length,
      totalCount,
    };
  } catch (err) {
    console.error('[matchPupilsFromText] Error matching pupils from text:', err);
    throw new Error(`Failed to parse SEND text: ${(err as Error).message}`);
  }
}

/**
 * Generate sample SEND PDF using jsPDF
 */
export function generateSampleSendPdf(): void {
  const doc = new jsPDF();
  const sampleData = [
    {
      name: 'Callum Taylor',
      need: 'Dyslexia',
      strategy:
        'Print handouts on pale buff paper; provide color-coded verb ending cards and visual scaffolds.',
    },
    {
      name: 'Joshua Evans',
      need: 'ADHD',
      strategy:
        'Seat near front; use 10-minute micro-tasks and tactile verb wheels during independent work.',
    },
    {
      name: 'Freya Davies',
      need: 'SLCN',
      strategy:
        'Pre-teach vocabulary with visuals; provide bilingual speaking frames and reduced oral cognitive load.',
    },
    {
      name: 'Ethan Brown',
      need: 'ASD',
      strategy:
        'Clear task checklist on desk; give advance notice of group tasks; maintain structured routines.',
    },
    {
      name: 'Harrison Green',
      need: 'SEMH',
      strategy:
        'Discreet praise; private non-verbal check-in if anxious in timed tasks; break writing into micro-goals.',
    },
    {
      name: 'Grace Edwards',
      need: 'Hearing impairment',
      strategy:
        'Ensure direct line of sight; seat row 1 center; provide written copies of audio cues.',
    },
  ];

  // Header branding
  doc.setFontSize(16);
  doc.setTextColor(28, 36, 33);
  doc.text('Departmental SEND Information Register', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Confidential Classroom Accommodations & Areas of Need', 14, 26);

  // Table header
  let y = 38;
  doc.setFillColor(233, 239, 233);
  doc.rect(14, y - 5, 182, 8, 'F');

  doc.setFontSize(10);
  doc.setTextColor(58, 93, 51);
  doc.text('Pupil Name', 16, y);
  doc.text('Area of Need', 62, y);
  doc.text('Classroom Accommodation Strategy', 110, y);

  y += 7;

  // Table rows
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);

  sampleData.forEach((row, idx) => {
    const stratLines = doc.splitTextToSize(row.strategy, 82);
    const rowHeight = Math.max(12, stratLines.length * 4.5 + 4);

    // Alternate row background
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, y - 4, 182, rowHeight, 'F');
    }

    doc.text(row.name, 16, y + 2);
    doc.text(row.need, 62, y + 2);
    doc.text(stratLines, 110, y + 2);

    // Bottom border line
    doc.setDrawColor(229, 231, 235);
    doc.line(14, y + rowHeight - 4, 196, y + rowHeight - 4);

    y += rowHeight;
  });

  // Footer notes
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Confidential &bull; Generated for testing client-side PDF parsing with pdfjs-dist', 14, y);

  doc.save('sample_send_information.pdf');
}

/**
 * Generate sample SEND Word (.docx) file using docx library
 */
export async function generateSampleSendDocx(): Promise<void> {
  const sampleData = [
    {
      name: 'Callum Taylor',
      need: 'Dyslexia',
      strategy:
        'Print handouts on pale buff paper; provide color-coded verb ending cards and visual scaffolds.',
    },
    {
      name: 'Joshua Evans',
      need: 'ADHD',
      strategy:
        'Seat near front; use 10-minute micro-tasks and tactile verb wheels during independent work.',
    },
    {
      name: 'Freya Davies',
      need: 'SLCN',
      strategy:
        'Pre-teach vocabulary with visuals; provide bilingual speaking frames and reduced oral cognitive load.',
    },
    {
      name: 'Ethan Brown',
      need: 'ASD',
      strategy:
        'Clear task checklist on desk; give advance notice of group tasks; maintain structured routines.',
    },
    {
      name: 'Harrison Green',
      need: 'SEMH',
      strategy:
        'Discreet praise; private non-verbal check-in if anxious in timed tasks; break writing into micro-goals.',
    },
    {
      name: 'Grace Edwards',
      need: 'Hearing impairment',
      strategy:
        'Ensure direct line of sight; seat row 1 center; provide written copies of audio cues.',
    },
  ];

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: 'E9EFE9' },
          children: [new Paragraph({ text: 'Pupil Name', style: 'Heading' })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: 'E9EFE9' },
          children: [new Paragraph({ text: 'Area of Need', style: 'Heading' })],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          shading: { fill: 'E9EFE9' },
          children: [
            new Paragraph({ text: 'Classroom Accommodation Strategy', style: 'Heading' }),
          ],
        }),
      ],
    }),
    ...sampleData.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(item.name)],
            }),
            new TableCell({
              children: [new Paragraph(item.need)],
            }),
            new TableCell({
              children: [new Paragraph(item.strategy)],
            }),
          ],
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'SEND Information Register',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: 'Confidential Departmental Record &bull; Student Needs & Accommodations',
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_send_information.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
