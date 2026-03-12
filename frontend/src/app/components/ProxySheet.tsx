"use client";

import React, { useEffect, useState } from 'react';

type Card = {
    id: string;
    card_name: string;
    quantity: number;
    sort_order: number;
    custom_image?: string | null;
};

interface ProxySheetProps {
    cards: Card[];
    scryfallCache: Record<string, string | null>;
    onClose: () => void;
}

const BASIC_LANDS = ['plains', 'island', 'swamp', 'mountain', 'forest',
    'snow-covered plains', 'snow-covered island', 'snow-covered swamp', 'snow-covered mountain', 'snow-covered forest',
    'wastes'];

const PAPER_SIZES: Record<string, { label: string; width: string; height: string }> = {
    letter: { label: 'Letter (8.5×11 in)', width: '215.9mm', height: '279.4mm' },
    a4: { label: 'A4 (210×297 mm)', width: '210mm', height: '297mm' },
};

const GAP_OPTIONS = [
    { label: '0 mm (no gap)', value: 0 },
    { label: '1 mm', value: 1 },
    { label: '2 mm', value: 2 },
    { label: '3 mm (bleed)', value: 3 },
];

const SCALE_OPTIONS = [
    { label: '90%', value: 0.9 },
    { label: '95%', value: 0.95 },
    { label: '100%', value: 1.0 },
];

export default function ProxySheet({ cards, scryfallCache, onClose }: ProxySheetProps) {
    const [showPlaytestLabel, setShowPlaytestLabel] = useState(true);
    const [showCropMarks, setShowCropMarks] = useState(true);
    const [skipBasicLands, setSkipBasicLands] = useState(false);
    const [blackCorners, setBlackCorners] = useState(true);
    const [printDecklist, setPrintDecklist] = useState(false);
    const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
    const [gap, setGap] = useState(3);
    const [scale, setScale] = useState(1.0);
    const [columns, setColumns] = useState(3);

    const [loadingImages, setLoadingImages] = useState(false);
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

    const filteredCards = skipBasicLands
        ? cards.filter(c => {
            console.log("FOUND THE BROKEN CARD:", c);
            return !BASIC_LANDS.includes(c.card_name?.toLowerCase().trim() || "");
        })
        : cards;

    // Expand cards by quantity
    const expandedCards = filteredCards.flatMap(card =>
        Array.from({ length: card.quantity }, (_, i) => ({
            ...card,
            instanceKey: `${card.id}-${i}`,
        }))
    );

    // Standard MTG card size: 63mm x 88mm
    const cardWidthMm = 63 * scale;
    const cardHeightMm = 88 * scale;

    const rows = columns === 4 ? 2 : 3; // 3x3 or 4x2 per page
    const perPage = columns * rows;

    const pages: typeof expandedCards[] = [];
    for (let i = 0; i < expandedCards.length; i += perPage) {
        pages.push(expandedCards.slice(i, i + perPage));
    }

    // Fetch any missing images on mount
    useEffect(() => {
        const fetchMissing = async () => {
            const relevantCards = skipBasicLands
                ? cards.filter(c => !BASIC_LANDS.includes(c.card_name.toLowerCase()))
                : cards;
            const missing = relevantCards.filter(c => scryfallCache[c.card_name] === undefined);

            if (missing.length === 0) {
                const urls: Record<string, string> = {};
                for (const c of relevantCards) {
                    urls[c.card_name] = scryfallCache[c.card_name] || '/placeholder.png';
                }
                setImageUrls(urls);
                return;
            }

            setLoadingImages(true);
            const urls: Record<string, string> = {};

            for (const card of relevantCards) {
                if (card.custom_image) {
                    urls[card.card_name] = card.custom_image;
                    continue;
                }
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
    }, [cards, scryfallCache, skipBasicLands]);

    const handlePrint = () => {
        window.print();
    };

    if (loadingImages) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading card images...</p>
                <button onClick={onClose} className="mt-4 text-blue-600 hover:text-blue-800 text-sm cursor-pointer">Cancel</button>
            </div>
        );
    }

    const cropMarkSize = 10; // mm
    const cropMarkColor = '#333';

    return (
        <div className="proxy-sheet-overlay">
            {/* Controls bar - hidden when printing */}
            <div className="no-print fixed top-0 left-0 right-0 bg-gray-900 text-white z-[101] shadow-lg">
                {/* Row 1: Toggles */}
                <div className="px-6 py-2 flex items-center justify-between border-b border-gray-700">
                    <div className="flex items-center gap-6">
                        <button onClick={onClose} className="text-gray-300 hover:text-white text-sm font-medium cursor-pointer">
                            ← Back to Editor
                        </button>
                        <span className="text-gray-600">|</span>
                        <span className="text-sm text-gray-400">
                            {expandedCards.length} cards · {pages.length} page{pages.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-5">
                        <Toggle label="Crop marks" checked={showCropMarks} onChange={setShowCropMarks} />
                        <Toggle label="Skip basic lands" checked={skipBasicLands} onChange={setSkipBasicLands} />
                        <Toggle label="Black corners" checked={blackCorners} onChange={setBlackCorners} />
                        <Toggle label="Print decklist" checked={printDecklist} onChange={setPrintDecklist} />
                        <Toggle label="Playtest watermark" checked={showPlaytestLabel} onChange={setShowPlaytestLabel} />
                    </div>
                </div>
                {/* Row 2: Dropdowns + Print */}
                <div className="px-6 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <SelectControl label="Paper" value={paperSize} onChange={(v) => setPaperSize(v as 'letter' | 'a4')}
                            options={Object.entries(PAPER_SIZES).map(([k, v]) => ({ value: k, label: v.label }))} />
                        <SelectControl label="Gap" value={String(gap)} onChange={(v) => setGap(Number(v))}
                            options={GAP_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} />
                        <SelectControl label="Scale" value={String(scale)} onChange={(v) => setScale(Number(v))}
                            options={SCALE_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} />
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
                    </div>
                    <button
                        onClick={handlePrint}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm px-6 py-2 transition-colors cursor-pointer flex items-center gap-2"
                    >
                        🖨 Print
                    </button>
                </div>
            </div>

            {/* Sheet content */}
            <div className="proxy-sheet-content" style={{ paddingTop: '100px' }}>
                {pages.map((pageCards, pageIdx) => (
                    <div
                        key={pageIdx}
                        className="proxy-page"
                        style={{
                            width: PAPER_SIZES[paperSize].width,
                            minHeight: PAPER_SIZES[paperSize].height,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, ${cardWidthMm}mm)`,
                            gridAutoRows: `${cardHeightMm}mm`,
                            justifyContent: 'center',
                            alignContent: 'center',
                            gap: `${gap}mm`,
                            padding: '8mm',
                            backgroundColor: 'white',
                            margin: '0 auto 20px auto',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            position: 'relative',
                        }}
                    >
                        {pageCards.map((card) => (
                            <div
                                key={card.instanceKey}
                                className="proxy-card"
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    overflow: 'visible',
                                }}
                            >
                                {/* Crop marks */}
                                {showCropMarks && (
                                    <>
                                        {/* Top-left */}
                                        <div style={{ position: 'absolute', top: `-${cropMarkSize}px`, left: 0, width: '1px', height: `${cropMarkSize}px`, background: cropMarkColor }} />
                                        <div style={{ position: 'absolute', top: 0, left: `-${cropMarkSize}px`, width: `${cropMarkSize}px`, height: '1px', background: cropMarkColor }} />
                                        {/* Top-right */}
                                        <div style={{ position: 'absolute', top: `-${cropMarkSize}px`, right: 0, width: '1px', height: `${cropMarkSize}px`, background: cropMarkColor }} />
                                        <div style={{ position: 'absolute', top: 0, right: `-${cropMarkSize}px`, width: `${cropMarkSize}px`, height: '1px', background: cropMarkColor }} />
                                        {/* Bottom-left */}
                                        <div style={{ position: 'absolute', bottom: `-${cropMarkSize}px`, left: 0, width: '1px', height: `${cropMarkSize}px`, background: cropMarkColor }} />
                                        <div style={{ position: 'absolute', bottom: 0, left: `-${cropMarkSize}px`, width: `${cropMarkSize}px`, height: '1px', background: cropMarkColor }} />
                                        {/* Bottom-right */}
                                        <div style={{ position: 'absolute', bottom: `-${cropMarkSize}px`, right: 0, width: '1px', height: `${cropMarkSize}px`, background: cropMarkColor }} />
                                        <div style={{ position: 'absolute', bottom: 0, right: `-${cropMarkSize}px`, width: `${cropMarkSize}px`, height: '1px', background: cropMarkColor }} />
                                    </>
                                )}

                                {/* Card image container */}
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: blackCorners ? '3mm' : 0,
                                    overflow: 'hidden',
                                    backgroundColor: blackCorners ? 'black' : 'transparent',
                                }}>
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
                                </div>

                                {/* Playtest watermark */}
                                {showPlaytestLabel && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        pointerEvents: 'none',
                                    }}>
                                        <span style={{
                                            fontSize: `${1.3 * scale}em`,
                                            fontWeight: 900,
                                            color: 'white',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.15em',
                                            WebkitTextStroke: '1.5px black',
                                            textShadow: '0 0 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)',
                                            transform: 'rotate(-30deg)',
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            PLAYTEST CARD
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Decklist page */}
                {printDecklist && (
                    <div
                        className="proxy-page"
                        style={{
                            width: PAPER_SIZES[paperSize].width,
                            minHeight: PAPER_SIZES[paperSize].height,
                            backgroundColor: 'white',
                            margin: '0 auto 20px auto',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            padding: '15mm',
                        }}
                    >
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#333' }}>
                            Decklist
                        </h2>
                        <div style={{ columns: 2, columnGap: '20px', fontSize: '11px', lineHeight: '1.8', color: '#444' }}>
                            {filteredCards.map(card => (
                                <div key={card.id} style={{ breakInside: 'avoid' }}>
                                    <span style={{ fontWeight: 600 }}>{card.quantity}x</span> {card.card_name}
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '20px', fontSize: '10px', color: '#999', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                            Total: {filteredCards.reduce((sum, c) => sum + c.quantity, 0)} cards
                            ({filteredCards.length} unique)
                            {skipBasicLands && ' · Basic lands excluded'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Toggle Switch ──
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
            onClick={() => onChange(!checked)}
        >
            <div
                className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-600'}`}
            >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${checked ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-gray-300">{label}</span>
        </div>
    );
}

// ── Select Dropdown ──
function SelectControl({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-gray-700 text-gray-200 rounded px-2 py-1 text-xs border border-gray-600 cursor-pointer outline-none"
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}
