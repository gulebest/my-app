# Assistly

Assistly is a modern AI chat web app with a polished messaging UI, live assistant responses, conversation history, search, chat controls, guest support, and production deployment.

## Live Links

- Frontend: https://my-app-client-five.vercel.app
- Backend API: https://my-app-2xx4.onrender.com
- Health check: https://my-app-2xx4.onrender.com/api/hello

## Features

- Real-time AI chat experience with streaming-style responses
- Smart auto-scroll that keeps new replies visible
- Stable conversation ordering for user and assistant messages
- Guest chat and signed-in chat flows
- Conversation history search
- Assistant actions like copy, like, dislike, share, and retry
- Emoji picker and polished responsive chat layout
- Sidebar toggle for a wider chat workspace

## Tech Stack

- React
- TypeScript
- Vite
- Bun
- Express
- Firebase
- Vercel
- Render

## Project Structure

```text
my-app/
  packages/
    client/   # Vite + React frontend
    server/   # Bun + Express backend
```

## Local Development

Install dependencies:

```bash
bun install
```

Run the app locally:

```bash
bun run index.ts
```

This starts:

- Frontend at `http://localhost:5173`
- Backend at `http://localhost:3000`

## Environment Notes

The frontend uses Firebase web env variables with the `VITE_FIREBASE_*` prefix.

The backend uses:

- `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID`
- optional Firebase Admin credentials when available

## Deployment

- Frontend deployed on Vercel
- Backend deployed on Render
- Production frontend API requests are rewritten to the Render backend
