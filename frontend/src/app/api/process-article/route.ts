import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import axios from 'axios';

const RILLA_API_KEY = process.env.RILLA_API_KEY;
const RILLA_API_URL = 'https://litellm.rillavoice.com/v1/chat/completions';

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
        const { url, question, context } = await request.json();

        if (!url && !context) {
            return NextResponse.json(
                { error: 'URL or context is required' },
                { status: 400 }
            );
        }

        if (!RILLA_API_KEY) {
            console.error('RILLA_API_KEY is not configured');
            return NextResponse.json(
                { error: 'Rilla API key not configured. Please check your environment variables.' },
                { status: 500 }
            );
        }

        // If this is a question about existing content
        if (context && question) {
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
                            content: "You are an expert at analyzing articles and answering questions about their content. Provide clear, concise, and accurate answers based on the given context."
                        },
                        {
                            role: "user",
                            content: `Context: ${context}\n\nQuestion: ${question}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Rilla API error:', errorData || response.statusText);
                throw new Error(`Rilla API error: ${response.statusText}`);
            }

            const data = await response.json();
            return NextResponse.json({
                answer: data.choices[0].message.content
            });
        }

        // If this is a new article analysis
        const webpageData = await extractWebpageContent(url);

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