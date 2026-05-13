# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # tsx watch — http://localhost:4000
npm run build            # tsc → dist/
npm start                # node dist/index.js
npm run db:migrate       # run pending migrations
npm run db:migrate:undo  # revert last migration
npm run db:migrate:status # show migration state
npm run db:seed          # wipe DB and reseed with demo data
```

No test runner configured.

## Architecture

Request flow: `src/index.ts` → `src/routes/*.routes.ts` → `src/controllers/*.controller.ts` → Sequelize models in `src/models/`.

**Database:** Uses `sequelize-cli` migrations in `migrations/`. Connection configured via individual env vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). Startup only calls `authenticate()` — no `sync()`. Schema changes require a new migration file. Run `npm run db:migrate` before first start and after each new migration.

**Auth middleware** (`src/middleware/auth.ts`) — three options, pick per route:
- `authenticate` — hard require, 401 if missing/invalid
- `optionalAuth` — attaches `req.user` if token present, continues as guest if absent
- `requireRole(Role.X)` — always chain after `authenticate`, never after `optionalAuth`

**Validation:** Every route body goes through Zod `safeParse` before touching the DB. Return `400` with `error.flatten()` on failure. Never read `req.body` directly in controllers.

**Restaurant lookup:** `GET /api/restaurants/:idOrSlug` accepts UUID or slug — UUID detected by regex in the controller. Slug generation lives in `restaurant.controller.ts` (`toSlug` + `uniqueSlug`); never accept a client-supplied slug on create.

**Reservation overlap:** The conflict query uses three OR conditions (start inside existing, end inside existing, wraps existing). All three are required — do not simplify.

**Roles:**
- `USER` — browse, create/cancel own reservations
- `RESTAURANT_OWNER` — manage own restaurant, floors, tables, all reservations for their restaurant. One restaurant per owner enforced in `createRestaurant`.

## Models

```
User          — email, password, name, phone, role (USER | RESTAURANT_OWNER)
Restaurant    — slug, name, description, address, phone, email, cuisine, openTime, closeTime
Floor         — name, sectionType, width, height, bgColor
Table         — label, shape, x, y, width, height, rotation, capacity, minCapacity, isWindowSeat, isActive
Wall          — x1, y1, x2, y2
Reservation   — date, startTime, endTime, partySize, status, notes, userId?, guestName?, guestEmail?, guestPhone?
```

Reservations support both authenticated users and guests. When no token is present, `guestName` and `guestEmail` are required.
