'use client';

import { useState, useEffect } from 'react';
import AudioPlayer from '../components/AudioPlayer';

interface ArticleSection {
  id: number;
  content: string;
  title: string;
}

// Add Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionError extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionError) => void;
}

interface Window {
  webkitSpeechRecognition: new () => SpeechRecognition;
}

const API_BASE_URL = 'http://localhost:3002/api';

export default function Home() {
  const [url, setUrl] = useState('');
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

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
    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, []);

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);
    setCurrentAudio(null);

    try {
      // Start conversation with the URL
      const startResponse = await fetch(`${API_BASE_URL}/start-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start conversation');
      }

      const startData = await startResponse.json();
      setThreadId(startData.threadId);
      
      // Get initial sections
      const sectionsResponse = await fetch(`${API_BASE_URL}/process-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!sectionsResponse.ok) {
        throw new Error('Failed to process article');
      }

      const sectionsData = await sectionsResponse.json();
      setSections(sectionsData.sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !question.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentAudio(null);
    setCurrentAnswer(null);

    try {
      const response = await fetch(`${API_BASE_URL}/ask-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          question: question.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();
      setCurrentAnswer(data.answer);
      if (data.audio) {
        setCurrentAudio(data.audio);
      }
      setQuestion('');
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

  return (
    <main className="min-h-screen p-8 bg-neutral-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-neutral-50">Article Section Analyzer</h1>

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

        {threadId && (
          <form onSubmit={handleAskQuestion} className="mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about the article"
                className="flex-1 p-2 border border-neutral-700 rounded bg-neutral-800 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-600"
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`px-4 py-2 rounded transition-colors ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isListening ? 'Stop' : '🎤'}
              </button>
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-4 py-2 bg-neutral-50 text-neutral-900 rounded hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 transition-colors"
              >
                {isLoading ? 'Processing...' : 'Ask'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div
            className="p-4 mb-4 text-neutral-50 bg-neutral-800 rounded border border-neutral-700"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        {currentAnswer && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-neutral-50">Answer</h2>
            <div className="p-4 bg-neutral-800 rounded border border-neutral-700 text-neutral-50">
              {currentAnswer}
            </div>
          </div>
        )}

        {currentAudio && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-neutral-50">Audio Response</h2>
            <AudioPlayer audioBase64={currentAudio} autoPlay={true} />
          </div>
        )}

        {sections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-neutral-50">Article Sections</h2>
            {sections
              .slice((currentPage - 1) * 4, currentPage * 4)
              .map((section, i) => (
                <div
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

            {currentPage < Math.ceil(sections.length / 4) && (
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="w-full p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors"
              >
                Next Page
              </button>
            )}
            {currentPage > 1 && (
              <button
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="w-full p-4 border border-neutral-700 rounded bg-neutral-800 hover:bg-neutral-750 cursor-pointer transition-colors"
              >
                Previous Page
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
