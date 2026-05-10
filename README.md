# mesa-api

Express + Sequelize REST API for the Mesa restaurant reservation platform.

## Stack

- **Express 4** — HTTP server
- **Sequelize + sequelize-typescript** — ORM (PostgreSQL)
- **Zod** — request validation
- **bcryptjs** — password hashing
- **jsonwebtoken** — access/refresh tokens
- **TypeScript**

## Database

PostgreSQL. Uses `sequelize.sync({ alter: true })` on startup — schema changes apply automatically on restart, no manual migrations needed.

## Auth

JWT access tokens. Two middleware functions in `src/middleware/auth.ts`:

| Middleware | Behavior |
|------------|----------|
| `authenticate` | Requires valid Bearer token, 401 otherwise |
| `optionalAuth` | Attaches user if token present, continues as guest if absent |
| `requireRole(...roles)` | Must follow `authenticate`, 403 if wrong role |

## API routes

### Auth — `/api/auth`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/register` | Public | Create account |
| POST | `/login` | Public | Get tokens |
| POST | `/refresh` | Public | Refresh access token |

### Restaurants — `/api/restaurants`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/` | Public | List all restaurants (includes `slug`) |
| GET | `/:idOrSlug` | Public | Get by UUID or slug |
| GET | `/me` | Owner | Get own restaurant |
| POST | `/` | Owner | Create restaurant (auto-generates `slug`) |
| PUT | `/me` | Owner | Update restaurant |

### Floors — `/api/floors`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/` | Owner | Create floor |
| GET | `/:id` | Public | Get floor with tables + walls |
| PUT | `/:id` | Owner | Update floor |
| DELETE | `/:id` | Owner | Delete floor |

### Reservations — `/api/reservations`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/` | Public (guest or user) | Create reservation |
| GET | `/my` | User | Own reservations |
| PATCH | `/:id/cancel` | User | Cancel own reservation |
| GET | `/restaurant` | Owner | All reservations for own restaurant |
| PATCH | `/:id/status` | Owner | Update reservation status |

**Guest reservations:** `POST /` uses `optionalAuth`. If no token, `guestName` and `guestEmail` are required in the body.

### Reservation body (guest)
```json
{
  "tableId": "uuid",
  "date": "2026-05-15",
  "startTime": "19:00",
  "endTime": "21:00",
  "partySize": 2,
  "notes": "optional",
  "guestName": "Ana Beridze",
  "guestEmail": "ana@example.com",
  "guestPhone": "+995 555 123 456"
}
```

## Restaurant slugs

Generated from `name` on create: `"La Bella Vita"` → `"la-bella-vita"`. Collisions resolved by appending `-2`, `-3`, etc.

Backfill existing rows with no slug:
```sql
UPDATE restaurants
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;
```

## Env

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://user:password@localhost:5432/restaurant_reservation
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Dev

```bash
npm install
npm run dev        # tsx watch, http://localhost:4000
npm run db:seed    # wipe + reseed with demo data
npm run build      # tsc → dist/
npm start          # node dist/index.js
```

## Models

```
User          — email, password, name, phone, role (USER | RESTAURANT_OWNER)
Restaurant    — slug, name, description, address, phone, email, cuisine, openTime, closeTime
Floor         — name, sectionType, width, height, bgColor
Table         — label, shape, x, y, width, height, rotation, capacity, minCapacity, isWindowSeat, isActive
Wall          — x1, y1, x2, y2
Reservation   — date, startTime, endTime, partySize, status, notes, userId?, guestName?, guestEmail?, guestPhone?
```
