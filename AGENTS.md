# mesa-api — Agent Rules

## Schema changes

No manual migrations. Add/modify columns in `src/models/`, restart server — `sync({ alter: true })` applies changes. For production data already in DB, write a one-off SQL backfill if new columns are NOT NULL.

## Auth middleware

Three options — pick the right one per route:

- `authenticate` — hard require (401 if no/bad token)
- `optionalAuth` — soft attach (guest-friendly)
- `requireRole(Role.X)` — always after `authenticate`, never after `optionalAuth`

Guest endpoints use `optionalAuth`. Check `req.user` at runtime.

## Validation

All request bodies validated with Zod before touching the DB. Always `safeParse`, return `400` with `error.flatten()` on failure. Never trust `req.body` directly.

## Restaurant lookup

`getRestaurantById` accepts UUID or slug. UUID detected by regex. Add new lookup fields the same way — check format, branch query.

## Slug generation

`toSlug(name)` + `uniqueSlug(base)` in `restaurant.controller.ts`. Reuse these if other models need slugs. Never let the client send a slug directly on create.

## Conflict detection for reservations

Overlap check uses three OR conditions (start inside, end inside, wraps). Do not simplify — all three cases are needed to catch all overlap patterns.

## Roles

| Role | Can do |
|------|--------|
| `USER` | Browse, make/cancel own reservations |
| `RESTAURANT_OWNER` | Manage own restaurant, floors, tables, view all reservations |

One restaurant per owner enforced in `createRestaurant`.
