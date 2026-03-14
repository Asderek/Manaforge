"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import ProxySheet from '../../components/ProxySheet';
import CustomCardModal from '@/app/components/CustomCardModal';
import ImportDeckModal from '@/app/components/ImportDeckModal';
import CardSearcher from '@/app/components/CardSearcher';
import { compressDeck } from '@/app/utils/deckSharing';

type Card = {
    id: string;
    card_name: string;
    quantity: number;
    category: string;
    sort_order: number;
    custom_image?: string | null;
};

type Deck = {
    id: string;
    name: string;
    description: string | null;
    cards: Card[];
};

export default function DeckEditorPage() {
    const params = useParams();
    const router = useRouter();
    const deckId = params.id as string;

    const [deck, setDeck] = useState<Deck | null>(null);
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
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [gridScale, setGridScale] = useState(1.7);

    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Animation state: cardId -> translateY value
    const [animatingCards, setAnimatingCards] = useState<Record<string, number>>({});
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

    // Tracking for keyboard shortcuts
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
    const categoryDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Scryfall data cache: card_name -> { img: URL | null, typeLine?: string }
    const scryfallCache = useRef<Record<string, { img: string | null; typeLine?: string }>>({});

    const { addToast } = useToast();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    const fetchDeck = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setDeck(data.deck);
                setNameValue(data.deck.name);
            } else {
                setError(data.error || 'Failed to load deck');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, deckId]);

    useEffect(() => { fetchDeck(); }, [fetchDeck]);

    // ── Category Utils ──
    const getCategoryFromType = (typeLine: string): string => {
        if (!typeLine) return 'Uncategorized';
        const lower = typeLine.toLowerCase();
        if (lower.includes('creature')) return 'Creatures';
        if (lower.includes('instant')) return 'Instants';
        if (lower.includes('sorcery')) return 'Sorceries';
        if (lower.includes('enchantment')) return 'Enchantments';
        if (lower.includes('artifact')) return 'Artifacts';
        if (lower.includes('planeswalker')) return 'Planeswalkers';
        if (lower.includes('land')) return 'Lands';
        return 'Other';
    };

    // ── Deck Name Editing ──
    const handleSaveName = async () => {
        if (!nameValue.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: nameValue, description: deck?.description })
            });
            const data = await res.json();
            if (data.success) {
                setDeck(prev => prev ? { ...prev, name: nameValue } : prev);
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
        const validatedCards: { card_name: string; quantity: number; category: string }[] = [];

        // Validate each card against Scryfall
        for (let i = 0; i < parsed.length; i++) {
            const card = parsed[i];
            setImportProgress(`Validating card ${i + 1} of ${parsed.length}: ${card.card_name}...`);

            try {
                const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.card_name)}`);
                if (res.ok) {
                    const data = await res.json();
                    const scryfallName = data.name;
                    const category = getCategoryFromType(data.type_line);
                    if (scryfallName.toLowerCase() !== card.card_name.toLowerCase()) {
                        warnings.push(`"${card.card_name}" not found — closest match "${scryfallName}" added`);
                    }
                    validatedCards.push({ card_name: scryfallName, quantity: card.quantity, category });
                    // Cache the image while we have it
                    const imgUrl = data.image_uris?.normal || data.image_uris?.small || null;
                    scryfallCache.current[scryfallName] = imgUrl;
                } else {
                    warnings.push(`"${card.card_name}" not found on Scryfall — added as-is`);
                    validatedCards.push({ ...card, category: 'Uncategorized' });
                }
            } catch {
                // Network error, just add as-is
                validatedCards.push({ ...card, category: 'Uncategorized' });
            }

            // Scryfall asks for 50-100ms between requests
            if (i < parsed.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        setImportProgress('Saving to deck...');

        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}/cards`, {
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
                fetchDeck();
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
    const handleUpdateCard = useCallback(async (card: Card, updates: Partial<Card>) => {
        const updated = { ...card, ...updates };
        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}/cards/${card.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ card_name: updated.card_name, quantity: updated.quantity, category: updated.category, sort_order: updated.sort_order })
            });
            const data = await res.json();
            if (data.success) {
                setDeck(prev => {
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
    }, [apiUrl, deckId]);

    const handleDeleteCard = useCallback(async (cardId: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}/cards/${cardId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setDeck(prev => {
                    if (!prev) return prev;
                    return { ...prev, cards: prev.cards.filter(c => c.id !== cardId) };
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    }, [apiUrl, deckId]);

    // ── Sort ──
    const handleMoveCard = async (card: Card, direction: 'up' | 'down') => {
        if (!deck) return;
        const cards = [...deck.cards];
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

        setDeck(prev => prev ? { ...prev, cards } : prev);

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

            // 3. Add to current deck decklist
            const resDeck = await fetch(`${apiUrl}/api/decks/${deckId}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cards: [{ card_name: name, quantity: 1 }] })
            });
            const dataDeck = await resDeck.json();
            if (!dataDeck.success) throw new Error(dataDeck.error || 'Failed to add to deck');

            // 4. Success cleanup
            setShowCustomCardModal(false);
            fetchDeck();
            addToast(`Custom card "${name}" created and added to deck!`, 'success');
        } catch (err: any) {
            console.error('Custom card error:', err);
            addToast(err.message || 'Error creating custom card. (Pro-tip: Some sites block direct image access, try a different host)', 'error', 8000);
        } finally {
            setSaving(false);
        }
    };

    const totalCards = deck?.cards.reduce((sum, c) => sum + c.quantity, 0) ?? 0;

    const groupedCards = React.useMemo(() => {
        const groups: Record<string, Card[]> = {};

        // Ensure all default categories exist in order
        const defaults = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Planeswalkers', 'Lands', 'Other'];
        defaults.forEach(cat => groups[cat] = []);

        deck?.cards.forEach(card => {
            const cat = card.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(card);
        });

        // Add user created custom categories
        customCategories.forEach(cat => {
            if (!groups[cat]) groups[cat] = [];
        });

        // Remove ALL empty groups (automatic AND custom)
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }, [deck?.cards, customCategories]);

    const handleConfirmAddCategory = () => {
        const name = newCategoryName.trim();
        if (name) {
            if (!customCategories.includes(name)) {
                setCustomCategories(prev => [...prev, name]);
                addToast(`Created category "${name}"`, 'success');
            }
            setNewCategoryName('');
            setIsAddingCategory(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, card: Card) => {
        e.dataTransfer.setData('cardId', card.id);
    };

    const handleDropOnCategory = async (e: React.DragEvent, targetCategory: string) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const card = deck?.cards.find(c => c.id === cardId);
        if (card && card.category !== targetCategory) {
            await handleUpdateCard(card, { category: targetCategory });
            addToast(`Moved ${card.card_name} to ${targetCategory}`, 'success');
        }
    };

    const cardQuantities = React.useMemo(() => {
        const counts: Record<string, number> = {};
        deck?.cards.forEach(c => {
            counts[c.card_name] = c.quantity;
        });
        return counts;
    }, [deck?.cards]);

    const handleSyncCardQuantity = useCallback(async (cardName: string, newQuantity: number, typeLine?: string) => {
        const existingCard = deck?.cards.find(c => c.card_name === cardName);

        if (newQuantity === 0) {
            if (existingCard) {
                await handleDeleteCard(existingCard.id);
                addToast(`Removed ${cardName} from deck!`, 'success');
            }
            return;
        }

        if (existingCard) {
            await handleUpdateCard(existingCard, { quantity: newQuantity });
            addToast(`Updated ${cardName} to ${newQuantity}!`, 'success');
        } else {
            setSaving(true);
            try {
                // Determine category first to avoid "Uncategorized" race condition
                let category = 'Uncategorized';
                if (typeLine) {
                    category = getCategoryFromType(typeLine);
                } else {
                    const scryRes = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                    if (scryRes.ok) {
                        const scryData = await scryRes.json();
                        category = getCategoryFromType(scryData.type_line);
                        cardName = scryData.name; // Normalize name too
                    }
                }

                const res = await fetch(`${apiUrl}/api/decks/${deckId}/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        cards: [{
                            card_name: cardName,
                            quantity: newQuantity,
                            category: category
                        }]
                    })
                });
                const data = await res.json();
                if (data.success) {
                    fetchDeck();
                    addToast(`Added ${newQuantity}x ${cardName} to ${category}!`, 'success');
                }
            } catch (err: any) {
                addToast(err.message, 'error');
            } finally {
                setSaving(false);
            }
        }
    }, [deck, apiUrl, deckId, handleDeleteCard, handleUpdateCard, fetchDeck, addToast, getCategoryFromType]);

    // ── Keyboard Shortcuts Logic ──
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore if in an input or modal
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || showImport || showSearchModal || showCustomCardModal) {
                return;
            }

            const key = e.key.toUpperCase();
            if (!['A', 'S', 'M'].includes(key) || !hoveredCardId || !deck) return;

            const card = deck.cards.find(c => c.id === hoveredCardId);
            if (!card) return;

            let targetCategory = '';
            if (key === 'S') targetCategory = 'Sideboard';
            else if (key === 'M') targetCategory = 'Maybeboard';
            else if (key === 'A') {
                // Auto-categorize
                if (scryfallCache.current[card.card_name]?.typeLine) {
                    targetCategory = getCategoryFromType(scryfallCache.current[card.card_name].typeLine!);
                } else {
                    try {
                        const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.card_name)}`);
                        if (res.ok) {
                            const data = await res.json();
                            scryfallCache.current[card.card_name] = {
                                ...scryfallCache.current[card.card_name],
                                img: data.image_uris?.normal || data.image_uris?.small || null,
                                typeLine: data.type_line
                            };
                            targetCategory = getCategoryFromType(data.type_line);
                        }
                    } catch {
                        targetCategory = 'Uncategorized';
                    }
                }
            }

            if (targetCategory && targetCategory !== card.category) {
                // Debounce the actual API call
                if (categoryDebounceTimer.current) clearTimeout(categoryDebounceTimer.current);
                
                // Immediately update local UI for snappiness
                setDeck(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        cards: prev.cards.map(c => c.id === card.id ? { ...c, category: targetCategory } : c)
                    };
                });

                categoryDebounceTimer.current = setTimeout(async () => {
                    await handleUpdateCard(card, { category: targetCategory });
                    addToast(`Updated ${card.card_name} to ${targetCategory}`, 'success');
                }, 300);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hoveredCardId, deck, showImport, showSearchModal, showCustomCardModal, handleUpdateCard, addToast, getCategoryFromType]);

    // ── Clipboard & Drag-Drop Import ──
    useEffect(() => {
        const processLinks = async (text: string) => {
            if (!text) return;

            // Look for any scryfall or edhrec links
            // Pattern matches the domain and captures everything until a space or end of string
            const linkRegex = /(?:https?:\/\/)?(?:www\.)?(scryfall\.com|edhrec\.com)\/[^\s]+/gi;
            const linkMatches = text.match(linkRegex);

            if (!linkMatches || linkMatches.length === 0) return;

            const extractedNames: string[] = [];
            for (const link of linkMatches) {
                try {
                    // Extract the last part of the path, removing query params
                    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
                    const pathParts = url.pathname.split('/').filter(p => p.length > 0);
                    if (pathParts.length > 0) {
                        const slug = pathParts[pathParts.length - 1];
                        extractedNames.push(slug.replace(/-/g, ' '));
                    }
                } catch (err) {
                    console.error('URL parse error:', err);
                }
            }

            const uniqueNames = Array.from(new Set(extractedNames));
            if (uniqueNames.length === 0) return;

            addToast(`Importing ${uniqueNames.length} card(s) from link(s)...`, 'info');

            for (const name of uniqueNames) {
                try {
                    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                    if (res.ok) {
                        const data = await res.json();
                        const scryfallName = data.name;
                        await handleSyncCardQuantity(scryfallName, 1, data.type_line);
                    } else {
                        addToast(`Card "${name}" not found.`, 'error');
                    }
                } catch (err) {
                    console.error('Import error:', err);
                }
                // Rate limit protection
                await new Promise(r => setTimeout(r, 100));
            }
        };

        const handlePaste = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const text = e.clipboardData?.getData('text');
            if (text) processLinks(text);
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            const text = e.dataTransfer?.getData('text');
            if (text) processLinks(text);
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault(); // Required to allow drop
        };

        window.addEventListener('paste', handlePaste);
        window.addEventListener('drop', handleDrop);
        window.addEventListener('dragover', handleDragOver);

        return () => {
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('drop', handleDrop);
            window.removeEventListener('dragover', handleDragOver);
        };
    }, [addToast, handleSyncCardQuantity]);


    const handleShare = () => {
        if (!deck) return;

        const hasCustomCards = deck.cards.some(c => c.custom_image);

        const portableDeck = {
            n: deck.name,
            c: deck.cards.map(c => ({
                n: c.card_name,
                q: c.quantity,
                // We strip the image here because Base64 images in URLs cause HTTP 431 (Header too large)
                i: null
            }))
        };

        const compressed = compressDeck(portableDeck);
        const url = `${window.location.origin}/portable?deck=${compressed}`;
        navigator.clipboard.writeText(url);

        if (hasCustomCards) {
            addToast('Portable link copied! Note: Custom images are excluded from portable links to keep them short.', 'warning', 6000);
        } else {
            addToast('Portable link copied to clipboard!', 'success');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !deck) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center p-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded max-w-md">
                    <p className="text-red-700">{error || 'Deck not found'}</p>
                </div>
                <Link href="/decks" className="mt-4 text-blue-600 hover:text-blue-500 font-medium">
                    ← Back to Decks
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
                        <Link href="/decks" className="text-gray-500 hover:text-gray-700 transition-colors text-sm">
                            ← Decks
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
                                <button onClick={() => { setEditingName(false); setNameValue(deck.name); }} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                            </div>
                        ) : (
                            <h1
                                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => setEditingName(true)}
                                title="Click to rename"
                            >
                                {deck.name}
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{deck.cards.length} unique · {totalCards} total</span>
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
                    {deck.cards.length > 0 && (
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
                    <button
                        onClick={handleShare}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer"
                        disabled={!deck || deck.cards.length === 0}
                    >
                        🔗 Share Portable Link
                    </button>
                    <button
                        onClick={() => setShowSearchModal(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer ml-auto"
                    >
                        🔍 Search Cards
                    </button>

                    {/* View Toggle */}
                    <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-md ml-2">
                        {viewMode === 'grid' && (
                            <div className="flex items-center gap-2 bg-white/40 px-1 py-1 rounded-lg border border-white/40 shadow-sm mr-2">
                                <button
                                    onClick={() => setGridScale(1.7)}
                                    className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale < 2.0 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-white/20'}`}
                                    title="Default Zoom"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                </button>
                                <button
                                    onClick={() => setGridScale(2.3)}
                                    className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale >= 2.0 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-white/20'}`}
                                    title="Large Zoom"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
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
                    </div>
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

                {/* Card List grouped by Category */}
                {deck.cards.length === 0 ? (
                    <div className="bg-blue-50/60 rounded-lg shadow-sm border border-blue-100 p-12 text-center">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">No cards yet</h2>
                        <p className="text-gray-500 mb-6">Import a decklist to add cards to this deck.</p>
                        <button
                            onClick={() => setShowImport(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm px-6 py-2.5 transition-colors"
                        >
                            📋 Import Decklist
                        </button>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-8" : "space-y-8"}>
                        {Object.entries(groupedCards).map(([category, cards]) => (
                            <div
                                key={category}
                                className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnCategory(e, category)}
                            >
                                <div className="bg-blue-50/80 px-4 py-2 border-b border-gray-100 flex justify-between items-center group/cat">
                                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                                        📁 {category}
                                        <span className="text-xs font-medium text-blue-400 normal-case">({cards.reduce((s, c) => s + c.quantity, 0)} cards)</span>
                                    </h3>
                                </div>
                                <div className="p-1">
                                    {viewMode === 'table' ? (
                                        <table className="min-w-full divide-y divide-gray-100">
                                            <thead className="hidden">
                                                <tr>
                                                    <th className="w-12">#</th>
                                                    <th className="w-10">👁</th>
                                                    <th className="w-20">Qty</th>
                                                    <th>Name</th>
                                                    <th className="w-32">Order</th>
                                                    <th className="w-20">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {cards.map((card, idx) => (
                                        <CardRow
                                            key={card.id}
                                            card={card}
                                            index={idx}
                                            isFirst={idx === 0}
                                            isLast={idx === cards.length - 1}
                                            onUpdate={handleUpdateCard}
                                            onDelete={handleDeleteCard}
                                            onMove={handleMoveCard}
                                            animateY={0}
                                            rowRefs={rowRefs}
                                            scryfallCache={scryfallCache}
                                            onDragStart={handleDragStart}
                                            onHover={() => setHoveredCardId(card.id)}
                                            onLeave={() => setHoveredCardId(null)}
                                        />
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <GridView
                                            cards={cards}
                                            onUpdate={handleUpdateCard}
                                            onDelete={handleDeleteCard}
                                            scryfallCache={scryfallCache}
                                            scale={gridScale}
                                            onDragStart={handleDragStart}
                                            onHoverCard={setHoveredCardId}
                                        />
                                    )}
                                    {cards.length === 0 && (
                                        <div className="py-8 text-center text-gray-400 text-sm italic">
                                            Drop cards here to move them to this category
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-center pt-8 pb-12 min-h-[100px]">
                            <div className={`relative h-[72px] transition-all duration-500 ease-in-out w-full ${isAddingCategory ? 'max-w-md' : 'max-w-[288px]'}`}>
                                {/* The "Add New" Button */}
                                <div className={`absolute inset-0 transition-all duration-500 ${!isAddingCategory ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-75 invisible pointer-events-none'}`}>
                                    <button
                                        onClick={() => setIsAddingCategory(true)}
                                        className="w-full h-full flex items-center justify-center gap-3 px-6 bg-white border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/50 transition-all group shadow-sm hover:shadow-md"
                                    >
                                        <span className="text-2xl font-light group-hover:rotate-90 transition-transform duration-300">+</span>
                                        <span className="font-bold text-xs tracking-widest uppercase">Add New Category</span>
                                    </button>
                                </div>

                                {/* The Animated Input Box */}
                                <div className={`absolute inset-0 transition-all duration-500 ${isAddingCategory ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none translate-y-2'}`}>
                                    <div className="flex items-center gap-2 bg-white border-2 border-blue-500 rounded-2xl p-1.5 shadow-xl ring-2 ring-blue-50 h-full">
                                        <input
                                            autoFocus={isAddingCategory}
                                            type="text"
                                            placeholder="Enter category name..."
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleConfirmAddCategory();
                                                if (e.key === 'Escape') setIsAddingCategory(false);
                                            }}
                                            className="flex-1 px-4 py-2 text-base font-semibold outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
                                        />
                                        <button
                                            onClick={handleConfirmAddCategory}
                                            className="bg-blue-600 text-white w-11 h-11 rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-md"
                                        >
                                            <span className="text-2xl font-bold leading-none pb-2">›</span>
                                        </button>
                                        <button
                                            onClick={() => setIsAddingCategory(false)}
                                            className="bg-red-200 text-red-500 w-11 h-11 rounded-xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Proxy Preview Sheet */}
            {showProxySheet && (
                <ProxySheet
                    cards={deck.cards}
                    scryfallCache={Object.fromEntries(
                        Object.entries(scryfallCache.current).map(([name, data]) => [name, data.img])
                    )}
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

            {showSearchModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl max-h-[90vh] flex flex-col">
                        <CardSearcher
                            onSyncQuantity={handleSyncCardQuantity}
                            onClose={() => setShowSearchModal(false)}
                            existingQuantities={cardQuantities}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}

// ── Grid View Components ──
function GridView({ cards, onUpdate, onDelete, scryfallCache, scale, onDragStart, onHoverCard }: {
    cards: Card[];
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    scryfallCache: React.MutableRefObject<Record<string, { img: string | null; typeLine?: string }>>;
    scale: number;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onHoverCard: (id: string | null) => void;
}) {
    // Standard base 100px
    const cardWidth = Math.round(100 * scale);

    return (
        <div
            className="grid gap-2 p-2"
            style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`
            }}
        >
            {cards.map(card => (
                <GridCard
                    key={card.id}
                    card={card}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    scryfallCache={scryfallCache}
                    scale={scale}
                    onDragStart={onDragStart}
                    onHover={() => onHoverCard(card.id)}
                    onLeave={() => onHoverCard(null)}
                />
            ))}
        </div>
    );
}

function GridCard({ card, onUpdate, onDelete, scryfallCache, scale, onDragStart, onHover, onLeave }: {
    card: Card;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    scryfallCache: React.MutableRefObject<Record<string, { img: string | null; typeLine?: string }>>;
    scale: number;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onHover: () => void;
    onLeave: () => void;
}) {
    const [img, setImg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (card.custom_image) {
            setImg(card.custom_image);
            return;
        }
        const fetchImg = async () => {
            const name = card.card_name;
            if (scryfallCache.current[name] !== undefined) {
                setImg(scryfallCache.current[name].img);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                if (res.ok) {
                    const data = await res.json();
                    const url = data.image_uris?.normal || data.image_uris?.small || null;
                    scryfallCache.current[name] = { img: url, typeLine: data.type_line };
                    setImg(url);
                } else {
                    scryfallCache.current[name] = { img: null };
                    setImg(null);
                }
            } catch {
                scryfallCache.current[name] = { img: null };
                setImg(null);
            } finally {
                setLoading(false);
            }
        };
        fetchImg();
    }, [card.card_name, card.custom_image, scryfallCache]);

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, card)}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className="group relative flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:border-blue-300 cursor-grab active:cursor-grabbing"
        >
            {/* Image Container */}
            <div className="aspect-[63/88] bg-gray-50 relative overflow-hidden flex items-center justify-center">
                {loading ? (
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <img
                        src={img || "/placeholder.png"}
                        alt={card.card_name}
                        className="w-full h-full object-cover select-none"
                    />
                )}

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <button
                        onClick={() => onDelete(card.id)}
                        className="self-end bg-red-600/90 hover:bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded transition-colors text-xs"
                        title="Delete card"
                    >
                        🗑
                    </button>

                    <div className="flex items-center justify-center gap-3 bg-white/10 backdrop-blur-md rounded-full py-1.5 px-3 mx-auto mb-2 border border-white/20">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (card.quantity === 1) {
                                    onDelete(card.id);
                                } else {
                                    onUpdate(card, { quantity: card.quantity - 1 });
                                }
                            }}
                            className={`flex items-center justify-center transition-all select-none ${card.quantity === 1
                                ? 'w-6 h-6 bg-red-500 rounded text-white hover:bg-red-600'
                                : 'w-4 text-white hover:text-blue-400 font-bold'
                                }`}
                        >
                            {card.quantity === 1 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            ) : "-"}
                        </button>
                        <span className="text-white font-bold text-sm min-w-[20px] text-center">{card.quantity}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate(card, { quantity: card.quantity + 1 });
                            }}
                            className="text-white hover:text-blue-400 font-bold w-4 text-center select-none"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
            {/* Info */}
            <div className="p-1 px-2 text-center bg-gray-50/50 border-t border-gray-100">
                <p className="text-[9px] font-bold text-gray-700 truncate" title={card.card_name}>
                    {card.quantity}x {card.card_name}
                </p>
            </div>
        </div>
    );
}

// ── Inline Editable Card Row ──
function CardRow({ card, index, isFirst, isLast, onUpdate, onDelete, onMove, animateY, rowRefs, scryfallCache, onDragStart, onHover, onLeave }: {
    card: Card;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    onMove: (card: Card, direction: 'up' | 'down') => void;
    animateY: number;
    rowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
    scryfallCache: React.MutableRefObject<Record<string, { img: string | null; typeLine?: string }>>;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onHover: () => void;
    onLeave: () => void;
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
            setPreviewImg(scryfallCache.current[name].img);
            return;
        }
        setPreviewLoading(true);
        try {
            const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
            if (res.ok) {
                const data = await res.json();
                const imgUrl = data.image_uris?.normal || data.image_uris?.small || null;
                scryfallCache.current[name] = { img: imgUrl, typeLine: data.type_line };
                setPreviewImg(imgUrl);
            } else {
                scryfallCache.current[name] = { img: null };
                setPreviewImg(null);
            }
        } catch {
            scryfallCache.current[name] = { img: null };
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
            ref={(el) => { rowRefs.current[card.id] = el; }}
            draggable
            onDragStart={(e) => onDragStart(e, card)}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className="hover:bg-blue-50/40 cursor-grab active:cursor-grabbing"
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
