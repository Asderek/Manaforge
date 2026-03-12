"use client";

import React, { useEffect, useState } from 'react';

type Card = {
    id: string;
    card_name: string;
    quantity: number;
    sort_order: number;
};

interface ProxySheetProps {
    cards: Card[];
    scryfallCache: Record<string, string | null>;
    onClose: () => void;
}

export default function ProxySheet({ cards, scryfallCache, onClose }: ProxySheetProps) {
    const [showPlaytestLabel, setShowPlaytestLabel] = useState(true);
    const [columns, setColumns] = useState(3);
    const [loadingImages, setLoadingImages] = useState(false);
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

    // Expand cards by quantity
    const expandedCards = cards.flatMap(card =>
        Array.from({ length: card.quantity }, (_, i) => ({
            ...card,
            instanceKey: `${card.id}-${i}`,
        }))
    );

    // Fetch any missing images on mount
    useEffect(() => {
        const fetchMissing = async () => {
            const missing = cards.filter(c => scryfallCache[c.card_name] === undefined);
            if (missing.length === 0) {
                // All cached, just set them
                const urls: Record<string, string> = {};
                for (const c of cards) {
                    urls[c.card_name] = scryfallCache[c.card_name] || '/placeholder.png';
                }
                setImageUrls(urls);
                return;
            }

            setLoadingImages(true);
            const urls: Record<string, string> = {};

            for (const card of cards) {
                if (scryfallCache[card.card_name] !== undefined) {
                    urls[card.card_name] = scryfallCache[card.card_name] || '/placeholder.png';
                    continue;
                }
                try {
                    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.card_name)}`);
                    if (res.ok) {
                        const data = await res.json();
                        const imgUrl = data.image_uris?.normal || data.image_uris?.small || null;
                        scryfallCache[card.card_name] = imgUrl;
                        urls[card.card_name] = imgUrl || '/placeholder.png';
                    } else {
                        scryfallCache[card.card_name] = null;
                        urls[card.card_name] = '/placeholder.png';
                    }
                } catch {
                    urls[card.card_name] = '/placeholder.png';
                }
                await new Promise(r => setTimeout(r, 100));
            }

            setImageUrls(urls);
            setLoadingImages(false);
        };

        fetchMissing();
    }, [cards, scryfallCache]);

    const handlePrint = () => {
        window.print();
    };

    // Calculate pages (9 cards per page for 3x3)
    const cardsPerPage = columns * Math.floor(columns * 1.2); // roughly 3x3=9, 4x4 region
    const perPage = columns === 3 ? 9 : columns === 4 ? 8 : 6;

    const pages: typeof expandedCards[] = [];
    for (let i = 0; i < expandedCards.length; i += perPage) {
        pages.push(expandedCards.slice(i, i + perPage));
    }

    if (loadingImages) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading card images...</p>
                <button onClick={onClose} className="mt-4 text-blue-600 hover:text-blue-800 text-sm">Cancel</button>
            </div>
        );
    }

    return (
        <div className="proxy-sheet-overlay">
            {/* Controls bar - hidden when printing */}
            <div className="no-print fixed top-0 left-0 right-0 bg-gray-900 text-white px-6 py-3 z-[101] flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white text-sm font-medium cursor-pointer"
                    >
                        ← Back to Editor
                    </button>
                    <span className="text-gray-400 text-sm">|</span>
                    <span className="text-sm text-gray-300">
                        {expandedCards.length} cards · {pages.length} page{pages.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showPlaytestLabel}
                            onChange={(e) => setShowPlaytestLabel(e.target.checked)}
                            className="rounded border-gray-400 cursor-pointer"
                        />
                        Show "PLAYTEST" label
                    </label>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Columns:</span>
                        {[3, 4].map(n => (
                            <button
                                key={n}
                                onClick={() => setColumns(n)}
                                className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${columns === n ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handlePrint}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm px-5 py-2 transition-colors cursor-pointer"
                    >
                        🖨 Print
                    </button>
                </div>
            </div>

            {/* Sheet content */}
            <div className="proxy-sheet-content pt-16">
                {pages.map((pageCards, pageIdx) => (
                    <div
                        key={pageIdx}
                        className="proxy-page"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, 1fr)`,
                            gap: '2px',
                            padding: '4mm',
                            pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : undefined,
                            backgroundColor: 'white',
                            maxWidth: '210mm',
                            margin: '0 auto 20px auto',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                        }}
                    >
                        {pageCards.map((card) => (
                            <div
                                key={card.instanceKey}
                                className="proxy-card"
                                style={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderRadius: '4mm',
                                    aspectRatio: '63/88', /* Standard MTG card ratio */
                                }}
                            >
                                <img
                                    src={imageUrls[card.card_name] || '/placeholder.png'}
                                    alt={card.card_name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                    }}
                                />
                                {showPlaytestLabel && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '1.3em',
                                                fontWeight: 900,
                                                color: 'white',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.15em',
                                                WebkitTextStroke: '1.5px black',
                                                textShadow: '0 0 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)',
                                                transform: 'rotate(-30deg)',
                                                userSelect: 'none',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            PLAYTEST CARD
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
