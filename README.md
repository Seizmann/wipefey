<p align="center">
  <a href="https://wipefey.rexio.pro">
    <img src="./public/favicon.svg" width="96" height="96" alt="Wipefey Logo" />
  </a>
</p>

<h1 align="center">Wipefey</h1>

<p align="center">
  Inspect photo metadata, detect AI-generation markers, and wipe it all clean — 100% in your browser.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" /></a>
  <a href="https://wipefey.rexio.pro"><img src="https://img.shields.io/badge/Live%20Demo-wipefey.rexio.pro-0066f3.svg" alt="Live Demo" /></a>
</p>

---

Wipefey is a free, open-source, client-side metadata utility for photos. It extracts and displays hidden metadata, checks for known AI-generation indicator tags, and processes the image to clean it. Wipefey is built for privacy-conscious users who want to review what information their images carry before sharing them online.

No registrations. No server uploads. **Your photos never leave your device.**

## Features

- **Metadata Inspection**: Reads and displays EXIF (camera make, model, timestamps, exposure, software), IPTC, XMP, GPS coordinates, and PNG text chunks (`tEXt`/`iTXt`/`zTXt`).
- **AI-Generation Badge Heuristic**: Scans metadata for known generator signatures (e.g., Stable Diffusion parameters, Midjourney/DALL-E software stamps, and C2PA content credentials) to output a **Yes / Uncertain / No** badge with raw tag evidence.
- **One-Click Clean/Transform**: Strips all metadata by re-encoding the image onto an HTML5 Canvas, verifies the strip, and rewrites the file with only the current timestamp and a clean "Wipefey by RexiO" stamp.
- **Batch Processing**: Drag and drop up to 50 images at once (up to 25 MB per file) with parallel inspection.
- **ZIP Bundler**: Package and download all cleaned images as a single, compressed `.zip` file using non-blocking, browser-based compression.
- **System-Matching Theme**: Remembers your light or dark mode preference across sessions via localStorage.

## Live Demo

Run the stable production build at: **[wipefey.rexio.pro](https://wipefey.rexio.pro)**

## Tech Stack

| Layer | Choice |
|---|---|
| Core Framework | React 19 + Vite 8 + TypeScript (Strict Mode) |
| Styling / Design | Tailwind CSS v4 (achromatic Vercel/Geist-style design tokens) |
| Metadata Extraction | `exifr` + custom PNG chunk reader |
| Metadata Rewriting | `piexifjs` (v1.0.4) + custom PNG chunk writer |
| Compression / ZIP | `fflate` |
| State Management | `zustand` |
| Shell / Router | `react-router-dom` v7 |
| Search Engine / SEO | `react-helmet-async` for page meta; static pre-renderer for crawler indexability |
| Rate Limiting | Serverless Edge Function (Vercel) + Upstash Redis |

## Local Development

Follow these steps to set up and run Wipefey locally.

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### 2. Clone and Install
```bash
git clone https://github.com/Seizmann/wipefey.git
cd wipefey
npm install
```

### 3. Environment Setup (Optional)
Wipefey uses Upstash Redis for serverless rate limiting in production. Copy the example file and fill in your credentials to run rate-limiting queries locally:
```bash
cp .env.example .env
```
*Note: If `.env` is unconfigured, the rate limit API function will fail-open so that the client-side tool continues working unimpeded.*

### 4. Running Commands
```bash
# Start local Vite development server
npm run dev

# Lint code using oxlint
npm run lint

# Compile TypeScript and build production SPA assets
npm run build

# Build production assets and prerender static pages for search engines
npm run build:static

# Preview production build locally
npm run preview
```

## How It Works

Wipefey's asset transformation runs entirely client-side. When you trigger a transform:
1. **HTML5 Canvas Re-Encode**: The browser draws the uploaded image to an offscreen Canvas element and exports it to a fresh JPEG or PNG blob. This native step discards all metadata.
2. **Post-Strip Verification**: The script reads the new blob to confirm that no metadata remains.
3. **Structured Write**: The metadata engine injects empty EXIF header templates, replacing timestamps with the current clock time and writing `Software: Wipefey by RexiO` as the sole software tag.
4. **Output Render**: The object URL is replaced, and the final image is made available for download.

*Note: Since web browsers do not support native encoding of HEIF/HEIC, uploading an HEIC file will convert and download the final cleaned file as a JPEG.*

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on code style, commit standards, and the pull request submission process. Keep TypeScript strict (`tsc -b`) and lint free before submitting any code.

## Project Family & Credits

- **Creator**: [Mohammad Sijan](https://sijan.pro.bd) — founder of RexiO.
- **Product Family**: part of the [RexiO](https://rexio.pro) family of open-source utilities.
- **Publisher**: [SpritexAI](https://spritexai.pro.bd) under its Open Source Tools catalog.

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
