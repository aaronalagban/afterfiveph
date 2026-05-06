# AfterFivePH: Project Identity & Engineering Standards

This document defines the architectural philosophy, technical standards, and design language for AfterFivePH. It is intended to guide development towards a high-end, "premium agency" output while maintaining absolute codebase integrity.

## 1. Architectural Mandate: Feature-Sliced Design (FSD)

We strictly follow **Feature-Sliced Design**. This is non-negotiable. If you detect the current structure violates these layers (specifically if Entities are nested inside Features), your priority is to refactor and align them.

- **App (`src/app`)**: Global config, providers, and Next.js file-based routing.
- **Pages (`src/app/...`)**: Route-level components. Keep them thin; they only compose widgets.
- **Widgets (`src/widgets`)**: Autonomous, complex UI blocks that combine features and entities (e.g., `EventFeed`, `GlobalNav`).
- **Features (`src/features`)**: User-facing actions with business value (e.g., `LikeEvent`, `SearchVenues`, `Auth`).
- **Entities (`src/entities`)**: Business models, domain logic, and data access (e.g., `Event`, `Venue`, `User`). 
- **Shared (`src/shared`)**: Reusable primitives, UI kits (`src/shared/ui`), API clients, and utilities.

**Rule**: Cross-imports between slices at the same layer are forbidden. Always import from lower layers (**Shared -> Entities -> Features -> Widgets -> Pages -> App**).

## 2. Technical Standards & Patterns

- **Framework**: Next.js 16 (App Router) & React 19. Utilize Server Components by default.
- **Data Access**: **Repository Pattern**. Direct Supabase calls are strictly forbidden in components. They must live in `[name].repository.ts` files within the relevant **Entity** slice.
- **Styling**: Tailwind CSS 4. Use utility-first styling but prioritize a "custom-built" look. Avoid standard rounded corners; prefer sharp, brutalist edges (`rounded-none` or `rounded-sm`).
- **Animation**: Framer Motion. Transitions must be mechanical and snappy (`type: "spring", stiffness: 300`).
- **State Management**: **TanStack Query** for server state; **Zustand** for lightweight client state.
- **Types**: Strict TypeScript. Use discriminated unions for handling UI states (Idle, Loading, Success, Error).

## 3. Visual Identity: "Manila After Dark"

The UI must feel like a premium night-life concierge. It should be aggressive, clean, and expensive. Avoid all "SaaS-standard" aesthetics.

- **Color**: Primary accent is **#F53D04** (Vibrant Red-Orange).
- **Background**: **#0B0B0D** (Void Black). High contrast is mandatory.
- **Borders**: Crisp, thin, and subtle (**#1A1A1E**).
- **Typography**: 
  - **Headings**: Heavy, brutalist, uppercase (`font-black uppercase tracking-tighter`).
  - **Metadata**: Monospace for dates, times, and technical data (`font-mono uppercase`).
- **Atmosphere**: Use `backdrop-blur-xl` for overlays, subtle grain/noise textures, and "alive" motion (hover scales of 1.02x, snappy transitions).

## 4. Engineering Principles

- **Surgical Precision**: Favor targeted, high-impact edits over broad refactors. Every line of code should feel intentional.
- **Taste Audit**: If a design or component looks "default" or "cheap," you are expected to upgrade it to the "After Dark" standard without being prompted.
- **Reproduce First**: Before fixing a bug, create a reproduction or check the existing flow.
- **Verification**: Changes are only complete once verified via terminal output or visual check.
- **FSD Enforcement**: If you see a file in the wrong directory (e.g., an Entity inside a Feature folder), propose the move immediately.

---
*“Precision is the only luxury.”*  
**AfterFivePH — Where Manila goes after five.**