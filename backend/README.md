# DungeonWorld Backend API

This backend powers the DungeonWorld control panel. The authentication module exposes JSON APIs backed by JWT tokens and bcrypt password hashing.

## Environment

Required variables:

- `DATABASE_URL` **or** individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (defaults to `dev-secret` outside production)
- `PORT` (optional, default `4000`)
- `CORS_ORIGIN` comma-separated origins (optional)

Install dependencies and start the server:

```bash
cd backend
npm install
npm run dev
```

## Authentication Endpoints

### Register

`POST /api/auth/register`

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@example.com",
    "password": "secret123",
    "role": "player",
    "displayName": "Player One"
  }'
```

Response: `201 Created`

```json
{
  "user": {
    "id": "...",
    "email": "player1@example.com",
    "username": "player1",
    "displayName": "Player One",
    "role": "player",
    "avatarUrl": null
  }
}
```

### Login

`POST /api/auth/login`

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@example.com",
    "password": "secret123"
  }'
```

Response: `200 OK`

```json
{
  "token": "<JWT>",
  "user": {
    "id": "...",
    "email": "player1@example.com",
    "username": "player1",
    "displayName": "Player One",
    "role": "player",
    "avatarUrl": null
  }
}
```

### Current User

`GET /api/auth/me`

```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <JWT>"
```

Response: `200 OK`

```json
{
  "user": {
    "id": "...",
    "email": "player1@example.com",
    "username": "player1",
    "displayName": "Player One",
    "role": "player",
    "avatarUrl": null
  }
}
```
