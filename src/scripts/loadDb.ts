import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APLLICATION_TOKEN,
    GOOGLE_API_KEY,
} = process.env;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const f1Data = [
    "https://en.wikipedia.org/wiki/Formula_One",
    "https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship",
    "https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship",
    "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers%27_Champions",
    "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Constructors%27_Champions",
    "https://en.wikipedia.org/wiki/Max_Verstappen",
    "https://en.wikipedia.org/wiki/Lewis_Hamilton",
    "https://en.wikipedia.org/wiki/Red_Bull_Racing",
    "https://en.wikipedia.org/wiki/Scuderia_Ferrari",
];

const client = new DataAPIClient(ASTRA_DB_APLLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, {
    keyspace: ASTRA_DB_NAMESPACE,
});
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createCollection = async () => {
    try {
        try {
            await db.dropCollection(ASTRA_DB_COLLECTION!);
            console.log("Dropped old collection");
        } catch {
        }

        await db.createCollection(ASTRA_DB_COLLECTION!, {
            vector: {
                dimension: 3072,
                metric: "cosine",
            },
        });
        console.log("Collection created:", ASTRA_DB_COLLECTION);
    } catch (error: any) {
        if (error.message?.includes("already exists")) {
            console.log("Collection already exists, continuing...");
        } else {
            throw error;
        }
    }
};

const generateEmbedding = async (text: string, retries = 3): Promise<number[]> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error: any) {
            if (error.status === 429 && attempt < retries) {
                const waitTime = attempt * 60_000;
                console.log(`   ⏳ Rate limited. Waiting ${waitTime / 1000}s before retry (attempt ${attempt}/${retries})...`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded");
};

const scrapePage = async (url: string): Promise<string> => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
        gotoOptions: {
            waitUntil: "domcontentloaded",
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerText);
            await browser.close();
            return result;
        },
    });

    const docs = await loader.load();
    return docs[0]?.pageContent || "";
};

const loadSampleData = async () => {
    const collection = db.collection(ASTRA_DB_COLLECTION!);

    for (const url of f1Data) {
        console.log(`\n Scraping: ${url}`);

        try {
            const content = await scrapePage(url);
            console.log(`Got ${content.length} characters`);

            const chunks = await splitter.splitText(content);
            console.log(`Split into ${chunks.length} chunks`);

            let inserted = 0;
            for (const chunk of chunks) {
                const vector = await generateEmbedding(chunk);

                await collection.insertOne({
                    $vector: vector,
                    text: chunk,
                    source: url,
                });
                inserted++;

                // Log progress every 10 chunks
                if (inserted % 10 === 0) {
                    console.log(`Inserted ${inserted}/${chunks.length} chunks...`);
                }

                // Small delay to avoid hitting rate limits (15 RPM for free tier)
                if (inserted % 14 === 0) {
                    console.log(`Pausing 60s to respect rate limits...`);
                    await sleep(60_000);
                }
            }

            console.log(`Done inserted ${inserted} chunks from this page`);
        } catch (error) {
            console.error(`Error processing ${url}:`, error);
        }
    }
};

const main = async () => {
    console.log("F1 GPT — Loading data into Astra DB...\n");

    await createCollection();
    await loadSampleData();

    console.log("\n🏁 All done! Your F1 data is loaded into Astra DB.");
};

main().catch(console.error);