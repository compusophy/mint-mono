"""
Fibonacci Spiral Art Generator

Ports the p5.js spiral algorithm to Python/Pillow.
"""

import io
import math
from PIL import Image


# Fixed layer counts: Center 1, then Fibonacci sequence
LAYERS = [1, 8, 13, 21, 34, 55, 89, 144]


def generate_spiral_art(image_data: bytes, size: int = 1024) -> Image.Image:
    """
    Generate Fibonacci spiral artwork from an input image.
    
    Args:
        image_data: Input image as bytes (PNG with transparency preferred)
        size: Output canvas size (square)
    
    Returns:
        PIL Image with the generated artwork
    """
    # Load the input image
    input_image = Image.open(io.BytesIO(image_data)).convert("RGBA")
    
    # Create output canvas (black background)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    
    # Center of canvas
    center_x = size // 2
    center_y = size // 2
    
    # Initial size calculation (matching p5.js: min(width, height) / 6.103)
    base_size = size / 6.103
    current_size = base_size
    y_position = 0.0
    
    # Draw each layer
    for layer_idx in range(8):
        layer_count = LAYERS[layer_idx]
        draw_polar_ellipses(
            canvas, 
            input_image, 
            count=layer_count,
            radius=current_size / 2,
            y_offset=y_position,
            center=(center_x, center_y)
        )
        
        # Calculate next layer position (matching p5.js golden ratio logic)
        next_size = current_size * 0.61803
        y_position = y_position - current_size / 2 - next_size * 0.61803 - next_size / 2
        current_size = next_size
    
    return canvas


def draw_polar_ellipses(
    canvas: Image.Image,
    source_image: Image.Image,
    count: int,
    radius: float,
    y_offset: float,
    center: tuple[int, int]
) -> None:
    """
    Draw images in a polar (circular) arrangement.
    
    Args:
        canvas: Target canvas to draw on
        source_image: Image to draw
        count: Number of images to place around the circle
        radius: Size of each image
        y_offset: Vertical offset from center (for spiral layers)
        center: Center point of the canvas
    """
    angle_step = 360.0 / count
    center_x, center_y = center
    
    for i in range(1, count + 1):
        # Calculate angle (starting from top, going clockwise)
        # Matches p5.js: radians(90 - i * n)
        angle_deg = 90 - i * angle_step
        angle_rad = math.radians(angle_deg)
        
        # Calculate position
        x = math.cos(angle_rad) * y_offset
        y = math.sin(angle_rad) * y_offset
        
        # Calculate rotation (matches p5.js: angle - HALF_PI)
        rotation_rad = angle_rad - (math.pi / 2)
        rotation_deg = math.degrees(rotation_rad)
        
        # Calculate image dimensions maintaining aspect ratio
        w = 2 * radius
        h = 2 * radius
        ar = source_image.width / source_image.height
        
        if ar > 1:
            h = w / ar
        else:
            w = h * ar
        
        # Resize source image
        new_width = max(1, int(w))
        new_height = max(1, int(h))
        
        if new_width < 1 or new_height < 1:
            continue
            
        resized = source_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Rotate the image
        rotated = resized.rotate(-rotation_deg, expand=True, resample=Image.Resampling.BICUBIC)
        
        # Calculate paste position (centered on the calculated point)
        # p5.js Y already increases downward, so no flip needed
        paste_x = int(center_x + x - rotated.width // 2)
        paste_y = int(center_y + y - rotated.height // 2)
        
        # Paste with alpha compositing
        canvas.paste(rotated, (paste_x, paste_y), rotated)
