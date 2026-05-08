# BookingManager API

A NestJS + TypeORM + MySQL backend for the BookingManager hotel-management
platform.

It powers three role-aware dashboards — **Admin** (super admin), **Owner**
(hotel owner), and **Manager** (front-desk operator) — and exposes a clean
REST API documented with Swagger.

---

## Tech stack

- [NestJS 11](https://nestjs.com/) — modular Node framework
- [TypeORM 0.3](https://typeorm.io/) on MySQL 8 (Docker compose included)
- JWT authentication (`@nestjs/jwt` + Passport) with bcrypt password hashing
- `class-validator` / `class-transformer` for DTO validation
- Swagger / OpenAPI docs at `/api/docs`

## Quick start

```bash
# 1. install
npm install

# 2. start MySQL (3307 on host -> 3306 in container)
docker compose up -d

# 3. configure env
cp .env.example .env

# 4. run in watch mode
npm run start:dev
```

The app listens on http://localhost:3000 and registers all routes under the
`/api` prefix.

- Health: `GET /api/health`
- Swagger UI: http://localhost:3000/api/docs

On **first startup with an empty `users` table**, you can create the initial
admin by setting `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (see
`.env.example`). No sample hotels, rooms, customers, or bookings are inserted.
Unset or rotate the bootstrap password after the first login. Owners can
self-register at `POST /api/auth/register` and must be activated by an admin.

---

## Project structure

```
src/
├── auth/            # login / register / JWT / guards / decorators
│   ├── decorators/  # @Roles, @Public, @CurrentUser
│   ├── guards/      # JwtAuthGuard, RolesGuard (registered globally)
│   ├── dto/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── jwt.strategy.ts
├── users/           # CRUD for owners / managers
├── hotels/          # CRUD with role-scoped access
├── rooms/           # CRUD per hotel
├── customers/       # guest profiles
├── bookings/        # reservations + status transitions
├── dashboard/       # aggregate stats per role
├── seed/            # optional first admin bootstrap (empty DB only)
├── common/          # shared enums + pagination DTO
├── config/          # TypeORM factory
├── app.module.ts
└── main.ts          # validation, swagger, cors, bootstrap runner
```

## Database schema

| Table       | Key fields                                                                |
| ----------- | ------------------------------------------------------------------------- |
| `users`     | `id`, `name`, `email`, `password`, `role`, `phone`, `assignedHotelId`     |
| `hotels`    | `id`, `name`, `location`, `rating`, `ownerId` → `users.id`                |
| `rooms`     | `id`, `roomNumber`, `type`, `price`, `status`, `capacity`, `hotelId`      |
| `customers` | `id`, `name`, `email`, `phone`, `idDocument`, `address`, `ownerId`        |
| `bookings`  | `id`, `roomId`, `customerId`, `checkIn`, `checkOut`, `status`, `total`    |

Enums:

- `UserRole`: `admin`, `owner`, `manager`
- `RoomStatus`: `available`, `occupied`, `maintenance`
- `RoomType`: `single`, `double`, `suite`, `deluxe`, `family`
- `BookingStatus`: `pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`

Tables are auto-created via `synchronize: true` in development. For production,
set `NODE_ENV=production` and run TypeORM migrations (`npm run migration:run`).

## Production deploy (cPanel)

Use this order on first deploy and every update:

```bash
npm install
npm run build
npm run migration:run
npm run start:prod
```

Notes:

- Keep `NODE_ENV=production` in `.env` on cPanel.
- `migration:run` is safe to run repeatedly; only pending migrations are applied.
- If you change entities later, generate a new migration before deploy:
  `npm run migration:generate --name=DescribeChange`.
- Full step-by-step cPanel instructions: see `DEPLOY.md`.

## API surface (high-level)

All endpoints (except `/auth/register`, `/auth/login`, `/health`) require a
Bearer JWT. Role authorization is enforced by `RolesGuard`.

| Group         | Method | Path                          | Roles                 |
| ------------- | ------ | ----------------------------- | --------------------- |
| Auth          | POST   | `/auth/register`              | public (becomes Owner) |
|               | POST   | `/auth/login`                 | public                |
|               | GET    | `/auth/me`                    | any auth              |
| Users         | GET    | `/users/owners`               | admin                 |
|               | GET    | `/users/managers`             | admin                 |
|               | GET    | `/users/my-managers`          | owner                 |
|               | POST   | `/users`                      | admin                 |
|               | PATCH  | `/users/:id`                  | admin                 |
|               | DELETE | `/users/:id`                  | admin                 |
| Hotels        | GET    | `/hotels`                     | role-scoped           |
|               | POST   | `/hotels`                     | admin / owner         |
|               | PATCH  | `/hotels/:id`                 | admin / owner         |
|               | DELETE | `/hotels/:id`                 | admin / owner         |
|               | POST   | `/hotels/:id/assign-owner`    | admin                 |
| Rooms         | GET / POST / PATCH / DELETE | `/rooms[/:id]` | role-scoped         |
| Customers     | GET / POST / PATCH / DELETE | `/customers[/:id]` | role-scoped     |
| Bookings      | GET / POST / PATCH / DELETE | `/bookings[/:id]` | role-scoped      |
|               | PATCH  | `/bookings/:id/status`        | role-scoped           |
| Dashboard     | GET    | `/dashboard`                  | shape varies by role  |

Full request/response shapes are exposed via Swagger at
http://localhost:3000/api/docs and a Postman/openapi.json export is available
from the same UI ("Download" button).

## Role-based access summary

| Capability                  | Admin | Owner | Manager |
| --------------------------- | :---: | :---: | :-----: |
| Manage owners               |  ✅   |       |         |
| Manage hotels (any)         |  ✅   |       |         |
| Manage own hotels           |  ✅   |  ✅   |         |
| Manage rooms                |  ✅   |  ✅   |         |
| Manage customers            |  ✅   |  ✅   |   ✅¹   |
| Create / update bookings    |  ✅   |  ✅   |   ✅    |
| Check-in / check-out        |  ✅   |  ✅   |   ✅    |
| Delete bookings             |  ✅   |  ✅   |         |
| View revenue / financials   |  ✅   |  ✅   |         |

¹ Manager can read and create customers tied to their assigned hotel.

## Scripts

```bash
npm run start:dev   # dev with hot reload
npm run build       # tsc -> dist/
npm run start:prod  # production server (requires npm run build)
npm run migration:run
npm run migration:revert
npm run lint        # eslint --fix
npm test            # unit tests (jest)
```

## Environment

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3307
DB_USERNAME=bookingmanager
DB_PASSWORD=bookingmanager
DB_DATABASE=bookingmanager

JWT_SECRET=replace-this-with-a-long-random-string
JWT_EXPIRES_IN=1d
```
