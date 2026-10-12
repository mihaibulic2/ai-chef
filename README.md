# Chef

A voice-first cooking companion, built as a mobile web prototype. You tap an orb, say what you are in the mood for, and it suggests meals from what you already have at home, judges them against your health profile, lets you compare them, walks you through cooking step by step with timers and healthier swaps, and ends with a short wrap-up.

Live demo: **https://oleg-demo.web.app/**

It is a prototype. There is no login, no backend, and no database. Everything is stored in the browser, and AI calls go straight from the browser to the Anthropic API with a key you paste into Settings.

## What it does

1. **Chat with an orb.** Tap the orb to talk (iPhone Safari and Chrome). Say "done" or just pause to send. There is also a text box. The orb pulses while you speak, spins while thinking, and its colour drifts from amber to green as the conversation moves in a healthier direction. It never goes red.
2. **Recipe cards.** The chat answers with a carousel of 3 to 5 recipes made from the products in your "What I have" list. Each card shows time, servings, tags, and anything you would be missing. A separate, faster model judges every recipe in the background; the healthiest one gets a green "Recommended" chip.
3. **Compare.** Cards start selected; tap Compare to see them side by side: nutrition per serving, your health concerns, allergens, watch-list ingredients, and the ingredient list with a coloured dot per ingredient (green, amber, or red by verdict; brighter when the amount matters, grey when it is a trace).
4. **Cook.** "Cook this" opens a full-screen cooking flow: an ingredients page first, then one page per step with timers, then a wrap-up. Recipes that are not a great fit come with one or two **Health hacks**: simple substitutions with quantities and a payoff line. "Switch to this" or "I did this" applies one (confetti, the orb turns greener); "Switch back" undoes it. A mini orb in the bottom strip lets you talk to the chat without leaving the cook view.
5. **Wrap-up.** A short, non-preachy summary: headline, highlights, a few stat tiles, a streak line (the streak is invented, everything else is from the meal), and a "next time" hack.

## Settings

Open with the gear in the top right. Five tabs:

- **What I have.** One product per line, written the way a receipt or label would. You can also add photos of your fridge, pantry, or receipts: tap "Add a photo", pick one or more, then "Analyze". Each photo is sent to the vision model together with your current list, only new items come back, a cheap pass dedupes them, and you confirm what to add from a checklist.
- **Profile.** Three lists, one item per line: ingredients to avoid (seed oils, HFCS, and so on), allergens, and general concerns ("high saturated fat", "high added sugar").
- **About me.** Free text the chat assumes unless told otherwise (who you cook for, your goals).
- **Storage.** Your chats (delete one at a time) and Clear all. Everything lives in this browser only.
- **API key.** Paste an Anthropic API key and tap Save. The app fires one tiny request per AI call it uses and shows a check per model; once all pass the key is marked verified. Until then the gear, the tab, and the field are outlined in red.

Sensible defaults are preloaded: a 50-product pantry for the demo persona, a 20-item watch-list, allergens "nuts", concerns "high saturated fat" and "high added sugar", and an about-me paragraph.

## Trying the demo on a phone

1. Open https://oleg-demo.web.app/ in Safari on an iPhone (or Chrome on Android).
2. Settings → API key → paste a key → Save. Wait for the five green checks.
3. Optionally adjust What I have, Profile, and About me.
4. Back on the chat, tap the orb and say something like "fun pasta for me and my girlfriend in about 15 minutes".
5. Compare, pick one, cook it, try a health hack, finish, read the wrap-up.

Add `?mock=1` to the URL to run the whole flow with canned answers and no key. This is what the automated tests use.

## Setting up for development

Requirements: Node 20 or newer, npm. For deploying: the Firebase CLI, logged in to a Google account with access to the `paced-breathing` project.

```
git clone https://github.com/mihaibulic2/ai-chef.git
cd ai-chef
npm install
npm run dev            # http://localhost:5173/
```

No environment variables are needed. The API key is entered in the app's Settings and stored in the browser.

### Tests

```
npm test               # unit tests (Vitest, jsdom)
npm run e2e            # end-to-end flows (Playwright, WebKit with an iPhone viewport, mock mode)
npx playwright install chromium webkit   # once, to download the browsers
```

The e2e config starts the dev server by itself. The flows cover chat → carousel → compare → cook → timers → wrap-up, the health hacks, settings persistence, storage, and the API key checks.

### Deploy

```
npm run deploy         # builds to dist/ and deploys to Firebase Hosting site "oleg-demo"
```

`firebase.json` names the site, `.firebaserc` the project. Deploying to a different site or project means changing those two files and the `deploy` script in `package.json`.

## How it is built

Vite, React 19, TypeScript. No UI framework; hand-written CSS in `src/styles/theme.css`. Runtime dependencies are React and the official Anthropic SDK (used in browser mode with the key from Settings). Dev dependencies: Vitest, Testing Library, Playwright.

### Where things are

| Path | What |
|---|---|
| `src/ai/calls/<name>/prompt.md` | The system prompt for each AI call. Edit these to change behaviour. |
| `src/ai/calls/<name>/config.json` | Model key, effort, and max tokens for that call. |
| `src/ai/models.ts` | Which model id each key (`opus`, `sonnet`) maps to. |
| `src/ai/schemas.ts` | Tool definitions for the chat and JSON schemas for the structured calls. |
| `src/ai/client.ts` | The real client: chat loop with tools, structured calls, the per-call checks. |
| `src/ai/mock.ts` | The canned client used when the URL has `?mock=1`. |
| `src/defaults/` | Default pantry, watch-list, allergens, concerns, about-me, tag vocabulary. |
| `src/components/` | Screens and widgets: chat, orb, carousel, health grid, cook mode, wrap-up, settings. |
| `src/state/` | The store, all actions (AI calls and chat mutations), timers. |
| `src/storage/` | localStorage layer, versioned under the `aichef.v1.` prefix. |
| `src/speech/` | Speech recognition wrapper and the optional mic level meter. |
| `e2e/` | Playwright flows. |

### The AI calls

| Call | Model | Purpose |
|---|---|---|
| `chat` | Opus, medium effort, streaming | The conversation. Has three tools: `show_recipes` (cards), `set_mood` (orb colour), `show_cooking` (the cooking plan, with steps keyed so an updated plan keeps your place, plus health hacks). |
| `judge` | Sonnet, low effort | Given one recipe and your profile, returns nutrition per serving, a verdict per concern, allergen and watch-list presence, a verdict and significance per ingredient, a health score, and tags. Runs in parallel for every card. This stands in for the product database the real product would have. |
| `pantry_vision` | Opus | One call per photo: returns food products visible that are not already on your list. |
| `pantry_merge` | Sonnet | Dedupes what several photos found against your list. |
| `wrapup` | Opus | The end-of-cook summary. |

All structured calls use JSON-schema output; the chat tools use strict schemas. Models that the app targets keep thinking on, so the full assistant content is appended back to history verbatim and chats are never edited, only deleted.

### Things to know

- The chat model assigns recipe ids; if it reuses one across turns the app renames the older recipe so old cards keep rendering.
- Sends are queued: tapping "Cook this" while a reply is still streaming waits for it instead of being dropped.
- On Safari the orb pulses from the live transcript, not a mic meter, because iOS will not share the microphone between speech recognition and `getUserMedia`.
- Chats are written to localStorage on a short debounce, flushed on page hide.
- Timers are wall-clock based and survive reloads; when one hits zero the app chirps (and vibrates where supported). Reaching the wrap-up clears them, and closing the cook view with one running asks first.

## What this is not

This is a demo of the cooking experience, not the product. The real product would infer what you have from receipts and grocery loyalty data and look ingredients up in a product database, instead of a pasted list and a model's estimates. Photos of your fridge are a stand-in for that, nothing more.
