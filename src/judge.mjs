/**
 * The judge — added lines on one side, the learned system on the other.
 * All detection comes from the roast engine's official doorway; this file
 * only decides what counts as "new mess" in the context of a diff.
 *
 * The rule for every sin: it must be NEW. A colour that is already a token,
 * a length the codebase already uses, a typeface the system already declares
 * — all invisible. The guard never asks anyone to clean the past.
 */
import {
  extractStyling, normalizeHex, nearestColor, nearestLength,
  isCodeFile, isStyleFile, typefaceOf, GENERIC_FONTS,
  definedComponents, exemptReason,
  EXTRA_KINDS, extraValue, fontDeclarations,
  WIDGET_CSS_RE, isLibraryClass, PALETTE_CLASS_RE, blankComments,
} from 'roast-my-design-system/engine';

// Folder membership, the way the engine's own splits do it.
const underAny = (file, dirs) => (dirs ?? []).some((d) => file === d || file.startsWith(`${d}/`) || file.endsWith(`/${d}`) || file.includes(`/${d}/`));

// The selector of the innermost block an added line sits in, read from the
// whole file: scan back from the line to the nearest unclosed "{" and take
// what precedes it. Null when the line is not inside a block.
function selectorAt(whole, lineNo) {
  if (!whole) return null;
  const lines = whole.split('\n');
  // include the added line itself up to the declaration: the block often
  // opens on the same line (`.cm-editor { font: x !important; }`)
  const cur = lines[lineNo - 1] ?? '';
  const cut = cur.search(/!\s*important/i);
  const upto = lines.slice(0, Math.max(0, lineNo - 1)).join('\n') + '\n' + (cut >= 0 ? cur.slice(0, cut) : cur);
  let depth = 0;
  for (let i = upto.length - 1; i >= 0; i--) {
    const ch = upto[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        const before = upto.slice(0, i);
        const start = Math.max(before.lastIndexOf('}'), before.lastIndexOf(';'), before.lastIndexOf('{'));
        return before.slice(start + 1).trim().split('\n').pop().trim();
      }
      depth--;
    }
  }
  return null;
}

// git prints diff paths from the repository root; the engine lists them from
// the directory it scanned. When the guard runs in a subdirectory the two
// disagree by a prefix, so a suffix match stands in for equality. It errs
// towards calling them the same file, which errs towards silence.
const samePath = (a, b) => a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);

// The honesty exemptions come from the engine now: email and print styling
// that must be inline, OG cards and PDF invoices, pixel renderers, and artwork
// that actually draws. This file used to keep its own copy and claim in a
// comment that the engine applied the same one. It did not, and that gap is
// how roast --check came to raise findings on email templates. One list, read
// from the doorway, so the claim is true by construction.

/**
 * Which files to leave alone. The whole file decides, not the added lines: a
 * satori import or an SVG drawing sits at the top of a file a diff may never
 * touch. readFile is how the caller hands over the working tree; without one
 * the added lines stand in, which sees less and so exempts less.
 */
function exemptFiles(added, readFile) {
  const text = new Map();
  for (const { file } of added) {
    if (text.has(file)) continue;
    let whole = null;
    if (readFile) { try { whole = readFile(file); } catch { whole = null; } }
    text.set(file, whole ?? added.filter((a) => a.file === file).map((a) => a.text).join('\n'));
  }
  const verdict = new Map();
  return (file) => {
    if (!verdict.has(file)) verdict.set(file, Boolean(exemptReason(file, text.get(file) ?? '')));
    return verdict.get(file);
  };
}

// Radius, font size and shadow, and what counts as a disciplined value, also
// come from the engine, so the harvest and the guard measure the same thing.

/**
 * Judge added lines against the learned system.
 * Returns [{ file, line, kind, value, advice }] sorted by file then line.
 * kinds: color | spacing | radius | fontsize | shadow | arbitrary |
 *        important | font | inline | component
 */
export function judge(added, system, { readFile } = {}) {
  const tokenSet = new Set(system.tokens);
  // How the repo was read, from the engine's own profiles (roast 7.8):
  // installed code is not the change's sin, a registry is judged on what it
  // publishes, and a palette class counts only where a theme variable exists.
  const prof = system.profile ?? {};
  const installed = prof.installedDirs ?? [];
  const counted = prof.registry?.countedDirs ?? [];
  const variants = prof.registry?.variants ?? [];
  const blockDirs = prof.registry?.blockDirs ?? [];
  const outOfScope = (file) => underAny(file, installed) || (counted.length > 0 && !underAny(file, counted));
  const whole = new Map();
  const wholeText = (file) => {
    if (!whole.has(file)) { let t = null; if (readFile) { try { t = readFile(file); } catch { t = null; } } whole.set(file, t); }
    return whole.get(file);
  };
  const isWidgetFile = (file) => underAny(file, prof.widgetDirs) || WIDGET_CSS_RE.test(wholeText(file) ?? '');
  const paletteRe = new RegExp(PALETTE_CLASS_RE.source, 'g');
  // The added line with its comments blanked, the way the report and the
  // live checks read a file before matching (roast 8.4.4): a class named in
  // a comment paints nothing. Blanked from the whole file when it is at hand,
  // so a block comment opened on an earlier line still counts as a comment.
  const blanked = new Map();
  const codeText = (file, lineNo, text) => {
    const w = wholeText(file);
    if (w == null) return blankComments(text);
    if (!blanked.has(file)) blanked.set(file, blankComments(w).split('\n'));
    // blanking keeps every character's place, so the file's line is the
    // diff's line only if the lengths match; otherwise the file has moved on
    const l = blanked.get(file)[lineNo - 1];
    return l != null && l.length === text.length ? l : blankComments(text);
  };

  // The system was learned from the tree that already CONTAINS these added
  // lines, so a new value would vouch for itself. A value is only "known"
  // if the repo uses it more times than this change added it.
  const exempt = exemptFiles(added, readFile);
  const addedLengths = new Map(), addedFaces = new Map();
  const addedExtras = { radius: new Map(), fontsize: new Map(), shadow: new Map() };
  for (const { file, line, text } of added) {
    if (exempt(file) || outOfScope(file)) continue;
    const css = isStyleFile(file);
    if (!css && !isCodeFile(file)) continue;
    for (const s of extractStyling(text, { css }).spacing) {
      addedLengths.set(s.value, (addedLengths.get(s.value) ?? 0) + 1);
    }
    if (css) {
      for (const { kind, re } of EXTRA_KINDS) {
        const v = extraValue(re, text);
        if (v) addedExtras[kind].set(v, (addedExtras[kind].get(v) ?? 0) + 1);
      }
    }
    if (css) {
      for (const d of fontDeclarations(text)) {
        const face = typefaceOf(d.raw);
        if (face) addedFaces.set(face, (addedFaces.get(face) ?? 0) + 1);
      }
    }
  }
  const knownLengths = new Set(
    system.spacing.filter((s) => s.count > (addedLengths.get(s.value) ?? 0)).map((s) => s.value)
  );
  const knownExtras = {};
  for (const { kind, learned } of EXTRA_KINDS) {
    knownExtras[kind] = new Set(
      (system[learned] ?? []).filter((e) => e.count > (addedExtras[kind].get(e.value) ?? 0)).map((e) => e.value)
    );
  }
  // "use var(--blue-500)", not "go hunt this hex": name a value when the
  // system defines it as a custom property.
  const named = (value) => {
    // shadcn-style tokens are defined as bare triplets (--primary: 222.2 47.4%
    // 11.2%) but normalised to hsl(...); try the unwrapped form too.
    const n = system.tokenNames?.[value]
      ?? system.tokenNames?.[value.replace(/^hsla?\((.*)\)$/i, '$1')];
    return n ? `var(${n}), ${value}` : value;
  };
  const faceCounts = new Map();
  for (const f of system.fontFamilies) {
    const face = typefaceOf(f.value);
    if (face) faceCounts.set(face, (faceCounts.get(face) ?? 0) + f.count);
  }
  const knownFaces = new Set(
    [...faceCounts].filter(([face, n]) => n > (addedFaces.get(face) ?? 0)).map(([face]) => face)
  );
  // Components the repo already defines, by name. Pages are routes rather than
  // reusable parts, so two of a name there is not a second Button.
  const componentsByName = new Map();
  if (definedComponents && Array.isArray(system.components)) {
    for (const c of system.components) {
      if (c.isPage) continue;
      const list = componentsByName.get(c.name) ?? [];
      list.push(c);
      componentsByName.set(c.name, list);
    }
  }

  const findings = [];

  for (const { file, line, text } of added) {
    if (exempt(file) || outOfScope(file)) continue;
    const css = isStyleFile(file);
    if (!css && !isCodeFile(file)) continue;

    const seen = extractStyling(text, { css });

    for (const c of seen.colors) {
      if (tokenSet.has(c.value)) continue; // disciplined token use
      const near = c.value.startsWith('#') ? nearestColor(c.value, system.tokens) : null;
      findings.push({
        file, line, kind: 'color', value: c.value,
        advice: near && near.distance <= 48
          ? `nearest token: ${named(near.value)}`
          : system.tokenFile
            ? `no token resembles it, and if it is a real decision it belongs in ${system.tokenFile}`
            : 'no token layer found to compare against',
      });
    }

    for (const s of seen.spacing) {
      if (knownLengths.has(s.value)) continue; // the codebase already uses it
      const near = nearestLength(s.value, [...knownLengths]);
      findings.push({
        file, line, kind: 'spacing', value: s.value,
        advice: near ? `nearest existing value: ${named(near.value)}` : 'first value of its unit in this codebase',
      });
    }

    if (css) {
      for (const { kind, re } of EXTRA_KINDS) {
        const v = extraValue(re, text);
        if (!v || knownExtras[kind].has(v)) continue;
        const near = nearestLength(v, [...knownExtras[kind]]);
        findings.push({
          file, line, kind, value: v,
          advice: near
            ? `nearest existing value: ${named(near.value)}`
            : knownExtras[kind].size
              ? `differs from every one the system declares`
              : 'first of its kind in this codebase',
        });
      }
    }

    // Styling inside style={{ }} is invisible to the system and to every
    // agent that reads the file, so it can never be on-system by definition.
    // Only static blocks count; extractStyling already ignores the ones built
    // from variables, where the values are decided elsewhere.
    for (const _ of seen.inlineBlocks) {
      findings.push({
        file, line, kind: 'inline', value: 'style={{ }}',
        advice: 'the values are invisible to the system and to every agent that reads the file; move them to classes or tokens',
      });
    }

    // A hand-rolled second <Button> is the most expensive thing a pull request
    // can add, and it was the one thing the guard could not see. The scan
    // includes this change, so the new copy is in the ledger too: what counts
    // is whether the name lives anywhere ELSE.
    if (!css && componentsByName.size) {
      for (const name of definedComponents(text)) {
        const variantOf = (f) => variants.find((v) => underAny(f, [v])) ?? null;
        const elsewhere = (componentsByName.get(name) ?? []).filter((c) => !samePath(c.file, file))
          // a registry keeps the same component in sibling variants, and a
          // block installs alone: neither is a second Button
          .filter((c) => !(variantOf(file) && variantOf(c.file) && variantOf(c.file) !== variantOf(file)))
          .filter((c) => !(underAny(file, blockDirs) && underAny(c.file, blockDirs)));
        if (!elsewhere.length) continue;
        const best = [...elsewhere].sort((a, b) => b.usageCount - a.usageCount)[0];
        findings.push({
          file, line, kind: 'component', value: name,
          // never open the advice with the path: the report capitalises the
          // first letter, and a capitalised path is the wrong path
          advice: elsewhere.length > 1
            ? `${elsewhere.length} other files define it too; import ${best.file}, the one the codebase leans on`
            : `import ${best.file} rather than starting a second one${best.usageCount ? `, which ${best.usageCount} place${best.usageCount === 1 ? '' : 's'} already do` : ''}`,
        });
      }
    }

    for (const a of seen.arbitrary) {
      findings.push({
        file, line, kind: 'arbitrary', value: a.value,
        advice: 'an arbitrary Tailwind value sidesteps the scale; use a scale step or add one',
      });
    }

    // !important is the medium, not the mess, in two places the report also
    // sets aside: a widget stylesheet that must beat its host page, and a
    // selector aimed only at a library's own class names.
    if (seen.important.length && !(css && isWidgetFile(file))) {
      const sel = css ? selectorAt(wholeText(file), line) : null;
      const classes = sel ? [...sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]) : [];
      const libraryAimed = classes.length > 0 && classes.every(isLibraryClass);
      if (!libraryAimed) {
        for (const _ of seen.important) {
          findings.push({
            file, line, kind: 'important', value: '!important',
            advice: 'the cascade admitting defeat; raise specificity or fix the source order',
          });
        }
      }
    }

    // A palette class where a theme variable exists (a shadcn kit in
    // CSS-variable mode): paint from a tin. The same pattern the report
    // counts per 100 files; here, per added line.
    if (!css && prof.paletteReady) {
      for (const m of codeText(file, line, text).matchAll(paletteRe)) {
        findings.push({
          file, line, kind: 'palette', value: m[0],
          advice: `a theme token covers this; use it as the class (bg-primary, text-muted-foreground), or add one${prof.sheetFile ? ` to ${prof.sheetFile}` : ' to the theme'} once`,
        });
      }
    }

    // The engine's fontDeclarations decides what a judgeable font value is
    // (benign token references filtered inside it), so the counter and the
    // checker can never disagree about fonts either.
    if (css) {
      for (const d of fontDeclarations(text)) {
        const face = typefaceOf(d.raw);
        if (face && !GENERIC_FONTS.has(face.toLowerCase()) && !knownFaces.has(face)) {
          findings.push({
            file, line, kind: 'font', value: face,
            advice: knownFaces.size
              ? `the system declares: ${[...knownFaces].join(', ')}`
              : 'first typeface declared in this codebase',
          });
        }
      }
    }
  }

  // Two extractors can see the same value on the same line (a hex inside a
  // Tailwind class is also a hex in the raw sweep). One sin, one line.
  const seen = new Set();
  const deduped = findings.filter((f) => {
    const key = `${f.file}|${f.line}|${f.kind}|${f.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
