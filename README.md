# TechChat (React + OpenAI)

AI-powered coding assistant with a React UI (Vite) and Node.js backend using OpenAI.

## Setup

1. Install dependencies
	- `npm install`

2. Configure environment
	- Copy `.env.example` to `.env`
	- Set `OPENAI_API_KEY` in `.env`

## Run Modes

- Full development (backend + React dev server): `npm run dev`
- Build React frontend: `npm run build`
- Start backend serving built React app: `npm start`

After `npm run build`, open `http://localhost:5000` when backend is running.

## Environment Variables

- `PORT` (default `5000`)
- `NODE_ENV` (default `development`)
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (default `gpt-4o-mini`)

## API

- `GET /health`
- `GET /config`
- `POST /chat`
