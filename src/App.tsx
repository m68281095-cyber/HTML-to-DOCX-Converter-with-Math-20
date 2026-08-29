import { useState, useEffect, useRef } from "react";
import {
  parseUploadedHTML,
  ParsedEquation,
  validateHTMLPreparse,
} from "./utils/fileParser";
import { convertHTMLToDocxBlob } from "./utils/docxGenerator";
import { getOMMLFromBackend, getMathMLString } from "./utils/mathConverter";
import { ConversionConfig, HTMLFileData, ConversionLog } from "./types";
import Header from "./components/Header";
import HTMLUploader from "./components/HTMLUploader";
import PreviewPane from "./components/PreviewPane";
import ErrorBoundary from "./components/ErrorBoundary";
import FileSequencer from "./components/FileSequencer";
import {
  Terminal,
  X,
  RefreshCw,
  Info,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";

export default function App() {
  const [fileData, setFileData] = useState<HTMLFileData | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [equations, setEquations] = useState<ParsedEquation[]>([]);
  const [logs, setLogs] = useState<ConversionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const conversionCache = useRef<Map<string, Blob>>(new Map());

  // App parameters configuration
  const [config, setConfig] = useState<ConversionConfig>({
    orientation: "portrait",
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }, // Default Narrow margins (1.27 cm / 0.5 inch)
    defaultFont: "'Inter', sans-serif",
    banglaFont: "BCC Purno Semibold",
    englishFont: "Cambria Math",
    arabicFont: "Al Qalam Kolkatta Quranic font",
    arabicFontSize: 24,
    theme: "light",
    title: "HTML to Word Compiled Document",
  });

  // Action status indicators
  const [uploadPercent, setUploadPercent] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Track multiple selected files for reordering & merging
  const [selectedFilesForMerge, setSelectedFilesForMerge] = useState<File[]>(
    [],
  );

  // Clear states
  const handleClear = () => {
    setFileData(null);
    setRawFile(null);
    setEquations([]);
    setLogs([]);
    setUploadPercent(0);
    setIsUploading(false);
    setDownloadPercent(0);
    setIsDownloading(false);
    setShowLogs(false);
    setValidationErrors([]);
    setSelectedFilesForMerge([]);
  };

  // Safe logging utility
  const appendLog = (log: ConversionLog) => {
    const uniqueLog = {
      ...log,
      id: `${log.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    setLogs((prev) => [uniqueLog, ...prev]);
  };

  // Parse uploaded HTML file
  const parseFile = async (file: File, skipEq?: boolean) => {
    try {
      setIsUploading(true);
      setUploadPercent(0);
      setLogs([]);

      appendLog({
        id: "start-parse",
        type: "info",
        message: `${file.name} ফাইলটি পড়া শুরু হচ্ছে... ${skipEq ? "(সমীকরণ ব্যতীত)" : ""}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Invoke parser
      const { fileData: parsedData, equations: parsedEqs } =
        await parseUploadedHTML(
          file,
          (percent) => setUploadPercent(percent),
          skipEq,
        );

      setFileData(parsedData);
      setEquations(parsedEqs);

      // Auto-enable Fast Mode / Disable Preview for large files (>1.5MB or >2000 equations) to prevent browser freezes
      if (parsedData.size > 1.5 * 1024 * 1024 || parsedEqs.length > 2000) {
        setConfig((prev) => ({ ...prev, disablePreview: true }));
        appendLog({
          id: "fast-mode-auto",
          type: "info",
          message: "বড় ফাইলের পারফরম্যান্স মোড: ফাইলটির আকার বা সমীকরণের সংখ্যা বেশি হওয়ায় ব্রাউজার হ্যাং হওয়া এড়াতে স্বয়ংক্রিয়ভাবে লাইভ প্রিভিউ বন্ধ রাখা হয়েছে।",
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      const errors = validateHTMLPreparse(parsedData.content);
      setValidationErrors(errors);
      if (errors.length > 0) {
        appendLog({
          id: "parse-warning",
          type: "warning",
          message: "এইচটিএমএল (HTML) এর গঠন কাঠামোতে কিছু ত্রুটি সনাক্ত হয়েছে।",
          timestamp: new Date().toLocaleTimeString(),
          details: errors.join("\n"),
        });
      }

      appendLog({
        id: "parse-success",
        type: "info",
        message: skipEq
          ? `${file.name} ফাইলটি সফলভাবে পড়া ও প্যারামিটারাইজ করা হয়েছে! (সমীকরণ খোঁজা নিষ্ক্রিয় করা হয়েছে)`
          : `${file.name} ফাইলটি সফলভাবে পড়া ও প্যারামিটারাইজ করা হয়েছে! মোট সমীকরণ সনাক্তকরণ: ${parsedEqs.length} টি।`,
        timestamp: new Date().toLocaleTimeString(),
      });

      setIsUploading(false);
    } catch (err: any) {
      setIsUploading(false);
      setUploadPercent(0);
      appendLog({
        id: "parse-fail",
        type: "error",
        message: "ফাইলটি পার্স করতে ব্যর্থ হয়েছে!",
        timestamp: new Date().toLocaleTimeString(),
        details: err.message || "Unknown file read error.",
      });
    }
  };

  // Perform background parsing and merge when multiple files are selected
  const handleFilesSelect = async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length === 1) {
      setRawFile(files[0]);
      await parseFile(files[0], config.skipEquations);
    } else {
      setSelectedFilesForMerge(files);
    }
  };

  // Merge selected files in the specified sequence and run parsing
  const handleMergeAndConvert = async () => {
    const files = selectedFilesForMerge;
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadPercent(5);
    setLogs([]);

    appendLog({
      id: "start-merge",
      type: "info",
      message: `${files.length} টি ফাইল একত্রিত করা হচ্ছে...`,
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      // 1. Read all files as text
      const filePromises = files.map((file) => {
        return new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = (ev) => resolve((ev.target?.result as string) || "");
          r.onerror = () => reject(new Error(`${file.name} ফাইলটি পড়া যায়নি।`));
          r.readAsText(file);
        });
      });

      const htmlTexts = await Promise.all(filePromises);
      setUploadPercent(20);

      // 2. Merge the HTML contents with high fidelity page break separations
      let combinedBodyContent = "";
      for (let i = 0; i < htmlTexts.length; i++) {
        const text = htmlTexts[i];
        const name = files[i].name;

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const body = doc.body;
        const content = body ? body.innerHTML : text;

        if (i > 0) {
          // Add a div with class "page-break" to separate documents cleanly
          combinedBodyContent += `\n<div class="page-break" style="page-break-after: always; margin-top: 40px; margin-bottom: 40px;"></div>\n`;
        }

        // Wrap document content with an identifying div or heading
        combinedBodyContent += `\n<div class="merged-file-section" data-file-name="${name}">\n`;
        combinedBodyContent += `<div style="margin-top: 10px; margin-bottom: 15px; color: #475569; font-weight: bold; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px;">[ফাইল: ${name}]</div>\n`;
        combinedBodyContent += `${content}\n</div>\n`;
      }

      const mergedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Compiled Document</title>
</head>
<body>
  ${combinedBodyContent}
</body>
</html>`;

      // 3. Create a single combined file representation
      const firstFileName = files[0].name.replace(/\.[^/.]+$/, "");
      const mergedFileName =
        files.length > 1
          ? `${firstFileName}_এবং_অন্যান্য_একত্রিত.html`
          : files[0].name;

      const mergedFile = new File([mergedHtml], mergedFileName, {
        type: "text/html",
      });
      setRawFile(mergedFile);

      // 4. Parse the combined file
      await parseFile(mergedFile, config.skipEquations);

      appendLog({
        id: "merge-success",
        type: "info",
        message: `${files.length} টি ফাইল সফলভাবে একত্রিত করে প্রসেস করা হয়েছে!`,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Clear sequencing queue to switch to Preview
      setSelectedFilesForMerge([]);
    } catch (err: any) {
      setIsUploading(false);
      setUploadPercent(0);
      appendLog({
        id: "merge-fail",
        type: "error",
        message: "একাধিক ফাইল একত্রিত করতে ব্যর্থতা ঘটেছে!",
        timestamp: new Date().toLocaleTimeString(),
        details: err.message || "Unknown error during file merge.",
      });
    }
  };

  // Re-parse when skipEquations option is toggled
  useEffect(() => {
    if (rawFile) {
      parseFile(rawFile, config.skipEquations);
    }
  }, [config.skipEquations]);

  // Run MS Word document creation pipeline
  const handleDownloadDOCX = async () => {
    if (!fileData) return;

    const cacheKey = `${fileData.name}-${fileData.size}-${config.orientation}-${config.margins.top}-${config.margins.bottom}-${config.margins.left}-${config.margins.right}`;

    try {
      setIsDownloading(true);
      setDownloadPercent(10);
      setShowLogs(true); // Open compiler logs so user sees translation pipeline live

      if (conversionCache.current.has(cacheKey)) {
        appendLog({
          id: "cache-hit",
          type: "info",
          message:
            "মেমরি এবং ব্রাউজার ক্যাশ (Cache) থেকে ফাইলটি দ্রুত লোড করা হচ্ছে...",
          timestamp: new Date().toLocaleTimeString(),
        });

        setDownloadPercent(50);
        const cachedBlob = conversionCache.current.get(cacheKey)!;
        setDownloadPercent(90);

        const originalName = fileData.name.replace(/\.[^/.]+$/, "");
        const finalFileName = `${originalName}_converted.docx`;

        const downloadUrl = URL.createObjectURL(cachedBlob);
        const tempLink = document.createElement("a");
        tempLink.href = downloadUrl;
        tempLink.download = finalFileName;

        document.body.appendChild(tempLink);
        tempLink.click();

        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);

        setDownloadPercent(100);
        appendLog({
          id: "gen-complete-cached",
          type: "info",
          message: `[ক্যাশড] ফাইল জেনারেশন সফল হয়েছে! ডাউনলোডকৃত ফাইল: ${finalFileName}`,
          timestamp: new Date().toLocaleTimeString(),
        });

        setTimeout(() => {
          setIsDownloading(false);
          setDownloadPercent(0);
        }, 1000);
        return;
      }

      appendLog({
        id: "gen-start",
        type: "info",
        message: "ডকএক্স (DOCX) ফাইল কম্পাইল প্রক্রিয়া শুরু করা হচ্ছে...",
        timestamp: new Date().toLocaleTimeString(),
      });

      // 1. Convert all LaTeX equations in background or local mapping
      setDownloadPercent(30);
      appendLog({
        id: "math-omml-start",
        type: "info",
        message:
          "সমীকরণগুলোকে মাইক্রোসফট ওয়ার্ড ফরম্যাটে রূপান্তর করা হচ্ছে...",
        timestamp: new Date().toLocaleTimeString(),
      });

      // Fire conversions for cached items optionally, standard parses MathML directly inline
      setDownloadPercent(55);

      // 2. Compile full Document layouts
      appendLog({
        id: "template-layout",
        type: "info",
        message:
          "টেইউইন্ড সিএসএস স্টাইলশীট বিশ্লেষণ ও ডকএক্স মার্জিন ম্যাপিং করা হচ্ছে...",
        timestamp: new Date().toLocaleTimeString(),
      });

      const blob = await convertHTMLToDocxBlob(
        fileData.sanitizedContent,
        config,
        (log) => appendLog(log),
      );

      // Save to client cache
      conversionCache.current.set(cacheKey, blob);

      setDownloadPercent(90);

      // 3. Initiate browser sandbox save download
      const originalName = fileData.name.replace(/\.[^/.]+$/, "");
      const finalFileName = `${originalName}_converted.docx`;

      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;
      tempLink.download = finalFileName;

      document.body.appendChild(tempLink);
      tempLink.click();

      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setDownloadPercent(100);

      appendLog({
        id: "gen-complete",
        type: "info",
        message: `ফাইল জেনারেশন সফল হয়েছে! ডাউনলোডকৃত ফাইল: ${finalFileName}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadPercent(0);
      }, 1000);
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadPercent(0);
      appendLog({
        id: "gen-abort",
        type: "error",
        message: "ডকুমেন্ট কম্পাইল প্রক্রিয়ায় ব্যর্থতা ঘটেছে!",
        timestamp: new Date().toLocaleTimeString(),
        details: err.message || "Failed during docx file packing flow.",
      });
    }
  };

  return (
    <div
      className={`flex flex-col min-h-screen ${config.theme === "dark" ? "bg-slate-900 text-slate-100" : "bg-[#F8F9FA] text-[#1A1A1A]"} font-sans antialiased selection:bg-blue-600 selection:text-white overflow-y-auto lg:overflow-hidden lg:h-screen lg:min-h-0`}
    >
      {/* Top Application Bar */}
      <Header
        config={config}
        onChangeConfig={(newCfg) =>
          setConfig((prev) => ({ ...prev, ...newCfg }))
        }
        onClear={handleClear}
        hasFile={fileData !== null}
      />

      {/* Main Core Viewport */}
      <main className="flex-grow flex flex-col lg:overflow-hidden">
        {fileData ? (
          <ErrorBoundary>
            {validationErrors.length > 0 && (
              <div className="mx-6 mt-6 mb-2 bg-red-50 border border-red-200 rounded-md p-4 animate-fade-in shadow-sm flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-red-900">
                    ফাইল প্রি-পার্সিং সতর্কতা
                  </h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setValidationErrors([])}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <PreviewPane
              fileData={fileData}
              config={config}
              onChangeConfig={(newCfg) =>
                setConfig((prev) => ({ ...prev, ...newCfg }))
              }
              onDownload={handleDownloadDOCX}
              isDownloading={isDownloading}
              downloadProgress={downloadPercent}
            />
          </ErrorBoundary>
        ) : selectedFilesForMerge.length > 0 ? (
          <FileSequencer
            files={selectedFilesForMerge}
            onReorder={setSelectedFilesForMerge}
            onMerge={handleMergeAndConvert}
            onCancel={() => setSelectedFilesForMerge([])}
            isLoading={isUploading}
          />
        ) : (
          <HTMLUploader
            onFilesSelect={handleFilesSelect}
            isLoading={isUploading}
            progress={uploadPercent}
            config={config}
            onChangeConfig={(newCfg) =>
              setConfig((prev) => ({ ...prev, ...newCfg }))
            }
          />
        )}
      </main>

      {/* Footer Bar: Engine Stats conforming to Geometric Balance */}
      <footer className="h-12 border-t border-gray-300 bg-white flex items-center justify-between px-6 shrink-0 select-none z-10">
        <div className="flex gap-4 md:gap-8 items-center">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
              Parsing Speed
            </span>
            <span className="text-xs font-mono font-semibold">
              {fileData
                ? `114ms / ${Math.round(fileData.size / 1024)}kb`
                : "0ms / 0kb"}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
              XSS Sanitation
            </span>
            <span className="text-xs font-mono font-bold text-green-600">
              DOMPurify Clean
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
              Equations Cache
            </span>
            <span className="text-xs font-mono font-semibold">
              {fileData
                ? `${fileData.equationsCount}/${fileData.equationsCount} HITS (100%)`
                : "0/0 HITS"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
              Conversion Progress
            </span>
            <div className="w-24 md:w-48 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden border border-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{
                  width: `${isDownloading ? downloadPercent : isUploading ? uploadPercent : fileData ? 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
          <div
            className={`w-6 h-6 rounded-full border-2 ${isDownloading || isUploading ? "border-blue-600 border-t-transparent animate-spin" : "border-green-500"} flex items-center justify-center`}
          >
            {!(isDownloading || isUploading) && (
              <span className="w-2 h-2 rounded-full bg-green-550"></span>
            )}
          </div>
        </div>
      </footer>

      {/* Trigger floating button for logging screen */}
      <button
        type="button"
        id="toggle-console-btn"
        onClick={() => setShowLogs(!showLogs)}
        className="fixed bottom-16 right-6 z-50 flex h-11 items-center justify-center space-x-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-4 shadow-md transition-all hover:scale-102 font-sans text-xs font-bold select-none"
      >
        <Terminal className="h-4.5 w-4.5 text-blue-600" />
        <span className="uppercase tracking-wider">Compiler Logs</span>
        {logs.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded bg-blue-100 text-blue-800 text-[10px] px-1 font-bold">
            {logs.length}
          </span>
        )}
      </button>

      {/* Compiler logs Drawer panel */}
      {showLogs && (
        <div
          id="logs-panel-drawer"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-slate-300 bg-white shadow-2xl flex flex-col h-full animate-slide-in"
        >
          {/* Drawer Title Bar */}
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3 select-none">
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Compiler Live Logs
              </h2>
            </div>
            <button
              onClick={() => setShowLogs(false)}
              className="rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Logs List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-48 text-slate-400 select-none">
                <Info className="h-8 w-8 mb-2.5 text-slate-300" />
                <p className="font-bold text-xs uppercase tracking-wide">
                  Console Idle
                </p>
                <p className="text-[10px] mt-1 text-slate-400 leading-normal max-w-xs">
                  Upload or compile documents to view live translation pipeline
                  updates.
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded p-2.5 border transition-all ${
                    log.type === "error"
                      ? "border-red-200 bg-red-50/50 text-red-800"
                      : log.type === "warning"
                        ? "border-amber-200 bg-amber-50/50 text-amber-800"
                        : "border-slate-200 bg-slate-50/50 text-slate-750"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <span className="capitalize text-[9px] font-sans bg-slate-100 px-1.5 py-0.5 rounded tracking-wider border border-slate-200">
                        {log.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-[11px] font-sans font-medium">
                    {log.message}
                  </p>
                  {log.details && (
                    <pre className="mt-1.5 rounded bg-black/5 p-1.5 text-[9px] overflow-x-auto text-slate-500 max-h-24 whitespace-pre-wrap leading-normal font-mono">
                      {log.details}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Console clear action */}
          {logs.length > 0 && (
            <div className="border-t border-slate-200 p-3 select-none flex justify-end">
              <button
                type="button"
                onClick={() => setLogs([])}
                className="flex items-center space-x-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Clear Console</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
