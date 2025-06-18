'use client';

import { useState, useEffect, useRef } from 'react';

interface ArticleSection {
    id: number;
    content: string;
    title: string;
}

interface Question {
    id: number;
    question: string;
    answer: string;
    timestamp: number;
}

export default function AnalyzePage() {
    const [url, setUrl] = useState('');
    const [sections, setSections] = useState<ArticleSection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const sectionsPerPage = 4;

    // Q&A state
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isAsking, setIsAsking] = useState(false);
    const [qaError, setQaError] = useState<string | null>(null);
    const [selectedSection, setSelectedSection] = useState<ArticleSection | null>(null);

    const questionInputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);

    // Get visible sections for current page
    const getVisibleSections = () => {
        return sections.slice((currentPage - 1) * sectionsPerPage, currentPage * sectionsPerPage);
    };

    // Announce changes to screen readers
    const announceToScreenReader = (message: string) => {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    };

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Handle number keys 0-9
            if (!/^[0-9]$/.test(event.key)) return;

            const keyNumber = parseInt(event.key);

            if (keyNumber >= 1 && keyNumber <= 4) {
                // Keys 1-4 navigate to sections on current page
                const sectionIndex = (currentPage - 1) * sectionsPerPage + keyNumber - 1;
                if (sectionIndex < sections.length) {
                    const section = sections[sectionIndex];
                    const element = document.getElementById(`section-${section.id}`);
                    element?.scrollIntoView({ behavior: 'smooth' });
                    announceToScreenReader(`Selected section: ${section.title}`);

                    // Generate a question about the section
                    const question = `Can you tell me more about the section that relates to "${section.title}"?`;
                    setCurrentQuestion(question);

                    // Focus the question input after a short delay
                    setTimeout(() => {
                        questionInputRef.current?.focus();
                    }, 500);
                }
            } else if (keyNumber === 0) {
                // Key 0 is "Previous Page"
                if (currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                    announceToScreenReader(`Navigated to page ${currentPage - 1}`);
                }
            } else if (keyNumber === 9) {
                // Key 9 is "Next Page"
                if (currentPage < Math.ceil(sections.length / sectionsPerPage)) {
                    setCurrentPage(prev => prev + 1);
                    announceToScreenReader(`Navigated to page ${currentPage + 1}`);
                }
            }
        };

        const handleGlobalKeys = (event: KeyboardEvent) => {
            // Jump to first/last page
            if (event.key === 'Home') {
                setCurrentPage(1);
                announceToScreenReader('Navigated to first page');
            }
            if (event.key === 'End') {
                const lastPage = Math.ceil(sections.length / sectionsPerPage);
                setCurrentPage(lastPage);
                announceToScreenReader(`Navigated to last page: ${lastPage}`);
            }

            // Clear forms with Escape
            if (event.key === 'Escape') {
                if (currentQuestion) {
                    setCurrentQuestion('');
                    questionInputRef.current?.focus();
                }
                if (url) {
                    setUrl('');
                    urlInputRef.current?.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        window.addEventListener('keydown', handleGlobalKeys);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
            window.removeEventListener('keydown', handleGlobalKeys);
        };
    }, [currentPage, sections.length, sections, currentQuestion, url]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setCurrentPage(1); // Reset to first page when new search is made
        setQuestions([]); // Clear previous questions
        setSelectedSection(null); // Reset selected section

        try {
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

    const handleQuestionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentQuestion.trim()) return;

        setIsAsking(true);
        setQaError(null);

        try {
            // If a specific section is selected, use its content as context
            const context = selectedSection
                ? `Section Title: ${selectedSection.title}\nSection Content: ${selectedSection.content}`
                : sections.map(section => `Section Title: ${section.title}\nSection Content: ${section.content}`).join('\n\n');

            const response = await fetch('/api/process-article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    context,
                    question: currentQuestion.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get answer');
            }

            const data = await response.json();

            // Add new Q&A to the list
            setQuestions(prev => [...prev, {
                id: Date.now(),
                question: currentQuestion.trim(),
                answer: data.answer,
                timestamp: Date.now(),
            }]);

            setCurrentQuestion(''); // Clear input
            setSelectedSection(null); // Reset selected section after question is asked
        } catch (err) {
            setQaError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsAsking(false);
        }
    };

    const speakAnswer = (text: string) => {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Get available voices and set a preferred voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => voice.name.includes('English'));
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    };

    return (
        <main className="min-h-screen p-8 bg-neutral-900">
            <div className="max-w-4xl mx-auto">
                <header>
                    <h1 className="text-3xl font-bold mb-8 text-neutral-50">Article section analyzer</h1>
                </header>

                <section aria-labelledby="url-form-title">
                    <h2 id="url-form-title" className="sr-only">Article URL Input</h2>
                    <form onSubmit={handleSubmit} className="mb-8">
                        <div className="flex gap-4">
                            <label htmlFor="article-url" className="sr-only">Article URL</label>
                            <input
                                ref={urlInputRef}
                                id="article-url"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Enter article URL"
                                className="flex-1 p-2 border border-neutral-700 rounded bg-neutral-800 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-600"
                                required
                                aria-label="Article URL"
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-neutral-50 text-neutral-900 rounded hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 transition-colors"
                                aria-label={isLoading ? "Processing article..." : "Analyze article"}
                            >
                                {isLoading ? 'Processing...' : 'Analyze'}
                            </button>
                        </div>
                    </form>
                </section>

                {error && (
                    <div
                        className="p-4 mb-4 text-neutral-50 bg-neutral-800 rounded border border-neutral-700"
                        role="alert"
                        aria-live="assertive"
                    >
                        {error}
                    </div>
                )}

                {sections.length > 0 && (
                    <section aria-labelledby="sections-title">
                        <h2 id="sections-title" className="text-2xl font-semibold mb-4 text-neutral-50">Article sections</h2>
                        <div className="space-y-4" role="list">
                            {getVisibleSections().map((section, i) => (
                                <article
                                    key={section.id}
                                    id={`section-${section.id}`}
                                    className={`p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors flex gap-4 focus:outline-none focus:ring-2 focus:ring-neutral-50 ${selectedSection?.id === section.id ? 'ring-2 ring-neutral-50' : ''
                                        }`}
                                    tabIndex={0}
                                    onClick={() => {
                                        setSelectedSection(section);
                                        const question = `Can you tell me more about the section that relates to "${section.title}"?`;
                                        setCurrentQuestion(question);
                                        questionInputRef.current?.focus();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedSection(section);
                                            const question = `Can you tell me more about the section that relates to "${section.title}"?`;
                                            setCurrentQuestion(question);
                                            questionInputRef.current?.focus();
                                        }
                                    }}
                                >
                                    <div
                                        className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-700 text-neutral-50 text-xl font-bold"
                                        aria-hidden="true"
                                    >
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium mb-2 text-neutral-50">{section.title}</h3>
                                        <p className="text-neutral-300">{section.content}</p>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <nav aria-label="Pagination" className="mt-4">
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 bg-neutral-800 text-neutral-50 rounded hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-50"
                                    aria-label="Previous page"
                                >
                                    Previous page
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    disabled={currentPage >= Math.ceil(sections.length / sectionsPerPage)}
                                    className="px-4 py-2 bg-neutral-800 text-neutral-50 rounded hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-50"
                                    aria-label="Next page"
                                >
                                    Next page
                                </button>
                            </div>
                            <div
                                className="text-center text-neutral-400 mt-2"
                                aria-live="polite"
                            >
                                Page {currentPage} of {Math.ceil(sections.length / sectionsPerPage)}
                            </div>
                        </nav>
                    </section>
                )}

                {sections.length > 0 && (
                    <section aria-labelledby="qa-title" className="mt-8">
                        <h2 id="qa-title" className="text-2xl font-semibold mb-4 text-neutral-50">
                            {selectedSection
                                ? `Ask questions about: ${selectedSection.title}`
                                : 'Ask questions about the article'}
                        </h2>

                        <form onSubmit={handleQuestionSubmit} className="mb-4">
                            <div className="flex gap-4">
                                <label htmlFor="question-input" className="sr-only">Question input</label>
                                <input
                                    ref={questionInputRef}
                                    id="question-input"
                                    type="text"
                                    value={currentQuestion}
                                    onChange={(e) => setCurrentQuestion(e.target.value)}
                                    placeholder={selectedSection
                                        ? `Ask a question about "${selectedSection.title}"...`
                                        : "Type your question here..."}
                                    className="flex-1 p-2 border border-neutral-700 rounded bg-neutral-800 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-600"
                                    disabled={isAsking}
                                    aria-label="Question input"
                                />
                                <button
                                    type="submit"
                                    disabled={isAsking || !currentQuestion.trim()}
                                    className="px-4 py-2 bg-neutral-50 text-neutral-900 rounded hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-50"
                                    aria-label={isAsking ? "Processing question..." : "Ask question"}
                                >
                                    {isAsking ? 'Asking...' : 'Ask'}
                                </button>
                            </div>
                        </form>

                        {qaError && (
                            <div
                                className="p-4 mb-4 text-neutral-50 bg-neutral-800 rounded border border-neutral-700"
                                role="alert"
                                aria-live="assertive"
                            >
                                {qaError}
                            </div>
                        )}

                        <div className="space-y-4" role="list">
                            {questions.map((qa) => (
                                <article
                                    key={qa.id}
                                    className="p-4 border border-neutral-700 rounded bg-neutral-800"
                                >
                                    <div className="mb-2">
                                        <h3 className="font-medium text-neutral-50">Q: {qa.question}</h3>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <p className="text-neutral-300 flex-1">A: {qa.answer}</p>
                                        <button
                                            onClick={() => speakAnswer(qa.answer)}
                                            className="p-2 text-neutral-50 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-50 rounded"
                                            aria-label="Read answer aloud"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9v6h4l5 5V4l-5 5H9z" />
                                            </svg>
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
} 