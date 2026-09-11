# Changelog

## 1.4.1 — 11 Sep 2026

The engine moves to roast 6.0.1 and three alignments land. Nothing new is
flagged; two wrong flags are gone.

- **Dark themes are the system working.** Through the engine's `tokenColors`,
  the guard now recognises every colour the system names, dark variants
  included. A dark-theme value passes; a near-miss snaps to the dark token:
  "nearest token: `var(--background)`, hsl(224 71% 4%)" — never the light
  twin. Verified on shadcn-ui/taxonomy.
- **`var(--x, fallback)` is benign everywhere.** A token reference with a
  fallback is still the system deciding. Previously it was flagged as a new
  radius (and worse, `var(--font-sans, sans-serif)` produced a phantom
  typeface finding). The guard's last private copy of the benign rule is
  gone: fonts now go through the engine's `fontDeclarations`, so counter and
  checker share one definition of a token reference.

Suite grows to 46 checks.


The promise behind every number: a patch release never changes what gets
flagged. If a version flags something new, it is a minor or major bump and
this file says what, in one plain line.

## 1.4.0 — 8 Sep 2026

Two new things get flagged, and a class of false positive goes away. The guard
and `roast --check` were answering the same question differently in seven
places; they now agree.

- **Now flagged: an inline `style={{ }}` block.** A pull request adding
  `style={{ display: 'flex' }}` carried no colour and no length, so nothing in
  the judge tripped and it sailed through. Only static blocks count. A block
  built from variables is decided somewhere else, and the guard cannot know
  whether that somewhere is on-system, so it stays quiet.
- **Now flagged: a second definition of a component you already have.** The
  most expensive thing a pull request can add, and the one thing the guard
  could not see. The finding names the file that already defines it and how
  many places use that one. Pages are routes rather than reusable parts, so
  two of a name there is not a second Button.
- **No longer flagged: pictures drawn with code.** An OG card, a PDF invoice,
  a canvas renderer and a file that is mostly SVG are all drawing rather than
  interface. The roast report has skipped them since 5.10 and the guard did
  not, so the same file came up clean in one place and full of strays in
  another. The whole file decides now, not the added lines, because a satori
  import sits at the top of a file a diff may never touch.
- **The exemption list, the extra declaration kinds and the component ledger
  all come from the engine.** The guard used to keep its own copies and a
  comment claiming they matched the engine's. They did not, and that is how
  the seven gaps opened. Forty lines of duplicated rules deleted; the claim is
  now true by construction. Requires roast 5.11.0, which the pin moves to.
- Em-dashes are gone from everything a person reads: the colour advice, both
  report formats, the git error and the strict-mode line in the action. A test
  fails if one comes back. Findings now read `Card.tsx:24 · new colour…`.
- Suite grows to 43.

## 1.3.5 — 7 Sep 2026

The engine moves to roast 5.10.2 and shadcn repos become legible. Nothing new
is flagged; the advice gets much truer.

- **shadcn palettes are read for real.** Tailwind v3 shadcn stores tokens as
  bare HSL triplets; the old engine saw almost none of them, so the guard's
  colour advice on the most common React stack ran on an empty map. Now a hex
  stray is matched to the actual palette, across colour notations, and named:
  "nearest token: `var(--foreground)`, hsl(222.2 47.4% 11.2%)". Verified on
  shadcn-ui/taxonomy.
- **The "it belongs in …" advice names the right file** — the token file is
  now chosen by where the palette lives, not where the most `--var`s sit.
- Artwork and OG-image routes stop contributing junk values to the learned
  system, inherited from the engine.

## 1.3.4 — 6 Sep 2026

Docs only: the README rewritten to the GOV.UK plain-language standard — short
sentences, active voice, everyday words. The slogan, the sample findings and
the promises all stay; the metaphors go. The command table also gains the
`--version` row it was missing. Nothing about behaviour changes.

## 1.3.3 — 2 Sep 2026

Docs only: the README and landing page catch up with 1.3.2 — the guard now
says it reads Lit and Stencil styling, and Honest limits carries the
css-template line-level gap. Published so npm's copy matches.

## 1.3.2 — 2 Sep 2026

The engine under the guard moves to roast 5.7.2, and the learning gets truer.
Nothing new is flagged; several wrong flags are gone.

- **Web-component repos are finally legible.** On Lit and Stencil codebases
  (Shoelace keeps its entire styling in `` css`…` `` templates) the guard now
  learns the real token layer, spacing scale and typefaces, so its "known" and
  "nearest" answers stop running on an almost-empty map.
- **Sass repos judge cleaner:** `$token` references are no longer typefaces,
  the Sass `color(base)` helper is no longer a colour, fully transparent
  values no longer pad the palette — inherited straight from the engine.
- Known gap, stated honestly: inside `` css`…` `` templates the per-line
  judge catches colours but not yet spacing and friends; the whole-repo
  learning sees everything.

## 1.3.1 — 31 Aug 2026

One character. The Marketplace sidebar strips a straight apostrophe from the
action description, so "doesn't" read "doesn t"; a typographic apostrophe
survives. Nothing else changes.

## 1.3.0 — 31 Aug 2026

The release for the legitimate exception, and for teams not on GitHub.

- **The escape hatch.** A `guard-ignore-next-line` comment silences every
  finding on the line below it — one line, visibly, with the reason sitting in
  code review. Checked against the file as it stands, so an exception granted
  last month still protects its line today. No config file, no rule IDs.
- **GitLab and Bitbucket recipes.** The README's new "Not on GitHub?" section
  carries copy-paste pipeline snippets for both; `--strict` fails the step and
  the verdict prints in the log.
- The repo grows CONTRIBUTING.md and issue templates — including a dedicated
  **false positive** template, because a wrong flag on legitimate code is the
  most serious bug class this tool has.

Nothing new is flagged; the escape hatch can only flag less. Suite grows to
28 checks.

## 1.2.0 — 31 Aug 2026

The advice names names, and three new kinds are judged. Minor bump: things
are flagged that 1.1 let through.

- **Advice speaks in variables.** Where the system defines a value as a custom
  property, findings now say so: "nearest token: `var(--blue-500)`, #3b6fe0"
  instead of leaving the reader to hunt the hex. Works for colours and for
  spacing steps alike.
- **Now flagged, wasn't before:** border radii, font sizes and shadows that
  the system does not declare, in style files, each with the nearest existing
  value named. Same self-vouching discount and disciplined-value handling
  (`var(…)`, `inherit`, `none`, known values) as everything else.
- Needs roast-my-design-system 5.5.3, which widened the engine doorway to
  carry the radii, font sizes, shadows and token names the harvest already
  computed.

Suite grows to 25 checks.

## 1.1.1 — 29 Aug 2026

Transparency release. Nothing new is flagged; two things can only flag less.

- `--exclude` and `.roastignore` now scope the judging as well as the
  learning: a folder you excluded is invisible to the whole tool, not judged
  against a system that deliberately ignores it.
- On a fork's pull request (read-only token) or a workflow missing
  `pull-requests: write`, the comment step no longer fails red: the verdict
  prints into the log with one line saying why it could not be posted.
- The README gains **Honest limits**: monorepos judged as one world, same-unit
  spacing comparison, taste not judged and tokens as a passport, the fork
  case, and the GitLab/Bitbucket recipe.

Suite grows to 21 checks.

## 1.1.0 — 29 Aug 2026

Field-tested against three public repos (vercel/ai-chatbot, excalidraw,
shadcn-ui) plus the no-GitHub cases: master-only repos, repos with no remote,
and the detached-HEAD state GitLab and Bitbucket CI run in. Two catches:

- **Now flagged, wasn't before:** styling in components whose filename sounds
  like artwork (Badge, Icon, Logo…). These were exempt wholesale, inherited
  from the scanner's SVG-artwork rule, which left every Badge component
  unguarded. The exemption now has to earn itself: such a file is only exempt
  when its added lines actually draw SVG. This is the minor bump.
- Fixed: a hex inside a Tailwind class was also counted by the raw sweep, so
  one sin on one line could appear twice. One sin, one finding.

Suite grows from 16 to 19 checks.

## 1.0.3 — 29 Aug 2026

Greg typed `--version` in his home folder and got four raw git fatals for his
trouble. Two fixes from one screenshot: `--version` (and `-v`) now answers
with the version, and running outside a git repository gets one calm sentence
instead of git's own noise. The README's command table also holds its column
width. Same rules, same flags, nothing new is judged.

## 1.0.2 — 29 Aug 2026

The shop window. The README grows up to match roast's: the slogan on top,
two real screenshots of the guard commenting on a live pull request (and the
same comment counting down after fixes), the command table, the trust section,
and the family footer. The npm description now opens with the slogan and the
keywords fill out. Docs only: same rules, same flags, nothing new is judged.

## 1.0.1 — 29 Aug 2026

The first live pull request earned its keep. The Action's comment step never
received the repository token (composite actions do not inherit it), so the
verdict was printed into the logs instead of posted on the pull request. The
token is now handed over explicitly. Same rules, same flags, nothing new is
judged: a patch, as promised. The publish workflow also learned to ignore the
floating `v1` tag, which moves on every release and must never start a publish.

## 1.0.0 — 29 Aug 2026

The guard exists. Judges only the lines a change adds, against the design
system the repo already has, learned with the roast engine.

- Catches: stray colours (nearest token named), spacing values new to the
  codebase (nearest step named), undeclared typefaces, `!important`,
  arbitrary Tailwind values.
- One sticky PR comment via the GitHub Action; strict mode fails the check
  instead.
- Local mode: `npx guard-my-design-system` judges uncommitted work.
- Exempt, same as roast: email and print styling, artwork files.

## 0.0.1 — 29 Aug 2026

Name reservation. The one hand-published version this package will ever have.
