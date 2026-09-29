# Vite 6 + React 19 + Tailwind CSS v4 + TypeScript

A production-ready starter project showcasing modern front-end architecture, strict type safety, and the latest web standards.

---

## ⚡ Tech Stack

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Vite** | `^6.2.0` | Next-generation frontend tooling with fast HMR and warmup |
| **React** | `^19.0.0` | UI library with native Actions, `useActionState`, and `useOptimistic` |
| **Tailwind CSS** | `^4.0.0` | CSS-first styling engine powered by `@tailwindcss/vite` |
| **TypeScript** | `^5.7.3` | Strict type-checking with bundler module resolution |
| **Lucide React** | `^1.16.0` | Modern, lightweight icon collection |

---

## 🛠️ Key Architectural Decisions

1. **Tailwind CSS v4 CSS-First Integration**
   - Configured via `@tailwindcss/vite` in `vite.config.ts`.
   - Replaces legacy `tailwind.config.js` and `postcss.config.js` with direct CSS `@import "tailwindcss";` in `src/index.css`.

2. **React 19 Native Actions & Optimistic UI**
   - Demonstrated in `src/App.tsx` using `useActionState` and `useOptimistic`.
   - Root error monitoring callbacks configured in `src/main.tsx` (`onCaughtError`, `onUncaughtError`, `onRecoverableError`).

3. **Stale Deployment Chunk Recovery**
   - Native `window.addEventListener('vite:preloadError')` listener in `src/main.tsx` automatically recovers from deleted CDN hashed chunks on route navigation.

4. **Coarse Vendor Code-Splitting**
   - `vite.config.ts` partitions `react-vendor` and core application assets to maximize browser caching efficiency.

5. **Path Aliases**
   - `@/*` is mapped directly to `src/*` across both `vite.config.ts` and `tsconfig.app.json`.

---

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Start local development server (http://localhost:3000)
pnpm dev

# Type-check and build for production
pnpm run build

# Preview production build locally
pnpm run preview
```
