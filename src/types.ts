/**
 * Configuration and metadata types for the HTMl to DOCX converter system
 */

export interface HTMLFileData {
  name: string;
  size: number;
  content: string;
  sanitizedContent: string;
  equationsCount: number;
}

export type PageOrientation = "portrait" | "landscape";

export interface ConversionConfig {
  orientation: PageOrientation;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  defaultFont: string;
  banglaFont: string;
  englishFont: string;
  banglaFontSize?: number;
  arabicFont?: string;
  arabicFontSize?: number;
  theme: "light" | "dark";
  title: string;
  forceBlackText?: boolean;
  skipEquations?: boolean;
  compactNoItalics?: boolean;
  disablePreview?: boolean;
}

export interface ConversionLog {
  id: string;
  type: "info" | "warning" | "error";
  message: string;
  timestamp: string;
  details?: string;
}

export interface EquationCacheItem {
  mathml: string;
  omml: string;
}
