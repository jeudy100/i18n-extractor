import { describe, it, expect } from 'vitest';
import  extractFromSource from '../extractFromSource.mjs';

// Sample test sources
const samples = {
  simpleT: `t('hello.world')`,
  i18nextT: `i18next.t("greeting.morning")`,
  templateNoExpr: "t(`key.with.no.expressions`)",
  templateWithExpr: "t(`key.${variable}`)",
  jsxTransSimple: `
    <Trans i18nKey="jsx.simple.key">Simple Text</Trans>
  `,
  jsxTransChildKey: `
    <Trans>Text child key</Trans>
  `,
  jsxTransComplexChildren: `
    <Trans i18nKey="jsx.complex">
      <strong>Bold Text</strong>
    </Trans>
  `,
  unsupportedArg: `t(42)`,
};

describe('extractFromSource', () => {
  it('extracts simple t function string keys', () => {
    const { success, warnings, errors } = extractFromSource(samples.simpleT, 'testfile.js');
    expect(success.has('hello.world')).toBe(true);
    expect(warnings.length).toBe(0);
    expect(errors.length).toBe(0);
  });

  it('extracts i18next.t string keys', () => {
    const { success } = extractFromSource(samples.i18nextT, 'testfile.js');
    expect(success.has('greeting.morning')).toBe(true);
  });

  it('extracts template literals without expressions with warning', () => {
    const { success, warnings, errors } = extractFromSource(samples.templateNoExpr, 'testfile.js');
    expect(success.has('key.with.no.expressions')).toBe(true);
    expect(warnings.length).toBe(1);
    expect(errors.length).toBe(0);
  });

  it('flags template literals with expressions as error', () => {
    const { errors } = extractFromSource(samples.templateWithExpr, 'testfile.js');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('extracts simple JSX Trans with i18nKey', () => {
    const { success, warnings, errors } = extractFromSource(samples.jsxTransSimple, 'testfile.jsx');
    expect(success.has('jsx.simple.key')).toBe(true);
    expect(warnings.length).toBe(0);
    expect(errors.length).toBe(0);
  });

  it('flags JSX Trans child as i18nKey', () => {
    const { success } = extractFromSource(samples.jsxTransChildKey, 'testfile.jsx');
    expect(success.has('Text child key')).toBe(true);
  });

  it('flags JSX Trans with complex children as error', () => {
    const { errors } = extractFromSource(samples.jsxTransComplexChildren, 'testfile.jsx');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('flags unsupported argument types as error', () => {
    const { errors } = extractFromSource(samples.unsupportedArg, 'testfile.js');
    expect(errors.length).toBeGreaterThan(0);
  });
});
