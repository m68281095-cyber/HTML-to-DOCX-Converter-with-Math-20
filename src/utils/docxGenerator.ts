import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  ShadingType,
  IParagraphOptions,
  ITableCellOptions,
  WidthType,
  LineRuleType,
  XmlComponent,
} from "docx";
import JSZip from "jszip";
import { ConversionConfig, ConversionLog } from "../types";
import {
  convertMathMLToDocxMath,
  getMathMLString,
  convertASTToLocalOmmlString,
} from "./mathConverter";
import { repairMalformedSpanTags } from "./fileParser";

// Module-level dynamic active font declarations updated per compilation request
let activeBanglaFont = "Kalpurush";
let activeEnglishFont = "Times New Roman";
let activeArabicFont = "Al Qalam Kolkatta Quranic font";
let activeArabicFontSize = 48; // Default 24pt (48 half-points)
let activeBanglaFontSize: number | null = null;
let activeForceBlackText = false;
let activeSkipEquations = false;

/**
 * Maps typical Tailwind color classes to hex values.
 */
const tailwindColors: Record<string, string> = {
  // Gray / Slate / Zinc / Neutral / Stone
  "gray-50": "F9FAFB",
  "gray-100": "F3F4F6",
  "gray-200": "E5E7EB",
  "gray-300": "D1D5DB",
  "gray-400": "9CA3AF",
  "gray-550": "4B5563",
  "gray-600": "4B5563",
  "gray-700": "374151",
  "gray-800": "1F2937",
  "gray-900": "111827",
  "gray-950": "030712",
  "slate-50": "F8FAFC",
  "slate-100": "F1F5F9",
  "slate-200": "E2E8F0",
  "slate-300": "CBD5E1",
  "slate-400": "94A3B8",
  "slate-550": "475569",
  "slate-600": "475569",
  "slate-700": "334155",
  "slate-800": "1E293B",
  "slate-900": "0F172A",
  "zinc-50": "FAFAFA",
  "zinc-100": "F4F4F5",
  "zinc-200": "E4E4E7",
  "zinc-300": "D4D4D8",
  "zinc-450": "71717A",
  "zinc-600": "71717A",
  "zinc-700": "52525B",
  "zinc-800": "3F3F46",
  "zinc-900": "27272A",
  "neutral-50": "FAFAFA",
  "neutral-100": "F5F5F5",
  "neutral-200": "E5E5E5",
  "neutral-300": "D4D4D4",
  "neutral-600": "737373",
  "neutral-700": "404040",
  "neutral-800": "262626",
  "neutral-900": "171717",
  "stone-50": "FAF9F6",
  "stone-100": "F5F5F4",
  "stone-200": "E7E5E4",
  "stone-300": "D6D3D1",
  "stone-600": "78716C",
  "stone-700": "57534E",
  "stone-800": "44403C",
  "stone-900": "292524",

  // Colors
  "blue-50": "EFF6FF",
  "blue-105": "EFF6FF",
  "blue-100": "DBEAFE",
  "blue-200": "BFDBFE",
  "blue-300": "93C5FD",
  "blue-500": "3B82F6",
  "blue-600": "2563EB",
  "blue-700": "1D4ED8",
  "blue-800": "1E40AF",
  "blue-900": "1E3A8A",
  "red-50": "FEF2F2",
  "red-100": "FEE2E2",
  "red-200": "FECACA",
  "red-500": "EF4444",
  "red-600": "DC2626",
  "red-750": "B91C1C",
  "red-800": "991B1B",
  "red-900": "7F1D1D",
  "emerald-50": "ECFDF5",
  "emerald-100": "D1FAE5",
  "emerald-200": "A7F3D0",
  "emerald-500": "10B981",
  "emerald-600": "059669",
  "emerald-700": "047857",
  "green-50": "F0FDF4",
  "green-100": "DCFCE7",
  "green-500": "22C55E",
  "green-600": "16A34A",
  "green-705": "15803D",
  "amber-50": "FFFBEB",
  "amber-100": "FEF3C7",
  "amber-200": "FDE68A",
  "amber-500": "F59E0B",
  "amber-600": "D97706",
  "amber-700": "B45309",
  "yellow-50": "FEFCE8",
  "yellow-100": "FEF9C3",
  "yellow-500": "EAB308",
  "yellow-600": "CA8A04",
  "indigo-50": "F5F3FF",
  "indigo-100": "E0E7FF",
  "indigo-605": "4F46E5",
  "indigo-700": "4338CA",
  "violet-50": "F5F3FF",
  "violet-100": "EDE9FE",
  "violet-650": "7C3AED",
  "purple-50": "FAF5FF",
  "purple-100": "F3E8FF",
  "purple-600": "9333EA",
  "pink-50": "FDF2F8",
  "pink-100": "FCE7F3",
  "pink-600": "DB2777",
};

function parseColorToHex(colorStr: string): string | null {
  const s = colorStr.trim().toLowerCase();

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    return hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6).toUpperCase();
  }

  if (s.startsWith("rgb")) {
    const match = s.match(
      /rgba?\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*)(?:,\s*[\d.]+\s*)?\)/,
    );
    if (match) {
      const parts = match[1].split(",").map((x) => parseInt(x.trim(), 10));
      const r = parts[0].toString(16).padStart(2, "0");
      const g = parts[1].toString(16).padStart(2, "0");
      const b = parts[2].toString(16).padStart(2, "0");
      return (r + g + b).toUpperCase();
    }
  }

  const cssColors: Record<string, string> = {
    white: "FFFFFF",
    black: "000000",
    red: "DC2626",
    blue: "2563EB",
    green: "16A34A",
    yellow: "CA8A04",
    grey: "4B5563",
    gray: "4B5563",
    lightgray: "D1D5DB",
    lightgrey: "D1D5DB",
    darkgray: "1F2937",
    darkgrey: "1F2937",
    transparent: "FFFFFF",
  };

  if (cssColors[s]) return cssColors[s];
  return null;
}

function isColorGrey(hex: string): boolean {
  if (!hex || hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;

  // Exclude pure white or extreme near-white so light backgrounds are safe
  if (r > 240 && g > 240 && b > 240) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 45;
}

function parseTailwindClassColor(cls: string): string | null {
  const matchBracket = cls.match(/-\[(#[0-9a-fA-F]{3,6}|rgba?\(.*?\))\]/);
  if (matchBracket) {
    return parseColorToHex(matchBracket[1]);
  }

  const baseColor = cls.replace(/^(bg|text|border|accent)-/, "");
  if (tailwindColors[baseColor]) {
    return tailwindColors[baseColor];
  }

  if (baseColor === "primary") return "2563EB";
  if (baseColor === "secondary") return "475569";
  if (baseColor === "success") return "16A34A";
  if (baseColor === "danger" || baseColor === "error") return "DC2626";
  if (baseColor === "warning") return "CA8A04";

  for (const name of Object.keys(tailwindColors)) {
    if (baseColor === name) {
      return tailwindColors[name];
    }
  }

  return null;
}

/**
 * Parse tailwind font-sizes to point sizes (half-points in docx).
 * 1 point = 2 half-points
 */
function parseTailwindFontSize(className: string): number {
  if (className.includes("text-xs")) return 18; // 9pt
  if (className.includes("text-sm")) return 20; // 10pt
  if (className.includes("text-base")) return 26; // Default to 13pt (26 half-points) as per request
  if (className.includes("text-lg")) return 28; // 14pt
  if (className.includes("text-xl")) return 32; // 16pt
  if (className.includes("text-2xl")) return 40; // 20pt
  if (className.includes("text-3xl")) return 48; // 24pt
  if (className.includes("text-4xl")) return 64; // 32pt
  return 26; // Default 13pt (size 26)
}

/**
 * Extract original LaTeX annotation TeX safely to allow perfect mathematical fallback
 */
function extractTeXAnnotation(mathml: string): string | null {
  try {
    const match = mathml.match(
      /<annotation[^>]*encoding=["'](?:application\/x-tex|TeX)["'][^>]*>([\s\S]*?)<\/annotation>/i,
    );
    if (match && match[1]) {
      return match[1].trim();
    }
    const matchGeneric = mathml.match(
      /<annotation[^>]*>([\s\S]*?)<\/annotation>/i,
    );
    if (matchGeneric && matchGeneric[1]) {
      return matchGeneric[1].trim();
    }
  } catch {}
  return null;
}

/**
 * Builds a marked equation placeholder with raw, translated OMML markup inline/block wrappers.
 */
function constructMathPlaceholder(mathml: string, isInline: boolean): string {
  const mathId = Math.random().toString(36).substring(2, 10);
  let omml = convertASTToLocalOmmlString(mathml);
  if (isInline) {
    omml = omml.replace(/<m:oMathPara>/g, "").replace(/<\/m:oMathPara>/g, "");
    return `__M_INLINE_START__${mathId}__${omml}__M_INLINE_END__${mathId}__`;
  } else {
    if (!omml.includes("<m:oMathPara>")) {
      omml = `<m:oMathPara>${omml}</m:oMathPara>`;
    }
    return `__MP_START__${mathId}__${omml}__MP_END__${mathId}__`;
  }
}

/**
 * Checks if a MathML string contains complex layouts (such as vectors, limits, or matrices)
 * that native DocxMath elements do not support or map incorrectly.
 */
function containsComplexMath(mathml: string): boolean {
  return /<(mover|munder|munderover|mtable|mtr|mtd|mspace)\b/i.test(mathml);
}

/**
 * Intelligent selector/renderer for inline math.
 * For simple equations, returns a native DocxMath node.
 * For complex equations, returns a TextRun with a raw XML placeholder.
 */
function renderInlineMathToRun(
  mathml: string,
  fallbackFormula: string,
  parentStyle: any,
): any {
  if (!containsComplexMath(mathml)) {
    try {
      const mathObj = convertMathMLToDocxMath(mathml);
      if (mathObj) {
        return mathObj;
      }
    } catch (e) {
      console.warn(
        "convertMathMLToDocxMath failed, falling back to placeholder:",
        e,
      );
    }
  }

  try {
    return new TextRun({
      text: constructMathPlaceholder(mathml, true),
    });
  } catch (err) {
    return new TextRun({
      text: fallbackFormula,
      italics: true,
      color: parentStyle.color,
      font: {
        ascii: activeEnglishFont,
        hAnsi: activeEnglishFont,
        cs: activeEnglishFont,
        eastAsia: activeEnglishFont,
      },
    });
  }
}

/**
 * Extracts element formatting styles based on custom HTML style tags and tailwind utility classes.
 */
interface ElementStyle {
  bold: boolean;
  italic: boolean;
  subScript?: boolean;
  superScript?: boolean;
  color: string;
  size: number;
  backgroundColor?: string;
  alignment: any;
  indentLeft?: number;
  indentRight?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  borderTop?: any;
  borderBottom?: any;
  borderLeft?: any;
  borderRight?: any;
  cellPadding?: { top: number; bottom: number; left: number; right: number };
}

function parseElementStyles(el: HTMLElement): ElementStyle {
  const styles: ElementStyle = {
    bold: false,
    italic: false,
    color: "000000", // Default Pure Black for standard text (preventing grey)
    size: 26, // Default 13pt (26 half-points)
    alignment: AlignmentType.START,
  };

  // Inspect tagName default layouts
  const tag = el.tagName.toLowerCase();
  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
    styles.bold = true;
    styles.spacingBefore = 240; // 12pt
    styles.spacingAfter = 120; // 6pt

    if (tag === "h1") {
      styles.size = 36;
      styles.color = "000000"; // Pure Black for clean printing
      styles.spacingBefore = 360;
    } else if (tag === "h2") {
      styles.size = 28;
      styles.color = "000000"; // Pure Black for clean printing
    } else if (tag === "h3") {
      styles.size = 24;
      styles.color = "000000"; // Pure Black for clean printing
    } else {
      styles.size = 20;
      styles.color = "000000"; // Pure Black for clean printing
    }
  } else if (tag === "blockquote") {
    styles.italic = true;
    styles.color = "4B5563"; // Muted gray
    styles.indentLeft = 720; // 0.5 inches in twips
    styles.spacingBefore = 180;
    styles.spacingAfter = 180;
  } else if (tag === "p") {
    styles.spacingBefore = 60;
    styles.spacingAfter = 120;
  } else if (tag === "pre") {
    styles.spacingBefore = 120;
    styles.spacingAfter = 120;
  }

  // Parse HTML raw inline styles (CSS AST Style Declarations)
  const styleAttr = el.getAttribute("style") || "";
  if (styleAttr) {
    const styleParts = styleAttr.split(";");
    for (const part of styleParts) {
      const colonIdx = part.indexOf(":");
      if (colonIdx !== -1) {
        const key = part.slice(0, colonIdx).trim().toLowerCase();
        const val = part
          .slice(colonIdx + 1)
          .trim()
          .toLowerCase();

        if (key === "color") {
          const hex = parseColorToHex(val);
          if (hex) styles.color = hex;
        } else if (key === "background-color" || key === "background") {
          const hex = parseColorToHex(val);
          if (hex) styles.backgroundColor = hex;
        } else if (
          key === "font-weight" &&
          (val === "bold" || parseInt(val) >= 600)
        ) {
          styles.bold = true;
        } else if (key === "font-style" && val === "italic") {
          styles.italic = true;
        } else if (key === "text-align") {
          if (val === "center") styles.alignment = AlignmentType.CENTER;
          else if (val === "right") styles.alignment = AlignmentType.END;
          else if (val === "justify") styles.alignment = AlignmentType.BOTH;
          else if (val === "left") styles.alignment = AlignmentType.START;
        } else if (key.startsWith("padding")) {
          if (!styles.cellPadding)
            styles.cellPadding = {
              top: 150,
              bottom: 150,
              left: 200,
              right: 200,
            };
          const pVal = parseInt(val) || 0;
          const pTwips = pVal * 15; // approximate mapping px to twips
          if (key === "padding") {
            styles.cellPadding = {
              top: pTwips,
              bottom: pTwips,
              left: pTwips,
              right: pTwips,
            };
          } else if (key === "padding-left") styles.cellPadding.left = pTwips;
          else if (key === "padding-right") styles.cellPadding.right = pTwips;
          else if (key === "padding-top") styles.cellPadding.top = pTwips;
          else if (key === "padding-bottom") styles.cellPadding.bottom = pTwips;
        }
      }
    }
  }

  // Parse color attribute directly (e.g. <font color="red">)
  const colorAttr = el.getAttribute("color");
  if (colorAttr) {
    const hex = parseColorToHex(colorAttr);
    if (hex) styles.color = hex;
  }

  // Examine Tailwind CSS utility classes
  const classes = Array.from(el.classList);
  for (const cls of classes) {
    // Ignore dark mode classes to adhere to print-friendly high-contrast layout priority
    if (cls.startsWith("dark:")) continue;

    if (cls === "font-bold") styles.bold = true;
    if (cls === "font-medium") styles.bold = true;
    if (cls === "italic") styles.italic = true;

    if (cls.startsWith("text-")) {
      if (cls.startsWith("text-left")) styles.alignment = AlignmentType.START;
      else if (cls.startsWith("text-center"))
        styles.alignment = AlignmentType.CENTER;
      else if (cls.startsWith("text-right"))
        styles.alignment = AlignmentType.END;
      else if (cls.startsWith("text-justify"))
        styles.alignment = AlignmentType.BOTH;
      else if (
        cls.includes("-xs") ||
        cls.includes("-sm") ||
        cls.includes("-base") ||
        cls.includes("-lg") ||
        cls.includes("-xl") ||
        cls.includes("-2xl") ||
        cls.includes("-3xl") ||
        cls.includes("-4xl")
      ) {
        styles.size = parseTailwindFontSize(cls);
      } else {
        const colorHex = parseTailwindClassColor(cls);
        if (colorHex) styles.color = colorHex;
      }
    }

    if (cls.startsWith("bg-")) {
      const colorHex = parseTailwindClassColor(cls);
      if (colorHex) styles.backgroundColor = colorHex;
    }

    // Border mappings
    if (cls === "border") {
      styles.borderLeft = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CBD5E1",
      };
      styles.borderRight = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CBD5E1",
      };
      styles.borderTop = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CBD5E1",
      };
      styles.borderBottom = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CBD5E1",
      };
    }
    if (cls.startsWith("border-l-")) {
      const val = parseInt(cls.replace("border-l-", "")) || 1;
      styles.borderLeft = {
        style: BorderStyle.SINGLE,
        size: val * 8,
        color: "CBD5E1",
      };
    }
    if (cls.startsWith("border-r-")) {
      const val = parseInt(cls.replace("border-r-", "")) || 1;
      styles.borderRight = {
        style: BorderStyle.SINGLE,
        size: val * 8,
        color: "CBD5E1",
      };
    }
    if (cls.startsWith("border-t-")) {
      const val = parseInt(cls.replace("border-t-", "")) || 1;
      styles.borderTop = {
        style: BorderStyle.SINGLE,
        size: val * 8,
        color: "CBD5E1",
      };
    }
    if (cls.startsWith("border-b-")) {
      const val = parseInt(cls.replace("border-b-", "")) || 1;
      styles.borderBottom = {
        style: BorderStyle.SINGLE,
        size: val * 8,
        color: "CBD5E1",
      };
    }
    if (
      cls.startsWith("border-") &&
      !cls.startsWith("border-[") &&
      !cls.startsWith("border-l-") &&
      !cls.startsWith("border-r-") &&
      !cls.startsWith("border-t-") &&
      !cls.startsWith("border-b-")
    ) {
      const colorHex = parseTailwindClassColor(cls);
      if (colorHex) {
        if (styles.borderLeft) styles.borderLeft.color = colorHex;
        if (styles.borderRight) styles.borderRight.color = colorHex;
        if (styles.borderTop) styles.borderTop.color = colorHex;
        if (styles.borderBottom) styles.borderBottom.color = colorHex;
      }
    }

    // Cell padding mappings
    if (cls.startsWith("p-")) {
      const val = parseInt(cls.replace("p-", "")) || 0;
      const twips = val * 60;
      styles.cellPadding = {
        top: twips,
        bottom: twips,
        left: twips,
        right: twips,
      };
    } else if (cls.startsWith("px-")) {
      const val = parseInt(cls.replace("px-", "")) || 0;
      const twips = val * 60;
      if (!styles.cellPadding)
        styles.cellPadding = { top: 150, bottom: 150, left: 200, right: 200 };
      styles.cellPadding.left = twips;
      styles.cellPadding.right = twips;
    } else if (cls.startsWith("py-")) {
      const val = parseInt(cls.replace("py-", "")) || 0;
      const twips = val * 60;
      if (!styles.cellPadding)
        styles.cellPadding = { top: 150, bottom: 150, left: 200, right: 200 };
      styles.cellPadding.top = twips;
      styles.cellPadding.bottom = twips;
    }

    // Checking Margin presets
    if (cls.startsWith("mt-")) {
      const val = parseInt(cls.replace("mt-", "")) || 0;
      styles.spacingBefore = val * 100;
    }
    if (cls.startsWith("mb-")) {
      const val = parseInt(cls.replace("mb-", "")) || 0;
      styles.spacingAfter = val * 100;
    }
    if (cls.startsWith("pl-") || cls.startsWith("ml-")) {
      const val = parseInt(cls.replace(/^(pl-|ml-)/, "")) || 0;
      styles.indentLeft = val * 144; // approx proportional twips
    }
  }

  if (activeForceBlackText && styles.color && isColorGrey(styles.color)) {
    styles.color = "000000";
  }

  return styles;
}

/**
 * Splits text into emoji chunks, math chunks, and normal text chunks
 */
function splitTextSegments(
  text: string,
): { text: string; type: "text" | "emoji" | "math" }[] {
  // Math regex: matches $...$ but ensures no space immediately after the opening $
  // and no space immediately before the closing $. This helps avoid matching "$5 and $10"
  const regex = activeSkipEquations
    ? /([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u2934-\u2935])/g
    : /([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u2934-\u2935])|(\$(?!\s)(?:[^$\n]*?[^\s$])?\$)/g;
  const chunks: { text: string; type: "text" | "emoji" | "math" }[] = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const before = text.substring(lastIndex, match.index);
    if (before) {
      chunks.push({ text: before, type: "text" });
    }
    if (match[1]) {
      chunks.push({ text: match[1], type: "emoji" });
    } else if (match[2]) {
      chunks.push({ text: match[2], type: "math" });
    }
    lastIndex = regex.lastIndex;
  }

  const rest = text.substring(lastIndex);
  if (rest) {
    chunks.push({ text: rest, type: "text" });
  }

  if (chunks.length === 0 && text) {
    chunks.push({ text, type: "text" });
  }

  return chunks;
}

/**
 * Splits a text into sub-segments based on scripts: bangla, arabic, or english/others.
 * This guarantees proper font and size mappings and keeps auxiliary symbols, punctuation,
 * spaces, and digits matching the wrapping script block.
 */
function splitScripts(
  text: string,
): { text: string; script: "bangla" | "arabic" | "english" }[] {
  const isArabicChar = (c: string) =>
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      c,
    );
  const isBanglaChar = (c: string) =>
    /[\u0980-\u09FF\u0964\u0965\u200C\u200D]/.test(c);
  const isNeutralChar = (c: string) =>
    /[\s0-9.,;:\-—–_+=/\\|?!@#$%^&*()\[\]{}<>'"`~।‘’“”]/.test(c);

  if (!text) return [];

  const chars = Array.from(text);
  const runs: { text: string; script: "bangla" | "arabic" | "english" }[] = [];

  let currentScript: "bangla" | "arabic" | "english" | null = null;
  let currentBuffer: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    let charScript: "bangla" | "arabic" | "english" | "neutral";

    if (isBanglaChar(c)) {
      charScript = "bangla";
    } else if (isArabicChar(c)) {
      charScript = "arabic";
    } else if (isNeutralChar(c)) {
      charScript = "neutral";
    } else {
      charScript = "english";
    }

    if (currentScript === null) {
      if (charScript === "neutral") {
        let nextStrong: "bangla" | "arabic" | "english" = "english";
        for (let j = i + 1; j < chars.length; j++) {
          if (isBanglaChar(chars[j])) {
            nextStrong = "bangla";
            break;
          }
          if (isArabicChar(chars[j])) {
            nextStrong = "arabic";
            break;
          }
          if (!isNeutralChar(chars[j])) {
            nextStrong = "english";
            break;
          }
        }
        currentScript = nextStrong;
      } else {
        currentScript = charScript;
      }
    }

    if (charScript !== "neutral" && charScript !== currentScript) {
      if (currentBuffer.length > 0) {
        runs.push({ text: currentBuffer.join(""), script: currentScript });
        currentBuffer = [];
      }
      currentScript = charScript;
    }

    currentBuffer.push(c);
  }

  if (currentBuffer.length > 0 && currentScript !== null) {
    runs.push({ text: currentBuffer.join(""), script: currentScript });
  }

  const mergedRuns: {
    text: string;
    script: "bangla" | "arabic" | "english";
  }[] = [];
  for (const r of runs) {
    if (
      mergedRuns.length > 0 &&
      mergedRuns[mergedRuns.length - 1].script === r.script
    ) {
      mergedRuns[mergedRuns.length - 1].text += r.text;
    } else {
      mergedRuns.push(r);
    }
  }

  return mergedRuns;
}

/**
 * Traverses sub-elements recursively to build rich text runs, ignoring duplicate KaTeX elements,
 * mapping equations to OMML, with robust fallback and assigning specific font engines for Bengali, English, and Emojis.
 */
function walkParagraphNodes(
  node: Node,
  parentStyle: ElementStyle,
  activeBold: boolean,
  activeItalic: boolean,
  runsArray: any[],
) {
  if (node.nodeType === Node.TEXT_NODE) {
    let txt = node.textContent;
    if (txt) {
      // Find out if we should preserve local hard code line newlines (pre, pre-wrap structures)
      let preserveLines = false;
      let parentEl = node.parentElement;
      while (parentEl) {
        const pTag = parentEl.tagName.toLowerCase();
        if (
          pTag === "pre" ||
          (pTag === "code" &&
            parentEl.parentElement?.tagName.toLowerCase() === "pre")
        ) {
          preserveLines = true;
          break;
        }
        const classes = parentEl.className || "";
        if (
          classes.includes("whitespace-pre") ||
          classes.includes("whitespace-pre-wrap") ||
          classes.includes("whitespace-pre-line") ||
          classes.includes("whitespace-break-spaces") ||
          parentEl.style.whiteSpace === "pre" ||
          parentEl.style.whiteSpace === "pre-wrap" ||
          parentEl.style.whiteSpace === "pre-line" ||
          parentEl.style.whiteSpace === "break-spaces"
        ) {
          preserveLines = true;
          break;
        }
        parentEl = parentEl.parentElement;
      }

      if (preserveLines) {
        const lines = txt.split(/\r?\n/);
        for (let l = 0; l < lines.length; l++) {
          const line = lines[l];
          if (line) {
            const chunks = splitTextSegments(line);
            for (const chunk of chunks) {
              if (chunk.type === "emoji") {
                runsArray.push(
                  new TextRun({
                    text: chunk.text,
                    bold: activeBold,
                    italics: activeItalic,
                    superScript: parentStyle.superScript,
                    subScript: parentStyle.subScript,
                    size: parentStyle.size,
                    font: "Segoe UI Emoji",
                  }),
                );
              } else if (chunk.type === "math") {
                const formula = chunk.text.slice(1, -1);
                try {
                  const mathml = getMathMLString(formula, false);
                  runsArray.push(
                    renderInlineMathToRun(mathml, formula, parentStyle),
                  );
                } catch (err) {
                  runsArray.push(
                    new TextRun({
                      text: formula,
                      italics: true,
                      color: parentStyle.color,
                      font: {
                        ascii: activeEnglishFont,
                        hAnsi: activeEnglishFont,
                        cs: activeEnglishFont,
                        eastAsia: activeEnglishFont,
                      },
                    }),
                  );
                }
              } else {
                const subChunks = splitScripts(chunk.text);
                for (const sub of subChunks) {
                  const isAr = sub.script === "arabic";
                  const isBn = sub.script === "bangla";
                  const targetFont = isAr
                    ? activeArabicFont
                    : isBn
                      ? activeBanglaFont
                      : activeEnglishFont;
                  const targetSize = isAr
                    ? activeArabicFontSize
                    : isBn && activeBanglaFontSize !== null
                      ? activeBanglaFontSize
                      : parentStyle.size;
                  runsArray.push(
                    new TextRun({
                      text: sub.text,
                      bold: activeBold,
                      italics: activeItalic,
                      superScript: parentStyle.superScript,
                      subScript: parentStyle.subScript,
                      color: parentStyle.color,
                      size: targetSize,
                      font: {
                        ascii: targetFont,
                        hAnsi: targetFont,
                        cs: targetFont,
                        eastAsia: targetFont,
                      },
                    }),
                  );
                }
              }
            }
          }
          if (l < lines.length - 1) {
            runsArray.push(new TextRun({ break: 1 }));
          }
        }
        return;
      }

      // Normalize whitespace like a browser (newlines, tabs, multiple spaces become a single space)
      txt = txt.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
      if (txt === "") return;
      const chunks = splitTextSegments(txt);
      for (const chunk of chunks) {
        if (chunk.type === "emoji") {
          runsArray.push(
            new TextRun({
              text: chunk.text,
              bold: activeBold,
              italics: activeItalic,
              superScript: parentStyle.superScript,
              subScript: parentStyle.subScript,
              size: parentStyle.size,
              font: "Segoe UI Emoji",
            }),
          );
        } else if (chunk.type === "math") {
          const formula = chunk.text.slice(1, -1);
          try {
            const mathml = getMathMLString(formula, false);
            runsArray.push(renderInlineMathToRun(mathml, formula, parentStyle));
          } catch (err) {
            runsArray.push(
              new TextRun({
                text: formula,
                italics: true,
                color: parentStyle.color,
                font: {
                  ascii: activeEnglishFont,
                  hAnsi: activeEnglishFont,
                  cs: activeEnglishFont,
                  eastAsia: activeEnglishFont,
                },
              }),
            );
          }
        } else {
          // Explicitly assign Complex Script font families based on Bengali, Arabic, or English characters
          const subChunks = splitScripts(chunk.text);
          for (const sub of subChunks) {
            const isAr = sub.script === "arabic";
            const isBn = sub.script === "bangla";
            const targetFont = isAr
              ? activeArabicFont
              : isBn
                ? activeBanglaFont
                : activeEnglishFont;
            const targetSize = isAr
              ? activeArabicFontSize
              : isBn && activeBanglaFontSize !== null
                ? activeBanglaFontSize
                : parentStyle.size;
            runsArray.push(
              new TextRun({
                text: sub.text,
                bold: activeBold,
                italics: activeItalic,
                superScript: parentStyle.superScript,
                subScript: parentStyle.subScript,
                color: parentStyle.color,
                size: targetSize,
                font: {
                  ascii: targetFont,
                  hAnsi: targetFont,
                  cs: targetFont,
                  eastAsia: targetFont,
                },
              }),
            );
          }
        }
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Ignore duplicate KaTeX visual spans and aria-hidden structures to avoid dual rendering
    if (
      el.classList.contains("katex-html") ||
      el.getAttribute("aria-hidden") === "true"
    ) {
      return;
    }

    // Line break tag
    if (tag === "br") {
      runsArray.push(new TextRun({ break: 1 }));
      return;
    }

    // Direct standalone MathML tag
    if (tag === "math") {
      try {
        const rawEq =
          extractTeXAnnotation(el.outerHTML) || el.textContent || "";
        runsArray.push(renderInlineMathToRun(el.outerHTML, rawEq, parentStyle));
      } catch (err) {
        const rawEq =
          extractTeXAnnotation(el.outerHTML) || el.textContent || "";
        if (rawEq) {
          runsArray.push(
            new TextRun({
              text: rawEq,
              italics: true,
              color: parentStyle.color,
              font: {
                ascii: activeEnglishFont,
                hAnsi: activeEnglishFont,
                cs: activeEnglishFont,
                eastAsia: activeEnglishFont,
              },
            }),
          );
        }
      }
      return;
    }

    // Handled mathml or katex wrapper tags
    if (
      !activeSkipEquations &&
      (el.classList.contains("katex-mathml") || el.classList.contains("katex"))
    ) {
      const mathEl = el.querySelector("math");
      if (mathEl) {
        try {
          const rawEq =
            extractTeXAnnotation(mathEl.outerHTML) || el.textContent || "";
          runsArray.push(
            renderInlineMathToRun(mathEl.outerHTML, rawEq, parentStyle),
          );
        } catch (err) {
          const rawEq =
            extractTeXAnnotation(mathEl.outerHTML) || el.textContent || "";
          if (rawEq) {
            runsArray.push(
              new TextRun({
                text: rawEq,
                italics: true,
                color: parentStyle.color,
                font: {
                  ascii: activeEnglishFont,
                  hAnsi: activeEnglishFont,
                  cs: activeEnglishFont,
                  eastAsia: activeEnglishFont,
                },
              }),
            );
          }
        }
      } else {
        // Fallback for simple TeX or string equations
        const rawEq = el.textContent || "";
        if (rawEq) {
          runsArray.push(
            new TextRun({
              text: rawEq,
              italics: true,
              color: parentStyle.color,
              font: {
                ascii: activeEnglishFont,
                hAnsi: activeEnglishFont,
                cs: activeEnglishFont,
                eastAsia: activeEnglishFont,
              },
            }),
          );
        }
      }
      return;
    }

    // Check if inline LaTeX equation is inside code/span elements (e.g. $17^\circ\text{C}$)
    const textContent = el.textContent || "";
    if (
      !activeSkipEquations &&
      (tag === "code" || tag === "span") &&
      textContent.startsWith("$") &&
      textContent.endsWith("$") &&
      !textContent.startsWith("$$")
    ) {
      const formula = textContent.slice(1, -1);
      try {
        const mathml = getMathMLString(formula, false);
        runsArray.push(renderInlineMathToRun(mathml, formula, parentStyle));
        return;
      } catch (err) {
        // Fallback to text formatting instead of crashing on LaTeX syntax error (e.g. \text{_total})
        runsArray.push(
          new TextRun({
            text: formula,
            italics: true,
            color: parentStyle.color,
            font: {
              ascii: activeEnglishFont,
              hAnsi: activeEnglishFont,
              cs: activeEnglishFont,
              eastAsia: activeEnglishFont,
            },
          }),
        );
        return;
      }
    }

    let isBold =
      activeBold ||
      ["strong", "b", "th"].includes(tag) ||
      el.classList.contains("font-bold");
    let isItalic =
      activeItalic ||
      ["em", "i"].includes(tag) ||
      el.classList.contains("italic");
    let isSubScript =
      parentStyle.subScript || tag === "sub" || el.classList.contains("sub");
    let isSuperScript =
      parentStyle.superScript || tag === "sup" || el.classList.contains("sup");

    const cellStyle = parseElementStyles(el);
    cellStyle.subScript = isSubScript;
    cellStyle.superScript = isSuperScript;
    // Inherit text color and size from parent if not local
    if (
      cellStyle.color === "000000" &&
      parentStyle.color &&
      parentStyle.color !== "000000"
    ) {
      cellStyle.color = parentStyle.color;
    }
    if (cellStyle.size === 26 && parentStyle.size && parentStyle.size !== 26) {
      cellStyle.size = parentStyle.size;
    }

    for (const child of Array.from(node.childNodes)) {
      walkParagraphNodes(child, cellStyle, isBold, isItalic, runsArray);
    }
  }
}

/**
 * Master HTML to Word DOCX parsing engine
 */
export async function convertHTMLToDocxBlob(
  htmlString: string,
  config: ConversionConfig,
  onLog: (log: ConversionLog) => void,
): Promise<Blob> {
  // Bind dynamic customizable fonts set in user configuration boxes
  if (config.banglaFont) {
    activeBanglaFont = config.banglaFont;
  }
  if (config.englishFont) {
    activeEnglishFont = config.englishFont;
  }
  if (config.arabicFont) {
    activeArabicFont = config.arabicFont;
  }
  if (config.arabicFontSize) {
    activeArabicFontSize = config.arabicFontSize * 2;
  }
  if (config.banglaFontSize) {
    activeBanglaFontSize = config.banglaFontSize * 2;
  } else {
    activeBanglaFontSize = null;
  }
  activeForceBlackText = !!config.forceBlackText;
  activeSkipEquations = !!config.skipEquations;

  const logs: ConversionLog[] = [];
  const addLog = (
    type: "info" | "warning" | "error",
    message: string,
    details?: string,
  ) => {
    const l: ConversionLog = {
      id: Math.random().toString(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      details,
    };
    onLog(l);
  };

  addLog(
    "info",
    "ডকুমেন্ট পার্সিং শুরু করা হচ্ছে...",
    "HTML DOM parser initializing.",
  );

  // 1. Browser Client DOM Parsing
  const parser = new DOMParser();
  const cleanedHtml = repairMalformedSpanTags(htmlString);
  const doc = parser.parseFromString(cleanedHtml, "text/html");
  const body = doc.body;

  // Global DOM pre-processing to eliminate KaTeX visual counterparts and aria-hidden duplications
  const katexHtmls = doc.querySelectorAll(".katex-html");
  katexHtmls.forEach((node) => node.remove());

  const ariaHiddens = doc.querySelectorAll("[aria-hidden='true']");
  ariaHiddens.forEach((node) => node.remove());

  const docxElements: any[] = [];

  // Helper values
  const pageMarginTwips = {
    top: config.margins.top * 1440,
    bottom: config.margins.bottom * 1440,
    left: config.margins.left * 1440,
    right: config.margins.right * 1440,
  };

  addLog("info", `পেজ মার্জিন ও লেআউট সেটআপ করা হয়েছে (${config.orientation})`);

  // Helper recursive block elements parsing engine
  async function parseBlocks(
    nodes: Node[],
    parentStyle: ElementStyle,
    elementsArray: any[],
  ): Promise<void> {
    let inlineBuffer: Node[] = [];

    const flushInlineBuffer = () => {
      if (inlineBuffer.length === 0) return;

      // Prevent creating empty paragraphs for pure HTML formatting whitespace
      const hasContent = inlineBuffer.some((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          return (n.textContent || "").trim() !== "";
        }
        return true;
      });

      if (!hasContent) {
        inlineBuffer = [];
        return;
      }

      const textRuns: any[] = [];
      for (const bufNode of inlineBuffer) {
        if (bufNode.nodeType === Node.TEXT_NODE) {
          walkParagraphNodes(
            bufNode,
            parentStyle,
            parentStyle.bold,
            parentStyle.italic,
            textRuns,
          );
        } else {
          const elStyle = {
            ...parentStyle,
            ...parseElementStyles(bufNode as HTMLElement),
          };
          walkParagraphNodes(
            bufNode,
            elStyle,
            elStyle.bold,
            elStyle.italic,
            textRuns,
          );
        }
      }
      if (textRuns.length > 0) {
        elementsArray.push(
          new Paragraph({
            children: textRuns,
            alignment: parentStyle.alignment,
            spacing: { before: 60, after: 120 },
          }),
        );
      }
      inlineBuffer = [];
    };

    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx];

      if (node.nodeType === Node.TEXT_NODE) {
        const textVal = node.textContent;
        if (textVal) {
          inlineBuffer.push(node);
        }
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Ignore duplicate KaTeX visual spans and aria-hidden structures to avoid dual rendering
      if (
        el.classList.contains("katex-html") ||
        el.getAttribute("aria-hidden") === "true"
      ) {
        continue;
      }

      const isMathBlock =
        !activeSkipEquations &&
        (el.classList.contains("katex-display") ||
          (tag === "math" && el.getAttribute("display") === "block"));
      const blockTags = [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "div",
        "pre",
        "blockquote",
        "table",
        "ul",
        "ol",
        "li",
        "figure",
        "section",
        "article",
        "header",
        "footer",
        "main",
        "body",
        "center",
        "hr",
      ];

      if (!blockTags.includes(tag) && !isMathBlock) {
        // Tag is inline (span, math, strong, code, etc)
        inlineBuffer.push(node);
        continue;
      }

      // Flush inline buffer before processing a block
      flushInlineBuffer();

      if (isMathBlock) {
        try {
          const mathEl = tag === "math" ? el : el.querySelector("math") || el;
          let mathml = mathEl.outerHTML;
          if (mathEl.tagName.toLowerCase() !== "math") {
            mathml = getMathMLString(mathEl.textContent || "", true);
          }

          if (!containsComplexMath(mathml)) {
            const docxMath = convertMathMLToDocxMath(mathml);
            if (docxMath) {
              elementsArray.push(
                new Paragraph({
                  children: [docxMath],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 240, after: 240 },
                }),
              );
              continue;
            }
          }

          elementsArray.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: constructMathPlaceholder(mathml, false),
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 240, after: 240 },
            }),
          );
        } catch (e) {
          // Fallback safely to inline buffer if mapping fails completely
          inlineBuffer.push(node);
        }
        continue;
      }

      try {
        // Check if div/element represents a custom alert/warning dialogue box
        const isAlertBox =
          el.classList.contains("alert") ||
          el.classList.contains("warning") ||
          el.className.includes("bg-amber-") ||
          el.className.includes("border-amber-") ||
          el.className.includes("bg-red-") ||
          el.className.includes("border-red-") ||
          el.className.includes("bg-yellow-") ||
          el.className.includes("border-yellow-");

        if (tag === "div" && isAlertBox) {
          const isDanger =
            el.className.includes("red-") || el.className.includes("danger");
          const fillColor = isDanger ? "FEF2F2" : "FFFBEB"; // Light red or Amber tint
          const borderColor = isDanger ? "EF4444" : "F59E0B"; // Rich red or Amber

          const styles = parseElementStyles(el);
          const paragraphChildrenElements: any[] = [];
          walkParagraphNodes(
            el,
            styles,
            styles.bold,
            styles.italic,
            paragraphChildrenElements,
          );

          elementsArray.push(
            new Paragraph({
              children: paragraphChildrenElements,
              indent: { left: 480, right: 240 },
              spacing: {
                before: 180,
                after: 180,
              },
              shading: {
                fill: fillColor,
                type: ShadingType.CLEAR,
              },
              border: {
                left: {
                  color: borderColor,
                  size: 32, // 4pt thickness
                  style: BorderStyle.SINGLE,
                  space: 16,
                },
              },
            }),
          );
          continue;
        }

        // Container element check: recurse in children if block structures exist inside
        const isContainer = [
          "div",
          "section",
          "article",
          "header",
          "footer",
          "main",
          "body",
          "center",
        ].includes(tag);
        if (isContainer) {
          const hasBlocks =
            el.querySelector(
              "p, h1, h2, h3, h4, h5, h6, table, ul, ol, blockquote, div, section, article, math[display='block'], span.katex-display",
            ) !== null;

          if (hasBlocks) {
            const elStyle = parseElementStyles(el);
            const currentStyle = { ...parentStyle, ...elStyle };
            if (
              elStyle.color === "000000" &&
              parentStyle.color &&
              parentStyle.color !== "000000"
            ) {
              currentStyle.color = parentStyle.color;
            }
            if (
              elStyle.size === 26 &&
              parentStyle.size &&
              parentStyle.size !== 26
            ) {
              currentStyle.size = parentStyle.size;
            }

            await parseBlocks(
              Array.from(el.childNodes),
              currentStyle,
              elementsArray,
            );
            continue;
          }
        }

        // Headings & Normal paragraphs mapping
        if (
          ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "pre"].includes(tag)
        ) {
          const rawStyles = parseElementStyles(el);
          const styles = { ...parentStyle, ...rawStyles };
          if (
            rawStyles.color === "000000" &&
            parentStyle.color &&
            parentStyle.color !== "000000"
          ) {
            styles.color = parentStyle.color;
          }
          if (rawStyles.size === 26 && parentStyle.size !== 26) {
            styles.size = parentStyle.size;
          }
          if (
            rawStyles.alignment === AlignmentType.START &&
            parentStyle.alignment !== AlignmentType.START
          ) {
            styles.alignment = parentStyle.alignment;
          }

          const paragraphChildrenElements: any[] = [];
          walkParagraphNodes(
            el,
            styles,
            styles.bold,
            styles.italic,
            paragraphChildrenElements,
          );

          elementsArray.push(
            new Paragraph({
              children: paragraphChildrenElements,
              alignment: styles.alignment,
              indent: styles.indentLeft
                ? { left: styles.indentLeft }
                : undefined,
              spacing: {
                before:
                  styles.spacingBefore !== undefined
                    ? styles.spacingBefore
                    : 80,
                after:
                  styles.spacingAfter !== undefined ? styles.spacingAfter : 160,
              },
            }),
          );
          continue;
        }

        // Blockquotes parsing
        if (tag === "hr") {
          elementsArray.push(
            new Paragraph({
              border: {
                bottom: {
                  color: "CBD5E1",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6, // 3/4 pt
                },
              },
              spacing: {
                before: 120,
                after: 120,
              },
            }),
          );
          continue;
        }

        if (tag === "blockquote") {
          const styles = parseElementStyles(el);
          const paragraphChildrenElements: any[] = [];
          walkParagraphNodes(
            el,
            styles,
            styles.bold,
            styles.italic,
            paragraphChildrenElements,
          );

          elementsArray.push(
            new Paragraph({
              children: paragraphChildrenElements,
              indent: { left: 540, right: 180 },
              spacing: {
                before: 180,
                after: 180,
              },
              shading: {
                fill: "F1F5F9", // Slate-100 backdrop matching design theme
                type: ShadingType.CLEAR,
              },
              border: {
                left: {
                  color: "2563EB",
                  size: 24, // 3pt thickness
                  style: BorderStyle.SINGLE,
                  space: 12,
                },
              },
            }),
          );
          continue;
        }

        // High-resolution lists utilizing native Word bullet/number properties
        if (tag === "ul" || tag === "ol") {
          const listItems = Array.from(el.children).filter(
            (c) => c.tagName.toLowerCase() === "li",
          );
          const builtInStyle = tag === "ul" ? "ListBullet" : "ListNumber";

          listItems.forEach((li) => {
            const lStyles = parseElementStyles(li as HTMLElement);
            const listRuns: any[] = [];
            walkParagraphNodes(
              li,
              lStyles,
              lStyles.bold,
              lStyles.italic,
              listRuns,
            );

            elementsArray.push(
              new Paragraph({
                children: listRuns,
                style: builtInStyle,
                spacing: {
                  before: 40,
                  after: 40,
                },
              }),
            );
          });
          continue;
        }

        // Microsoft Word High-Fidelity Tables mapping
        if (tag === "table") {
          const rows: TableRow[] = [];
          const allTrs = Array.from(el.querySelectorAll("tr"));

          // Compile columns and proportional widths
          const maxCellsInRow = Math.max(
            ...allTrs.map((tr) => tr.querySelectorAll("td, th").length),
          );

          // Let Word grid handle width dynamically based on content but provide baseline width (100% / cols)
          const columnWidthPCT = Math.floor(100 / maxCellsInRow);

          for (let trIdx = 0; trIdx < allTrs.length; trIdx++) {
            if (trIdx % 15 === 0 && trIdx > 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }

            const tr = allTrs[trIdx];
            const cells: TableCell[] = [];
            const htmlCells = Array.from(tr.querySelectorAll("td, th"));
            const isHeaderRow =
              tr.parentElement?.tagName.toLowerCase() === "thead" ||
              trIdx === 0 ||
              htmlCells.every((c) => c.tagName.toLowerCase() === "th");

            for (let cellIdx = 0; cellIdx < htmlCells.length; cellIdx++) {
              const cell = htmlCells[cellIdx] as HTMLElement;
              const isHeaderCell =
                cell.tagName.toLowerCase() === "th" || isHeaderRow;
              const cellStyle = parseElementStyles(cell);

              const cellChildren: any[] = [];
              await parseBlocks(
                Array.from(cell.childNodes),
                cellStyle,
                cellChildren,
              );

              if (cellChildren.length === 0) {
                cellChildren.push(new Paragraph(""));
              }

              // Shading background styling
              let shadingFill = undefined;
              if (cellStyle.backgroundColor) {
                shadingFill = cellStyle.backgroundColor;
              } else if (isHeaderCell) {
                shadingFill = "E2E8F0"; // Distinct elegant grey headers
              } else if (trIdx % 2 === 1) {
                shadingFill = "F8FAFC"; // Clean alternating zebra rows
              }

              // Margin cell pads
              const paddingTwips = {
                top: 150,
                bottom: 150,
                left: 200,
                right: 200,
              };

              cells.push(
                new TableCell({
                  children: cellChildren,
                  width: {
                    size: `${columnWidthPCT}%`,
                    type: WidthType.PERCENTAGE,
                  },
                  shading: shadingFill ? { fill: shadingFill } : undefined,
                  margins: {
                    top: paddingTwips.top,
                    bottom: paddingTwips.bottom,
                    left: paddingTwips.left,
                    right: paddingTwips.right,
                  },
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                  },
                }),
              );
            }

            // Pad any missing cells to prevent layout corruption in Microsoft Word
            while (cells.length < maxCellsInRow) {
              cells.push(
                new TableCell({
                  children: [new Paragraph("")],
                  width: {
                    size: `${columnWidthPCT}%`,
                    type: WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CBD5E1",
                    },
                  },
                }),
              );
            }

            rows.push(
              new TableRow({ children: cells, tableHeader: isHeaderRow }),
            );
          }

          const wordTable = new Table({
            rows,
            width: {
              size: "100%",
              type: WidthType.PERCENTAGE,
            },
          });

          elementsArray.push(wordTable);
          elementsArray.push(new Paragraph({ spacing: { after: 120 } }));
          continue;
        }

        // Standalone text nodes / fallback safely
        const textVal = el.textContent?.trim();
        if (textVal) {
          const textRuns: any[] = [];
          walkParagraphNodes(
            el,
            parseElementStyles(el),
            false,
            false,
            textRuns,
          );
          elementsArray.push(new Paragraph({ children: textRuns }));
        }
      } catch (err: any) {
        addLog(
          "error",
          `${tag.toUpperCase()} ট্যাগটি রূপান্তর করার সময় এরর ঘটেছে`,
          err.message || "Unknown compile fail",
        );
      }
    }

    // Flush any remaining active inline elements at end of block
    flushInlineBuffer();
  }

  const defaultBaseStyle: ElementStyle = {
    bold: false,
    italic: false,
    color: "000000",
    size: 26, // Default 13pt (26 half-points)
    alignment: AlignmentType.START,
  };

  await parseBlocks(
    Array.from(body.childNodes),
    defaultBaseStyle,
    docxElements,
  );

  // Generate the document
  const wordDoc = new Document({
    styles: {
      default: {
        document: {
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing for better default spacing readability
              lineRule: "auto",
              after: 120, // 6pt
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: pageMarginTwips,
            size: {
              orientation: config.orientation,
            },
          },
        },
        children: docxElements,
      },
    ],
  });

  addLog("info", "সার্ভিসটি ডকএক্স (DOCX) বাইনারি প্যাক করছে...");

  // Pack to Blob
  const blob = await Packer.toBlob(wordDoc);

  // Post-process to replace math placeholders with unescaped raw Math XML
  let finalBlob = blob;
  try {
    const zip = await JSZip.loadAsync(blob);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (docXml) {
      const regex =
        /<w:p(?:\s+[^>]*)*>(?:(?!<\/w:p>).)*?__MP_START__([a-zA-Z0-9]+)__(.*?)__MP_END__\1__(?:(?!<w:p[>\s]).)*?<\/w:p>/gs;

      const decodeXml = (encoded: string): string => {
        return encoded
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
      };

      let replacedXml = docXml;

      // 1. Process block math placeholders (replaces the entire paragraph)
      const blockRegex =
        /<w:p(?:\s+[^>]*)*>(?:(?!<\/w:p>).)*?__MP_START__([a-zA-Z0-9]+)__(.*?)__MP_END__\1__(?:(?!<w:p[>\s]).)*?<\/w:p>/gs;
      replacedXml = replacedXml.replace(
        blockRegex,
        (match, id, encodedPayload) => {
          return decodeXml(encodedPayload);
        },
      );

      // 2. Process inline math placeholders (replaces just the run containing the marker)
      const inlineRegex =
        /<w:r(?:\s+[^>]*)*>(?:(?!<\/w:r>).)*?__M_INLINE_START__([a-zA-Z0-9]+)__(.*?)__M_INLINE_END__\1__(?:(?!<w:r[>\s]).)*?<\/w:r>/gs;
      replacedXml = replacedXml.replace(
        inlineRegex,
        (match, id, encodedPayload) => {
          return decodeXml(encodedPayload);
        },
      );

      zip.file("word/document.xml", replacedXml);
      finalBlob = await zip.generateAsync({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }
  } catch (err) {
    console.error("Error post-processing DOCX for center math blocks:", err);
  }

  addLog("info", "অভিনন্দন! ডকএক্স (DOCX) ডকুমেন্ট জেনারেশন সফল হয়েছে।");
  return finalBlob;
}
