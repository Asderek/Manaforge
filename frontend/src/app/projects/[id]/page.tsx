"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import ProxySheet from '../../components/ProxySheet';
import CustomCardModal from '@/app/components/CustomCardModal';
import ImportDeckModal from '@/app/components/ImportDeckModal';

type Card = {
    id: string;
    card_name: string;
    quantity: number;
    sort_order: number;
    custom_image?: string | null;
};

type Project = {
    id: string;
    name: string;
    description: string | null;
    cards: Card[];
};

export default function ProjectEditorPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Editing states
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');

    // Import modal
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState('');
    const [importProgress, setImportProgress] = useState('');
    const [showProxySheet, setShowProxySheet] = useState(false);
    const [showCustomCardModal, setShowCustomCardModal] = useState(false);

    // Animation state: cardId -> translateY value
    const [animatingCards, setAnimatingCards] = useState<Record<string, number>>({});
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

    // Scryfall image cache: card_name -> image URL
    const scryfallCache = useRef<Record<string, string | null>>({});

    const { addToast } = useToast();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    const fetchProject = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setProject(data.project);
                setNameValue(data.project.name);
            } else {
                setError(data.error || 'Failed to load project');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, projectId]);

    useEffect(() => { fetchProject(); }, [fetchProject]);

    // ── Project Name Editing ──
    const handleSaveName = async () => {
        if (!nameValue.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: nameValue, description: project?.description })
            });
            const data = await res.json();
            if (data.success) {
                setProject(prev => prev ? { ...prev, name: nameValue } : prev);
                setEditingName(false);
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Decklist Parser ──
    function parseDeckList(text: string): { card_name: string; quantity: number }[] {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('#'));
        const cards: { card_name: string; quantity: number }[] = [];

        for (const line of lines) {
            const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
            if (match) {
                cards.push({ card_name: match[2].trim(), quantity: parseInt(match[1], 10) });
            } else {
                cards.push({ card_name: line, quantity: 1 });
            }
        }

        return cards;
    }

    const handleImport = async () => {
        setImportError('');
        setImportProgress('');
        const parsed = parseDeckList(importText);

        if (parsed.length === 0) {
            setImportError('No valid card entries found. Use a format like "4 Lightning Bolt" or "4x Lightning Bolt".');
            return;
        }

        setSaving(true);
        const warnings: string[] = [];
        const validatedCards: { card_name: string; quantity: number }[] = [];

        // Validate each card against Scryfall
        for (let i = 0; i < parsed.length; i++) {
            const card = parsed[i];
            setImportProgress(`Validating card ${i + 1} of ${parsed.length}: ${card.card_name}...`);

            try {
                const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.card_name)}`);
                if (res.ok) {
                    const data = await res.json();
                    const scryfallName = data.name;
                    if (scryfallName.toLowerCase() !== card.card_name.toLowerCase()) {
                        warnings.push(`"${card.card_name}" not found — closest match "${scryfallName}" added`);
                    }
                    validatedCards.push({ card_name: scryfallName, quantity: card.quantity });
                    // Cache the image while we have it
                    const imgUrl = data.image_uris?.normal || data.image_uris?.small || null;
                    scryfallCache.current[scryfallName] = imgUrl;
                } else {
                    warnings.push(`"${card.card_name}" not found on Scryfall — added as-is`);
                    validatedCards.push(card);
                }
            } catch {
                // Network error, just add as-is
                validatedCards.push(card);
            }

            // Scryfall asks for 50-100ms between requests
            if (i < parsed.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        setImportProgress('Saving to project...');

        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cards: validatedCards })
            });
            const data = await res.json();
            if (data.success) {
                setShowImport(false);
                setImportText('');
                setImportProgress('');
                fetchProject();
                addToast(`${validatedCards.length} card(s) imported successfully!`, 'success');
                // Show warnings as individual toasts
                for (const w of warnings) {
                    addToast(w, 'warning', 8000);
                }
            } else {
                setImportError(data.error || 'Failed to import cards');
            }
        } catch (err: any) {
            setImportError(err.message);
        } finally {
            setSaving(false);
            setImportProgress('');
        }
    };

    // ── Card Editing ──
    const handleUpdateCard = async (card: Card, updates: Partial<Card>) => {
        const updated = { ...card, ...updates };
        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}/cards/${card.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ card_name: updated.card_name, quantity: updated.quantity, sort_order: updated.sort_order })
            });
            const data = await res.json();
            if (data.success) {
                setProject(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        cards: prev.cards.map(c => c.id === card.id ? updated : c)
                    };
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteCard = async (cardId: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}/cards/${cardId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setProject(prev => {
                    if (!prev) return prev;
                    return { ...prev, cards: prev.cards.filter(c => c.id !== cardId) };
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    // ── Sort ──
    const handleMoveCard = async (card: Card, direction: 'up' | 'down') => {
        if (!project) return;
        const cards = [...project.cards];
        const idx = cards.findIndex(c => c.id === card.id);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === cards.length - 1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const movingId = cards[idx].id;
        const displacedId = cards[swapIdx].id;

        // Measure row heights for accurate animation
        const movingRow = rowRefs.current[movingId];
        const displacedRow = rowRefs.current[displacedId];
        const movingH = movingRow?.offsetHeight ?? 41;
        const displacedH = displacedRow?.offsetHeight ?? 41;

        // Animate: the clicked card slides into the other's spot and vice-versa
        setAnimatingCards({
            [movingId]: direction === 'up' ? -displacedH : displacedH,
            [displacedId]: direction === 'up' ? movingH : -movingH,
        });

        // Wait for animation, then swap
        await new Promise(resolve => setTimeout(resolve, 200));
        setAnimatingCards({});

        const tempSort = cards[idx].sort_order;
        cards[idx].sort_order = cards[swapIdx].sort_order;
        cards[swapIdx].sort_order = tempSort;

        [cards[idx], cards[swapIdx]] = [cards[swapIdx], cards[idx]];

        setProject(prev => prev ? { ...prev, cards } : prev);

        await Promise.all([
            handleUpdateCard(cards[idx], { sort_order: cards[idx].sort_order }),
            handleUpdateCard(cards[swapIdx], { sort_order: cards[swapIdx].sort_order })
        ]);
    };

    const imageToBase64 = (url: string): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            } catch (err) {
                reject(err);
            }
        });
    };

    const handleCreateCustomCard = async (name: string, url: string) => {
        setSaving(true);
        addToast('Processing custom card...', 'info');
        try {
            // 1. Convert to base64
            const base64 = await imageToBase64(url);

            // 2. Add to custom card table
            const resCustom = await fetch(`${apiUrl}/api/custom-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ card_name: name, card_image: base64 })
            });
            const dataCustom = await resCustom.json();
            if (!dataCustom.success) throw new Error(dataCustom.error || 'Failed to save to gallery');

            // 3. Add to current project decklist
            const resProject = await fetch(`${apiUrl}/api/projects/${projectId}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cards: [{ card_name: name, quantity: 1 }] })
            });
            const dataProject = await resProject.json();
            if (!dataProject.success) throw new Error(dataProject.error || 'Failed to add to project');

            // 4. Success cleanup
            setShowCustomCardModal(false);
            fetchProject();
            addToast(`Custom card "${name}" created and added to project!`, 'success');
        } catch (err: any) {
            console.error('Custom card error:', err);
            addToast(err.message || 'Error creating custom card. (Pro-tip: Some sites block direct image access, try a different host)', 'error', 8000);
        } finally {
            setSaving(false);
        }
    };

    const totalCards = project?.cards.reduce((sum, c) => sum + c.quantity, 0) ?? 0;

    if (loading) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center p-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded max-w-md">
                    <p className="text-red-700">{error || 'Project not found'}</p>
                </div>
                <Link href="/projects" className="mt-4 text-blue-600 hover:text-blue-500 font-medium">
                    ← Back to Projects
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/projects" className="text-gray-500 hover:text-gray-700 transition-colors text-sm">
                            ← Projects
                        </Link>
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                                    className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none text-lg font-bold"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} disabled={saving} className="text-green-600 hover:text-green-700 text-sm font-medium">Save</button>
                                <button onClick={() => { setEditingName(false); setNameValue(project.name); }} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                            </div>
                        ) : (
                            <h1
                                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => setEditingName(true)}
                                title="Click to rename"
                            >
                                {project.name}
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{project.cards.length} unique · {totalCards} total</span>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-8">
                {/* Actions Bar */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => setShowImport(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer"
                    >
                        📋 Import Decklist
                    </button>
                    {project.cards.length > 0 && (
                        <button
                            onClick={() => setShowProxySheet(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer"
                        >
                            🖨 Preview Sheet
                        </button>
                    )}
                    <button
                        onClick={() => setShowCustomCardModal(true)}
                        className="bg-green-700 hover:bg-blue-700 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer"
                    >
                        + Add Custom Card
                    </button>
                </div>

                {/* Import Modal */}
                {showImport && (
                    <ImportDeckModal
                        onClose={() => setShowImport(false)}
                        onImport={handleImport}
                        importText={importText}
                        setImportText={setImportText}
                        importError={importError}
                        setImportError={setImportError}
                        importProgress={importProgress}
                        setImportProgress={setImportProgress}
                        saving={saving}
                    />
                )}

                {/* Card List */}
                {project.cards.length === 0 ? (
                    <div className="bg-blue-50/60 rounded-lg shadow-sm border border-blue-100 p-12 text-center">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">No cards yet</h2>
                        <p className="text-gray-500 mb-6">Import a decklist to add cards to this project.</p>
                        <button
                            onClick={() => setShowImport(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm px-6 py-2.5 transition-colors"
                        >
                            📋 Import Decklist
                        </button>
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {project.cards.map((card, idx) => (
                                    <CardRow
                                        key={card.id}
                                        card={card}
                                        index={idx}
                                        isFirst={idx === 0}
                                        isLast={idx === project.cards.length - 1}
                                        onUpdate={handleUpdateCard}
                                        onDelete={handleDeleteCard}
                                        onMove={handleMoveCard}
                                        animateY={animatingCards[card.id] ?? 0}
                                        rowRef={(el) => { rowRefs.current[card.id] = el; }}
                                        scryfallCache={scryfallCache}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Proxy Preview Sheet */}
            {showProxySheet && (
                <ProxySheet
                    cards={project.cards}
                    scryfallCache={scryfallCache.current}
                    onClose={() => setShowProxySheet(false)}
                />
            )}

            {/* Proxy Preview Sheet */}
            {showCustomCardModal && (
                <CustomCardModal
                    onClose={() => setShowCustomCardModal(false)}
                    onCreate={handleCreateCustomCard}
                />
            )}
        </main>
    );
}

// ── Inline Editable Card Row ──
function CardRow({ card, index, isFirst, isLast, onUpdate, onDelete, onMove, animateY, rowRef, scryfallCache }: {
    card: Card;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    onMove: (card: Card, direction: 'up' | 'down') => void;
    animateY: number;
    rowRef: (el: HTMLTableRowElement | null) => void;
    scryfallCache: React.MutableRefObject<Record<string, string | null>>;
}) {
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(card.card_name);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleNameSave = () => {
        if (nameVal.trim() && nameVal !== card.card_name) {
            onUpdate(card, { card_name: nameVal.trim() });
        }
        setEditingName(false);
    };

    const handlePreviewEnter = async () => {
        setShowPreview(true);
        if (card.custom_image) {
            setPreviewImg(card.custom_image);
            return;
        }
        const name = card.card_name;
        // Check cache first
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
        <tr
            ref={rowRef}
            className="hover:bg-blue-50/40"
            style={{
                transform: animateY !== 0 ? `translateY(${animateY}px)` : undefined,
                transition: animateY !== 0 ? 'transform 0.2s ease-in-out' : undefined,
                position: 'relative',
                zIndex: animateY !== 0 ? 10 : undefined,
            }}
        >
            <td className="px-4 py-2 text-sm text-gray-400">{index + 1}</td>
            <td className="px-2 py-2 text-center">
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
                                alt={card.card_name}
                                className="rounded-lg shadow-xl border border-gray-200"
                                style={{ width: 250, height: 'auto' }}
                            />
                        )}
                    </div>
                )}
            </td>
            <td className="px-4 py-2">
                <input
                    type="number"
                    min="1"
                    max="99"
                    value={card.quantity}
                    onChange={(e) => onUpdate(card, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-14 px-2 py-1 text-sm border border-gray-200 rounded text-center focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </td>
            <td className="px-4 py-2">
                {editingName ? (
                    <input
                        type="text"
                        value={nameVal}
                        onChange={(e) => setNameVal(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') { setNameVal(card.card_name); setEditingName(false); } }}
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                        autoFocus
                    />
                ) : (
                    <span
                        className="text-sm text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setEditingName(true)}
                        title="Click to edit"
                    >
                        {card.card_name}
                    </span>
                )}
            </td>
            <td className="px-4 py-2">
                <div className="flex gap-1">
                    <button
                        onClick={() => onMove(card, 'up')}
                        disabled={isFirst}
                        className="cursor-pointer text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1"
                        title="Move up"
                    >▲</button>
                    <button
                        onClick={() => onMove(card, 'down')}
                        disabled={isLast}
                        className="cursor-pointer text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1"
                        title="Move down"
                    >▼</button>
                </div>
            </td>
            <td className="px-4 py-2">
                <button
                    onClick={() => onDelete(card.id)}
                    className="cursor-pointer text-red-400 hover:text-red-600 transition-colors text-xs font-medium"
                >
                    ✕
                </button>
            </td>
        </tr>
    );
}
