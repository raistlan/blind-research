'use client';

import { useState } from 'react';

interface ArticleSection {
  id: number;
  content: string;
  title: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/process-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to process article');
      }

      const data = await response.json();
      setSections(data.sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Article Section Analyzer - HMR Test</h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter article URL"
              className="flex-1 p-2 border border-gray-700 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-white text-gray-900 rounded hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-400 transition-colors"
            >
              {isLoading ? 'Processing...' : 'Analyze'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-4 text-white bg-gray-800 rounded border border-gray-700">
            {error}
          </div>
        )}

        {sections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-white">Article Sections</h2>
            {sections.map((section) => (
              <div
                key={section.id}
                className="p-4 border border-gray-700 rounded bg-gray-800 hover:bg-gray-750 cursor-pointer transition-colors"
              >
                <h3 className="font-medium mb-2 text-white">{section.title}</h3>
                <p className="text-gray-300">{section.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
