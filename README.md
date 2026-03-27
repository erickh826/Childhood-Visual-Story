# 看圖說故事生成器 — Childhood Visual Story Generator

An AI-powered interactive storybook tool for early childhood educators. Enter a teaching topic, pick an age group and illustration style, and instantly receive a fully illustrated, narrated, branching story lesson plan.

---

## Features

- **AI Story Generation** — Azure OpenAI (GPT-4o-mini) generates age-appropriate story scripts with teacher guidance prompts
- **Illustrated Story Cards** — fal.ai FLUX.1-schnell generates style-consistent picture book illustrations for each story node
- **Animated Avatar Narrator** — Five SVG avatar characters (bear, cat, robot, bunny, girl) with animated talking mouths
- **Text-to-Speech Narration** — Browser Web Speech API reads the story aloud in Traditional Chinese, Cantonese, or English
- **Branching Interactive Choices** — Children tap choices that lazy-load new story branches on demand, saving API costs
- **Result Caching** — Same parameters always return instantly from SQLite cache (no duplicate API charges)
- **Generation History** — Browse and replay all previously generated lessons

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | Wouter |
| Server | Express.js (Node 20, ESM) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| AI — Text | Azure OpenAI (GPT-4o-mini) |
| AI — Images | fal.ai (FLUX.1-schnell) |
| Deployment | Vercel (serverless) |

---

## Prerequisites

- Node.js 20+
- An **Azure OpenAI** resource with a `gpt-4o-mini` deployment
- A **fal.ai** account and API key

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/erickh826/Childhood-Visual-Story.git
cd Childhood-Visual-Story
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Azure OpenAI
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# fal.ai
FAL_API_KEY=your_fal_api_key
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Usage

1. **Select age group** — 1–3 years, 4–5 years, or 6+ years
2. **Enter a story topic** — type freely or pick a preset (e.g. 洗手, 情緒, 自律)
3. **Choose an illustration style** — Watercolour, Crayon, or Kawaii
4. **Click 生成** — the server generates the story text and all illustrations in ~10–20 seconds
5. **Play the story** — the animated avatar narrates each page; children tap branching choices to shape the story

---

## Project Structure

```
├── client/                  # React frontend
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx     # Story configuration form
│       │   ├── Player.tsx   # Interactive story player
│       │   └── History.tsx  # Past lesson history
│       └── components/ui/   # shadcn/ui components
├── server/
│   ├── index.ts             # Express app entry point
│   ├── routes.ts            # API route handlers
│   ├── ai.ts                # Azure OpenAI + fal.ai integration
│   └── storage.ts           # SQLite storage layer (Drizzle ORM)
├── shared/
│   └── schema.ts            # Shared types, Zod schemas, constants
└── .env                     # Environment variables (not committed)
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/generate` | Generate a new story lesson |
| `POST` | `/api/branch` | Lazy-load a branching story node |
| `GET` | `/api/lessons` | List all cached lessons |
| `GET` | `/api/lessons/:id` | Fetch a specific lesson by ID |

### POST `/api/generate` — Request body

```json
{
  "age_group": "2-3",
  "topic": "洗手習慣",
  "visual_style": "watercolor",
  "image_count": 3,
  "voice_lang": "zh-TW",
  "avatar_style": "bear"
}
```

---

## Supported Options

**Age Groups:** `2-3` / `4-5` / `6+`

**Visual Styles:** `watercolor` / `crayon` / `kawaii`

**Voice Languages:** `zh-TW` (繁體中文) / `zh-HK` (廣東話) / `en-US` (English)

**Avatar Characters:** `bear` / `cat` / `robot` / `bunny` / `girl`

---

## Deployment (Vercel)

```bash
npm run build:vercel
```

Set all `.env` variables as Vercel Environment Variables in your project settings before deploying.

---

## Cost Estimate

| Item | Approximate cost |
|---|---|
| Story text (GPT-4o-mini) | ~$0.0003 per lesson |
| 3 illustrations (FLUX.1-schnell) | ~$0.003 per lesson |
| Cached repeat | $0.00 |

---

## License

MIT
