/**
 * Analizador SCSS avanzado para Ionic con auto-fix
 * Detecta colores fijos, sugiere variables dinámicas y aplica cambios automáticos.
 * Autor: ChatGPT (para José)
 */

import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve("./src/app");
const OUTPUT_FILE = path.resolve("./scss-color-report.txt");
const BACKUP_DIR = path.resolve("./scss-backups");

// Busca colores hexadecimales, rgb(), rgba()
const COLOR_REGEX = /#([0-9a-fA-F]{3,6})\b|rgb[a]?\s*\([^)]*\)/g;

// Mapeo completo de propiedades (incluyendo abreviaturas y variantes)
const PROP_MAPPING = {
  background: "var(--ion-background-color)",
  "background-color": "var(--ion-background-color)",
  bg: "var(--ion-background-color)",
  color: "var(--ion-text-color)",
  c: "var(--ion-text-color)",
  "border-color": "var(--ion-border-color)",
  "border": "var(--ion-border-color)",
  fill: "var(--ion-text-color)",
  stroke: "var(--ion-text-color)",
  "box-shadow": "var(--ion-shadow-color)"
};

// Mapeo de variantes temáticas (success, warning, danger, etc)
const VARIANT_MAP = {
  success: "var(--ion-color-success)",
  warning: "var(--ion-color-warning)",
  danger: "var(--ion-color-danger)",
  warning: "var(--ion-color-warning)",
  info: "var(--ion-color-info)",
  medium: "var(--ion-color-medium)",
  dark: "var(--ion-color-dark)",
  light: "var(--ion-color-light)",
  primary: "var(--ion-color-primary)",
  secondary: "var(--ion-color-secondary)",
  tertiary: "var(--ion-color-tertiary)",
  card: "var(--ion-card-background)",
  button: "var(--ion-button-background)",
  "button-hover": "var(--ion-button-background-hover)"
};

// Crear directorio de backups
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Recorre recursivamente las carpetas
function walkDir(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath, results);
    } else if (file.endsWith(".scss")) {
      analyzeFile(fullPath, results);
    }
  }
  return results;
}

// Detecta la propiedad CSS en una línea
function detectProperty(line) {
  const match = line.match(/^[^:]*?(?:^|\s)([\w-]+)\s*:/);
  if (!match) return null;
  
  const prop = match[1].toLowerCase().trim();
  return PROP_MAPPING[prop] ? prop : null;
}

// Detecta variantes en el nombre de la clase o contexto
function detectVariant(line) {
  const variants = Object.keys(VARIANT_MAP);
  
  // Busca variantes en nombres de clase (.btn-success, .card-danger, etc)
  const classMatch = line.match(/\.([\w-]*?(success|warning|danger|info|primary|secondary|tertiary|card|button)[\w-]*)/i);
  if (classMatch) {
    for (const variant of variants) {
      if (classMatch[1].toLowerCase().includes(variant)) {
        return variant;
      }
    }
  }
  
  // Busca variantes en valores (rgba variables con nombre)
  for (const variant of variants) {
    if (line.toLowerCase().includes(`-${variant}`) || line.toLowerCase().includes(`_${variant}`)) {
      return variant;
    }
  }
  
  return null;
}

// Extrae el valor completo de una propiedad
function extractPropertyValue(line) {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  
  const value = line.substring(colonIndex + 1).trim();
  return value.endsWith(";") ? value : value + ";";
}

// Analiza un archivo línea por línea
function analyzeFile(filePath, results) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const issues = [];

  lines.forEach((line, index) => {
    const clean = line.trim();
    if (!clean || clean.startsWith("//") || clean.startsWith("*")) return;

    const prop = detectProperty(line);
    const variant = detectVariant(line);
    
    if (!COLOR_REGEX.test(clean)) return;

    const value = extractPropertyValue(line);
    if (!value) return;

    // Determina la sugerencia: variante tiene prioridad sobre propiedad
    let suggestion = variant ? VARIANT_MAP[variant] : (prop ? PROP_MAPPING[prop] : null);
    
    if (!suggestion) return;

    issues.push({
      file: filePath,
      line: index + 1,
      lineContent: line,
      property: prop,
      variant: variant || "generic",
      value: value.trim(),
      suggestion,
      lineIndex: index
    });
  });

  if (issues.length > 0) {
    results.push({
      file: filePath,
      issues,
      content: lines
    });
  }
}

// Auto-fix: reemplaza colores por variables
function autoFixFile(fileData) {
  const lines = [...fileData.content];
  let modified = false;

  fileData.issues.forEach(issue => {
    const oldLine = lines[issue.lineIndex - 1];
    const colonIndex = oldLine.indexOf(":");
    const beforeColon = oldLine.substring(0, colonIndex + 1);
    const newLine = `${beforeColon} ${issue.suggestion};`;

    if (oldLine !== newLine) {
      lines[issue.lineIndex - 1] = newLine;
      modified = true;
    }
  });

  return { lines, modified };
}

// Crear backup del archivo original
function backupFile(filePath) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${timestamp}_${fileName}`);
  
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// Ejecutar análisis
console.log("🔍 Analizando archivos SCSS en:", ROOT_DIR);
const allResults = [];
walkDir(ROOT_DIR, allResults);

if (allResults.length === 0) {
  console.log("✅ No se encontraron colores fijos.");
} else {
  console.log(`⚠️ Se encontraron ${allResults.length} archivos con posibles problemas.`);

  let totalIssues = 0;
  const reportLines = [];

  allResults.forEach((fileData, fileIndex) => {
    reportLines.push(`\n${'='.repeat(60)}`);
    reportLines.push(`📄 ARCHIVO ${fileIndex + 1}: ${fileData.file}`);
    reportLines.push(`${'='.repeat(60)}\n`);

    fileData.issues.forEach((issue, issueIndex) => {
      reportLines.push(`[${String(totalIssues + issueIndex + 1).padStart(3, "0")}] Línea ${issue.line}`);
      reportLines.push(`  Propiedad: ${issue.property || "N/A"}`);
      if (issue.variant !== "generic") {
        reportLines.push(`  Variante detectada: ${issue.variant}`);
      }
      reportLines.push(`  Valor actual: ${issue.value}`);
      reportLines.push(`  💡 Variable sugerida: ${issue.suggestion}\n`);
    });

    totalIssues += fileData.issues.length;

    // Auto-fix
    const { lines: fixedLines, modified } = autoFixFile(fileData);
    if (modified) {
      backupFile(fileData.file);
      fs.writeFileSync(fileData.file, fixedLines.join("\n"));
      reportLines.push(`  ✅ AUTO-FIJADO\n`);
    }
  });

  reportLines.unshift(`REPORTE DE ANÁLISIS SCSS - ${new Date().toLocaleString()}`);
  reportLines.unshift(`Total de issues encontrados: ${totalIssues}\n`);

  fs.writeFileSync(OUTPUT_FILE, reportLines.join("\n"));
  console.log(`\n📄 Reporte generado: ${OUTPUT_FILE}`);
  console.log(`💾 Backups guardados en: ${BACKUP_DIR}`);
  console.log(`✅ Se auto-fijaron los archivos SCSS`);
}