import React, { useState, useRef, useEffect } from "react";
import { Upload, FileCode, CheckCircle, AlertCircle, HelpCircle, ClipboardPaste } from "lucide-react";

interface HTMLUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  progress: number;
}

export default function HTMLUploader({ onFileSelect, isLoading, progress }: HTMLUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Ignore if pasting inside an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const pastedText = e.clipboardData?.getData("text/html") || e.clipboardData?.getData("text/plain");
      if (pastedText && pastedText.trim().length > 0) {
        const file = new File([pastedText], "pasted_content.html", { type: "text/html" });
        validateAndProcess(file);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  const handleManualPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        const file = new File([text], "pasted_content.html", { type: "text/html" });
        validateAndProcess(file);
      } else {
        setErrorMsg("ক্লিপবোর্ডে কোনো টেক্সট বা এইচটিএমএল পাওয়া যায়নি।");
      }
    } catch (err) {
      setErrorMsg("ক্লিপবোর্ড থেকে পেস্ট করতে ব্যর্থ হয়েছে। দয়া করে ব্রাউজার পারমিশন চেক করুন বা Ctrl+V ব্যবহার করুন।");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setErrorMsg(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      validateAndProcess(e.target.files[0]);
    }
  };

  const validateAndProcess = (file: File) => {
    const isHtml = file.name.endsWith(".html") || file.name.endsWith(".htm") || file.type === "text/html";
    if (!isHtml) {
      setErrorMsg("অনুপযুক্ত ফাইল ফরম্যাট! দয়া করে একটি অর্গানাইজড .html বা .htm ফাইল আপলোড করুন।");
      return;
    }
    onFileSelect(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper template generator to assist first-time users
  const downloadSampleHTML = () => {
    const sampleHTML = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>স্যাম্পল ডক্যুমেন্ট</title>
</head>
<body class="max-w-2xl mx-auto p-8 my-8 text-slate-800 bg-white">
  <h1 class="text-3xl font-bold text-center text-blue-600 mb-6">বীজগণিতের মৌলিক সূত্রাবলি</h1>
  
  <p class="text-base my-4 leading-relaxed">
    আসসালামু আলাইকুম! গণিত ও রিয়েল-টাইম ডকএক্স ট্রান্সলেটর সিস্টেমে আপনাকে স্বাগতম। নিচে আমাদের একটি স্যাম্পল লেআউট দেওয়া হলো যা Word এর নেটিভ ইকুয়েশন হিসেবে রূপান্তরিত হবে:
  </p>

  <blockquote class="pl-4 border-l-4 border-blue-500 italic text-slate-600 bg-slate-50 p-4 rounded mb-6">
    "গণিত হলো সমস্ত বিজ্ঞানের রানী এবং পাটিগণিত হলো সমস্ত তত্ত্বের রাজা।" - কার্ল ফ্রিডরিখ গাউস
  </blockquote class="pl-4">

  <h2 class="text-xl font-semibold text-slate-700 mt-8 mb-4 border-b border-slate-200 pb-2">দ্বিপদী উপপাদ্য ও সূত্র</h2>
  
  <p class="my-4">
    দ্বিপদী বিস্তৃতির বীজগণিতীয় সাধারণ বর্গীয় সূত্রটি নিম্নরূপ প্রকাশ করা হয়ে থাকে:
  </p>
  
  <!-- Inline Math TeX -->
  <p class="my-4">
    বর্গ করার সাধারণ সমীকরণ: <span class="text-blue-600">$(a + b)^2 = a^2 + 2ab + b^2$</span>
  </p>

  <!-- MathML Equation block -->
  <div class="my-6 p-4 bg-slate-50 border border-slate-200 rounded flex justify-center">
    <math display="block" class="text-lg">
      <mfrac>
        <mrow>
          <mo>-</mo>
          <mi>b</mi>
          <mo>±</mo>
          <msqrt>
            <msup>
              <mi>b</mi>
              <mn>2</mn>
            </msup>
            <mo>-</mo>
            <mn>4</mn>
            <mi>a</mi>
            <mi>c</mi>
          </msqrt>
        </mrow>
        <mrow>
          <mn>2</mn>
          <mi>a</mi>
        </mrow>
      </mfrac>
    </math>
  </div>

  <h2 class="text-xl font-semibold text-slate-700 mt-8 mb-4">তথ্য সারণী (Table Layout Preserving)</h2>
  
  <table class="w-full border-collapse border border-slate-300 mt-4 text-sm justify-left">
    <thead>
      <tr class="bg-slate-100">
        <th class="border border-slate-300 px-4 py-2 font-semibold">সমীকরণ প্রকার</th>
        <th class="border border-slate-300 px-4 py-2 font-semibold">সূত্র</th>
        <th class="border border-slate-300 px-4 py-2 font-semibold">জটিলতা</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="border border-slate-300 px-4 py-2 text-center">দ্বিপদী উপপাদ্য</td>
        <td class="border border-slate-300 px-4 py-2 text-center">$(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k$</td>
        <td class="border border-slate-300 px-4 py-2 text-center">মাঝারি</td>
      </tr>
      <tr>
        <td class="border border-slate-300 px-4 py-2 text-center">আইনস্টাইন সূচক</td>
        <td class="border border-slate-300 px-4 py-2 text-center">$E = mc^2$</td>
        <td class="border border-slate-300 px-4 py-2 text-center">সহজ</td>
      </tr>
    </tbody>
  </table>

  <h2 class="text-xl font-semibold text-slate-700 mt-8 mb-4">সাধারণ ফিচার তালিকা</h2>
  <ul class="list-disc pl-6 space-y-2 my-4">
    <li>হাই-ফিডেলিটি টেইলউইন্ড সিএসএস কালার কনভার্টার।</li>
    <li>ওয়ার্ডের নেটিভ অবজেক্ট হিসেবে এডিটেবল ম্যাথব্লক জেনারেশন।</li>
    <li>সিঙ্কড স্ক্রোলিং স্প্লিট স্ক্রিন ব্রাউজার লেআউট।</li>
  </ul>
</body>
</html>`;

    const blob = new Blob([sampleHTML], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample_latex_math.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {/* Intro Greetings card */}
      <div className="mb-10 text-center animate-fade-in">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10 mb-4 font-mono">
          Native Math & Tailwind Companion
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          এইচটিএমএল ফাইল আপলোড করুন
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
          যেকোনো টেইলউইন্ড সিএসএস স্টাইল সমৃদ্ধ এইচটিএমএল ফাইল নির্বাচন বা ড্র্যাগ করুন। ফাইলটির মধ্যকার সমস্ত জটিল সমীকরণ স্বয়ংক্রিয়ভাবে মাইক্রোসফট ওয়ার্ডের এডিটেবল চরিত্রে রূপান্তরিত হবে।
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        id="drag-drop-container"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-all cursor-pointer ${
          isDragActive
            ? "border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner shadow-blue-100"
            : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/40"
        } ${isLoading ? "pointer-events-none opacity-90" : "shadow-md shadow-slate-100/40"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          onChange={handleChange}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center space-y-4">
            {/* Spinning Loader & Progress Bar */}
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full border-2 border-blue-400 opacity-75"></span>
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-transparent border-t-blue-600 border-r-blue-600"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">পড়ার লজিক প্রসেস করা হচ্ছে...</p>
              <p id="parsing-progress-text" className="text-xs text-slate-500 mt-1 font-mono">প্রগতি: {progress}%</p>
            </div>
            <div className="h-1.5 w-52 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm md:text-md font-semibold text-slate-800">
                ক্লিক করে ফাইল সিলেক্ট করুন, ড্র্যাগ করুন অথবা পেস্ট (Ctrl+V) করুন
              </p>
              <p className="text-xs text-slate-500 mt-1.5">
                শুধুমাত্র .html বা .htm কন্টেন্ট সাপোর্ট করে
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualPaste();
                }}
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-blue-600" />
                <span>ক্লিপবোর্ড থেকে পেস্ট করুন</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Feedback Popup */}
      {errorMsg && (
        <div className="mt-4 flex items-center space-x-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700 animate-slide-in">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Helper segment / Download templates */}
      {!isLoading && (
        <div className="mt-8 flex flex-col md:flex-row items-stretch justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 select-none">
          <div className="flex items-start space-x-3">
            <HelpCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">কোনো ফাইল নেই?</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                সিস্টেমটি পরীক্ষা করার জন্য আমাদের ম্যাথ ও টেবিল সমৃদ্ধ স্যাম্পল এইচটিএমএল ফাইলটি ডাউনলোড করুন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadSampleHTML}
            className="flex items-center justify-center space-x-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors self-center flex-shrink-0"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>স্যাম্পল ফাইল দিন</span>
          </button>
        </div>
      )}
    </div>
  );
}
