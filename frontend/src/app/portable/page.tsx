"use client";

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { decompressDeck, PortableDeck } from '@/app/utils/deckSharing';

function PortableViewer() {
    const searchParams = useSearchParams();
    const [deck, setDeck] = useState<PortableDeck | null>(null);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
    const scryfallCache = useRef<Record<string, string | null>>({});

    useEffect(() => {
        const data = searchParams.get('deck');
        if (data) {
            const decoded = decompressDeck(data);
            if (decoded) {
                setDeck(decoded);
            } else {
                setError('Invalid or corrupted deck link.');
            }
        } else {
            setError('No deck data found in link.');
        }
    }, [searchParams]);

    if (error) {
        return (
            <div className="max-w-5xl mx-auto p-12 text-center text-gray-900 bg-white shadow-sm rounded-lg mt-10 border border-gray-100">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                <p className="text-gray-600 mb-8">{error}</p>
                <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
                    Go Home
                </Link>
            </div>
        );
    }

    if (!deck) return <div className="p-12 text-center text-gray-500">Loading shared deck...</div>;

    return (
        <main className="min-h-screen bg-transparent">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Shared Portable Deck</span>
                        <h1 className="text-xl font-bold text-gray-900">{deck.n}</h1>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        {/* View Toggle */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Grid
                            </button>
                        </div>
                        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                            Create Your Own Project →
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-8">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {deck.c.map((card, idx) => (
                            <ReadOnlyGridCard key={idx} card={card} scryfallCache={scryfallCache} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-blue-50/60 rounded-lg shadow-sm border border-blue-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-100/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">👁</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Qty</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Name</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {deck.c.map((card, idx) => (
                                    <ReadOnlyCardRow 
                                        key={idx} 
                                        card={card} 
                                        index={idx} 
                                        scryfallCache={scryfallCache} 
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-lg text-center">
                    <h3 className="text-blue-900 font-bold mb-2">Want to save this deck?</h3>
                    <p className="text-blue-700 text-sm mb-4">Log in or create an account to import this list into your own projects.</p>
                    <Link href="/register" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                        Get Started
                    </Link>
                </div>
            </div>
        </main>
    );
}

function ReadOnlyGridCard({ card, scryfallCache }: { 
    card: { n: string, q: number, i?: string | null }, 
    scryfallCache: React.MutableRefObject<Record<string, string | null>> 
}) {
    const [img, setImg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (card.i) {
            setImg(card.i);
            return;
        }
        const fetchImg = async () => {
            const name = card.n;
            if (scryfallCache.current[name] !== undefined) {
                setImg(scryfallCache.current[name]);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                if (res.ok) {
                    const data = await res.json();
                    const url = data.image_uris?.normal || data.image_uris?.small || null;
                    scryfallCache.current[name] = url;
                    setImg(url);
                } else {
                    scryfallCache.current[name] = null;
                }
            } catch {
                scryfallCache.current[name] = null;
            } finally {
                setLoading(false);
            }
        };
        fetchImg();
    }, [card.n, card.i, scryfallCache]);

    return (
        <div className="flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:border-blue-300">
            <div className="aspect-[63/88] bg-gray-50 relative overflow-hidden flex items-center justify-center">
                {loading ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <img src={img || "/placeholder.png"} alt={card.n} className="w-full h-full object-cover select-none" />
                )}
            </div>
            <div className="p-1 px-2 text-center bg-gray-50/50 border-t border-gray-100">
                <p className="text-[9px] font-bold text-gray-700 truncate" title={card.n}>
                    {card.q}x {card.n}
                </p>
            </div>
        </div>
    );
}

function ReadOnlyCardRow({ card, index, scryfallCache }: {
    card: { n: string, q: number, i?: string | null };
    index: number;
    scryfallCache: React.MutableRefObject<Record<string, string | null>>;
}) {
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handlePreviewEnter = async () => {
        setShowPreview(true);
        if (card.i) {
            setPreviewImg(card.i);
            return;
        }
        const name = card.n;
        if (scryfallCache.current[name] !== undefined) {
            setPreviewImg(scryfallCache.current[name]);
            return;
        }
        setPreviewLoading(true);
        try {
            const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
            if (res.ok) {
                const data = await res.json();
                const imgUrl = data.image_uris?.normal || data.image_uris?.small || null;
                scryfallCache.current[name] = imgUrl;
                setPreviewImg(imgUrl);
            } else {
                scryfallCache.current[name] = null;
                setPreviewImg(null);
            }
        } catch {
            scryfallCache.current[name] = null;
            setPreviewImg(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handlePreviewMove = (e: React.MouseEvent) => {
        setPreviewPos({ x: e.clientX - 270, y: e.clientY - 100 });
    };

    const handlePreviewLeave = () => {
        setShowPreview(false);
        setPreviewImg(null);
        setPreviewLoading(false);
    };

    return (
        <tr className="hover:bg-blue-50/40">
            <td className="px-4 py-2 text-sm text-gray-400">{index + 1}</td>
            <td className="px-2 py-2 text-center">
                <div className="relative">
                    <span
                        className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors text-sm select-none"
                        onMouseEnter={handlePreviewEnter}
                        onMouseMove={handlePreviewMove}
                        onMouseLeave={handlePreviewLeave}
                    >
                        👁
                    </span>
                    {showPreview && (
                        <div
                            className="fixed z-50 pointer-events-none"
                            style={{ left: previewPos.x, top: previewPos.y }}
                        >
                            {previewLoading ? (
                                <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-xs text-gray-500">
                                    Loading...
                                </div>
                            ) : (
                                <img
                                    src={previewImg || '/placeholder.png'}
                                    alt={card.n}
                                    className="rounded-lg shadow-xl border border-gray-200"
                                    style={{ width: 250, height: 'auto' }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-2 text-sm font-medium text-gray-700">{card.q}</td>
            <td className="px-4 py-2 text-sm text-gray-900">{card.n}</td>
        </tr>
    );
}

export default function PortablePage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading viewer...</div>}>
            <PortableViewer />
        </Suspense>
    );
}
