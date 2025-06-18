// server.js (Express.js example)
import express from 'express';
import OpenAI from 'openai';
import 'dotenv/config';

const app = express();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

let assistantId = null;

async function initializeAssistant() {
    if (!assistantId) {
        const assistant = await openai.beta.assistants.create({
            name: "Website Assistant",
            instructions: "You are a helpful assistant that answers questions about webpage content.",
            model: "gpt-4o-mini",
            tools: []
        });
        assistantId = assistant.id;
        console.log('Assistant created:', assistantId);
    }
}

// Your route handlers here...

// Start server and initialize assistant
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeAssistant(); // Initialize after server starts
});