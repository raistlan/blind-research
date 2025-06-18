import { NextResponse } from 'next/server';

const RILLA_API_KEY = process.env.RILLA_API_KEY;
const RILLA_API_URL = 'https://litellm.rillavoice.com/v1/chat/completions';

interface ArticleSection {
    id: number;
    title: string;
    content: string;
}

export async function POST(request: Request) {
    try {
        // Log environment variable status (without exposing the key)
        console.log('RILLA_API_KEY available:', !!RILLA_API_KEY);

        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: 'URL is required' },
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

        // First, fetch the article content
        const articleResponse = await fetch(url);
        if (!articleResponse.ok) {
            throw new Error(`Failed to fetch article: ${articleResponse.statusText}`);
        }
        const articleContent = await articleResponse.text();

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
                        content: `Please analyze this article and break it down into sections:\n\n${articleContent}`
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

        return NextResponse.json({ sections });
    } catch (error) {
        console.error('Error processing article:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process article' },
            { status: 500 }
        );
    }
} 