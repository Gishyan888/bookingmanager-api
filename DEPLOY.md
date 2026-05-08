# BookingManager API Deployment (cPanel)

This guide is for deploying the NestJS API on cPanel with Passenger Node.js.

## 1) Prepare cPanel

1. Open cPanel -> **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version**: 20.x (recommended)
   - **Application mode**: Production
   - **Application root**: folder where this API lives (example: `bookingmanager-api`)
   - **Application URL**: your subdomain/domain path
   - **Application startup file**: `dist/main.js`
3. Create the app.

## 2) Configure environment variables

In cPanel Node.js app settings, set these variables:

- `NODE_ENV=production`
- `PORT` (usually assigned by Passenger; if cPanel provides one, use that value)
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=1d`
- Optional mail settings: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`
- Optional first admin bootstrap: `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`

Important:
- Do not keep development/test secrets in production.
- If any secret was shared accidentally, rotate it before go-live.
- You can copy from `.env.cpanel.example` as a starting template.

## 3) Install and build

Open Terminal in cPanel (or SSH), then run from project root:

```bash
npm install
npm run build
```

## 4) Run database migrations

```bash
npm run migration:run
```

This creates/updates schema using pending migrations only.

## 5) Start or restart the app

In cPanel Node.js App page:
- Click **Restart** application.

If startup file is `dist/main.js` and build succeeded, app boots in production mode.

## First deploy checklist

- Node app exists in cPanel
- Env vars configured
- `npm install` done
- `npm run build` done
- `npm run migration:run` done
- App restarted
- `GET /api/health` returns success
- Swagger opens at `/api/docs` (optional in production)

## Update deploy checklist (every new release)

```bash
git pull
npm install
npm run build
npm run migration:run
```

Then restart from cPanel.

## Migration commands

- Run pending: `npm run migration:run`
- Show state: `npm run migration:show`
- Revert last migration: `npm run migration:revert`

Use revert only when you are sure; it rolls back the latest applied migration.

## Common issues

1. **`Table ... doesn't exist`**
   - You skipped migrations. Run `npm run migration:run`.

2. **App starts locally but fails on cPanel**
   - Check Node version (use 20.x).
   - Ensure startup file is `dist/main.js`.
   - Re-run build.

3. **Cannot connect to DB**
   - Verify DB host/port/user/password/database in app env.
   - Confirm cPanel DB user has privileges on selected DB.

4. **Port conflict / wrong port**
   - Use port provided by Passenger/cPanel if required.
   - Keep app behind cPanel proxy; do not hardcode unsupported ports.

## Security notes

- Use strong `JWT_SECRET`.
- Rotate bootstrap admin password after first login.
- Avoid storing plain secrets in git-tracked files.
