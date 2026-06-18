import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { convertMathMLToOMML } from "./src/mml2omml";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup basic parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Confirm XSLT existance
  const xslPath = path.join(process.cwd(), "templates", "MML2OMML.XSL");
  const xslExists = fs.existsSync(xslPath);
  console.log(`[XSLT Engine] Template MML2OMML.XSL found: ${xslExists} at ${xslPath}`);

  // API route for Equation to MS Word OMML translation
  app.post("/api/math-to-omml", (req, res) => {
    try {
      const { mathml } = req.body;
      if (!mathml || typeof mathml !== "string") {
        return res.status(400).json({ error: "No MathML string provided" });
      }

      console.log(`[API math-to-omml] Processing math node of length: ${mathml.length}`);
      
      // Perform translation and return
      const omml = convertMathMLToOMML(mathml);
      
      res.json({
        success: true,
        original: mathml,
        omml,
        usingXslReference: xslExists ? "templates/MML2OMML.XSL" : null
      });
    } catch (err: any) {
      console.error("[API math-to-omml] Error converting math:", err);
      res.status(500).json({ error: err.message || "Failed to convert math" });
    }
  });

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Booting development mode with Vite live middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Booting production mode with static direct delivery...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core Service online at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Booting Crash:", err);
});
