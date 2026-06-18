import katex from "katex";
import {
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
  MathRoundBrackets,
  MathSquareBrackets,
  MathCurlyBrackets,
  MathComponent,
  XmlComponent,
} from "docx";
import { parseXML, XMLNode, convertMathMLToOMML } from "../mml2omml";

// Maintain a client-side equation cache of TeX/MathML key strings to OMML strings and component nodes
const equationCache = new Map<string, string>();

/**
 * Normalizes input: renders LaTeX math to a standard MathML block using KaTeX
 * if it matches LaTeX patterns.
 */
export function getMathMLString(
  input: string,
  isDisplay: boolean = false,
): string {
  try {
    // If it's already MathML, return directly
    if (input.trim().startsWith("<math")) {
      return input;
    }

    // Otherwise, treat as LaTeX and render to pure MathML using KaTeX
    // Set strict: false, but throwOnError: true (which is default) to catch syntax issues
    const mathml = katex.renderToString(input, {
      displayMode: isDisplay,
      output: "mathml",
      throwOnError: true,
    });

    return mathml;
  } catch (err) {
    console.warn("KaTeX render failed. Rethrowing for safety:", err);
    throw err;
  }
}

/**
 * Escapes special characters for XML safely.
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Helper to recursively map MathML AST nodes into native Docx Math Components.
 */
function mapNodeToDocxMath(node: XMLNode | string): any {
  if (typeof node === "string") {
    const text = node.trim();
    return text ? new MathRun(text) : null;
  }

  const recurse = (child: XMLNode | string) => mapNodeToDocxMath(child);
  const recurseList = (list: (XMLNode | string)[]) => {
    return list
      .map(recurse)
      .filter((v): v is any => v !== null && v !== undefined);
  };

  switch (node.tagName) {
    case "annotation":
    case "annotation-xml": {
      return null;
    }

    case "math":
    case "mrow": {
      return recurseList(node.children);
    }

    case "mfrac": {
      // Fraction: item 0 over item 1
      const num = flattenMathComponents(recurseList([node.children[0] || ""]));
      const den = flattenMathComponents(recurseList([node.children[1] || ""]));
      return new MathFraction({
        numerator: num.length > 0 ? num : [new MathRun("1")],
        denominator: den.length > 0 ? den : [new MathRun("1")],
      });
    }

    case "msup": {
      const base = flattenMathComponents(recurseList([node.children[0] || ""]));
      const sup = flattenMathComponents(recurseList([node.children[1] || ""]));
      return new MathSuperScript({
        children: base.length > 0 ? base : [new MathRun("x")],
        superScript: sup.length > 0 ? sup : [new MathRun("2")],
      });
    }

    case "msub": {
      const base = flattenMathComponents(recurseList([node.children[0] || ""]));
      const sub = flattenMathComponents(recurseList([node.children[1] || ""]));
      return new MathSubScript({
        children: base.length > 0 ? base : [new MathRun("x")],
        subScript: sub.length > 0 ? sub : [new MathRun("1")],
      });
    }

    case "msubsup": {
      const base = flattenMathComponents(recurseList([node.children[0] || ""]));
      const sub = flattenMathComponents(recurseList([node.children[1] || ""]));
      const sup = flattenMathComponents(recurseList([node.children[2] || ""]));
      return new MathSubSuperScript({
        children: base.length > 0 ? base : [new MathRun("x")],
        subScript: sub.length > 0 ? sub : [new MathRun("1")],
        superScript: sup.length > 0 ? sup : [new MathRun("2")],
      });
    }

    case "msqrt": {
      const body = flattenMathComponents(recurseList(node.children));
      return new MathRadical({
        children: body.length > 0 ? body : [new MathRun("x")],
      });
    }

    case "mroot": {
      const body = flattenMathComponents(recurseList([node.children[0] || ""]));
      const deg = flattenMathComponents(recurseList([node.children[1] || ""]));
      return new MathRadical({
        children: body.length > 0 ? body : [new MathRun("x")],
        degree: deg,
      });
    }

    case "mfenced": {
      // Round/Square delimiters
      const body = flattenMathComponents(recurseList(node.children));
      const open = node.attributes.open || "(";
      if (open === "[") {
        return new MathSquareBrackets({ children: body });
      }
      if (open === "{") {
        return new MathCurlyBrackets({ children: body });
      }
      return new MathRoundBrackets({ children: body });
    }

    case "mi":
    case "mn":
    case "mo":
    case "mtext": {
      const text = node.children
        .map((c) => (typeof c === "string" ? c : ""))
        .join("")
        .trim();
      return text ? new MathRun(text) : null;
    }

    default: {
      return recurseList(node.children);
    }
  }
}

/**
 * Recursively flattens nested arrays of math components into a clean 1D list.
 */
function flattenMathComponents(arr: any | any[]): MathComponent[] {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    return [arr as MathComponent];
  }

  const result: MathComponent[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flattenMathComponents(item));
    } else if (item) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Main parser entry: converts a MathML string into native DOCX DocxMath wrapper.
 */
export function convertMathMLToDocxMath(mathml: string): DocxMath | null {
  try {
    const ast = parseXML(mathml);
    if (!ast) return null;

    const rawComponents = mapNodeToDocxMath(ast);
    const flattened = flattenMathComponents(rawComponents);

    if (flattened.length === 0) {
      return null;
    }

    return new DocxMath({ children: flattened });
  } catch (err) {
    console.error("Failed to parse MathML to DocxMath native components", err);
    return null;
  }
}

/**
 * Call backend to convert MathML to raw OMML with local cache backup.
 */
export async function getOMMLFromBackend(mathml: string): Promise<string> {
  // Check client-side caching mechanism
  const cached = equationCache.get(mathml);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch("/api/math-to-omml", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mathml }),
    });

    if (!response.ok) {
      throw new Error(`API error code: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.omml) {
      // Save in cache
      equationCache.set(mathml, data.omml);
      return data.omml;
    }
    throw new Error("No OMML string in response content");
  } catch (err) {
    console.warn(
      "Backend down or network fail, rendering locally via AST transformer",
      err,
    );
    // Standalone fallback: render offline using local AST generator
    const fallbackOmml = convertASTToLocalOmmlString(mathml);
    equationCache.set(mathml, fallbackOmml);
    return fallbackOmml;
  }
}

/**
 * Converts MathML to raw OMML XML locally (useful as an immediate offline fallback).
 */
export function convertASTToLocalOmmlString(mathml: string): string {
  try {
    return convertMathMLToOMML(mathml);
  } catch (err) {
    console.warn("Local convertMathMLToOMML failed:", err);
    return "";
  }
}
