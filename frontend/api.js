// Call on server start
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
        
        // Add user message to thread
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: question
        });
        
        // Run assistant
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
        });
        
        // Poll for completion
        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        
        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }
        
        if (runStatus.status === 'completed') {
            // Get messages
            const messages = await openai.beta.threads.messages.list(threadId);
            const lastMessage = messages.data[0];
            
            res.json({
                answer: lastMessage.content[0].text.value,
                threadId: threadId
            });
        } else {
            res.status(500).json({ error: 'Assistant run failed', status: runStatus.status });
        }
        
    } catch (error) {
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

async function extractWebpageContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAssistant/1.0)'
            }
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Extract text content
        const title = document.title || '';
        const body = document.body?.textContent || '';
        
        return {
            title,
            content: body.replace(/\s+/g, ' ').trim(),
            url
        };
    } catch (error) {
        throw new Error(`Failed to fetch webpage: ${error.message}`);
    }
}