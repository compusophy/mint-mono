# Generative PFP - Farcaster Mini App

A Farcaster Mini App that takes the user's profile picture, removes the background using AI, and generates a high-resolution generative art piece using p5.js.

## Features

- **Background Removal**: Uses `@imgly/background-removal` for client-side AI-powered background removal
- **Generative Art**: Creates unique Fibonacci-spiral patterns using p5.js with the user's face as texture
- **Mobile Friendly**: Uses hidden iframe pattern to enable "Long Press to Save" on mobile devices
- **Dark Mode**: Slate 900 dark theme throughout

## Tech Stack

- React 18 (TypeScript)
- Vite
- Tailwind CSS
- p5.js (CDN loaded in sandboxed iframe)
- @farcaster/miniapp-sdk
- @imgly/background-removal
- lucide-react

## Getting Started

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Configuration

Before deploying, update the Farcaster meta tags in `index.html`:

1. Replace `[YOUR_DOMAIN]` with your actual domain (e.g., `generative-pfp.vercel.app`)
2. Add your `icon.png` to the `public/` folder (recommended size: 512x512)

## Architecture

### Hidden Generator Pattern

The app uses a hidden iframe pattern to work around mobile browser limitations with canvas saving:

1. A hidden 0x0 iframe loads p5.js from CDN
2. User's PFP (as base64) and p5 code are injected into the iframe
3. After `setup()` runs, the canvas is converted to a Data URL
4. The Data URL is posted back to the main React app via `postMessage`
5. The result is displayed as a standard `<img>` tag for easy saving

### Background Removal

- On load, fetches the Farcaster user's PFP
- Attempts background removal with a 10-second timeout
- Falls back to raw image if removal fails or times out

## Project Structure

```
├── index.html           # Entry HTML with Farcaster meta tags
├── public/
│   └── icon.png         # App icon (add your own)
├── src/
│   ├── main.tsx         # React entry point
│   ├── App.tsx          # Main app component
│   ├── index.css        # Global styles
│   ├── constants.ts     # p5.js code and utilities
│   └── components/
│       └── Preview.tsx  # Hidden iframe generator component
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── tsconfig.json
```

## License

MIT
