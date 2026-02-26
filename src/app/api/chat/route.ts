import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenerativeAI } from "@google/generative-ai";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APLLICATION_TOKEN,
    GOOGLE_API_KEY,
} = process.env;

// ─── Astra DB Client ───────────────────────────────────────────────
const client = new DataAPIClient(ASTRA_DB_APLLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, {
    keyspace: ASTRA_DB_NAMESPACE,
});
const collection = db.collection(ASTRA_DB_COLLECTION!);

// ─── Google Gemini Client ──────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── POST /api/chat ────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const latestMessage = messages[messages.length - 1]?.content;

        if (!latestMessage) {
            return new Response(JSON.stringify({ error: "No message provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 1. Generate embedding + search for context (with fallback if rate limited)
        let docContext = "";
        try {
            const embeddingResult = await embeddingModel.embedContent(latestMessage);
            const queryVector = embeddingResult.embedding.values;

            // 2. Search Astra DB for relevant context (vector similarity search)
            const cursor = collection.find(
                {},
                {
                    sort: { $vector: queryVector },
                    limit: 10,
                    projection: { text: 1, source: 1 },
                }
            );

            const documents = await cursor.toArray();
            docContext = documents.map((doc) => doc.text).join("\n\n");
        } catch (error) {
            console.warn("⚠️ Embedding/search failed (likely rate limit), using Gemini without RAG context");
            docContext = "";
        }

        // 3. Build a RAG prompt with context
        const systemPrompt = `You are an F1 (Formula 1) racing expert assistant called F1 GPT. 
You have deep knowledge of Formula 1 racing history, drivers, teams, circuits, regulations, and statistics.
Use the following context from F1 data sources to answer the user's question accurately.
If the context doesn't contain relevant information, use your general knowledge about F1.
If the question is not related to F1 or motorsport, politely redirect the conversation to F1 topics.

START CONTEXT
${docContext}
END CONTEXT

Guidelines:
- Be enthusiastic about F1!
- Provide specific stats, dates, and facts when available
- Reference your sources when relevant
- Keep answers concise but informative
- Use racing terminology naturally`;

        // 4. Build conversation history for Gemini
        const chatHistory = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // 5. Use streaming for the response (prepend system prompt as first user/model exchange)
        const chat = chatModel.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood! I'm F1 GPT, ready to answer your Formula 1 questions with enthusiasm! 🏎️" }] },
                ...chatHistory,
            ],
        });

        const result = await chat.sendMessageStream(latestMessage);

        // 6. Create a ReadableStream for the response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
            },
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to generate response" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
