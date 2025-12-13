import io
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import httpx
from rembg import remove
from generator import generate_spiral_art

app = FastAPI(title="Generative PFP API")

# CORS - only allow our frontend
ALLOWED_ORIGINS = [
    "https://compu-gnpfp.vercel.app",
    "http://localhost:5173",  # Local dev
    "http://localhost:3000",  # Local dev alt
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    pfp_url: str
    fid: int | None = None
    remove_background: bool = True
    size: int = 1024


class GenerateResponse(BaseModel):
    success: bool
    image_base64: str | None = None
    error: str | None = None


@app.get("/")
async def root():
    return {"status": "ok", "service": "Generative PFP API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """
    Generate spiral artwork from a PFP image.
    
    1. Download the PFP from URL
    2. Remove background (optional)
    3. Generate Fibonacci spiral artwork
    4. Return as base64
    """
    try:
        print(f"Generating for FID: {request.fid}, URL: {request.pfp_url[:50]}...")
        
        # Step 1: Download the image
        async with httpx.AsyncClient() as client:
            response = await client.get(request.pfp_url, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PFP")
            image_data = response.content
        
        print(f"Downloaded image: {len(image_data)} bytes")
        
        # Step 2: Remove background (optional)
        if request.remove_background:
            print("Removing background...")
            image_data = remove(image_data)
            print(f"Background removed: {len(image_data)} bytes")
        
        # Step 3: Generate spiral artwork
        print(f"Generating spiral art at {request.size}x{request.size}...")
        result_image = generate_spiral_art(image_data, size=request.size)
        
        # Step 4: Convert to base64
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        print(f"Generated image: {len(image_base64)} chars base64")
        
        return GenerateResponse(
            success=True,
            image_base64=f"data:image/png;base64,{image_base64}"
        )
        
    except Exception as e:
        print(f"Error: {e}")
        return GenerateResponse(
            success=False,
            error=str(e)
        )


@app.post("/api/generate/image")
async def generate_image(request: GenerateRequest):
    """
    Same as /api/generate but returns the image directly instead of base64.
    """
    try:
        # Download
        async with httpx.AsyncClient() as client:
            response = await client.get(request.pfp_url, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PFP")
            image_data = response.content
        
        # Remove background
        if request.remove_background:
            image_data = remove(image_data)
        
        # Generate
        result_image = generate_spiral_art(image_data, size=request.size)
        
        # Return as PNG
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        buffer.seek(0)
        
        return Response(content=buffer.getvalue(), media_type="image/png")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
