# i18n Key Extractor

A Node.js CLI tool to extract internationalization (i18n) keys from JavaScript and TypeScript source files.  
It scans code for translation keys used in `t()` function calls and `<Trans>` JSX components, and generates JSON, CSV, and Excel reports to help manage localization efforts.

---

## Features

- Extracts i18n keys from:
  - `t('key', {...})` or `i18next.t('key', {...})` function calls
  - `<Trans i18nKey="key" {...props}>...</Trans>` or `<Trans>key text</Trans>` JSX elements
- Supports parsing TypeScript and JSX syntax
- Processes multiple named glob patterns for file matching
- Ignores specified glob patterns (e.g., test files)
- Loads existing keys to avoid duplicates
- Outputs:
  - JSON files separating successful keys, warnings, and errors per glob pattern
  - A consolidated CSV file for translation management
  - An Excel `.xlsx` spreadsheet with language columns ready for translators
- Configurable output directory and base filename

## Usage

```bash
i18n-extract \
  --globs frontend::\"src/frontend/**/*.{ts,tsx,js,jsx}\" \
  --ignore '**/__tests__/**' \
  --outputDir ./dist/translations \
  --baseName translation \
  --existingKeysPath ./dist/translations/existingkeys.json \
  --languages es,fr,de,it
```
