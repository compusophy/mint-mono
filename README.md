# Generative PFP - Farcaster Mini App

A Farcaster Mini App that takes the user's profile picture, removes the background using AI, and generates a Fibonacci-spiral generative art piece.

## Features

- **Background Removal**: Server-side AI-powered background removal using `rembg`
- **Generative Art**: Creates unique Fibonacci-spiral patterns using the user's face as texture
- **Farcaster Integration**: Automatically fetches user PFP via Farcaster Mini App SDK
- **Dev Mode**: Test with any image URL when running outside Farcaster
- **Dark Mode**: Slate 900 dark theme throughout

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│   React Frontend    │  POST   │       FastAPI Backend            │
│   (Vercel)          │ ──────► │       (Railway)                  │
│                     │         │                                  │
│  - Farcaster SDK    │         │  1. Download PFP from URL        │
│  - Display result   │ ◄────── │  2. Remove background (rembg)    │
│                     │  base64 │  3. Generate spiral art (Pillow) │
└─────────────────────┘         │  4. Return as base64 PNG         │
                                └──────────────────────────────────┘
```

## Tech Stack

### Frontend
- React 18 (TypeScript)
- Vite
- Tailwind CSS
- @farcaster/miniapp-sdk
- lucide-react

### Backend
- Python 3.11+
- FastAPI
- rembg (AI background removal)
- Pillow (image processing)
- httpx (async HTTP client)

## Getting Started

### Frontend Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Development

```bash
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
# or
uvicorn main:app --reload --port 8000
```

## API Endpoints

### GET /
Health check, returns service info.

### GET /health
Health check for Railway deployment.

### POST /api/generate
Generate spiral artwork and return as base64.

**Request:**
```json
{
  "pfp_url": "https://example.com/pfp.png",
  "fid": 12345,
  "remove_background": true,
  "size": 1024
}
```

**Response:**
```json
{
  "success": true,
  "image_base64": "data:image/png;base64,..."
}
```

### POST /api/generate/image
Same as above but returns the PNG image directly.

## Deployment

### Frontend (Vercel)
1. Connect the repo to Vercel
2. Deploy automatically on push

### Backend (Railway)
1. Push the `server/` folder to Railway
2. Railway auto-detects the Dockerfile
3. Deploy!

## Configuration

Before deploying, update the Farcaster meta tags in `index.html`:

1. Replace placeholder domain with your actual domain
2. Add your `icon.png` to the `public/` folder (recommended size: 512x512)

## Project Structure

```
├── index.html              # Entry HTML with Farcaster meta tags
├── public/
│   ├── .well-known/
│   │   └── farcaster.json  # Farcaster frame manifest
│   └── icon.png            # App icon (add your own)
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Main app component
│   └── index.css           # Global styles
├── server/
│   ├── main.py             # FastAPI server
│   ├── generator.py        # Fibonacci spiral art generator
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Container config
│   └── README.md           # Server documentation
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── vercel.json
```

## License

MIT
