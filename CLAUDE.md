# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Århjulet ("Year Wheel") is a Swedish business planning calendar visualization app. It displays organizational events on either a circular year wheel or a horizontal timeline view, organized by tertials (4-month periods).

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Build for production
npm run preview    # Preview production build
```

## Environment Setup

Create `.env.local` with:
```
GEMINI_API_KEY=your_key_here
```

The Gemini API is used for the AI report feature that analyzes calendar events.

## Architecture

**Entry point:** `index.tsx` → `App.tsx`

**State management:** React useState with localStorage persistence. Events are stored under the key `arhjul-events`.

**Views:**
- `Wheel.tsx` - Circular SVG visualization using d3-shape for arc generation. Places January at 12 o'clock position with clockwise progression.
- `Timeline.tsx` - Horizontal scrollable grid organized by tertials and months.

**Data model (types.ts):**
- `CalendarEvent` - Events with id, title, description, date (ISO), monthIndex (0-11), year
- `TertialDef` - Three 4-month periods with color coding
- `MonthDef` - Swedish month names

**Constants (constants.ts):**
- Three tertials: Service & Kompetens (Jan-Apr), Platsutveckling (May-Aug), Etablering & Innovation (Sep-Dec)
- Swedish month definitions

**Services:**
- `geminiService.ts` - Generates AI reports using Google's Gemini 2.5 Flash model

## Key Technical Details

- Vite + React 19 + TypeScript
- Path alias: `@/*` maps to project root
- Styling: Tailwind CSS (utility classes throughout)
- The wheel SVG uses d3-shape's `arc()` generator with angle offset to align D3's coordinate system with the visual layout
