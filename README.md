# Lumina Filters

Lumina Filters is a high-performance, real-time web application designed to apply Instagram-style filters and image adjustments using WebGL and the HTML5 Canvas API.

## 🌟 Features

- **🚀 Real-time Processing:** Leverages WebGL for instant filter application and smooth slider adjustments.
- **🎨 Comprehensive Adjustments:**
  - **Strength:** Global filter intensity.
  - **Exposure:** Adjust the brightness of the image.
  - **Contrast:** Enhance or reduce the range between dark and light areas.
  - **Saturation:** Control the intensity of colors.
  - **Temperature & Tint:** Fine-tune color balance for warm, cool, or tinted looks.
  - **Fade:** Apply a matte, washed-out effect.
  - **Vignette:** Add classic dark corners for focus.
  - **Grain:** Add stylistic film grain texture.
- **🖼️ Professional Presets:** Includes 20+ curated presets inspired by Instagram and Google Photos, such as:
  - Clarendon, Gingham, Juno, Lark, Valencia, Lo-Fi.
  - Black and White options: Inkwell, Vogue, Ollie.
  - Aesthetic styles: West, Palma, Metro, Eiffel, Blush, and more.
- **💾 Save Result:** Export your processed high-resolution image as a PNG.
- **📱 Responsive UI:** Simple and intuitive interface for both desktop and mobile browsing.

## 🛠️ Technologies

- **Frontend:** HTML5, CSS3, JavaScript (ES6+), WebGL.
- **Backend:** Node.js, Express (for static file hosting).
- **Testing:** Jest.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lxlgarnett/lumina-filters.git
   cd lumina-filters
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Usage

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open in browser:**
    Navigate to `http://localhost:3000` to start editing your images.

### Docker

Alternatively, you can run the application using Docker:

1. **Build the image:**
   ```bash
   docker build -t lumina-filters .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:3000 lumina-filters
   ```

## 🧪 Development & Testing
The project uses Jest for unit testing core filter logic located in `filters.js`.

To run tests:
```bash
npm test
```

## 📁 Project Structure

- `index.html`: Main application interface.
- `main.js`: Core application logic, WebGL shader implementation, and UI wiring.
- `filters.js`: Mathematical utility functions for image processing (shared between app and tests).
- `server.js`: Simple Express server for local development.
- `tests/`: Contains unit tests for filter utilities.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.