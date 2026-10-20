// Load the app's TypeScript modules in plain `node --test`: transpile with the
// typescript package (Node's type stripping rejects parameter properties) and
// import them from data: URLs, with each import mapped to a real file or a test double.
import {readFileSync} from 'node:fs';
import ts from 'typescript';

export const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
export const fileUrl = path => new URL(path, import.meta.url).href;

/** A data: URL for a TypeScript file whose import specifiers are replaced by `imports`. `tag` makes a fresh module instance. */
export function tsModule(path, imports = {}, tag = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
  js = js.replace(/(\bfrom\s*|\bimport\s*)(["'])([^"']+)\2/g, (match, lead, quote, specifier) => {
    if (!(specifier in imports)) throw new Error(`${path}: no mapping for import ${specifier}`);
    return lead + JSON.stringify(imports[specifier]);
  });
  return dataUrl(js + (tag ? `\n// ${tag}` : ''));
}

// Test doubles live in a registry so a data: module can export live values.
const doubles = globalThis.__tsModuleDoubles ||= [];
/** A data: URL for a module exporting `values` (use `default` for a default export). */
export function doubleModule(values) {
  const id = doubles.push(values) - 1;
  const lines = Object.keys(values).map(name => name === 'default'
    ? `export default globalThis.__tsModuleDoubles[${id}].default;`
    : `export const ${name} = globalThis.__tsModuleDoubles[${id}].${name};`);
  return dataUrl(lines.join('\n'));
}

export const guideCoreUrl = fileUrl('../../lib/guide-core.mjs');
export const validationUrl = tsModule('../../lib/cloud-validation.ts', {'./guide-core.mjs': guideCoreUrl});
/** The real lib/cloud-validation.ts. */
export const loadValidation = () => import(validationUrl);
