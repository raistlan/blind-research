'use client';

import { useState, useEffect } from 'react';

interface ArticleSection {
  id: number;
  content: string;
  title: string;
}

const MOCK_SECTIONS: ArticleSection[] = [
  {
    id: 1,
    title: "The Evolution of Engineering Management",
    content: "Once upon a time, 'engineering teams' were just a couple of devs reporting to whoever happened to be around. A PM. A founder. Maybe even someone in marketing. Then teams became bigger and companies realized that someone had to handle career talks, approvals, decisions."
  },
  {
    id: 2,
    title: "The Tech Lead and Manager Split",
    content: "Companies split the roles: senior ICs would own the tech side, and people managers would handle the people stuff. This created a clean separation between ICs and EMs. However, not every company followed that split well. Some made the manager role so 'pure' it didn't even require a tech background."
  },
  {
    id: 3,
    title: "The Compression Era",
    content: "Welcome to the era of layoffs, shrinking teams, and hiring freezes. Companies now want one person to do what used to be sometimes three full-time jobs. Engineering Managers today are expected to manage the team and the people, handle team culture, and set technical vision."
  },
  {
    id: 4,
    title: "The Modern EM's Responsibilities",
    content: "Today's Engineering Manager must handle team culture, ways of working, and people's career growth. They need to set technical vision while working with PMs and other teams to align on priorities. They're accountable for technical decisions and still need to write some code."
  },
  {
    id: 5,
    title: "The Leadership Paradox",
    content: "Engineering Managers are measured like leaders but treated like coordinators. They're held responsible for team output, morale, retention, and product quality - but without the tools to fix core problems. Decisions about raises, headcount, and deadlines often require multiple stakeholder approvals."
  },
  {
    id: 6,
    title: "Why People Choose Engineering Management",
    content: "Despite the challenges, people choose this path because helping others grow is deeply rewarding. Seeing a team thrive under pressure brings immense satisfaction. When it works, it really works. The role offers unique opportunities for impact and growth."
  },
  {
    id: 7,
    title: "Coping Strategies for EMs",
    content: "To succeed as an Engineering Manager, be clear on your scope and document it. Push back when work creeps outside of it. Build peer support networks with other EMs. Track your actual work to help with comp talks and performance reviews."
  },
  {
    id: 8,
    title: "The Future of Engineering Management",
    content: "The role needs a rethink. It's not that EMs aren't skilled enough - it's that the job keeps getting bigger while support keeps shrinking. Engineering Managers need to push for change and better support structures to succeed in their roles."
  },
  {
    id: 9,
    title: "The Takeaway",
    content: "Engineering Management used to be one role, then it became two or three. Now, many companies want it back as one, but without adding time, help, or authority. This is a fundamental problem that needs addressing at the organizational level."
  },
  {
    id: 10,
    title: "Moving Forward",
    content: "If you're an Engineering Manager feeling the pressure, you're not alone. The role is indeed harder than ever, and that means it's time to push for change. Building support networks and advocating for better structures is crucial for the future of the role."
  },
  {
    id: 11,
    title: "The Role's Impact",
    content: "Despite its challenges, Engineering Management remains a crucial role in tech organizations. The right manager can make a significant difference in team performance, individual growth, and overall organizational success."
  },
  {
    id: 12,
    title: "Conclusion",
    content: "Being an Engineering Manager today has never been harder, but it's also never been more important. The role requires a delicate balance of technical knowledge, people skills, and organizational savvy. Success requires both individual resilience and systemic change."
  }
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const sectionsPerPage = 4;

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Handle number keys 0-9
      if (!/^[0-9]$/.test(event.key)) return;

      const keyNumber = parseInt(event.key);

      if (keyNumber >= 1 && keyNumber <= 4) {
        // Keys 1-4 navigate to sections on current page
        const sectionIndex = (currentPage - 1) * sectionsPerPage + keyNumber - 1;
        if (sectionIndex < sections.length) {
          // Scroll to the section
          const element = document.getElementById(`section-${sectionIndex + 1}`);
          element?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (keyNumber === 0) {
        // Key 0 is "Previous Page"
        if (currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
      } else if (keyNumber === 9) {
        // Key 9 is "Next Page"
        if (currentPage < Math.ceil(sections.length / sectionsPerPage)) {
          setCurrentPage(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, sections.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCurrentPage(1); // Reset to first page when new search is made

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
    <main className="min-h-screen p-8 bg-neutral-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-neutral-50">Article section analyzer</h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter article URL"
              className="flex-1 p-2 border border-neutral-700 rounded bg-neutral-800 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-600"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-neutral-50 text-neutral-900 rounded hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 transition-colors"
            >
              {isLoading ? 'Processing...' : 'Analyze'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-4 text-neutral-50 bg-neutral-800 rounded border border-neutral-700">
            {error}
          </div>
        )}

        {sections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-neutral-50">Article sections</h2>
            {sections
              .slice((currentPage - 1) * sectionsPerPage, currentPage * sectionsPerPage)
              .map((section, i) => (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className="p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors flex gap-4"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-700 text-neutral-50 text-xl font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2 text-neutral-50">{section.title}</h3>
                    <p className="text-neutral-300">{section.content}</p>
                  </div>
                </div>
              ))}

            {currentPage < Math.ceil(sections.length / sectionsPerPage) && (
              <div
                id="section-next"
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="flex-1 p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors flex gap-4"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-700 text-neutral-50 text-xl font-bold">
                  9
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2 text-neutral-50">Next Page</h3>
                  <p className="text-neutral-300">View more sections</p>
                </div>
              </div>
            )}
            {currentPage > 1 && (
              <div
                id="section-prev"
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="flex-1 p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors flex gap-4"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-700 text-neutral-50 text-xl font-bold">
                  0
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2 text-neutral-50">Previous Page</h3>
                  <p className="text-neutral-300">View previous sections</p>
                </div>
              </div>
            )}
            <div className="text-center text-neutral-400 mt-2">
              Page {currentPage} of {Math.ceil(sections.length / sectionsPerPage)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
