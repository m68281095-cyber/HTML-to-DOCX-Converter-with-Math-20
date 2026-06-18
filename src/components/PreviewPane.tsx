import { useRef, useEffect, useMemo } from "react";
import { Eye, FileCode, CheckCircle, Smartphone, Monitor } from "lucide-react";
import { ConversionConfig, HTMLFileData } from "../types";
import renderMathInElement from "katex/contrib/auto-render";

function isColorStrGrey(colorVal: string): boolean {
  let cleanValue = colorVal.trim().toLowerCase();
  
  // 1. Check if name matches standard grays
  if (["grey", "gray", "lightgray", "lightgrey", "darkgray", "darkgrey", "dimgray", "dimgrey", "slategray", "slategrey", "darkslategray", "darkslategrey"].includes(cleanValue)) {
    return true;
  }

  // 2. If it is rgb/rgba
  if (cleanValue.startsWith("rgb")) {
    const parts = cleanValue.replace(/rgba?\(/, "").replace(/\)/, "").split(",");
    if (parts.length >= 3) {
      const r = parseInt(parts[0].trim(), 10);
      const g = parseInt(parts[1].trim(), 10);
      const b = parseInt(parts[2].trim(), 10);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        if (r > 240 && g > 240 && b > 240) return false; // exclude near white
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return (max - min) < 45;
      }
    }
  }

  // 3. Hex check
  if (cleanValue.startsWith("#")) {
    let hex = cleanValue.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        if (r > 240 && g > 240 && b > 240) return false; // exclude near white
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return (max - min) < 45;
      }
    }
  }

  return false;
}

interface PreviewPaneProps {
  fileData: HTMLFileData;
  config: ConversionConfig;
  onChangeConfig: (cfg: Partial<ConversionConfig>) => void;
  onDownload: () => void;
  isDownloading: boolean;
  downloadProgress: number;
}

export default function PreviewPane({
  fileData,
  config,
  onChangeConfig,
  onDownload,
  isDownloading,
  downloadProgress
}: PreviewPaneProps) {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftContentRef = useRef<HTMLDivElement>(null);
  const rightContentRef = useRef<HTMLDivElement>(null);
  
  // Track scroll locking state to avoid cascade trigger recursion
  const trackingRef = useRef<"left" | "right" | null>(null);
  const scrollTimerRef = useRef<any>(null);

  // Dynamic on-the-fly HTML gray-to-black optimization and script-specific styles for pixel-perfect preview matches
  const processedContent = useMemo(() => {
    if (!fileData?.sanitizedContent) return "";

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(fileData.sanitizedContent, "text/html");

      // 0. If skipEquations is true, strip KaTeX equations or replace them with plain text
      if (config.skipEquations) {
        // Find math elements and standalone katex blocks
        // 1. Standalone <math> tags
        const mathTags = doc.querySelectorAll("math");
        mathTags.forEach((mathEl) => {
          const match = mathEl.outerHTML.match(/<annotation\s+encoding="application\/x-tex">([\s\S]*?)<\/annotation>/i);
          const rawEq = match ? match[1].trim() : (mathEl.textContent || "");
          const textNode = doc.createTextNode(rawEq ? ` ${rawEq} ` : "");
          mathEl.parentNode?.replaceChild(textNode, mathEl);
        });

        // 2. KaTeX spans (e.g. .katex or .katex-display or .katex-mathml)
        const katexSpans = doc.querySelectorAll(".katex, .katex-display, .katex-mathml");
        katexSpans.forEach((el) => {
          const mathEl = el.querySelector("math");
          const match = mathEl?.outerHTML.match(/<annotation\s+encoding="application\/x-tex">([\s\S]*?)<\/annotation>/i);
          const rawEq = match ? match[1].trim() : (el.textContent || "");
          const textNode = doc.createTextNode(rawEq ? ` ${rawEq} ` : "");
          el.parentNode?.replaceChild(textNode, el);
        });

        // 3. Remove .katex-html which are used for layout rendering
        const katexHtmls = doc.querySelectorAll(".katex-html");
        katexHtmls.forEach((el) => el.remove());
      }

      // 1. Wrap Arabic and Bangla text nodes in custom span elements with selected fonts
      const wrapArabicAndBanglaTextNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
          const isBangla = /[\u0980-\u09FF\u0964\u0965\u200C\u200D]/;
          
          const hasArabic = isArabic.test(text);
          const hasBangla = isBangla.test(text);
          
          if (hasArabic || hasBangla) {
            const parent = node.parentNode;
            if (parent && parent.nodeName.toLowerCase() !== "script" && parent.nodeName.toLowerCase() !== "style" && !(parent as HTMLElement).classList?.contains("katex")) {
              const fragment = doc.createDocumentFragment();
              const segments: { text: string; type: 'ar' | 'bn' | 'other' }[] = [];
              let currentStr = "";
              let currentType: 'ar' | 'bn' | 'other' = 'other';
              
              const chars = Array.from(text);
              for (const c of chars) {
                let type: 'ar' | 'bn' | 'other' = 'other';
                if (isArabic.test(c)) {
                  type = 'ar';
                } else if (isBangla.test(c)) {
                  type = 'bn';
                } else if (/[\s0-9.,;:\-—–_+=/\\|?!@#$%^&*()\[\]{}<>'"`~।‘’“”]/.test(c)) {
                  type = currentType;
                }
                
                if (type !== currentType) {
                  if (currentStr) {
                    segments.push({ text: currentStr, type: currentType });
                  }
                  currentStr = c;
                  currentType = type;
                } else {
                  currentStr += c;
                }
              }
              if (currentStr) {
                segments.push({ text: currentStr, type: currentType });
              }
              
              segments.forEach(seg => {
                if (seg.type === 'ar') {
                  const span = doc.createElement("span");
                  span.style.fontFamily = `"${config.arabicFont || "Al Qalam Kolkatta Quranic font"}", Amiri, Scheherazade New, serif`;
                  span.style.fontSize = `${config.arabicFontSize || 24}px`;
                  span.style.direction = "rtl";
                  span.style.unicodeBidi = "embed";
                  span.style.lineHeight = "1.5";
                  span.textContent = seg.text;
                  fragment.appendChild(span);
                } else if (seg.type === 'bn') {
                  const span = doc.createElement("span");
                  span.style.fontFamily = `"${config.banglaFont}", "Kalpurush", sans-serif`;
                  span.style.fontStyle = "normal";
                  if (config.banglaFontSize) {
                    span.style.fontSize = `${config.banglaFontSize}px`;
                  }
                  span.textContent = seg.text;
                  fragment.appendChild(span);
                } else {
                  fragment.appendChild(doc.createTextNode(seg.text));
                }
              });
              
              parent.replaceChild(fragment, node);
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.nodeName.toLowerCase();
          if (tagName !== "script" && tagName !== "style" && tagName !== "math" && !(node as HTMLElement).classList?.contains("katex")) {
            const children = Array.from(node.childNodes);
            children.forEach(child => wrapArabicAndBanglaTextNodes(child));
          }
        }
      };
 
      wrapArabicAndBanglaTextNodes(doc.body);

      // 2. Perform Gray-to-black optimization if requested
      if (config.forceBlackText) {
        const elements = doc.body.querySelectorAll("*");
        elements.forEach((el: any) => {
          if (el.tagName.toLowerCase() === "blockquote") {
            el.style.color = "#000000";
          }
          const styleAttr = el.getAttribute("style");
          if (styleAttr) {
            const colorVal = el.style.color;
            if (colorVal) {
              const isGrey = isColorStrGrey(colorVal);
              if (isGrey) {
                el.style.color = "#000500"; // Black-tinted
              }
            }
          }
          const classes = Array.from(el.classList) as string[];
          classes.forEach((cls) => {
            if (
              cls.startsWith("text-gray-") ||
              cls.startsWith("text-slate-") ||
              cls.startsWith("text-zinc-") ||
              cls.startsWith("text-neutral-") ||
              cls.startsWith("text-stone-") ||
              cls === "text-gray-550" ||
              cls === "text-slate-550" ||
              cls === "text-zinc-450"
            ) {
              el.classList.remove(cls);
              el.classList.add("text-black");
            }
          });
        });
      }

      return doc.body.innerHTML;
    } catch (err) {
      console.error("DOM Parsing failed during processedContent generation:", err);
      return fileData.sanitizedContent;
    }
  }, [fileData?.sanitizedContent, config.forceBlackText, config.arabicFont, config.arabicFontSize, config.banglaFont, config.banglaFontSize, config.skipEquations]);

  const syncScrollLeft = () => {
    if (trackingRef.current === "right") return;
    trackingRef.current = "left";

    const left = leftPaneRef.current;
    const right = rightPaneRef.current;

    if (left && right) {
      const maxLeft = left.scrollHeight - left.clientHeight;
      const maxRight = right.scrollHeight - right.clientHeight;
      if (maxLeft > 0) {
        const ratio = left.scrollTop / maxLeft;
        right.scrollTop = ratio * maxRight;
      }
    }

    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      trackingRef.current = null;
    }, 150);
  };

  const syncScrollRight = () => {
    if (trackingRef.current === "left") return;
    trackingRef.current = "right";

    const left = leftPaneRef.current;
    const right = rightPaneRef.current;

    if (left && right) {
      const maxLeft = left.scrollHeight - left.clientHeight;
      const maxRight = right.scrollHeight - right.clientHeight;
      if (maxRight > 0) {
        const ratio = right.scrollTop / maxRight;
        left.scrollTop = ratio * maxLeft;
      }
    }

    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      trackingRef.current = null;
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  // Use KaTeX auto-render to gracefully display LaTeX in the HTML preview panes
  useEffect(() => {
    const renderMath = (element: HTMLElement | null) => {
      if (!element) return;
      try {
        renderMathInElement(element, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false,
        });
      } catch (err) {
        // Prevent crashes on mathematically invalid rendering
        console.warn("Math rendering failed in preview pane", err);
      }
    };

    if (processedContent) {
      // Allow DOM to settle innerHTML before auto-rendering
      requestAnimationFrame(() => {
        renderMath(leftContentRef.current);
        renderMath(rightContentRef.current);
      });
    }
  }, [processedContent, config.englishFont, config.banglaFont]);

  return (
    <div className={`flex flex-col flex-1 h-auto lg:h-[calc(100vh-112px)] min-h-[500px] ${config.theme === "dark" ? "bg-slate-900" : "bg-[#F8F9FA]"}`}>
      {/* Mini control strip */}
      <div className={`flex items-center justify-between border-b px-6 py-2 shrink-0 select-none ${config.theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-300"}`}>
        <div className="flex items-center space-x-3 text-xs">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          <p className={`font-bold uppercase tracking-wider font-mono ${config.theme === "dark" ? "text-gray-305" : "text-gray-750"}`}>
            File: {fileData.name} ({Math.round(fileData.size / 1024)} KB)
          </p>
          <span className="text-gray-300 font-normal">|</span>
          <span className={`px-2.5 py-0.5 rounded-sm text-[10px] uppercase font-extrabold tracking-wider border ${
            config.skipEquations 
              ? (config.theme === "dark" ? "bg-red-950/20 text-red-400 border-red-900/50" : "bg-red-50 text-red-700 border-red-100")
              : (config.theme === "dark" ? "bg-slate-705 text-blue-400 border-slate-600" : "bg-blue-50 text-blue-700 border-blue-100")
          }`}>
            Equations: {config.skipEquations ? "Ignored / Disabled" : `${fileData.equationsCount} detected`}
          </span>
        </div>

        {/* Download Action with Geometric Balance Styling */}
        <div className="flex items-center space-x-3">
          {isDownloading ? (
            <div className="flex items-center space-x-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Bundling DOCX File...</span>
                <span className="text-[9px] font-mono text-gray-500">{downloadProgress}% completed</span>
              </div>
              <div className="h-1.5 w-20 overflow-hidden bg-gray-105 border border-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              id="action-download-docx"
              onClick={onDownload}
              className="px-6 py-2 bg-blue-600 font-bold uppercase text-[11px] tracking-wider text-white select-none hover:bg-blue-700 transition-all shadow-xs active:translate-y-0.5 cursor-pointer rounded-sm animate-none"
            >
              Export DOCX
            </button>
          )}
        </div>
      </div>

      {/* Font Configuration Panel */}
      <div className={`flex flex-wrap items-center gap-4 border-b px-6 py-3 text-xs select-none ${config.theme === "dark" ? "bg-slate-850 border-slate-700 text-gray-200" : "bg-gray-50 border-gray-300 text-gray-800"}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-600">ফন্ট সেটিংস (Custom Fonts):</span>
        </div>

        {/* First Box: Bengali Font */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">১ম বক্স (বাংলা ফন্ট):</span>
          <div className="flex items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
            <input
              type="text"
              value={config.banglaFont}
              onChange={(e) => onChangeConfig({ banglaFont: e.target.value })}
              className="px-2 py-1 text-xs text-gray-855 dark:text-gray-100 bg-transparent focus:outline-none w-36 border-r border-gray-200 dark:border-slate-700"
              placeholder="e.g. BCC Purno Semibold"
              title="বাংলা ফন্টের নাম যেমন: BCC Purno Semibold, Kalpurush, Siyam Rupali, Nikosh"
            />
            <select
              value={config.banglaFont}
              onChange={(e) => onChangeConfig({ banglaFont: e.target.value })}
              className="px-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[11px] focus:outline-none h-6 cursor-pointer border-none"
            >
              <option value="BCC Purno Semibold">BCC Purno Semibold</option>
              <option value="Kalpurush">Kalpurush</option>
              <option value="Nikosh">Nikosh</option>
              <option value="Siyam Rupali">Siyam Rupali</option>
              <option value="SolaimanLipi">SolaimanLipi</option>
              <option value="Vrinda">Vrinda</option>
              <option value="Arial">Arial</option>
            </select>
          </div>
        </div>

        {/* Action Button: Set All Bangla Font Size to 13 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (config.banglaFontSize === 13) {
                onChangeConfig({ banglaFontSize: undefined });
              } else {
                onChangeConfig({ banglaFontSize: 13 });
              }
            }}
            className={`px-3 py-1 bg-white hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-720 dark:text-slate-100 border dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded font-semibold text-xs tracking-tight transition-all flex items-center gap-1.5 h-7 cursor-pointer`}
            title="সব বাংলা লেখার ফন্ট সাইজ ১৩ করুন"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.banglaFontSize === 13 ? 'bg-emerald-500 animate-ping' : 'bg-blue-500'}`}></span>
            বাংলা ১৩ সাইজ করুন
          </button>
          {config.banglaFontSize && (
            <div className="flex items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
              <input
                type="number"
                value={config.banglaFontSize}
                onChange={(e) => onChangeConfig({ banglaFontSize: parseInt(e.target.value) || undefined })}
                className="px-2 py-0.5 text-xs text-gray-855 dark:text-gray-100 bg-transparent focus:outline-none w-12"
                min={6}
                max={72}
                title="বাংলা লেখার সাইজ পরিবর্তন"
              />
            </div>
          )}
        </div>

        {/* Second Box: English & Equations Font */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">২য় বক্স (ইংরেজি ও সমীকরণ):</span>
          <div className="flex items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
            <input
              type="text"
              value={config.englishFont}
              onChange={(e) => onChangeConfig({ englishFont: e.target.value })}
              className="px-2 py-1 text-xs text-gray-855 dark:text-gray-100 bg-transparent focus:outline-none w-36 border-r border-gray-200 dark:border-slate-700"
              placeholder="e.g. Cambria Math"
              title="ইংরেজি ও ইকুয়েশন ফন্টের নাম যেমন: Cambria Math, Times New Roman, Calibri"
            />
            <select
              value={config.englishFont}
              onChange={(e) => onChangeConfig({ englishFont: e.target.value })}
              className="px-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[11px] focus:outline-none h-6 cursor-pointer border-none"
            >
              <option value="Cambria Math">Cambria Math</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Calibri">Calibri</option>
              <option value="Arial">Arial</option>
              <option value="Cambria">Cambria</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>
        </div>

        {/* Third Box: Arabic Font */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">৩য় বক্স (আরবি ফন্ট):</span>
          <div className="flex items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
            <input
              type="text"
              value={config.arabicFont || "Al Qalam Kolkatta Quranic font"}
              onChange={(e) => onChangeConfig({ arabicFont: e.target.value })}
              className="px-2 py-1 text-xs text-gray-855 dark:text-gray-100 bg-transparent focus:outline-none w-36 border-r border-gray-200 dark:border-slate-700"
              placeholder="e.g. Al Qalam Kolkatta Quranic font"
              title="আরবি ফন্টের নাম যেমন: Al Qalam Kolkatta Quranic font, Traditional Arabic"
            />
            <select
              value={config.arabicFont || "Al Qalam Kolkatta Quranic font"}
              onChange={(e) => onChangeConfig({ arabicFont: e.target.value })}
              className="px-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[11px] focus:outline-none h-6 cursor-pointer border-none"
            >
              <option value="Al Qalam Kolkatta Quranic font">Al Qalam Kolkatta Quranic font</option>
              <option value="Amiri">Amiri</option>
              <option value="Scheherazade New">Scheherazade New</option>
              <option value="Traditional Arabic">Traditional Arabic</option>
              <option value="Simplified Arabic">Simplified Arabic</option>
              <option value="Arial">Arial</option>
            </select>
          </div>
        </div>

        {/* Fourth Box: Arabic Font Size */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">আরবি সাইজ:</span>
          <div className="flex items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
            <input
              type="number"
              value={config.arabicFontSize || 24}
              onChange={(e) => onChangeConfig({ arabicFontSize: parseInt(e.target.value) || 24 })}
              className="px-2 py-0.5 text-xs text-gray-855 dark:text-gray-100 bg-transparent focus:outline-none w-14"
              min={6}
              max={72}
              title="আরবি লেখার ফন্ট সাইজ"
            />
          </div>
        </div>

        {/* Third Box: Force Black Text */}
        <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-blue-200/50 dark:border-slate-700">
          <label className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!config.forceBlackText}
              onChange={(e) => onChangeConfig({ forceBlackText: e.target.checked })}
              className="w-4.5 h-4.5 text-blue-650 rounded border-gray-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-[12px]">ধূসর লেখা কালো করুন (Force Black)</span>
          </label>
        </div>

        {/* Dynamic Skip Equations Checkbox */}
        <div className="flex items-center gap-2 bg-red-50/50 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-red-200/50 dark:border-slate-700">
          <label className="flex items-center gap-2 font-bold text-red-800 dark:text-red-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!config.skipEquations}
              onChange={(e) => onChangeConfig({ skipEquations: e.target.checked })}
              className="w-4.5 h-4.5 text-red-650 rounded border-gray-300 dark:border-slate-600 focus:ring-red-500 cursor-pointer"
            />
            <span className="text-[12px]">সমীকরণ খুঁজবেন না (Ignore Equations)</span>
          </label>
        </div>

        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono hidden xl:inline">
          [১ম ফন্ট: বাংলা সব লেখার জন্য • ২য় ফন্ট: ইংরেজি ও ইকুয়েশনের জন্য • ৩য় ফন্ট: আরবি লেখার জন্য]
        </span>

        {/* Info Banner for BCC Purno Semibold */}
        <div className="w-full mt-1.5 p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-cyan-50/70 border-cyan-200/80 text-cyan-900 dark:bg-slate-800/80 dark:border-cyan-950/50 dark:text-cyan-200">
          <div className="flex items-start gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 shrink-0 mt-1.5"></span>
            <div>
              <p className="font-semibold text-[13px] text-cyan-950 dark:text-cyan-100 mb-0.5">সরকারি ‘BCC Purno Semibold’ ফন্ট সংক্রান্ত নোটিশ:</p>
              <p className="text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-300">
                এই ফন্টটি আপনার অপারেটিং সিস্টেম বা কম্পিউটারে ইনস্টল করা না থাকলে ব্রাউজারের প্রিভিউ এবং ডকএক্স (Word) ফাইলে হয়তো ডিফল্ট ফন্ট দেখা যাবে। ফন্টটির পূর্ণাঙ্গ সংস্করণের জন্য দয়া করে নিচে দেওয়া বাংলাদেশ সরকারের অফিশিয়াল লিংক বা পোর্টাল থেকে ফন্টটি ডাউনলোড করে আপনার কম্পিউটারে ইনস্টল করে নিন।
              </p>
            </div>
          </div>
          <a
            href="https://bangla.gov.bd/purno"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-md inline-flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer self-end sm:self-auto"
          >
            ফন্ট ডাউনলোড করুন (bangla.gov.bd) &rarr;
          </a>
        </div>
      </div>

      {/* Side by side Preview workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 lg:overflow-hidden lg:h-full h-auto">
        
        {/* Left Side: Live HTML Input preview */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-gray-300 h-auto lg:h-full lg:overflow-hidden select-none bg-white font-sans">
          <div className="h-10 flex items-center justify-between px-4 bg-gray-50 border-b border-gray-300">
            <span className="text-[11px] font-bold text-gray-550 uppercase tracking-wider">Source Code Panel</span>
            <div className="flex gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              <span className="w-2 h-2 rounded-full bg-slate-205"></span>
            </div>
          </div>
          <div
            ref={leftPaneRef}
            onScroll={syncScrollLeft}
            className="p-8 overflow-y-auto flex-1 select-text bg-[#FAFAFA]"
          >
            {/* Direct insert sanitized HTML */}
            <div
              ref={leftContentRef}
              className={`prose prose-sm max-w-none text-[#1A1A1A] ${config.forceBlackText ? "force-black-text" : ""}`}
              dangerouslySetInnerHTML={{ __html: processedContent }}
              style={{
                fontFamily: `"${config.englishFont}", "${config.banglaFont}", 'Inter', sans-serif`,
              }}
            />
          </div>
        </div>

        {/* Right Side: MS Word style Portrait/Landscape visual rendering preview */}
        <div className="flex flex-col h-auto lg:h-full lg:overflow-hidden select-none bg-[#E9EBEF]">
          <div className="h-10 flex items-center justify-between px-4 bg-gray-200 border-b border-gray-350">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider font-mono">Word Layout Engine Pre-render</span>
            <span className="bg-gray-300 text-gray-750 px-2 py-0.5 rounded-sm text-[9px] font-mono font-black scale-95 border border-gray-400">
              {config.orientation.toUpperCase()} SHEET
            </span>
          </div>
          
          <div
            ref={rightPaneRef}
            onScroll={syncScrollRight}
            className={`p-6 overflow-y-auto flex-1 select-text flex justify-center ${
              config.theme === "dark" ? "bg-slate-800" : "bg-[#E9EBEF]"
            }`}
          >
            {/* Elegant visual page sheet mock */}
            <div
              className={`shadow-2xl transition-all duration-350 bg-white border border-gray-300 transform origin-top my-4 select-text font-serif text-[#1A1A1A] ${
                config.orientation === "portrait"
                  ? "w-full max-w-[21cm] min-h-[29.7cm] p-8 md:p-14"
                  : "w-full max-w-[29.7cm] min-h-[21cm] p-8 md:p-14"
              }`}
              style={{
                paddingTop: `${config.margins.top * 1.5}cm`,
                paddingBottom: `${config.margins.bottom * 1.5}cm`,
                paddingLeft: `${config.margins.left * 1.5}cm`,
                paddingRight: `${config.margins.right * 1.5}cm`,
                fontFamily: config.defaultFont
              }}
            >
              {/* Dynamic simulated Header / Footers */}
              <div className="w-full text-[9px] text-gray-400 uppercase font-sans tracking-widest border-b border-gray-200 pb-2 mb-10 flex justify-between">
                <span>{config.title || "HTML to Word Conversion"}</span>
                <span>Page 1 of 1</span>
              </div>

              {/* Document content */}
              <div
                ref={rightContentRef}
                className={`prose prose-sm max-w-none text-slate-900 text-justify ${config.forceBlackText ? "force-black-text" : ""}`}
                dangerouslySetInnerHTML={{ __html: processedContent }}
                style={{
                  fontFamily: `"${config.englishFont}", "${config.banglaFont}", 'Inter', sans-serif`,
                }}
              />
              
              {/* Dynamic simulated Footer */}
              <div className="w-full text-[9px] text-gray-450 font-sans border-t border-gray-200 pt-3 mt-16 text-center tracking-widest uppercase">
                Generated with HTML2Word Compiler Platform • Highly Structured Native OpenXML Content
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
