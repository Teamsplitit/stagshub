# StagsHub

StagsHub is a lightweight, shared roster app for users, custom sections, and credit-card style entries. It is built with Next.js and MongoDB and is ready for Vercel deployment.

## Features
- Secret key gate before enrolling or logging in
- Enroll + login with name and password stored in MongoDB
- Global users roster
- Shared custom sections (visible to every user)
- Section items list with `{card name} - {card holder}`
- Friends section (visible only to mutual friends; adding a friend is bidirectional)
- Profile settings with default avatar, display-name edit, and logout
- Admin delete for sections and items (first enrolled user is admin)
- Light/dark mode toggle and mobile-ready UI

## Local Setup
1. Install dependencies

```bash
npm install
```

2. Create `.env.local` (copy from `.env.example`) and set:

```bash
MONGODB_URI=your_mongodb_connection_string
STAGSHUB_SECRET_KEY=your_secret_key
STAGSHUB_DB=stagshub
```

3. Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deployment (Vercel)
- Add the same environment variables in Vercel
- Deploy the repo; Next.js will build automatically

## Data Model
- `users`: `{ name, displayName, passwordHash, createdAt }`
- `sessions`: `{ token, userId, createdAt }`
- `sections`: `{ name, slug, createdBy, createdAt }`
- `items`: `{ sectionId, userId, label, createdAt }`
