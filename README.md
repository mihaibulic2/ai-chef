# Chef prototype

Voice-first cooking companion. A mobile web app (iPhone Safari first) that suggests recipes from what you have at
home, judges them against your health profile, compares them, walks you through cooking, and ends with a short
wrap-up. Everything is stored in the browser; AI calls go straight from the browser to the Anthropic API with the
key you paste in Settings.

## Run locally
```
npm install
npm run dev          # http://localhost:5173/<slug>/  (slug is `base` in vite.config.ts)
```
Add `?mock=1` to the URL to use canned AI answers (no key, no cost).

## Deploy
```
npm run deploy       # builds and deploys to Firebase Hosting site "oleg-demo" in project "paced-breathing"
```
The app lives at `https://oleg-demo.web.app/<slug>/`.

## Where things are
- `src/ai/calls/<name>/prompt.md` and `config.json`: one folder per AI call (chat, judge, pantry_vision, wrapup).
  Edit prompts there. `config.json` picks the model key, effort, and max tokens.
- `src/ai/models.ts`: which model id each key maps to.
- `src/ai/schemas.ts`: tool definitions for the chat and JSON schemas for structured calls.
- `src/defaults/`: default pantry, watch-list, allergens, concerns, about-me, tag vocabulary.
- `src/components/`: screens (chat, carousel, health grid, cook mode, wrap-up, settings) and the orb.
- `src/state/`: store, actions (all AI calls and chat mutations), timers.
- `src/storage/`: localStorage layer.

## Tests
```
npm test             # unit tests (vitest)
npm run e2e          # Playwright flow in WebKit with an iPhone viewport, mock mode
```
