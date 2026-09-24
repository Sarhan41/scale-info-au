# scale-info

Production site for **scaleinfo.com.au**.

## Deploy rule

**This repo is the only source of truth. Do not run `vercel --prod` from a local folder.**

Vercel deploys by replacing the entire deployment with the folder you upload. Any file
missing from that folder is deleted from the live site. On 7 and 12 Sep 2026 this silently
removed `/book-5k` and `/book-orl` three times, because they were deployed from a different
machine whose copy never contained those files.

Workflow: branch, commit, open a PR, merge. Vercel deploys from `main`.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `variation-a.html` | Root, rewritten by `middleware.ts` |
| `/book` | `book.html` | Standard booking, AURR Calendly |
| `/book-orl` | `book-orl.html` | ORL closer Calendly |
| `/book-5k` | `book-5k.html` | 70/30 closer split, fires `Book5kVariant` pixel event |
| `/confirm` | `confirm.html` | Post-booking confirmation |
| `/disqualified` | `disqualified.html` | Disqualified applicants |
| `/variation-a`, `/variation-b` | A/B variants of the root |

All pages carry the Meta pixel and the Whop pixel (`biz_RUNwpNN7ysF3hl`). `variation-b`
currently has no Whop pixel.

## Gotchas

- `.vercelignore` keeps `.claude/`, `.playwright-mcp/` and working screenshots off the public
  domain. It was previously corrupt (it contained a literal HTML string), which served all of
  that publicly. Don't revert it.
- `book-5k.html` and `book-orl.html` are copies of `book.html` with different Calendly links.
  A change to `book.html` usually needs porting to both.
