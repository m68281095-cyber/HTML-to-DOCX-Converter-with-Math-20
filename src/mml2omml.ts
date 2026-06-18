/**
 * Utility to convert MathML source to MS Word OMML (Office Math Markup Language)
 */

export interface XMLNode {
  tagName: string;
  attributes: Record<string, string>;
  children: (XMLNode | string)[];
}

/**
 * Parses a MathML XML string into a lightweight AST.
 */
export function parseXML(xmlString: string): XMLNode | null {
  // Clean up XML header, namespaces or comments
  let cleaned = xmlString
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  // Find tags and text parts
  const regex = /(<\/?[a-zA-Z0-9:-]+(?:\s+[a-zA-Z0-9_:-]+=(?:"[^"]*"|'[^']*'))*\s*\/?>)/g;
  const parts = cleaned.split(regex).map(p => p.trim()).filter(p => p.length > 0);

  const root: XMLNode = { tagName: "root", attributes: {}, children: [] };
  const stack: XMLNode[] = [root];

  for (const part of parts) {
    if (part.startsWith("</")) {
      // Closing tag
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (part.startsWith("<") && part.endsWith(">")) {
      // Self-closing or opening tag
      const isSelfClosing = part.endsWith("/>");
      const tagContent = part.slice(1, isSelfClosing ? -2 : -1).trim();
      const firstSpaceIdx = tagContent.search(/\s/);
      
      let tagName = firstSpaceIdx === -1 ? tagContent : tagContent.slice(0, firstSpaceIdx);
      tagName = tagName.replace(/^[a-zA-Z0-9_]+:/, ""); // Remove namespace prefix (e.g., mml:math -> math)

      const attributes: Record<string, string> = {};
      if (firstSpaceIdx !== -1) {
        const attrStr = tagContent.slice(firstSpaceIdx).trim();
        const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let match;
        while ((match = attrRegex.exec(attrStr)) !== null) {
          attributes[match[1]] = match[2] || match[3] || "";
        }
      }

      const newNode: XMLNode = { tagName: tagName.toLowerCase(), attributes, children: [] };
      stack[stack.length - 1].children.push(newNode);

      if (!isSelfClosing) {
        stack.push(newNode);
      }
    } else {
      // Text node
      // Decode typical XML entities safely
      const text = part
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ");
      stack[stack.length - 1].children.push(text);
    }
  }

  return root.children.length > 0 ? (root.children[0] as XMLNode) : null;
}

/**
 * Transforms a parsed XML Node representing MathML into an OMML XML String.
 */
export function convertASTToOMML(node: XMLNode | string): string {
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (!trimmed) return "";
    return `<m:r><m:t>${escapeXML(trimmed)}</m:t></m:r>`;
  }

  const { tagName, attributes, children } = node;

  switch (tagName) {
    case "math": {
      // Root math element translates to oMathPara (Equation container) and oMath (Equation)
      return `<m:oMathPara><m:oMath>${children.map(convertASTToOMML).join("")}</m:oMath></m:oMathPara>`;
    }

    case "mrow": {
      // Sequential container
      return children.map(convertASTToOMML).join("");
    }

    case "mfrac": {
      // Fraction with numerator and denominator
      const num = children[0] ? convertASTToOMML(children[0]) : "";
      const den = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:f><m:num>${num}</m:num><m:den>${den}</m:den></m:f>`;
    }

    case "msup": {
      // Superscript: base and power
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const power = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:sSup><m:e>${base}</m:e><m:sup>${power}</m:sup></m:sSup>`;
    }

    case "msub": {
      // Subscript: base and sub
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const sub = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:sSub><m:e>${base}</m:e><m:sub>${sub}</m:sub></m:sSub>`;
    }

    case "msubsup": {
      // Sub-Superscript: base, sub, power
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const sub = children[1] ? convertASTToOMML(children[1]) : "";
      const power = children[2] ? convertASTToOMML(children[2]) : "";
      return `<m:sSubSup><m:e>${base}</m:e><m:sub>${sub}</m:sub><m:sup>${power}</m:sup></m:sSubSup>`;
    }

    case "msqrt": {
      // Square root
      const body = children.map(convertASTToOMML).join("");
      return `<m:rad><m:deg/><m:e>${body}</m:e></m:rad>`;
    }

    case "mroot": {
      // Radicand / nth root
      const body = children[0] ? convertASTToOMML(children[0]) : "";
      const index = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:rad><m:deg>${index}</m:deg><m:e>${body}</m:e></m:rad>`;
    }

    case "mfenced": {
      // Delimiters
      const open = attributes.open || "(";
      const close = attributes.close || ")";
      const body = children.map(convertASTToOMML).join("");
      return `<m:d><m:dPr><m:begChr m:val="${open}"/><m:endChr m:val="${close}"/></m:dPr><m:e>${body}</m:e></m:d>`;
    }

    case "mover": {
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const over = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:limUpp><m:limUppPr/><m:e>${base}</m:e><m:lim>${over}</m:lim></m:limUpp>`;
    }

    case "munder": {
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const under = children[1] ? convertASTToOMML(children[1]) : "";
      return `<m:limLow><m:limLowPr/><m:e>${base}</m:e><m:lim>${under}</m:lim></m:limLow>`;
    }

    case "munderover": {
      const base = children[0] ? convertASTToOMML(children[0]) : "";
      const under = children[1] ? convertASTToOMML(children[1]) : "";
      const over = children[2] ? convertASTToOMML(children[2]) : "";
      return `<m:limLow><m:limLowPr/><m:e><m:limUpp><m:limUppPr/><m:e>${base}</m:e><m:lim>${over}</m:lim></m:limUpp></m:e><m:lim>${under}</m:lim></m:limLow>`;
    }

    case "mtable": {
      const rows = children.map(convertASTToOMML).join("");
      return `<m:m><m:mPr/>${rows}</m:m>`;
    }

    case "mtr": {
      const cells = children.map(convertASTToOMML).join("");
      return `<m:mr>${cells}</m:mr>`;
    }

    case "mtd": {
      const cellContent = children.map(convertASTToOMML).join("");
      return `<m:e>${cellContent}</m:e>`;
    }

    case "mspace": {
      return `<m:r><m:t>&#x2004;</m:t></m:r>`;
    }

    case "mi":
    case "mn":
    case "mo": {
      // Identifiers, numbers, operators are runs in OMML
      const text = children.map(c => (typeof c === "string" ? c : "")).join("").trim();
      if (!text) return "";
      
      // Variable items in mi are styled in italic style in Word math typically as italic run
      const isItalic = tagName === "mi" && text.length === 1;
      const rPr = isItalic ? "<m:rPr><m:sty m:val=\"p\"/></m:rPr>" : "";
      
      return `<m:r>${rPr}<m:t>${escapeXML(text)}</m:t></m:r>`;
    }

    case "mtext": {
      // Text blocks inside math are normal text runs
      const text = children.map(c => (typeof c === "string" ? c : "")).join("");
      return `<m:r><m:rPr><m:lit/></m:rPr><m:t>${escapeXML(text)}</m:t></m:r>`;
    }

    case "annotation":
    case "annotation-xml": {
      return "";
    }

    default: {
      // Fallback
      if (children && children.length > 0) {
        return children.map(convertASTToOMML).join("");
      }
      return "";
    }
  }
}

/**
 * Escapes special XML characters.
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
 * Parses and converts a MathML string to an OMML string.
 */
export function convertMathMLToOMML(mathml: string): string {
  // If the string starts with LaTeX, render it with KaTeX first
  const parsed = parseXML(mathml);
  if (!parsed) return "";
  return convertASTToOMML(parsed);
}
