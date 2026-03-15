"use client";

import React, { useState, useEffect, useRef } from 'react';

interface ScryfallCard {
    id: string;
    name: string;
    image_uris?: {
        small: string;
        normal: string;
    };
    card_faces?: {
        image_uris: {
            small: string;
            normal: string;
        };
    }[];
    set_name: string;
    type_line: string;
}

interface CardSearcherProps {
    onSyncQuantity: (cardName: string, newQuantity: number, typeLine?: string) => void;
    onClose: () => void;
    existingQuantities: Record<string, number>;
}

export default function CardSearcher({ onSyncQuantity, onClose, existingQuantities }: CardSearcherProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ScryfallCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState(false);
    const [gridScale, setGridScale] = useState(2.25);

    useEffect(() => {
        console.log("grid scale changed", gridScale);
    }, [gridScale]);

    // localQuantities tracks the visual state, including non-synced changes
    const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({});
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Sync local state when existingQuantities from parent changes
    useEffect(() => {
        setLocalQuantities(prev => ({
            ...prev,
            ...existingQuantities
        }));
    }, [existingQuantities]);

    const handleAdjustQuantity = (cardName: string, delta: number) => {
        const currentQty = localQuantities[cardName] ?? existingQuantities[cardName] ?? 0;
        const newQty = Math.max(0, currentQty + delta);

        // 1. Update visual state immediately
        setLocalQuantities(prev => ({ ...prev, [cardName]: newQty }));

        // 2. Clear existing timer for this card
        if (debounceTimers.current[cardName]) {
            clearTimeout(debounceTimers.current[cardName]);
        }

        // 3. Set a new timer to sync with parent
        const card = results.find(c => c.name === cardName);
        debounceTimers.current[cardName] = setTimeout(() => {
            onSyncQuantity(cardName, newQty, card?.type_line);
            delete debounceTimers.current[cardName];
        }, 300); // 300ms action debounce
    };

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            setTouched(true);
            try {
                // Scryfall search API
                const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.data || []);
                } else {
                    setResults([]);
                }
            } catch (err) {
                console.error('Search error:', err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 500); // 500ms search debounce

        return () => clearTimeout(timer);
    }, [query]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, []);

    // Card width calculation - Base 100 means 2.0 = 200px, 2.5 = 250px
    const cardWidth = Math.round(100 * gridScale);

    const [faceIndices, setFaceIndices] = useState<Record<string, number>>({});
    const [flippingIds, setFlippingIds] = useState<Record<string, boolean>>({});

    const handleFlip = (e: React.MouseEvent, cardId: string, max: number) => {
        e.stopPropagation();
        if (flippingIds[cardId]) return;

        setFlippingIds(prev => ({ ...prev, [cardId]: true }));

        setTimeout(() => {
            setFaceIndices(prev => ({
                ...prev,
                [cardId]: ((prev[cardId] || 0) + 1) % max
            }));
            setFlippingIds(prev => ({ ...prev, [cardId]: false }));
        }, 150);
    };

    return (
        <div className="flex flex-col h-[1000px] w-full bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            {/* Header / Search Area */}
            <div className="p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <span className="text-blue-600">🔍</span> Card Searcher
                        </h2>
                        <div className="flex items-center gap-2 bg-white/40 px-1 py-1 rounded-lg border border-white/40 shadow-sm ml-4">
                            <button
                                onClick={() => setGridScale(2.25)}
                                className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale < 2.3 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Default Size"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            </button>
                            <button
                                onClick={() => setGridScale(2.65)}
                                className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale >= 2.3 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Zoomed Size"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="relative group">
                    <input
                        type="text"
                        autoFocus
                        placeholder="Search for any Magic card..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-white/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white px-5 py-3 rounded-xl shadow-inner outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar"
            >
                {!touched && !query && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                        <div className="text-4xl mb-4 opacity-20">🃏</div>
                        <p className="text-sm font-medium">Type a name to start searching<br />Thousands of cards at your fingertips.</p>
                    </div>
                )}

                {touched && results.length === 0 && !loading && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                        <div className="text-4xl mb-4 opacity-20">📭</div>
                        <p className="text-sm font-medium">No cards found for "{query}"</p>
                    </div>
                )}

                <div
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`
                    }}
                >
                    {results.map((card) => {
                        const images = card.image_uris
                            ? [card.image_uris.normal]
                            : (card.card_faces ? card.card_faces.map(f => f.image_uris?.normal).filter(Boolean) as string[] : []);

                        const currentFace = faceIndices[card.id] || 0;
                        const imgUrl = images[currentFace] || null;
                        const cardQty = localQuantities[card.name] ?? existingQuantities[card.name] ?? 0;

                        return (
                            <div
                                key={card.id}
                                className="group relative flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-[width,transform] duration-75 ease-in-out" // (This is your $1 class)
                                style={{ width: Math.round(100 * gridScale) }}
                            >
                                <div className="aspect-[63/88] bg-gray-50 relative flex items-center justify-center overflow-hidden">
                                    {imgUrl ? (
                                        <img
                                            src={imgUrl}
                                            alt={card.name}
                                            className="w-full h-full object-cover transition-transform duration-150 ease-in-out"
                                            style={{ transform: flippingIds[card.id] ? 'scaleX(0)' : 'scaleX(1)' }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter text-center px-2">
                                            No Image Available
                                        </div>
                                    )}

                                    {/* Flip Button overlay */}
                                    {images.length > 1 && (
                                        <button
                                            onClick={(e) => handleFlip(e, card.id, images.length)}
                                            className="absolute bottom-2 right-2 bg-purple-600/80 hover:bg-purple-600 text-white w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md border border-white/20 transition-all active:scale-90 z-20 shadow-lg"
                                            title="Flip card"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21l-4-4 4-4" /><path d="M3 17h18" /><path d="M17 3l4 4-4 4" /><path d="M21 7H3" /></svg>
                                        </button>
                                    )}

                                    {/* Overlay Action */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 backdrop-blur-[2px]">
                                        <div className="flex items-center justify-between bg-white/20 backdrop-blur-md rounded-xl p-2 border border-white/30 shadow-xl overflow-hidden">
                                            <button
                                                onClick={() => handleAdjustQuantity(card.name, -1)}
                                                disabled={cardQty <= 0}
                                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-30 ${cardQty === 1 ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-red-500/80'} text-white`}
                                            >
                                                {cardQty === 1 ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                ) : (
                                                    <span className="text-xl font-bold">−</span>
                                                )}
                                            </button>

                                            <div className="flex flex-col items-center min-w-[40px]">
                                                <span className="text-white text-xl font-black leading-none">{cardQty}</span>
                                                <span className="text-white/50 text-[8px] font-bold uppercase tracking-widest mt-0.5">Qty</span>
                                            </div>

                                            <button
                                                onClick={() => handleAdjustQuantity(card.name, 1)}
                                                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-green-500/80 text-white rounded-lg transition-all active:scale-90"
                                            >
                                                <span className="text-xl font-bold">+</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 text-center bg-gray-50/50">
                                    <h4 className="text-[10px] font-black text-gray-700 truncate" title={card.name}>
                                        {card.name}
                                    </h4>
                                    <p className="text-[7px] text-gray-400 uppercase tracking-widest truncate">{card.set_name}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between px-6">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    Powered by <span className="text-gray-600">Scryfall API</span>
                </span>
                <span className="text-[9px] text-blue-500 font-black uppercase tracking-tight">
                    {results.length} results found
                </span>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e5e7eb;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d1d5db;
                }
            `}</style>
        </div>
    );
}
