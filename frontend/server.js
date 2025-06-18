// server.js (Express.js example)
import express from 'express';
import OpenAI from 'openai';
import 'dotenv/config';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const app = express();
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

let assistantId = null;

async function initializeAssistant() {
    if (!assistantId) {
        const assistant = await openai.beta.assistants.create({
            name: "Website Assistant",
            instructions: "You are a helpful assistant that answers questions about webpage content.",
            model: "gpt-4-turbo-preview",
            tools: []
        });
        assistantId = assistant.id;
        console.log('Assistant created:', assistantId);
    }
}

async function extractWebpageContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            },
            maxRedirects: 5,
            timeout: 10000
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer');
        scripts.forEach(el => el.remove());
        
        // Extract text content
        const title = document.title || '';
        const mainContent = document.querySelector('main') || document.body;
        const body = mainContent?.textContent || '';
        
        // Clean up the content
        const cleanedContent = body
            .replace(/\s+/g, ' ')
            .replace(/[^\S\r\n]+/g, ' ')
            .trim();
        
        if (!cleanedContent) {
            throw new Error('No content could be extracted from the webpage');
        }
        
        return {
            title,
            content: cleanedContent.substring(0, 15000), // Limit content size
            url
        };
    } catch (error) {
        console.error('Webpage extraction error:', error);
        throw new Error(`Failed to fetch webpage: ${error.message}`);
    }
}

// Start conversation with a webpage
app.post('/api/start-conversation', async (req, res) => {
    try {
        const { url } = req.body;
        
        // Extract webpage content
        const webpageData = await extractWebpageContent(url);
        
        // Create new thread for this webpage
        const thread = await openai.beta.threads.create({
            messages: [
                {
                    role: "user",
                    content: `Please analyze this webpage content and prepare to answer questions about it.
                    
Title: ${webpageData.title}
URL: ${webpageData.url}
Content: ${webpageData.content.substring(0, 15000)}` // Limit content size
                }
            ]
        });
        
        res.json({
            threadId: thread.id,
            title: webpageData.title,
            url: webpageData.url
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ask question about the webpage
app.post('/api/ask-question', async (req, res) => {
    try {
        const { threadId, question } = req.body;
        console.log('Received question:', question, 'for thread:', threadId);
        
        // Add user message to thread
        console.log('Adding message to thread...');
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: question
        });
        
        // Run assistant
        console.log('Creating run with assistant:', assistantId);
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
        });
        console.log('Run created:', run.id);
        
        // Poll for completion
        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        console.log('Initial run status:', runStatus.status);
        
        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            console.log('Run status:', runStatus.status);
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }
        
        console.log('Final run status:', runStatus.status);
        
        if (runStatus.status === 'completed') {
            // Get messages
            console.log('Retrieving messages...');
            const messages = await openai.beta.threads.messages.list(threadId);
            const lastMessage = messages.data[0];
            console.log('Last message:', lastMessage);
            
            res.json({
                answer: lastMessage.content[0].text.value,
                threadId: threadId
            });
        } else {
            console.error('Run failed with status:', runStatus.status);
            res.status(500).json({ error: 'Assistant run failed', status: runStatus.status });
        }
        
    } catch (error) {
        console.error('Error in ask-question:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get conversation history
app.get('/api/conversation/:threadId', async (req, res) => {
    try {
        const { threadId } = req.params;
        const messages = await openai.beta.threads.messages.list(threadId);
        
        res.json({
            messages: messages.data.reverse().map(msg => ({
                role: msg.role,
                content: msg.content[0].text.value,
                timestamp: msg.created_at
            }))
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server and initialize assistant
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeAssistant(); // Initialize after server starts
});