import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { JSDOM } from 'jsdom';
import axios from 'axios';

const RILLA_API_KEY = process.env.RILLA_API_KEY;
const RILLA_API_URL = 'https://litellm.rillavoice.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

let assistantId: string | null = null;

async function initializeAssistant() {
    if (!assistantId) {
        const assistant = await openai.beta.assistants.create({
            name: "Article Analyzer",
            instructions: "You are an expert at analyzing articles and breaking them down into clear, logical sections. You can also answer questions about the article content.",
            model: "gpt-4",
            tools: []
        });
        assistantId = assistant.id;
        console.log('Assistant created:', assistantId);
    }
}

// Initialize assistant when the module loads
initializeAssistant().catch(console.error);

interface ArticleSection {
    id: number;
    title: string;
    content: string;
}

async function extractWebpageContent(url: string) {
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
        scripts.forEach((el: Element) => el.remove());

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
        throw new Error(`Failed to fetch webpage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function POST(request: Request) {
    try {
        const { url, question, threadId } = await request.json();

        if (!url && !threadId) {
            return NextResponse.json(
                { error: 'URL or threadId is required' },
                { status: 400 }
            );
        }

        // If this is a question about an existing thread
        if (threadId && question) {
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
                assistant_id: assistantId!
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

                return NextResponse.json({
                    answer: lastMessage.content[0].text.value,
                    threadId: threadId
                });
            } else {
                console.error('Run failed with status:', runStatus.status);
                return NextResponse.json(
                    { error: 'Assistant run failed', status: runStatus.status },
                    { status: 500 }
                );
            }
        }

        // If this is a new article analysis
        if (!RILLA_API_KEY) {
            console.error('RILLA_API_KEY is not configured');
            return NextResponse.json(
                { error: 'Rilla API key not configured. Please check your environment variables.' },
                { status: 500 }
            );
        }

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

        // Process with Rilla API for section analysis
        const response = await fetch(RILLA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RILLA_API_KEY}`
            },
            body: JSON.stringify({
                model: "claude-3-7-sonnet-v1",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at analyzing articles and breaking them down into clear, logical sections. For each section, provide a title and a concise summary of the content. Format each section with a title on one line, followed by the content on subsequent lines. Separate sections with blank lines."
                    },
                    {
                        role: "user",
                        content: `Please analyze this article and break it down into sections:\n\n${webpageData.content}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('Rilla API error:', errorData || response.statusText);
            throw new Error(`Rilla API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Process the response to extract sections
        const content = data.choices[0].message.content;

        // Split the content into sections and format them
        const sections: ArticleSection[] = content.split('\n\n').map((section: string, index: number) => {
            const [title, ...contentParts] = section.split('\n');
            return {
                id: index + 1,
                title: title.replace(/^#+\s*/, '').trim(), // Remove markdown headers if present
                content: contentParts.join('\n').trim()
            };
        }).filter((section: ArticleSection) => section.title && section.content);

        return NextResponse.json({
            sections,
            threadId: thread.id,
            title: webpageData.title,
            url: webpageData.url
        });
    } catch (error) {
        console.error('Error processing article:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process article' },
            { status: 500 }
        );
    }
} 