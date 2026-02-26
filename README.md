# 🏎️ F1 GPT — Formula 1 AI Chatbot

An AI-powered chatbot that answers Formula 1 questions using **RAG (Retrieval-Augmented Generation)**. It scrapes real F1 data from Wikipedia, stores it as vector embeddings in Astra DB, and uses Google Gemini to generate accurate, context-aware responses.

## Features

- **RAG Pipeline** — Retrieves relevant F1 data from a vector database before generating answers
- **Vector Search** — Uses cosine similarity to find the most relevant information for each question
- **Streaming Responses** — Answers appear word-by-word in real time
- **Web Scraping** — Automatically scrapes F1 Wikipedia pages using Puppeteer
- **Markdown Rendering** — Chat responses render bold, lists, and other formatting
- **Dark F1 Theme** — Sleek racing-inspired UI with glassmorphism effects

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16** | Full-stack React framework (App Router) |
| **TypeScript** | Type-safe development |
| **Google Gemini** | AI model for embeddings and chat generation |
| **Astra DB** | Cloud vector database (Cassandra-based) |
| **LangChain** | Text splitting and document loading |
| **Puppeteer** | Headless browser for web scraping |
| **react-markdown** | Render markdown in chat messages |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  Wikipedia   │────▶│  loadDb.ts   │────▶│  Astra DB │
│  (F1 Pages)  │     │  (Scrape +   │     │  (Vector  │
│              │     │   Embed)     │     │   Store)  │
└─────────────┘     └──────────────┘     └─────┬─────┘
                                               │
┌─────────────┐     ┌──────────────┐           │
│   User      │────▶│  route.ts    │◀──────────┘
│  Question   │     │  (RAG API)   │     Vector Search
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌───────────┐
                    │   Gemini AI  │────▶│  Streamed  │
                    │  (Generate)  │     │  Response  │
                    └──────────────┘     └───────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- [Google Gemini API Key](https://aistudio.google.com/apikey) (free tier)
- [Astra DB Account](https://astra.datastax.com/) (free tier)

### 1. Clone and Install

```bash
git clone https://github.com/your-username/AiChatWithYoutube.git
cd AiChatWithYoutube
npm install --legacy-peer-deps
```

### 2. Configure Environment

Create a `.env` file in the root:

```env
ASTRA_DB_NAMESPACE="default_keyspace"
ASTRA_DB_COLLECTION="f1gpt"
ASTRA_DB_API_ENDPOINT="your_astra_db_endpoint"
ASTRA_DB_APLLICATION_TOKEN="your_astra_db_token"
GOOGLE_API_KEY=your_gemini_api_key
```

### 3. Load F1 Data

This scrapes Wikipedia pages and stores embeddings in Astra DB:

```bash
npm run seed
```

> Note: This takes ~30 minutes due to free-tier rate limits. The script automatically pauses between batches.

### 4. Start the Chatbot

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start asking F1 questions!

## Project Structure

```
src/
├── app/
│   ├── api/chat/
│   │   └── route.ts        # RAG API — embedding, vector search, Gemini streaming
│   ├── globals.css          # Dark F1-themed styling
│   ├── layout.tsx           # Root layout with metadata
│   └── page.tsx             # Chat UI with streaming and markdown
└── scripts/
    └── loadDb.ts            # Data pipeline — scrape, chunk, embed, store
```

## How RAG Works in This Project

1. **User asks a question** → "Who won the 2024 F1 championship?"
2. **Embed the question** → Convert to a 3072-dimensional vector using Gemini
3. **Vector search** → Find the 10 most similar text chunks in Astra DB
4. **Build prompt** → Inject retrieved F1 context into the AI prompt
5. **Generate answer** → Gemini reads the context and produces an accurate response
6. **Stream to UI** → Response appears word-by-word in the browser

## License

MIT
