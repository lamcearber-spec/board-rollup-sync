# Board Rollup Sync

A client-only monday.com Board View app that rolls selected source boards into one target board for dashboard reporting and cross-board status review.

## Stack

- React + TypeScript + Vite
- `monday-sdk-js` for context, GraphQL, and `monday.storage.instance`
- `@vibe/core` tokens/components and `lucide-react` icons
- Vitest + Testing Library

## Local Development

```bash
pnpm install
pnpm dev
```

Outside monday, the app uses fixture boards so preview and sync behavior are testable locally. Inside monday, it reads source board IDs from the user configuration, fetches source board items through GraphQL pagination, creates or updates rollup items on the configured target board, and saves configuration plus sync mappings in monday instance storage.

## Verification

```bash
pnpm test
pnpm lint
pnpm build
```

## Deployment

- Production URL: https://board-rollup-sync.vercel.app/
- GitHub: https://github.com/lamcearber-spec/board-rollup-sync

## monday App Setup

1. Create a monday app named Board Rollup Sync with a Board View feature.
2. Set the feature source to Custom URL and use `https://board-rollup-sync.vercel.app/`.
3. Request `boards:read` and `boards:write` OAuth scopes.
4. Test inside a real monday board with a disposable target board before marketplace submission.
