# Contributing to Wipefey

Thank you for your interest in contributing to Wipefey! We welcome contributions to improve the metadata cleaner, enhance AI marker detection heuristics, fix bugs, or polish the design.

By participating in this project, you agree to abide by our code style, conventions, and licensing terms.

## Before You Start

- **Check Issues**: Scan our open issues and pull requests on [GitHub](https://github.com/Seizmann/wipefey/issues) before starting works to avoid duplicate efforts.
- **Propose Major Changes**: If you are planning an architectural change or a new feature that goes beyond small UI tweaks or bug fixes, please open a feature proposal issue first to coordinate design decisions.

## Development Setup

Set up your local workspace using these commands:

```bash
# Clone the repository
git clone https://github.com/Seizmann/wipefey.git
cd wipefey

# Install dependencies
npm install

# Run the local development server with hot reloading
npm run dev
```

If you plan to test the serverless rate-limiting functions locally:
1. Copy the example environment file: `cp .env.example .env`
2. Enter your Upstash Redis REST credentials in `.env`.
3. If left unset, the API returns a `500` (code `misconfigured`), but the frontend is designed to fail-open and run the transform anyway.

## Code Conventions

Wipefey is built with a focused, strict tech stack (TypeScript, React 19, Vite 8, Tailwind CSS v4). Please align your code with the following practices:

1. **TypeScript Strict Mode**: The compiler has strict checks enabled, including `noUncheckedIndexedAccess`, `noImplicitReturns`, and `noImplicitOverride`. Using `any` is prohibited unless explicitly justified. Run `npm run build` to typecheck before packaging.
2. **Linter Integrity**: We use `oxlint` for lightning-fast lint checks. Ensure code passes cleanly by running `npm run lint`.
3. **Directory Structure**:
   - **Frontend Pages**: Page components represent routes and live under `src/pages/` (Home, Tool, HowItWorks, About, Privacy).
   - **UI Components**: Atomic reuse components live in `src/components/`.
   - **Logic domains**: Library concerns belong in `src/lib/` grouped under dedicated directories (e.g. `src/lib/metadata/` for extraction, `src/lib/ai-heuristics/` for AI signallers, `src/lib/transform/` for strip/rewrite).
   - **SEO / Meta**: Route SEO tags are centralized in `src/seo/meta.ts` and rendered via the `<Seo>` Helmet wrapper component. Keep these in sync, since static pre-rendering pulls from this module.
4. **CSS and Styling**: Utilize the design tokens specified in `src/design/tokens.css` via utility classes (e.g. `bg-bg`, `text-muted`, `border-border`, `bg-accent`). Do not write custom hex values directly in component files. Follow the [DESIGN.md](./DESIGN.md) document layout instructions.

## Commits & Branching Conventions

- **Branch Names**: Branch out from `main` using descriptive names (e.g. `feature/short-description` or `fix/issue-id`).
- **Commit Messages**: Write concise, descriptive commit summaries. We encourage semantic commit titles (e.g. `feat: ...`, `fix: ...`, `chore: ...`) and mentioning phases if referencing a roadmap item (e.g. `feat: Phase 2 — add prompt rule`).

## Testing & Verification

A set of Node-runnable verification scripts exists under `scripts/`. They test file format writing, metadata parsing, CRC verification, and boundary conditions without needing a browser window.

Ensure that the verification suite runs successfully for the areas of the engine you modified:
```bash
npm run verify:phase1   # Verify upload/extraction integration
npm run verify:phase2   # Verify AI heuristic rule engine
npm run verify:phase3   # Verify Transform stripping/rewriting
npm run verify:phase4   # Verify batch & ZIP exports
```

Before submitting a PR, verify the full static build and pre-renderer runs correctly (this catches compilation errors and SSR hydration issues):
```bash
npm run build:static
```

## Pull Request Process

When submitting a pull request:
1. Fill out the PR template/description clearly outlining:
   - What problem was solved or what feature was introduced.
   - Which verification scripts were tested.
   - Any layout/UX changes (please attach before/after screenshots).
2. Ensure that `npm run lint` and `npm run build:static` compile without any warnings or errors.
3. Keep pull requests minimal and focused. Do not mix unrelated refactors or formatting changes in a PR.

## Security Disclosures

If you discover a security vulnerability or metadata leak in Wipefey, please responsibly disclose it by contacting the creator Mohammad Sijan directly (via the contact form at [sijan.pro.bd](https://sijan.pro.bd)) or opening a private repository alert instead of publicizing it in a standard GitHub issue.

## Licensing

By contributing to this repository, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
