import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
const root = path.resolve("src");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (/\.(tsx?|css)$/.test(name)) files.push(name);
  }
}
await walk(root);
const problems = [];
const graph = new Map();
for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
  const source = await readFile(file, "utf8");
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const edges = [];
  for (const match of source.matchAll(
    /(?:from\s+|import\s*)['"]([^'"]+)['"]/g,
  )) {
    const specifier = match[1];
    if (rel.startsWith("shared/") && /^@\/(features|app)\//.test(specifier))
      problems.push(`${rel}: foundations import ${specifier}`);
    if (
      /capirov2|apps\/api|\.\.\/\.\.\/\.\.\/\.\.\/|node:/.test(specifier) &&
      !rel.startsWith("app/")
    )
      problems.push(`${rel}: unexpected boundary ${specifier}`);
    let target = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null;
    if (target) {
      target = files.find(
        (f) => f === target || f === `${target}.ts` || f === `${target}.tsx`,
      );
      if (target) edges.push(target);
    }
  }
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  function inspect(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      problems.push(`${rel}: untyped any`);
    if (
      ts.isStringLiteral(node) &&
      /^https?:\/\//.test(node.text) &&
      !/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(node.text)
    )
      problems.push(`${rel}: hardcoded remote origin`);
    ts.forEachChild(node, inspect);
  }
  inspect(syntax);
  graph.set(file, edges);
}
function visit(file, ancestors = []) {
  if (ancestors.includes(file)) {
    problems.push(
      `Import cycle: ${[...ancestors, file].map((f) => path.relative(root, f)).join(" -> ")}`,
    );
    return;
  }
  for (const target of graph.get(file) ?? [])
    visit(target, [...ancestors, file]);
}
for (const file of graph.keys()) visit(file);
if (problems.length) {
  console.error([...new Set(problems)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${graph.size} modules; foundation direction, remote origins, typed boundaries and cycles checked.`,
  );
