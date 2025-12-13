# Generative PFP Server

FastAPI server for background removal and Fibonacci spiral art generation.

## Local Development

```bash
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
Health check for Railway.

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

## Deploy to Railway

1. Push this `server/` folder to a Git repo
2. Connect to Railway
3. Railway will auto-detect the Dockerfile
4. Deploy!

## Environment Variables

None required for basic functionality.

Future:
- `PINATA_API_KEY` - For IPFS uploads
- `PINATA_SECRET_KEY` - For IPFS uploads
