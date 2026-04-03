import { GoogleGenAI } from "@google/genai";

async function run() {
    try {
        const ai = new GoogleGenAI({
            apiKey: '***REVOKED-CLOUDFLARE-TOKEN***',
            httpOptions: {
                baseUrl: "https://gateway.ai.cloudflare.com/v1/d65b76a0e64c3791e932edd9163b1c71/workspace-gateway/google-ai-studio",
            }
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "What is Cloudflare?",
        });

        console.log(response.text);
    } catch (e) {
        console.error("ERROR HAPPENED:");
        console.error(e.message);
    }
}

run();
