#!/usr/bin/env node
/**
 * The gate. Builds a small git repo with a known base, applies a change with
 * known sins, and asserts the guard sees exactly those — and stays silent on
 * a disciplined change. No network, no snapshots, deterministic.
 *
 *   node tests/run.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'index.mjs');

let passed = 0, failed = 0;
const ok = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
};

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'guard-test-'));
  mkdirSync(join(dir, 'styles'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  git(dir, 'init', '-qb', 'main');
  writeFileSync(join(dir, 'styles/site.css'),
    '--blue-500: #3b6fe0;\n--grey-100: #f5f5f5;\n' +
    '.card { padding: 12px; color: var(--blue-500); border-radius: 6px; font-size: 14px; box-shadow: 0 1px 2px #1a1a1a; }\n');
  writeFileSync(join(dir, 'components/Button.tsx'),
    'export const Button = () => <button className="p-4">ok</button>;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}

const run = (dir, ...extra) =>
  JSON.parse(execFileSync('node', [CLI, dir, '--base', 'HEAD', '--json', ...extra], { encoding: 'utf8' }));

// ---- a change with known sins ----
console.log('sinful change:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'),
    '.hero { color: #3564cc; margin: 13px; font-family: "Comic Sans MS", cursive; }\n' +
    '.hero b { color: #3b6fe0 !important; }\n');
  writeFileSync(join(dir, 'components/Hero.tsx'),
    'export const Hero = () => <div className="mt-[37px]" style={{color: "#4a7be8"}}>hi</div>;\n');

  const r = run(dir);
  const kinds = r.findings.map((f) => f.kind).sort().join(',');
  ok(r.findings.length === 7, `finds 7 issues (got ${r.findings.length})`);
  // Since roaster 7.0.0 a bracket on a spacing utility (mt-[37px]) is judged
  // as off-scale spacing, not as an arbitrary value: one class, one finding.
  ok(kinds === 'color,color,font,important,inline,spacing,spacing', `kinds are right (${kinds})`);
  const stray = r.findings.find((f) => f.kind === 'color' && f.value === '#3564cc');
  ok(stray?.advice.includes('#3b6fe0'), 'stray colour names its nearest token');
  const spacing = r.findings.find((f) => f.kind === 'spacing' && f.value === '13px');
  ok(spacing && spacing.advice.includes('12px'), 'off-scale spacing names the nearest step');
  const bracket = r.findings.find((f) => f.kind === 'spacing' && f.value === '37px');
  ok(bracket && bracket.file.endsWith('Hero.tsx'), 'a bracket spacing class is off-scale spacing, judged once');
  ok(r.findings.every((f) => f.file && f.line > 0), 'every finding carries file and line');

  rmSync(dir, { recursive: true, force: true });
}

// ---- strict mode exit code ----
console.log('strict mode:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '.x { color: #4a7be8; }\n');
  let code = 0;
  try { execFileSync('node', [CLI, dir, '--base', 'HEAD', '--strict'], { encoding: 'utf8' }); }
  catch (e) { code = e.status; }
  ok(code === 1, `--strict exits 1 on findings (got ${code})`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- a disciplined change stays invisible ----
console.log('clean change:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '.note { color: var(--grey-100); padding: 12px; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'no findings for on-system code');
  rmSync(dir, { recursive: true, force: true });
}

// ---- extending the system is allowed ----
console.log('token definition:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '--green-500: #2fa14d;\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'defining a new token is not a sin');
  rmSync(dir, { recursive: true, force: true });
}

// ---- the past is never judged ----
console.log('old mess ignored:');
{
  const dir = makeRepo();
  // plant mess in the BASE, then make a clean change
  appendFileSync(join(dir, 'styles/site.css'), '.legacy { color: #cc0011 !important; margin: 17px; }\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'legacy mess');
  appendFileSync(join(dir, 'styles/site.css'), '.tidy { color: var(--blue-500); }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'pre-existing mess produces no findings');
  rmSync(dir, { recursive: true, force: true });
}

// ---- exempt files ----
console.log('exemptions:');
{
  const dir = makeRepo();
  mkdirSync(join(dir, 'emails'), { recursive: true });
  writeFileSync(join(dir, 'emails/welcome-email.tsx'),
    'export const E = () => <td style={{color: "#ff8800", padding: "3px"}} />;\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'email templates are exempt (inline styling there is correct practice)');
  rmSync(dir, { recursive: true, force: true });
}

// ---- markdown output ----
console.log('markdown:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '.x { color: #4a7be8; }\n');
  const md = execFileSync('node', [CLI, dir, '--base', 'HEAD', '--markdown'], { encoding: 'utf8' });
  ok(md.includes('guard-my-design-system: 1 new issue'), 'markdown header counts issues');
  ok(md.includes('npx roast-my-design-system'), 'markdown carries the roast footer');
  ok(md.includes('never judged'), 'markdown states the diff-only promise');
  rmSync(dir, { recursive: true, force: true });
}

// ---- advice names the token, not just the hex ----
console.log('token names:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '.x { color: #3564cc; }\n');
  const r = run(dir);
  ok(r.findings[0]?.advice.includes('var(--blue-500)'), `nearest token is named (${r.findings[0]?.advice})`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- radius, font-size and shadow are judged too ----
console.log('new kinds:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'),
    '.y { border-radius: 5px; font-size: 13.5px; box-shadow: 0 4px 12px; }\n');
  const r = run(dir);
  const kinds = r.findings.map((f) => f.kind).sort().join(',');
  ok(kinds === 'fontsize,radius,shadow', `all three kinds flagged (${kinds})`);
  const radius = r.findings.find((f) => f.kind === 'radius');
  ok(radius?.advice.includes('6px'), 'radius names the nearest existing value');
  rmSync(dir, { recursive: true, force: true });
}

// ---- inline style blocks ----
// The gap that let a whole class of change through (2026-09-08): a PR adding
// style={{ display: 'flex' }} carries no colour and no length, so nothing
// tripped. The engine had flagged inline blocks since 5.0; the guard had not.
console.log('inline styles:');
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'components/Panel.tsx'),
    'export const Panel = () => <div style={{ display: "flex", gap: "12px" }}>x</div>;\n');
  const r = run(dir);
  const inline = r.findings.filter((f) => f.kind === 'inline');
  ok(inline.length === 1, `a colourless inline block is still caught (got ${inline.length})`);
  ok(inline[0]?.advice.includes('invisible'), 'advice says why it cannot be seen');

  // a block whose values come from variables is decided elsewhere; the guard
  // cannot know whether it is on-system, so it says nothing
  writeFileSync(join(dir, 'components/Panel.tsx'),
    'export const Panel = ({ w }) => <div style={{ width: w, color: theme.fg }}>x</div>;\n');
  const dyn = run(dir);
  ok(dyn.findings.filter((f) => f.kind === 'inline').length === 0,
    'a block built from variables is not judged');

  // and the label carries no redundant value
  const text = execFileSync('node', [CLI, dir, '--base', 'HEAD'], { encoding: 'utf8' });
  ok(!text.includes('style={{ }} .'), 'the report does not repeat the value after the label');

  rmSync(dir, { recursive: true, force: true });
}

// ---- a second definition of the same component ----
// The highest-value check the engine had, missing from the path that runs on
// every pull request (2026-09-08). Needs a ledger only a newer engine exports,
// so it is skipped rather than failed when the pin is behind.
console.log('duplicate components:');
{
  const engineApi = await import('roast-my-design-system/engine');
  if (typeof engineApi.definedComponents !== 'function' ) {
    console.log('  – skipped: the pinned engine exports no component ledger yet');
  } else {
    const dir = makeRepo();
    writeFileSync(join(dir, 'components/ButtonV2.tsx'),
      'export const Button = () => <button className="p-4">also ok</button>;\n');
    const r = run(dir);
    const dupes = r.findings.filter((f) => f.kind === 'component');
    ok(dupes.length === 1, `a second <Button> is caught (got ${dupes.length})`);
    ok(dupes[0]?.value === 'Button', 'the finding names the component');
    ok(dupes[0]?.advice.includes('components/Button.tsx'), 'the advice names the one to import');

    // editing the component that already exists is not a second one
    writeFileSync(join(dir, 'components/ButtonV2.tsx'), '');
    writeFileSync(join(dir, 'components/Button.tsx'),
      'export const Button = () => <button className="p-4 gap-2">ok</button>;\n');
    const edit = run(dir);
    ok(edit.findings.filter((f) => f.kind === 'component').length === 0,
      'editing the original is not a duplicate of itself');

    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- disciplined values of the new kinds stay silent ----
console.log('new kinds, clean:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'),
    '.z { border-radius: var(--radius); font-size: 14px; box-shadow: none; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'var(), known value and none are not sins');
  rmSync(dir, { recursive: true, force: true });
}

// ---- one sin, one finding, even when two extractors see it ----
console.log('dedup:');
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'components/Promo.tsx'),
    'export const Promo = () => <div className="bg-[#4a7be8]" style={{color: "#4a7be8"}}>go</div>;\n');
  const r = run(dir);
  const colours = r.findings.filter((f) => f.kind === 'color' && f.value === '#4a7be8');
  ok(colours.length === 1, `#4a7be8 on one line is one finding (got ${colours.length})`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- a Badge that is plain UI is guarded; a Badge that draws SVG is not ----
console.log('artwork exemption earns itself:');
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'components/PromoBadge.tsx'),
    'export const PromoBadge = () => <span style={{background: "#70b1ec"}}>new</span>;\n');
  const r = run(dir);
  ok(r.findings.some((f) => f.file.includes('PromoBadge')), 'styled Badge component is judged');
  writeFileSync(join(dir, 'components/ShieldBadge.tsx'),
    'export const ShieldBadge = () => <svg><path fill="#ff8800" d="M0 0"/></svg>;\n');
  const r2 = run(dir);
  ok(!r2.findings.some((f) => f.file.includes('ShieldBadge')), 'SVG-drawing badge stays exempt');
  rmSync(dir, { recursive: true, force: true });
}

// ---- excluded folders are invisible to the judge too ----
// ---- pictures drawn with code ----
// The report skipped these from roast 5.10 and the guard did not, so an OG
// card came up clean in one door and full of strays in the other (2026-09-08).
// The satori import sits at the top of a file the diff never touches, which is
// why the judge reads the whole file rather than the added lines.
console.log('pictures, not interface:');
{
  const dir = makeRepo();
  mkdirSync(join(dir, 'app/api/og'), { recursive: true });
  mkdirSync(join(dir, 'src/renderers'), { recursive: true });
  writeFileSync(join(dir, 'app/card.tsx'),
    "import { ImageResponse } from 'next/og';\nexport function GET() { return new ImageResponse(<div />); }\n");
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'og base');

  const STRAY = 'export const X = () => <div style={{ background: "#c0ffee", padding: "27px" }} />;\n';
  writeFileSync(join(dir, 'app/api/og/route.tsx'), STRAY);
  writeFileSync(join(dir, 'src/renderers/Board.tsx'), STRAY);
  writeFileSync(join(dir, 'components/Scene.tsx'),
    `export const Scene = () => <svg style={{ fill: "#c0ffee" }}>${'<path d="M0 0" />'.repeat(15)}</svg>;\n`);
  // the giveaway is in the committed part of the file, not in the added line
  writeFileSync(join(dir, 'app/card.tsx'),
    "import { ImageResponse } from 'next/og';\nexport function GET() { return new ImageResponse(<div style={{ background: '#c0ffee' }} />); }\n");

  const r = run(dir, '--base', 'HEAD');
  for (const [needle, label] of [
    ['api/og', 'an OG route is left alone'],
    ['renderers', 'a pixel renderer is left alone'],
    ['Scene', 'a file that is mostly drawing is left alone'],
    ['card.tsx', 'a next/og import above the diff still exempts the file'],
  ]) {
    ok(!r.findings.some((f) => f.file.includes(needle)), label);
  }

  // and an ordinary component in the same change is still judged
  writeFileSync(join(dir, 'components/Panel.tsx'), STRAY);
  const r2 = run(dir, '--base', 'HEAD');
  ok(r2.findings.some((f) => f.file.includes('Panel')), 'an ordinary component is still judged');

  rmSync(dir, { recursive: true, force: true });
}

// ---- the voice: no em-dashes in anything a person reads ----
console.log('copy:');
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'components/Hero.tsx'),
    'export const Hero = () => <div style={{color: "#4a7be8"}} className="mt-[37px]">hi</div>;\n');
  const term = execFileSync('node', [CLI, dir, '--base', 'HEAD'], { encoding: 'utf8' });
  const md = execFileSync('node', [CLI, dir, '--base', 'HEAD', '--markdown'], { encoding: 'utf8' });
  ok(!term.includes('\u2014'), 'the terminal report carries no em-dash');
  ok(!md.includes('\u2014'), 'the markdown report carries no em-dash');
  rmSync(dir, { recursive: true, force: true });
}

console.log('exclusions:');
{
  const dir = makeRepo();
  mkdirSync(join(dir, 'lab'), { recursive: true });
  writeFileSync(join(dir, '.roastignore'), 'lab/\n');
  writeFileSync(join(dir, 'lab/experiment.css'), '.x { color: #cc0011; margin: 17px; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, '.roastignore folder is not judged');
  const r2 = JSON.parse(execFileSync('node', [CLI, dir, '--base', 'HEAD', '--json', '--exclude', 'lab/'], { encoding: 'utf8' }));
  ok(r2.findings.length === 0, '--exclude folder is not judged');
  rmSync(dir, { recursive: true, force: true });
}

// ---- the escape hatch ----
// ---- a dark theme is the system working ----
console.log('dark theme:');
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'styles/themes.css'),
    ':root { --surface: hsl(0 0% 100%); }\n.dark { --surface: 224 71% 4%; }\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'themes');
  appendFileSync(join(dir, 'styles/site.css'), '.panel { background: hsl(224 71% 4%); }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'a dark-theme token value is on-system, not a stray');
  appendFileSync(join(dir, 'styles/site.css'), '.panel-b { background: #04081a; }\n');
  const r2 = run(dir);
  const c = r2.findings.find((f) => f.kind === 'color');
  ok(c?.advice.includes('hsl(224 71% 4%)'), `near-dark stray snaps to the dark variant (${c?.advice})`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- a var() with a fallback is still the system deciding ----
console.log('token reference with fallback:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'),
    '.x { border-radius: var(--radius, 4px); font-family: var(--font-sans, sans-serif); }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'var(--x, fallback) is benign for radius and font alike');
  rmSync(dir, { recursive: true, force: true });
}

console.log('escape hatch:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'),
    '/* guard-ignore-next-line — partner brand colour */\n.p { color: #e4002b; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'ignored line stays silent');
  appendFileSync(join(dir, 'styles/site.css'), '.q { color: #e4002b; }\n');
  const r2 = run(dir);
  ok(r2.findings.length === 1 && r2.findings[0].line > 0, 'the exception covers one line, not the value');
  rmSync(dir, { recursive: true, force: true });
}

// ---- an old exception still protects its line ----
console.log('escape hatch, pre-existing:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '/* guard-ignore-next-line — legacy embed */\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'comment only');
  appendFileSync(join(dir, 'styles/site.css'), '.r { color: #cc0011 !important; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, 'comment committed earlier still silences the new line below it');
  rmSync(dir, { recursive: true, force: true });
}

// ---- --version ----
console.log('version flag:');
{
  const v = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const out = execFileSync('node', [CLI, '--version'], { encoding: 'utf8' }).trim();
  ok(out === `guard-my-design-system ${v}`, `--version prints the package version (${out})`);
}

// ---- outside a git repository ----
console.log('not a git repo:');
{
  const dir = mkdtempSync(join(tmpdir(), 'guard-nogit-'));
  let code = 0, err = '';
  try { execFileSync('node', [CLI, dir], { encoding: 'utf8' }); }
  catch (e) { code = e.status; err = e.stderr ?? ''; }
  ok(code === 2, `exits 2 outside a repo (got ${code})`);
  ok(err.includes('not a git repository') && !err.includes('fatal:'),
    'one calm sentence, no raw git noise');
  rmSync(dir, { recursive: true, force: true });
}


// ---- the profile facts from roast 7.8: installed code, palette, registry ----
console.log('shadcn kit:');
const SHEET = ':root {\n' + ['background', 'foreground', 'primary', 'primary-foreground', 'muted', 'muted-foreground', 'border', 'input', 'ring', 'card'].map((r) => `  --${r}: oklch(0.5 0 0);`).join('\n') + '\n}\n.dark {\n' + ['background', 'foreground', 'primary', 'muted-foreground', 'border', 'ring'].map((r) => `  --${r}: oklch(0.2 0 0);`).join('\n') + '\n}\n';
function makeKit() {
  const dir = mkdtempSync(join(tmpdir(), 'guard-kit-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components/ui'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });
  git(dir, 'init', '-qb', 'main');
  writeFileSync(join(dir, 'package.json'), '{ "name": "kit", "dependencies": { "next": "16.0.0", "react": "19.0.0", "tailwindcss": "4.0.0" } }\n');
  writeFileSync(join(dir, 'tsconfig.json'), '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }\n');
  writeFileSync(join(dir, 'components.json'), '{ "style": "base-nova", "tailwind": { "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true }, "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" } }\n');
  writeFileSync(join(dir, 'app/globals.css'), SHEET);
  writeFileSync(join(dir, 'lib/utils.ts'), 'export const cn = (...a) => a.join(" ");\n');
  writeFileSync(join(dir, 'components/ui/button.tsx'), 'export function Button(p) { return <button data-slot="button" className="bg-primary text-primary-foreground ring-[3px]" {...p} />; }\n');
  writeFileSync(join(dir, 'components/ui/card.tsx'), 'export function Card(p) { return <div data-slot="card" className="bg-card" {...p} />; }\n');
  writeFileSync(join(dir, 'app/page.tsx'), 'import { Button } from "@/components/ui/button";\nexport default function Page() { return <main className="p-6"><Button>ok</Button></main>; }\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}
{
  const dir = makeKit();
  // shadcn add sheet: a new door in the catalogue carries shadcn's brackets
  writeFileSync(join(dir, 'components/ui/sheet.tsx'), 'export function Sheet(p) { return <div data-slot="sheet" className="translate-x-[2.5rem] text-[0.8rem] bg-blue-500" {...p} />; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, `a component added to the installed catalogue is not the change's sin (got ${r.findings.length})`);
  // the same class in own code is paint from a tin
  writeFileSync(join(dir, 'app/page.tsx'), 'export default function Page() { return <main className="p-6 text-slate-500 bg-blue-500/20">hi</main>; }\n');
  const r2 = run(dir);
  const palette = r2.findings.filter((f) => f.kind === 'palette');
  ok(palette.length === 2, `palette classes in own code are flagged where a theme variable exists (got ${palette.length})`);
  ok(palette[0]?.advice.includes('app/globals.css'), 'the advice names the theme file');
  ok(r2.findings.every((f) => !f.file.includes('components/ui/')), 'nothing inside the catalogue is judged');
}

console.log('!important as the medium:');
{
  const dir = makeRepo();
  appendFileSync(join(dir, 'styles/site.css'), '.cm-editor { font-family: monospace !important; }\n.cm-gutters { padding-right: 12px !important; }\n.hero { color: red !important; }\n');
  const r = run(dir);
  const imp = r.findings.filter((f) => f.kind === 'important');
  ok(imp.length === 1, `!important aimed at a code editor's class names is the medium; the team's own is not (got ${imp.length})`);
  ok(imp[0]?.line === 6 || imp[0]?.file.endsWith('site.css'), 'the remaining finding is the .hero one');
}
{
  const dir = makeRepo();
  writeFileSync(join(dir, 'styles/widget.css'), '@import "tailwindcss/utilities.css" layer(utilities) important;\n#w .btn { color: red !important; }\n');
  const r = run(dir);
  ok(r.findings.filter((f) => f.kind === 'important').length === 0, 'a widget stylesheet that must beat its host page is the medium');
}

console.log('registry: judged on what it publishes:');
{
  const dir = mkdtempSync(join(tmpdir(), 'guard-reg-'));
  mkdirSync(join(dir, 'registry/ui'), { recursive: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  git(dir, 'init', '-qb', 'main');
  writeFileSync(join(dir, 'package.json'), '{ "name": "reg" }\n');
  writeFileSync(join(dir, 'registry.json'), JSON.stringify({ name: 'reg', items: [{ name: 'pill', type: 'registry:ui', files: [{ path: 'registry/ui/pill.tsx', type: 'registry:ui' }] }] }) + '\n');
  writeFileSync(join(dir, 'registry/ui/pill.tsx'), 'export function Pill(p) { return <span className="rounded-md" {...p} />; }\n');
  writeFileSync(join(dir, 'app/page.tsx'), 'export default function Page() { return <main>docs</main>; }\n');
  writeFileSync(join(dir, 'app/site.css'), '--ink: #101010;\n.doc { color: var(--ink); }\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  // a stray colour in the docs site: not published, not judged
  appendFileSync(join(dir, 'app/site.css'), '.promo { color: #ff6600; }\n');
  const r = run(dir);
  ok(r.findings.length === 0, `the docs site of a registry is not judged (got ${r.findings.length})`);
  // the same stray in a published component: judged
  writeFileSync(join(dir, 'registry/ui/pill.tsx'), 'export function Pill(p) { return <span className="rounded-md" style={{ color: "#ff6600" }} {...p} />; }\n');
  const r2 = run(dir);
  ok(r2.findings.some((f) => f.file.includes('registry/ui/pill.tsx')), 'a published component is judged as the project\'s own work');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
