# IT Support Troubleshooting Portfolio

A responsive troubleshooting portfolio built with React, TypeScript, Vite, Framer Motion, and Lucide icons, hosted on Vercel. Cases (including screenshots) can be added, edited, and deleted from any device after signing in with your Vercel account.

## How editing works

| Address | Who can open it | What it does |
| --- | --- | --- |
| Public site, e.g. `supportfolio.vercel.app` | Everyone | Read-only portfolio |
| The deployment's own URL, e.g. `supportfolio-a1b2c3-you.vercel.app` | Only you, after a Vercel login | Same site with **New case**, **Edit case**, and **Delete** |

- To edit, open the public site and click **Manage cases** in the footer. It always points to the current editor address, and Vercel asks you to sign in.
- Edits are saved to a private **Vercel Blob** store and appear on the public site within about a minute. Each save keeps the previous version under `data/history/` (the latest 50 are kept).
- If you edit on two devices at once, the second save is refused instead of overwriting the first. Reload the page and apply your change again.
- The server only allows editing on the protected address, and only after checking that Vercel Authentication is switched on (Project → Settings → Deployment Protection → **Standard Protection**). If protection is ever turned off, editing turns off with it.
- Don't share *Shareable Links* or *Protection Bypass* secrets for the editor address: anyone who has one can edit.

Images are resized in the browser to at most 1920 px and saved as WebP before uploading. That keeps them small and removes photo location data. Each image must end up under 4 MB, and each case can have up to 12.

## Run locally

Requires Node.js 20.19+ and npm.

```bash
npm install
npm run dev
```

`npm run dev` includes a local copy of the API, so the editor works offline. Local edits are saved in `.local-data/` (git-ignored) and **do not** change the live site. The first time you run it, it starts from the bundled cases in `src/data/cases.json`.

Create a production build with `npm run build`.

## Deploy

```bash
npx vercel login                                   # once per computer
npx vercel link                                    # once: choose or create the project
npx vercel blob create-store supportfolio-cases --access private --yes   # once: storage, auto-connected
npx vercel deploy --prod
```

New Vercel projects use Standard Deployment Protection by default. Check it with `npx vercel project protection`.

## Repository layout

```text
.
├── api/                  Vercel Functions (thin wrappers around server/)
├── server/
│   ├── handlers.ts       the /api contract: cases, images, session
│   ├── blobRepository.ts Vercel Blob storage (production)
│   ├── fileRepository.ts .local-data/ storage (npm run dev)
│   └── vercelAccess.ts   who may edit, and the protection self-check
├── src/
│   ├── App.tsx           pages and layout
│   ├── components/       case card, image gallery
│   ├── editor/           case editor (loaded only for editors)
│   └── data/             types, validation, API client, starting cases (cases.json)
├── vite-plugins/         local API for npm run dev
├── styles.css, src/pages.css
└── vercel.json           SPA routing and security headers
```

## Features

- Searchable, category-filtered case library with a dedicated page for each case
- Detailed case guides: symptoms, causes, step-by-step flow, root cause, resolution, verification, prevention, tools, and skills
- Screenshot galleries with a full-screen viewer (keyboard and Esc support)
- Case editor: live card preview, icon picker, reorderable lists, drag-and-drop or paste-to-upload images, validation, `Ctrl/Cmd + S` to save
- Interactive flowcharts and expandable decision trees
- Light and dark themes, responsive layout, keyboard search shortcut (`Ctrl/Cmd + K`), and reduced-motion support

Troubleshooting procedures are examples. Follow organizational policies, verify identity before account actions, protect user data, and escalate when appropriate.
