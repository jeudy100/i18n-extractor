import { parse } from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = traverseImport.default;

/**
 * @typedef {Object} IErroredTranslation
 * @property {string} key
 * @property {string} reason
 * @property {string} filePath
 * @property {number|string} line
 */

/**
 * @param {string} source
 * @param {string} filePath
 * @returns {{
 *   success: Set<string>,
 *   warnings: IErroredTranslation[],
 *   errors: IErroredTranslation[]
 * }}
 */
export default function extractFromSource(source, filePath) {
  const success = new Set();
  const warnings = [];
  const errors = [];

  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    traverse(ast, {
      CallExpression(path) {
        const callee = path.get('callee');
        const loc = path.node.loc?.start || { line: '?' };
        const arg = path.node.arguments[0];
        let isTFunction = false;

        if (callee.isIdentifier({ name: 't' })) {
          isTFunction = true;
        }

        if (
          callee.isMemberExpression() &&
          callee.get('object').isIdentifier({ name: 'i18next' }) &&
          callee.get('property').isIdentifier({ name: 't' })
        ) {
          isTFunction = true;
        }

        if (!isTFunction || !arg) return;

        if (arg.type === 'StringLiteral') {
          success.add(arg.value);
        } else if (arg.type === 'TemplateLiteral') {
          if (arg.expressions.length === 0) {
            const key = arg.quasis.map((q) => q.value.cooked).join('');
            success.add(key);
            warnings.push({ key, reason: 'TemplateLiteral with no expressions', filePath, line: loc.line });
          } else {
            errors.push({ key: path.toString(), reason: 'TemplateLiteral with expressions', filePath, line: loc.line });
          }
        } else {
          errors.push({ key: path.toString(), reason: 'Unsupported argument type', filePath, line: loc.line });
        }
      },

      JSXElement(path) {
        const opening = path.node.openingElement;
        const loc = path.node.loc?.start || { line: '?' };

        if (opening.name.name !== 'Trans') return;

        const keyAttr = opening.attributes.find(attr => attr.name?.name === 'i18nKey');
        const children = path.node.children;
        const hasSimpleText = children.length === 1 && children[0].type === 'JSXText' && children[0].value.trim();

        if (keyAttr && keyAttr.value.type === 'StringLiteral') {
          if (hasSimpleText || children.length === 0) {
            success.add(keyAttr.value.value);
          } else {
            errors.push({ key: keyAttr.value.value, reason: 'Complex children in <Trans>', filePath, line: loc.line });
          }
        } else if (hasSimpleText) {
          success.add(children[0].value.trim());
        } else {
          errors.push({ key: path.toString(), reason: 'Missing i18nKey or complex children', filePath, line: loc.line });
        }
      }
    });
  } catch (err) {
    console.error(`[i18n-extract] ❌ Failed to parse ${filePath}\n`, err);
  }

  return { success, warnings, errors };
}