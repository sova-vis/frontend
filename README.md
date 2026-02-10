# Frontend - Next.js UI

This is the frontend UI application built with Next.js 14.

## Structure

```
frontend/
├── src/
│   ├── app/              # App Router pages
│   │   ├── (public)/     # Public pages (landing, pricing, about)
│   │   ├── (auth)/       # Auth pages (login, signup)
│   │   ├── app/          # Student area
│   │   ├── teacher/      # Teacher portal
│   │   └── admin/        # Admin portal
│   ├── components/       # React components
│   │   ├── ui/           # Button, Card, Input, etc.
│   │   └── layouts/      # Navigation components
│   ├── lib/
│   │   ├── api/          # API client (calls backend)
│   │   ├── auth/         # Client-side auth helpers
│   │   └── utils.ts      # Utilities
│   ├── hooks/            # Custom React hooks
│   └── styles/           # Global styles
├── public/               # Static assets
├── middleware.ts         # Route protection
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Getting Started

### Install Dependencies
```bash
cd frontend
npm install
```

### Development
```bash
npm run dev
```
Runs on http://localhost:3000

### Build
```bash
npm run build
npm start
```

## API Communication

All API calls go through `src/lib/api/client.ts`:

```typescript
import { authApi, contentApi } from '@/lib/api/client';

// Login
const user = await authApi.login(email, password);

// Get content
const papers = await contentApi.getPastPapers();
```

## Authentication Flow

1. User submits login form
2. `authApi.login()` calls backend `/auth/login`
3. Backend returns JWT token
4. Token stored in localStorage
5. Token sent with all subsequent requests
6. Middleware checks auth on protected routes

## Importing Shared Types

```typescript
import { User, UserRole, PastPaper } from '@shared/types';
```

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```

Make sure to set `NEXT_PUBLIC_API_URL` environment variable in Vercel dashboard.
