import { useState, useEffect } from "react";
import { FileCode, Moon, Sun, ArrowLeftRight, Smartphone } from "lucide-react";
import { ConversionConfig, PageOrientation } from "../types";

interface HeaderProps {
  config: ConversionConfig;
  onChangeConfig: (cfg: Partial<ConversionConfig>) => void;
  onClear: () => void;
  hasFile: boolean;
}

export default function Header({ config, onChangeConfig, onClear, hasFile }: HeaderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
      console.log("[PWA] beforeinstallprompt event fired and captured.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Filter out if currently running in PWA standalone window mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Installation prompt user decision outcome: ${outcome}`);
    // Reset state
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const setOrientation = (val: PageOrientation) => {
    onChangeConfig({ orientation: val });
  };

  const handleMarginChange = (type: "normal" | "narrow" | "wide") => {
    if (type === "narrow") {
      onChangeConfig({ margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } });
    } else if (type === "wide") {
      onChangeConfig({ margins: { top: 1, bottom: 1, left: 1.5, right: 1.5 } });
    } else {
      onChangeConfig({ margins: { top: 1, bottom: 1, left: 1, right: 1 } });
    }
  };

  const activeMargin = () => {
    const { top, left } = config.margins;
    if (top === 0.5 && left === 0.5) return "narrow";
    if (top === 1 && left === 1.5) return "wide";
    return "normal";
  };

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-gray-300 bg-white px-6 flex items-center justify-between shrink-0 select-none">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => hasFile && onClear()}>
          <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-sm text-white font-bold text-xl shadow-xs transition-colors hover:bg-blue-700">
            ∑
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight leading-none uppercase text-slate-900 md:text-lg">
              MathDoc <span className="text-blue-600">Engine</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-semibold hidden sm:block">
              HTML to Native DOCX Pipeline
            </p>
          </div>
        </div>

        {/* Toolbar parameters */}
        <div className="flex items-center space-x-4">
          {/* Active worker indication */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
            <span className="text-[10px] font-mono uppercase text-gray-650 font-bold tracking-wide">Worker-Thread-01 Active</span>
          </div>

          {hasFile && (
            <div className="flex items-center space-x-2 rounded-md border border-gray-300 bg-gray-50/50 p-1 text-xs font-semibold">
              {/* Orientation Option */}
              <div className="flex space-x-1 border-r border-gray-200 pr-1.5">
                <button
                  type="button"
                  id="ori-portrait"
                  onClick={() => setOrientation("portrait")}
                  className={`rounded-sm px-2.5 py-1 select-none transition-all ${
                    config.orientation === "portrait"
                      ? "bg-white text-blue-600 shadow-xs border border-gray-200/60 font-bold"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  id="ori-landscape"
                  onClick={() => setOrientation("landscape")}
                  className={`rounded-sm px-2.5 py-1 select-none transition-all ${
                    config.orientation === "landscape"
                      ? "bg-white text-blue-600 shadow-xs border border-gray-200/60 font-bold"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Landscape
                </button>
              </div>

              {/* Margin Option */}
              <div className="flex space-x-1">
                <button
                  type="button"
                  id="marg-normal"
                  onClick={() => handleMarginChange("normal")}
                  className={`rounded-sm px-2.5 py-1 transition-all ${
                    activeMargin() === "normal"
                      ? "bg-white text-blue-600 shadow-xs border border-gray-200/60 font-bold"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                  title="Normal margins (1 inch)"
                >
                  Normal
                </button>
                <button
                  type="button"
                  id="marg-narrow"
                  onClick={() => handleMarginChange("narrow")}
                  className={`rounded-sm px-2.5 py-1 transition-all ${
                    activeMargin() === "narrow"
                      ? "bg-white text-blue-600 shadow-xs border border-gray-200/60 font-bold"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                  title="Narrow margins (0.5 inch)"
                >
                  Narrow
                </button>
              </div>
            </div>
          )}

          {isInstallable && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md px-3 py-1.5 flex items-center gap-1.5 transition-all shadow-sm animate-pulse shrink-0 border border-blue-700 cursor-pointer"
              title="এই অ্যাপ্লিকেশনটি ডিভাইসে ইনস্টল করুন"
            >
              <Smartphone className="h-4 w-4" />
              <span>App ইনস্টল করুন</span>
            </button>
          )}

          {/* Theme switcher toggle / Segmented controls for light & dark */}
          <div className="flex items-center bg-gray-100 rounded-md p-1 border border-gray-200 text-xs font-bold">
            <button
              onClick={() => onChangeConfig({ theme: "light" })}
              className={`px-3 py-1 text-xs font-bold rounded transiton-all ${
                config.theme === "light"
                  ? "bg-white shadow-sm border border-gray-200 text-gray-900"
                  : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => onChangeConfig({ theme: "dark" })}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                config.theme === "dark"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Dark
            </button>
          </div>

          {hasFile && (
            <button
              type="button"
              id="clear-btn"
              onClick={onClear}
              className="bg-gray-150 border border-gray-300 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-sm px-3 py-1.5 text-xs font-bold transition-all"
            >
              Change File
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
