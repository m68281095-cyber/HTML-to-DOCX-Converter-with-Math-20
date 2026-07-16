import React, { useRef } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ArrowLeft,
  FileCode,
  Combine,
  Layers,
  ArrowDownAZ,
} from "lucide-react";

interface FileSequencerProps {
  files: File[];
  onReorder: (newFiles: File[]) => void;
  onMerge: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function FileSequencer({
  files,
  onReorder,
  onMerge,
  onCancel,
  isLoading,
}: FileSequencerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index - 1];
    newFiles[index - 1] = temp;
    onReorder(newFiles);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index + 1];
    newFiles[index + 1] = temp;
    onReorder(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    if (newFiles.length === 0) {
      onCancel();
    } else {
      onReorder(newFiles);
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newSelected = Array.from(e.target.files).filter(
        (file) =>
          file.name.endsWith(".html") ||
          file.name.endsWith(".htm") ||
          file.type === "text/html",
      );
      if (newSelected.length > 0) {
        onReorder([...files, ...newSelected]);
      }
    }
  };

  const sortAlphabetically = () => {
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
    onReorder(sorted);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-3xl mx-auto my-8 bg-white border border-slate-200 shadow-lg rounded-2xl p-6 md:p-8 animate-fade-in">
      {/* Header section with back button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
            title="ফাইল আপলোডে ফিরে যান"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              ফাইল সাজানো ও একত্রিতকরণ
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ডকুমেন্টের সিকোয়েন্স ঠিক করুন। প্রথম ফাইলটি সবার প্রথমে এবং শেষের
              ফাইলটি সবার শেষে থাকবে।
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={sortAlphabetically}
            disabled={isLoading || files.length <= 1}
            className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="ফাইলগুলো নাম অনুযায়ী (A to Z) সাজান"
          >
            <ArrowDownAZ className="h-3.5 w-3.5 text-indigo-600" />
            <span>A to Z সাজান</span>
          </button>
          <span className="bg-slate-50 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200">
            মোট ফাইল: {files.length} টি
          </span>
        </div>
      </div>

      {/* Files list */}
      <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {files.map((file, index) => {
          const isFirst = index === 0;
          const isLast = index === files.length - 1;

          return (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-all shadow-sm"
            >
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                {/* Position Badge */}
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white font-mono text-sm font-bold shadow-sm shrink-0">
                  {index + 1}
                </span>

                <FileCode className="h-8 w-8 text-blue-500 shrink-0" />

                <div className="min-w-0 flex-1 pr-2">
                  <p
                    className="text-sm font-semibold text-slate-800 break-all"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    আকার: {formatSize(file.size)}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-1 ml-4 shrink-0">
                {/* Move Up */}
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={isFirst || isLoading}
                  className={`p-2 rounded-lg transition-colors ${
                    isFirst
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  }`}
                  title="উপরে নিয়ে যান"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>

                {/* Move Down */}
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={isLast || isLoading}
                  className={`p-2 rounded-lg transition-colors ${
                    isLast
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  }`}
                  title="নিচে নিয়ে যান"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>

                {/* Vertical Divider */}
                <span className="h-5 w-[1px] bg-slate-200 mx-1"></span>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                  className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                  title="তালিকা থেকে বাদ দিন"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
        {/* Add more files input */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAddFiles}
            accept=".html,.htm"
            multiple
            className="hidden"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 font-semibold text-sm px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>আরও ফাইল যোগ করুন</span>
          </button>
        </div>

        {/* Compile trigger */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            বাতিল করুন
          </button>

          <button
            type="button"
            onClick={onMerge}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-200/50 hover:shadow-lg transition-all"
          >
            <Combine className="h-4 w-4" />
            <span>একত্রিত ও কনভার্ট করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
}
