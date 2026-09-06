# guard-my-design-system

[![npm](https://img.shields.io/npm/v/guard-my-design-system?color=2dd4bf&label=npm)](https://www.npmjs.com/package/guard-my-design-system) [![downloads](https://img.shields.io/npm/dm/guard-my-design-system?color=2dd4bf&label=downloads)](https://www.npmjs.com/package/guard-my-design-system) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![no telemetry](https://img.shields.io/badge/no-telemetry-2dd4bf)](https://github.com/gregkozakiewicz/guard-my-design-system#what-makes-the-verdict-trustworthy) [![GitHub Action](https://img.shields.io/badge/GitHub_Action-v1-2dd4bf)](#on-a-pull-request)

## Your design system dies one pull request at a time. This makes sure it doesn't.

The guard checks pull requests for design-system drift. It looks only at the
lines a change adds. It never judges the code that was already there. For each
problem it finds, it names the closest value your system already has:

> `Card.tsx:24` — new colour `#4a7be8`. Nearest token: `var(--blue-500)`, `#3b6fe0`.
>
> `site.css:31` — new spacing value `13px`. Nearest existing value: `12px`.
>
> `site.css:32` — new border radius `5px`. Nearest existing value: `6px`.
>
> `site.css:33` — new typeface `Comic Sans MS`. First typeface declared in this codebase.
>
> `site.css:35` — `!important`. The cascade admitting defeat; raise specificity or fix the source order.

It learns your design system by scanning your repository with the
[roast-my-design-system](https://github.com/gregkozakiewicz/roast-my-design-system)
engine. It reads CSS, SCSS, styled components, Lit `` css`…` `` templates and
Stencil styling. You do not write any config, rules or token lists. Your
codebase is the rulebook.

This is the guard's comment on a real pull request:

![The guard's comment on a pull request: six new issues, each with a file path and line, the stray colours shown with swatches next to their nearest token, an off-scale spacing value next to its nearest step, a new typeface, an !important, and an arbitrary Tailwind value, ending with the note that only added lines are checked](https://raw.githubusercontent.com/gregkozakiewicz/guard-my-design-system/main/docs/pr-comment.png?v=1.0.2)

The guard posts one comment per pull request. When the author pushes fixes,
it updates that same comment. It never adds more comments:

![The same pull request after fixes were pushed: the guard's single comment has updated in place, now showing three remaining issues, with the fix commits visible in the timeline above it and all checks passing below](https://raw.githubusercontent.com/gregkozakiewicz/guard-my-design-system/main/docs/pr-comment-updated.png?v=1.0.2)

## What it catches

- **A hard-coded colour where a token exists.** The finding names the token:
  `var(--blue-500)`, not just a hex code.
- **A spacing value your codebase has never used**, with the nearest existing
  step named.
- **A border radius, font size or shadow your system does not declare**, with
  the nearest existing value named.
- **A typeface your system does not declare.**
- **`!important`.**
- **Arbitrary Tailwind values** such as `w-[137px]` and `mt-[37px]`.

It ignores everything that was already in the codebase. It asks one question
of a change: does it make things worse?

## When the guard is wrong

Sometimes an off-system value is correct. A partner's brand colour, for
example. Write a comment on the line above, and the guard lets that one line
pass:

```css
/* guard-ignore-next-line — partner brand colour, agreed with design */
background: #e4002b;
```

This works in any file the guard reads: `//` in components, `/* */` in styles.
The comment is visible in code review. It silences exactly one line. It keeps
working on later pull requests that touch the same line. There is no config
file and there are no rule IDs.

## Why this exists

You cannot ask a team to clean up years of styling. You can stop new problems
getting in. The guard does that automatically, on every pull request.

It matters more now than ever. AI tools write a growing share of UI code, and
they drift off-system faster than review can catch. Rules files ask nicely;
the guard checks.

## On a pull request

Set it up once. It takes about five minutes:

```yaml
# .github/workflows/guard.yml
name: guard
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: gregkozakiewicz/guard-my-design-system@v1
```

After that it runs on every pull request and needs no attention from you.

If you want the check to fail instead of commenting, turn on strict mode.
It is the only setting:

```yaml
      - uses: gregkozakiewicz/guard-my-design-system@v1
        with:
          strict: true
```

`exclude` keeps folders out of the system scan. It uses the same syntax as
the CLI below.

If your team pins actions for security, use an exact commit instead of a
version tag: `uses: gregkozakiewicz/guard-my-design-system@<commit-sha>`.

## On your machine

Check your own work before you open a pull request:

```bash
npx guard-my-design-system@latest
```

| Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | What you get |
|---|---|
| <code>npx&nbsp;guard-my-design-system@latest</code> | The lines you have added, judged against main, in the terminal |
| <code>npx&nbsp;guard-my-design-system@latest&nbsp;&lt;path&gt;</code> | Judge a different repository |
| <code>...&nbsp;--base&nbsp;&lt;ref&gt;</code> | Compare against a branch other than main |
| `... --strict` | Exit with code 1 when there are findings, for scripts and hooks |
| `... --markdown` | The verdict as markdown, the same text the PR comment carries |
| `... --json` | Findings as JSON, for scripts and pipelines |
| <code>...&nbsp;--exclude&nbsp;lab/</code> | Keep folders out of the system scan (separate more with commas). A `.roastignore` file at the repository root works too |
| `... --version` | The version number |

You need Node 18 or later, and git.

## Not on GitHub?

The CLI works anywhere git works. Only the comment-posting Action needs
GitHub. On GitLab, add this to `.gitlab-ci.yml`:

```yaml
guard:
  image: node:22
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - npx guard-my-design-system@latest --strict --base origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
```

On Bitbucket, add this to `bitbucket-pipelines.yml`:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          image: node:22
          script:
            - git fetch origin $BITBUCKET_PR_DESTINATION_BRANCH
            - npx guard-my-design-system@latest --strict --base origin/$BITBUCKET_PR_DESTINATION_BRANCH
```

The verdict prints in the pipeline log, and `--strict` fails the step. The
updating PR comment works on GitHub only, for now.

## What makes the verdict trustworthy

- **Only added lines are checked.** The existing codebase is never judged,
  never counted, never mentioned.
- **The results are deterministic.** The same engine that powers
  roast-my-design-system reads the diff and returns the same verdict every
  time. No AI model is involved.
- **Read-only. No network. No telemetry.** Everything runs on your machine or
  your CI runner. Nothing about your code leaves it.
- **Fair exemptions, inherited from roast.** Email and print styling must be
  inline, so the guard never flags it. Files that draw SVG artwork are not
  judged on their colours. Defining a new token is extending the system, not
  a problem.
- **Every finding comes with a fix.** The guard names the on-system value the
  author probably meant, so most fixes take under a minute and no meeting.

## Honest limits

Things the guard deliberately does not do, listed here so they never surprise
you in a pull request:

- **Monorepos are judged as one codebase.** The guard learns the system from
  the whole repository. A colour that is legitimate in `packages/ui` counts
  as known when it appears in `apps/web`. For per-package scores, use roast.
- **Spacing is compared within one unit.** If your scale uses rem and someone
  adds `13px`, the guard flags it. But it will not claim `0.75rem` is the
  nearest value to `13px`. Converting units would be a guess, and the guard
  does not guess.
- **Taste is not judged.** The right token in the wrong place passes.
  Defining a new token is never flagged. The guard checks drift, not
  decisions.
- **On a pull request from a fork, the comment cannot be posted.** GitHub
  gives the workflow a read-only token. The guard still runs, and the verdict
  appears in the workflow log with a line explaining why. The same happens if
  the workflow is missing `pull-requests: write`.
- **Not on GitHub?** Covered: GitLab and Bitbucket recipes are in
  [Not on GitHub?](#not-on-github) above.
- **Inside `` css`…` `` templates, the line-by-line check catches colours but
  not yet spacing, radii or shadows.** The whole-repository scan reads those
  templates in full, so the system is still learned correctly. The
  line-level gap will close with a future engine release.

## The family

[roast-my-design-system](https://github.com/gregkozakiewicz/roast-my-design-system)
examines your whole codebase: a health score against a 34-repo benchmark, the
evidence behind it, and the agent rules that keep AI-written UI on-system.
The guard stops new work adding to the pile.

Roast diagnoses it. Guard protects it.

**Your design system dies one pull request at a time. This makes sure it doesn't.**

<a href="https://github.com/gregkozakiewicz/guard-my-design-system"><img src="https://img.shields.io/badge/If%20it%20caught%20something%20before%20review%20did%2C%20a%20star%20helps%20other%20people%20find%20it-a855f7?style=for-the-badge&logo=github&logoColor=white" alt="If it caught something before review did, a star helps other people find it"></a>

## License

MIT. You may fork, modify and redistribute the code. The copyright notice
travels with it.

If you build a report, summary or audit of your own from this tool's findings,
keep one line in it: *Built with
[guard-my-design-system](https://github.com/gregkozakiewicz/guard-my-design-system)
by Greg Kozakiewicz*.

**guard-my-design-system**™ and the GK mark are trademarks of Greg Kozakiewicz.
Forking is welcome. Republishing under this name is not. See
[brand and attribution](https://gregkozakiewicz.github.io/guard-my-design-system/brand.html).

Built and designed by <a href="https://gregkozakiewicz.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/gk-mark-dark.png?v=3.10.1"><img src="https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/gk-mark.png?v=3.10.1" height="15" alt="GK mark"></picture> Greg Kozakiewicz</a>.
