# Image Filter Recipes (Web)

A real-time web application to apply Instagram-style filters to your images using the HTML5 Canvas API.

## Features

- **Real-time Processing:** Filters are applied instantly using the CPU (Canvas API).
- **Adjustable Parameters:** Fine-tune Strength, Exposure, Contrast, Saturation, Temperature, Fade, Vignette, and Grain.
- **Presets:** Includes presets like Clarendon-ish, Gingham-ish, Juno-ish, and more.
- **Save Result:** Export your processed image as a PNG.

## Requirements

- Node.js installed on your machine.

## Installation & Usage

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Start the server:**

    ```bash
    npm start
    ```

3.  **Open in browser:**
    Navigate to `http://localhost:3000` to use the application.

## Development

- The core logic is contained within `index.html`.
- `server.js` is a simple Express server to host the static file.
