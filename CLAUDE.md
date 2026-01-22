# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Århjulet ("Year Wheel") is a Swedish business planning calendar visualization app for Business Falkenberg. It displays organizational activities on either a circular year wheel, horizontal timeline, or spreadsheet view.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (frontend on 3000, backend on 3001)
npm run build      # Build for production
npm run preview    # Preview production build
```

## Local Development Setup

### Prerequisites
1. Create `.env.local` with required environment variables (see `.env.local` for reference)
2. PostgreSQL database runs on VPS in Docker - requires SSH tunnel for local development

### SSH Tunnel for Database Access
The PostgreSQL database runs on the VPS and is only accessible via localhost. To connect from local development:

```bash
# In a separate terminal, keep this running:
ssh -L 5433:127.0.0.1:5433 glsfbg -N
```

This forwards local port 5433 to the VPS PostgreSQL. The `.env.local` DATABASE_URL uses `localhost:5433`.

### Running Locally
1. Start SSH tunnel (see above)
2. Run `npm run dev` - starts both frontend (port 3000) and backend (port 3001)

## Architecture

**Entry point:** `index.tsx` → `App.tsx`

**Backend:** Express.js server in `server/` directory
- PostgreSQL database via `pg` library
- Directus CMS for authentication
- Google Gemini AI for activity generation and reports

**Frontend Views:**
- `Wheel.tsx` - Circular SVG visualization using d3-shape. Supports time period filtering (quarters, tertials, halves)
- `Timeline.tsx` - Horizontal scrollable grid organized by months
- `SpreadsheetView.tsx` - Table view for editing activities

**Data Model:**
- `StrategicConcept` - Top-level grouping (currently one: "Fokusområden")
- `FocusArea` - 4 categories: Service & Kompetens, Platsutveckling, Etablering & Innovation, Övrigt
- `Activity` - Events with dates, weeks, responsible person, status, etc.

**Key Components:**
- `CategoryFilter.tsx` - Filter by focus area (shown in all views)
- `TimePeriodFilter.tsx` - Filter by time period (wheel view only): Kv1-4, T1-3, 1H/2H
- `AIActivityAssistant/` - AI-powered activity creation from text/Excel
- `AIReportModal.tsx` - AI-generated reports about activities

## Deployment (VPS)

The app runs on the VPS in Docker. To deploy changes:

```bash
ssh glsfbg
cd fbg-planning
git pull
docker compose down
docker compose up -d --build
```

## Key Technical Details

- Vite + React 19 + TypeScript
- Path alias: `@/*` maps to project root
- Styling: Tailwind CSS
- The wheel SVG uses d3-shape's `arc()` generator with angle offset to align D3's coordinate system with the visual layout
- Vite proxy forwards `/api/*` requests to backend server in development
