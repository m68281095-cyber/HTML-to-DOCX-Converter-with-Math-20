import DOMPurify from "dompurify";
import { HTMLFileData } from "../types";

/**
 * Inline Web Worker code for background parsing of large HTML documents
 */
const workerCode = `
  self.onmessage = function(e) {
    const { htmlText } = e.data;
    
    // Find MathML blocks: <math ...> ... </math>
    const mathmlRegex = /<math[\\s\\S]*?<\\/math>/gi;
    const mathmlMatches = htmlText.match(mathmlRegex) || [];
    
    // Find Display LaTeX: $$...$$ or \[...\]
    const displayTexRegex2 = /\\\\\\[([\\\\s\\\\S]*?)\\\\\\]/g;
    const displayTexRegex = /\\$\\$([\\\\s\\\\S]*?)\\$\\$/g;
    
    // Find Inline LaTeX: $...$ or \(...\)
    const inlineTexRegex2 = /\\\\\\(([\\\\s\\\\S]*?)\\\\\\)/g;
    const inlineTexRegex = /\\$(?!\\s)([^$\\n]*?[^\\s$])?\\$/g;
    
    const equations = [];
    
    // Index equations to prevent duplicates
    let match;
    
    // 1. MathML
    for (const m of mathmlMatches) {
      equations.push({ type: 'mathml', content: m });
    }
    
    // 2. Display TeX ($$)
    while ((match = displayTexRegex.exec(htmlText)) !== null) {
      const latex = match[1]?.trim() || "";
      if (latex) equations.push({ type: 'latex-display', content: latex, raw: match[0] });
    }
    
    // 3. Display TeX (\\[...\\])
    while ((match = displayTexRegex2.exec(htmlText)) !== null) {
      const latex = match[1]?.trim() || "";
      if (latex) equations.push({ type: 'latex-display', content: latex, raw: match[0] });
    }
    
    // 4. Inline TeX ($)
    while ((match = inlineTexRegex.exec(htmlText)) !== null) {
      const latex = match[1]?.trim() || match[0].slice(1, -1)?.trim() || "";
      if (latex && !/^[0-9\\s.,+%\\-/*()=<>\\$\\u0980-\\u09FF]+$/.test(latex)) {
        equations.push({ type: 'latex-inline', content: latex, raw: match[0] });
      }
    }
    
    // Send back calculated equations and general statistics
    self.postMessage({
      equations,
      totalCount: equations.length
    });
  };
`;

export interface ParsedEquation {
  type: "mathml" | "latex-display" | "latex-inline";
  content: string;
  raw?: string;
}

export function validateHTMLPreparse(htmlText: string): string[] {
  const errors: string[] = [];

  // Basic check for unclosed key HTML tags that might corrupt layout before DOMPurify kicks in
  const openTags = (htmlText.match(/<div\b/gi) || []).length;
  const closeTags = (htmlText.match(/<\/div>/gi) || []).length;
  if (openTags !== closeTags) {
    errors.push(
      `HTML স্ট্রাকচারে অসামঞ্জস্যতা: <div> ট্যাগ ওপেন করা হয়েছে ${openTags} টি, কিন্তু ক্লোজ করা হয়েছে ${closeTags} টি। লেআউট ভেঙে যেতে পারে।`,
    );
  }

  const openTable = (htmlText.match(/<table\b/gi) || []).length;
  const closeTable = (htmlText.match(/<\/table>/gi) || []).length;
  if (openTable !== closeTable) {
    errors.push(
      `HTML টেবিল স্ট্রাকচারে অসামঞ্জস্যতা: <table> ওপেন ${openTable} টি, ক্লোজ ${closeTable} টি।`,
    );
  }

  // Check for potentially unbalanced LaTeX delimiters which might cause KaTeX syntax errors
  const doubleDollarCount = (htmlText.match(/\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    errors.push(
      `সমীকরণ সিনট্যাক্স ত্রুটি: ডিসপ্লে ল্যাটেক্স (LaTeX) এর '$$' চিহ্ন বিজোড় সংখ্যক বার ব্যবহার করা হয়েছে। সমীকরণ সঠিকভাবে রেন্ডার নাও হতে পারে।`,
    );
  }

  return errors;
}

/**
 * Async file reading with FileReader and background Web Worker indexing.
 */
export function parseUploadedHTML(
  file: File,
  onProgress: (percent: number) => void,
  skipEquations?: boolean,
): Promise<{ fileData: HTMLFileData; equations: ParsedEquation[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Track progression percentages
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 40); // Allocation: 40% file loading
        onProgress(percent);
      }
    };

    reader.onerror = () => {
      reject(new Error("ফাইলটি পড়তে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।"));
    };

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") {
        reject(new Error("ফাইল কন্টেন্ট পড়ার উপযোগী নয়।"));
        return;
      }

      onProgress(45); // File loaded completed

      const repairedResult = repairMalformedSpanTags(result);

      // 1. Client-Side XSS Protection Sanitization with DOMPurify
      // We allow standard MathML tags and SVG for Math layout representation
      const sanitized = DOMPurify.sanitize(repairedResult, {
        ADD_TAGS: [
          "math",
          "mrow",
          "mfrac",
          "mi",
          "mn",
          "mo",
          "msup",
          "msub",
          "msubsup",
          "msqrt",
          "mroot",
          "mfenced",
          "mtext",
          "annotation",
          "mover",
          "munder",
          "munderover",
          "mtable",
          "mtr",
          "mtd",
          "mspace",
          "semantics",
          "annotation-xml",
          "mstyle"
        ],
        ADD_ATTR: ["display", "open", "close", "class", "style", "id"],
      });
      onProgress(60);

      if (skipEquations) {
        onProgress(100);
        resolve({
          fileData: {
            name: file.name,
            size: file.size,
            content: repairedResult,
            sanitizedContent: sanitized,
            equationsCount: 0,
          },
          equations: [],
        });
        return;
      }

      try {
        // 2. Initialize Web Worker for background mathematical expression scanning
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
          const { equations, totalCount } = e.data;

          onProgress(100);

          worker.terminate();
          URL.revokeObjectURL(workerUrl);

          const fileData: HTMLFileData = {
            name: file.name,
            size: file.size,
            content: repairedResult,
            sanitizedContent: sanitized,
            equationsCount: totalCount,
          };

          resolve({
            fileData,
            equations,
          });
        };

        worker.onerror = (err) => {
          console.error(
            "Web Worker error, falling back to synchronous parse:",
            err,
          );
          worker.terminate();
          URL.revokeObjectURL(workerUrl);

          // Fallback parser inside main thread if worker block fails
          const fbEquations = parseHTMLSynchronouslyFallback(repairedResult);
          resolve({
            fileData: {
              name: file.name,
              size: file.size,
              content: repairedResult,
              sanitizedContent: sanitized,
              equationsCount: fbEquations.length,
            },
            equations: fbEquations,
          });
        };

        // Transfer task to the background thread
        worker.postMessage({ htmlText: repairedResult });
        onProgress(85);
      } catch (workerErr) {
        console.warn(
          "Could not start worker, resolving synchronously:",
          workerErr,
        );
        const fbEquations = parseHTMLSynchronouslyFallback(repairedResult);
        onProgress(100);
        resolve({
          fileData: {
            name: file.name,
            size: file.size,
            content: repairedResult,
            sanitizedContent: sanitized,
            equationsCount: fbEquations.length,
          },
          equations: fbEquations,
        });
      }
    };

    reader.readAsText(file);
  });
}

function parseHTMLSynchronouslyFallback(htmlText: string): ParsedEquation[] {
  const mathmlRegex = /<math[\s\S]*?<\/math>/gi;
  const mathmlMatches = htmlText.match(mathmlRegex) || [];
  const equations: ParsedEquation[] = [];

  for (const m of mathmlMatches) {
    equations.push({ type: "mathml", content: m });
  }

  // Display TeX ($$ or \[ \])
  const displayTexRegex = /\$\$([\s\S]+?)\$\$/g;
  const displayTexRegex2 = /\\\[([\s\S]+?)\\\]/g;
  let match;
  while ((match = displayTexRegex.exec(htmlText)) !== null) {
    if (match[1].trim()) {
      equations.push({
        type: "latex-display",
        content: match[1].trim(),
        raw: match[0],
      });
    }
  }
  while ((match = displayTexRegex2.exec(htmlText)) !== null) {
    if (match[1].trim()) {
      equations.push({
        type: "latex-display",
        content: match[1].trim(),
        raw: match[0],
      });
    }
  }

  // Inline TeX ($ or \( \))
  const inlineTexRegex = /\$(?!\s)([^$\n]*?[^\s$])?\$/g;
  const inlineTexRegex2 = /\\\(([\s\S]*?)\\\)/g;
  while ((match = inlineTexRegex.exec(htmlText)) !== null) {
    const latex = match[1]?.trim() || match[0].slice(1, -1)?.trim() || "";
    if (latex && !/^[0-9\s.,+%\-/*()=<>]+$/.test(latex)) {
      equations.push({
        type: "latex-inline",
        content: latex,
        raw: match[0],
      });
    }
  }
  while ((match = inlineTexRegex2.exec(htmlText)) !== null) {
    const latex = match[1]?.trim() || match[0].slice(2, -2)?.trim() || "";
    if (latex && !/^[0-9\s.,+%\-/*()=<>]+$/.test(latex)) {
      equations.push({
        type: "latex-inline",
        content: latex,
        raw: match[0],
      });
    }
  }

  return equations;
}

/**
 * Automatically repairs malformed HTML styling tags like `<span style="color: #2563eb}` or escaped tags
 */
export function repairMalformedSpanTags(htmlText: string): string {
  let repaired = htmlText;

  // 1. Normalize all variations of closing span tags first to standard </span>
  repaired = repaired.replace(/(?:&lt;|<)\/span\s*(?:&gt;|[>}]|&quot;|"|')?/gi, "</span>");

  // 2. Locate and process start tags. We match both escaped and unescaped starting span tags.
  // The match spans from (<span) or (&lt;span) to its end bracket/curly/quote.
  const spanStartRegex = /(?:&lt;|<)span\b(.*?)(?:&gt;|[>}]|&quot;[>}]|"[>}]|'[>}]|$)/gi;

  repaired = repaired.replace(spanStartRegex, (match, attrs) => {
    // If the span tag doesn't contain "color:", keep original content, but unescape start/end brackets safely.
    if (!/color\s*:/i.test(attrs)) {
      let cleanTag = match;
      if (cleanTag.toLowerCase().startsWith("&lt;")) {
        cleanTag = "<" + cleanTag.slice(4);
      }
      if (cleanTag.toLowerCase().endsWith("&gt;")) {
        cleanTag = cleanTag.slice(0, -4) + ">";
      }
      return cleanTag;
    }

    // Since it contains color, let's extract the clean color value.
    // Order in regex ensures we capture multi-value rgb/rgba expressions before single words.
    const colorMatch = attrs.match(/color\s*:\s*(rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|#[a-fA-F0-9]{3,6}|[a-zA-Z]+)/i);
    if (colorMatch) {
      const cleanColor = colorMatch[1].trim();
      return `<span style="color: ${cleanColor};">`;
    }

    // Default fallback to ensure valid HTML nesting if parsing was inconclusive
    return '<span style="color: #000000;">';
  });

  return repaired;
}
