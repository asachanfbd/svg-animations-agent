# Agent Instructions for SVG Interactive Animation Engine

Please adhere to the following rules, architecture constraints, and historical context.

## 1. Context & Architecture
- **Library Name**: `svg-interactive-animation-engine` (Published on NPM).
- **Purpose**: A lightweight, purely imperative JavaScript animation engine designed to sequence complex, timeline-based SVG animations and interactive prototypes. It does not rely on CSS keyframes.
- **Core File**: `svg_animations.js` uses a Universal Module Definition (UMD) pattern. It securely exports the `AnimationManager` and `Layer` classes and functions seamlessly in both modern NPM setups (React, Vue, Next.js) and vanilla HTML environments via `<script>` tags.

## 2. Working on the Library Core
- **No External Dependencies**: The engine must remain self-contained, lightweight, and purely imperative. Do not add external libraries or CSS frameworks.
- **UMD Pattern**: When modifying `svg_animations.js`, ensure your changes remain compatible with the UMD wrapper so you do not break existing CJS, ESM, or global browser implementations.
- **NPM Package**: If you make changes to the core files, remind the user that they will need to bump the version in `package.json` and run `npm publish` to push the updates to the registry.

## 3. Creating Animations for Users
When generating walkthroughs or animations for the user using this library:
1. **Initialize**: Instantiate `const manager = new AnimationManager('svg-id');` and call `manager.start();`.
2. **Layers**: Use `manager.createLayer('layer-name', '#element-id')` to wrap target SVG elements (`<g>`, `<path>`, etc.).
3. **Timelines**: Define timelines using arrays of steps. Each step executes parallel animations (like `move`, `fade`, `scale`, `rotate`, `type`) over a specified `duration`.
4. **Events**: For complex, non-linear prototypes (like waiting for a click simulation), utilize the Event Bus. Emit events in a timeline step (`{ type: 'emit', event: 'step-done' }`) and listen on other layers (`layer.on('step-done', () => { ... })`).
5. **Transform Origins**: Remember that `scale` and `rotate` animations operate relative to the immediate parent's `(0,0)` coordinate. Always wrap paths in `<g>` tags and use standard SVG structural translations to define custom origins if needed.

## 4. Retrieving and Using Icons
If the user asks you to add, include, or animate a new icon:
1. **Search**: Go to [svgrepo.com](https://www.svgrepo.com/) to find the requested icon.
2. **Extract**: Copy the raw SVG portion (the `<svg>` tags and inner paths) of that icon.
3. **Integrate**: Insert the raw SVG code directly into the user's file and use `<g>` tags around the icon to scale/translate it to fit the intended use case.
4. **Fallback**: If `svgrepo.com` is inaccessible to you, or you cannot retrieve the raw SVG data, **you must explicitly ask the user to provide the SVG code** so you can embed it directly.

