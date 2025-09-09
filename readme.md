# Winery Management Game – Architecture & Code Generation Guide

This briefing is for AI-assisted code generation for the **Winery Management Game**, a turn-based single-player simulation game.

---

## 🔧 Project Overview
Players manage a winery, including vineyard operations, wine production, building upgrades, staff, and sales. The game includes a simple economic engine with **formula-based wine prices** and **NPC buyers** — there is **no multiplayer or player-to-player interaction**.

### 💻 Frontend Architecture

- **Framework**: React + TypeScript + supabase
- **Styling**: Tailwind CSS, SHADCN (Maybe bootstrap if nessesacy) (no custom CSS in this iteration).


### 🧠 State & Logic

- Centralize all game data and logic in `gameState.ts`.
- Game logic (e.g., production, quality calculations, finances) must not live in components.

### 🔌 supabase backend. (USE MCP SERVER TOOLS)

### 📈 Economic System
- The economy is **formula-based**, not dynamic or real-time.
- Wine prices, land values, and prestige scores are **calculated**, not simulated.
- Sales are resolved to randomized NPCs (non-interactive).

## Core Game Systems & Features

### 1. Wine Production System (advenced ideas NOT YET IMPLEMENTET))
- Wine characteristics (Sweetness, Acidity, Tannins, Body, Spice, Aroma)
- Quality tracking through production stages
- Balance calculation system with archetypes
- Processing influence on characteristics (crushing methods, fermentation)
- Wine archetypes for style matching

### 2. Field Management
- Dynamic health system (0-1 scale)
- Field clearing and preparation
- Planting with grape variety selection
- Environmental factors (soil, altitude, aspect)
- Harvest timing and ripeness tracking

### 3. Staff System (NOT YET IMPLEMENTET)
- Skill-based hiring with specializations
- Work rate calculations based on skills
- Staff search and recruitment system
- Wage calculation and payment system
- Team management and task assignment

### 4. Sales System (NOT YET IMPLEMENTET)
- Wine order generation
- Dynamic pricing engine
- Contract system for stable income
- Customer preferences and archetypes
- Price negotiation mechanics

### 5. Game Flow
- End-day/tick system for game progression
- Tutorial system with guided learning (NOT YET IMPLEMENTET)
- Notification system for game events (NOT YET IMPLEMENTET)
- Work calculation system for tasks (NOT YET IMPLEMENTET)
- Building maintenance cycle (NOT YET IMPLEMENTET)
