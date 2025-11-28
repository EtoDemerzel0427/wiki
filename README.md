<div align="center">
  <img src="public/logo.png" alt="MetaWiki Logo" width="120" height="120" />
  <h1>Meta Wiki</h1>
  <p>
    <b>A modern, personal wiki application built with React, Vite, and Electron.</b>
  </p>
  <p>
    <a href="https://github.com/EtoDemerzel0427/wiki/releases">
      <img src="https://img.shields.io/github/v/release/EtoDemerzel0427/wiki?style=for-the-badge&color=blue" alt="GitHub Release" />
    </a>
  </p>
  <p>
    <b>Latest Release: v0.1.0 is out!</b> <a href="https://github.com/EtoDemerzel0427/wiki/releases">Download for macOS/Windows/Linux</a>
  </p>
  <p>
    <img src="docs/images/web-view.png" alt="Web View" width="45%" />
    <img src="docs/images/app-split-view.png" alt="App Split View" width="45%" />
  </p>
</div>

A modern, personal wiki application built with React, Vite, and Tailwind CSS. It features a file-based content system, Markdown rendering with math and code support, and a responsive, beautiful UI.

## Features

- **Markdown Support**: Write content in standard Markdown.
- **Math Equations**: LaTeX support via KaTeX (`$E=mc^2$`).
- **Code Highlighting**: Syntax highlighting for code blocks.
- **Wiki Links**: Internal linking using `[[Wiki Link]]` syntax.
- **Clean URLs**: Path-based routing (e.g., `/Category/Page`).
- **Responsive Design**: Mobile-friendly with a collapsible sidebar.
- **Dark Mode**: Toggle between light and dark themes.
- **Search & Filtering**: Real-time search and tag filtering.
- **File-Based**: Content is generated from a local folder structure.

## Project Structure

```
meta-wiki/
├── content/           # Your Markdown files (the wiki content)
├── public/            # Static assets
│   ├── content.json   # Generated content index (do not edit manually)
│   └── logo.png       # Application logo
├── scripts/           # Build scripts
│   └── generate-content.js # Script to parse markdown and generate JSON
├── src/               # React source code
├── index.html         # Entry point
├── vite.config.js     # Vite configuration
└── package.json       # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/meta-wiki.git
    cd meta-wiki
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Local Development

1.  Start the development server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173/`.

2.  **Adding Content**:
    - Create `.md` files in the `content/` directory.
    - You can use subdirectories to create categories (e.g., `content/Physics/Quantum.md`).
    - Add frontmatter to your markdown files for metadata:
      ```markdown
      ---
      title: My Note Title
      date: 2023-10-27
      tags: [tag1, tag2]
      ---
      ```

3.  **Updating Content**:
    - Whenever you add or modify markdown files, run the generator script to update `content.json`:
      ```bash
      npm run gen-content
      ```
    - You may need to restart the dev server or refresh the page to see changes.

## Desktop App (Electron)

This project also includes a desktop application wrapper built with Electron, providing a native experience with local file system access.

![Screenshot](public/screenshot.png)

### Features

- **Local File System**: Directly edit files on your hard drive.
- **Native Menus**: Context menus for file operations (rename, delete, etc.).
- **Offline Capable**: Works without an internet connection.

### Running the Desktop App

1.  Start the development version:
    ```bash
    npm run electron:dev
    ```

2.  Build for production (Mac/Windows/Linux):
    ```bash
    npm run electron:build
    ```
    The executable will be in the `dist_electron/` folder.

    > **Note for macOS Users:**
    > If you see a "damaged" error when opening the app, run this command in your terminal to bypass Gatekeeper:
    > ```bash
    > xattr -cr /Applications/MetaWiki.app
    > ```

## Deployment

### GitHub Pages

This project is configured to deploy to GitHub Pages.

1.  **Configuration**:
    - Ensure `vite.config.js` has the correct `base` URL. For a repository named `meta-wiki`, it should be `/wiki/` (or `/meta-wiki/` depending on your preference).
    - Currently configured as: `/wiki/`.

2.  **GitHub Actions**:
    - The project includes a workflow file `.github/workflows/deploy.yml`.
    - Simply push your changes to the `main` branch, and the action will automatically build and deploy the site.

3.  **Manual Build**:
    - To build the project locally:
      ```bash
      npm run build
      ```
    - The output will be in the `dist/` directory.

## Customization

- **Logo**: Replace `public/logo.png` with your own image.
- **Styles**: Edit `src/index.css` or `tailwind.config.js` to customize the look and feel.

## License

MIT
