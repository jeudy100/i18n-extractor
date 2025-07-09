#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import ExcelJS from 'exceljs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import extractFromSource from './extractFromSource.mjs';

// --- Parse CLI Arguments ---
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --globs name::pattern [...more] [options]')
  .option('globs', {
    alias: 'g',
    type: 'array',
    demandOption: true,
    describe: 'Glob patterns in the format name::pattern',
  })
  .option('ignore', {
    type: 'array',
    describe: 'Glob patterns to ignore',
    default: [],
  })
  .option('outputDir', {
    alias: 'o',
    type: 'string',
    default: 'public/locales/en',
    describe: 'Output directory for results',
  })
  .option('baseName', {
    alias: 'b',
    type: 'string',
    default: 'translation',
    describe: 'Base name for output files',
  })
  .option('existingKeysPath', {
    alias: 'e',
    type: 'string',
    describe: 'Path to an existing keys JSON file',
  })
  .option('languages', {
    alias: 'l',
    type: 'string',
    default: '',
    describe: 'Comma-separated list of language codes to be used in the excel creator to indicate what languages the key needs to be translated into  (e.g. "es,fr,de")',
  })
  .help()
  .alias('help', 'h')
  .parse();

/**
 * @typedef {Object} GlobOption
 * @property {string} name
 * @property {string} pattern
 */

/**
 * @typedef {Object} ExtractOptions
 * @property {GlobOption[]} globs
 * @property {string} outputDir
 * @property {string} baseName
 * @property {string} existingKeysPath
 */

/** @type {ExtractOptions} */
const options = {
  globs: (argv.globs || []).map((entry) => {
    const [name, pattern] = entry.split('::');
    if (!name || !pattern) {
      console.warn(`[i18n-extract] ⚠️ Invalid glob "${entry}". Expected format: name::pattern`);
      return null;
    }
    return { name, pattern };
  }).filter(Boolean),
  outputDir: argv.outputDir,
  baseName: argv.baseName,
  existingKeysPath: argv.existingKeysPath || '',
};

/** @type {string[]} */
let languages = ['es', 'fr', 'de'];
if (argv.languages) {
  languages = argv.languages.split(',').map((s) => s.trim()).filter(Boolean);
}

// --- Load existing keys ---
let existingKeys = new Set();
if (options.existingKeysPath) {
  try {
    const fileContent = fs.readFileSync(path.resolve(options.existingKeysPath), 'utf8');
    const parsed = JSON.parse(fileContent);
    existingKeys = new Set(Array.isArray(parsed) ? parsed : Object.keys(parsed));
  } catch (e) {
    console.warn(`[i18n-extract] ⚠️ Failed to load existing keys from ${options.existingKeysPath}`);
  }
}

// --- Write JSON outputs ---
/**
 * @param {string} basePath
 * @param {string} name
 * @param {Set<string>} successSet
 * @param {IErroredTranslation[]} warnings
 * @param {IErroredTranslation[]} errors
 * @returns {string[]}
 */
function writeResults(basePath, name, successSet, warnings, errors) {
  const outputFolder = path.resolve(basePath, name);
  fs.mkdirSync(outputFolder, { recursive: true });

  const filteredSuccess = Array.from(successSet).sort().filter(k => !existingKeys.has(k));

  const makePath = (suffix) => path.join(outputFolder, `${options.baseName}.${suffix}.json`);

  fs.writeFileSync(makePath('success'), JSON.stringify(Object.fromEntries(filteredSuccess.map(k => [k, ''])), null, 2));
  fs.writeFileSync(makePath('warning'), JSON.stringify(warnings, null, 2));
  fs.writeFileSync(makePath('error'), JSON.stringify(errors, null, 2));

  console.log(`[${name}] ✅ ${filteredSuccess.length} keys added (ignored ${successSet.size - filteredSuccess.length})`);
  console.log(`[${name}] ⚠️ ${warnings.length} warnings`);
  console.log(`[${name}] ❌ ${errors.length} errors`);

  return filteredSuccess;
}

// --- Generate CSV ---
function generateSuccessCSV(successByName) {
  const headers = ['name', ...languages];
  const rows = [headers.join(',')];
  for (const [name, keys] of Object.entries(successByName)) {
    for (const key of keys) {
      rows.push([name, `"${key}"`, ...languages.map(() => '')].join(','));
    }
  }
  const csvPath = path.join(options.outputDir, 'translations.csv');
  fs.writeFileSync(csvPath, rows.join(os.EOL));
  console.log(`📄 CSV written to ${csvPath}`);
}

// --- Generate Excel ---
async function generateSuccessSpreadsheet(successByName) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Translations', { views: [{ state: 'frozen', ySplit: 1 }] });

  const headers = ['name', ...languages];
  sheet.addRow(headers);

  for (const [name, keys] of Object.entries(successByName)) {
    for (const key of keys) {
      sheet.addRow([name, key, ...languages.map(() => '')]);
    }
  }

  sheet.columns = headers.map(h => ({ header: h, width: 120 }));

  const filePath = path.join(options.outputDir, 'translations.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`📄 Excel written to ${filePath}`);
}

// --- Main ---
/**
 * Entry point for extraction
 * @returns {Promise<void>}
 */
async function main() {
  /** @type {Record<string, string[]>} */
  const successByName = {};

  for (const { name, pattern } of options.globs) {
    const files = glob.sync(pattern, { absolute: true, ignore: argv.ignore }).filter(f => /\.(ts|js|tsx|jsx)$/.test(f));
    const successSet = new Set();
    const warnings = [];
    const errors = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf-8');
      const { success, warnings: w, errors: e } = extractFromSource(source, file);
      for (const key of success) successSet.add(key);
      warnings.push(...w);
      errors.push(...e);
    }

    const filtered = writeResults(options.outputDir, name, successSet, warnings, errors);
    successByName[name] = filtered;
  }

  generateSuccessCSV(successByName);
  await generateSuccessSpreadsheet(successByName);
}

main();
