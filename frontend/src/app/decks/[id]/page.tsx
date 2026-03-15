"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    created_at: string;
    custom_image?: string | null;
};

type Deck = {
    id: string;
    name: string;
    description: string | null;
    cards: Card[];
};

const SortSelector = ({ current, onChange }: { current: 'alphabetical' | 'date' | 'custom', onChange: (val: 'alphabetical' | 'date' | 'custom') => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { id: 'alphabetical', label: 'Alphabetical', icon: 'AZ' },
        { id: 'date', label: 'Date Added', icon: '📅' },
        { id: 'custom', label: 'Custom', icon: '⇅' },
    ] as const;

    const currentOpt = options.find(o => o.id === current) || options[0];

    return (
        <div
            className={`relative flex items-center bg-white border border-gray-200 rounded-md shadow-sm h-9 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'w-[420px]' : 'w-10'}`}
        // onMouseLeave={() => setIsOpen(false)}
        >
            {/* Main Toggle Button / Current Selection */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex-shrink-0 w-10 h-full flex items-center justify-center font-bold text-sm transition-colors ${isOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600'}`}
                title={`Sort: ${currentOpt.id}`}
            >
                {currentOpt.icon}
            </button>

            {/* Sliding Options */}
            <div className={`flex items-center h-full absolute left-10 transition-opacity duration-200 whitespace-nowrap ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                {options.map((opt, idx) => (
                    <React.Fragment key={opt.id}>
                        {idx === 0 && <div className="w-[1px] h-4 bg-gray-200 mx-1" />}
                        <button
                            onClick={() => {
                                onChange(opt.id);
                                setIsOpen(false);
                            }}
                            className={`px-3 h-full flex items-center justify-center transition-all hover:bg-gray-50 group gap-2`}
                            title={opt.id}
                        >
                            <span className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transform group-hover:scale-105 transition-all ${current === opt.id ? 'text-blue-600 opacity-100' : 'text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-gray-600'}`}>
                                <span className="text-sm">{opt.icon}</span>
                                <span>{opt.label}</span>
                            </span>
                        </button>
                        {idx < options.length - 1 && <div className="w-[1px] h-4 bg-gray-200" />}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
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
    const [gridScale, setGridScale] = useState(1.95);

    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Category Reordering
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [showReorderModal, setShowReorderModal] = useState(false);

    // Card Sorting & Reordering
    const [sortMode, setSortMode] = useState<'alphabetical' | 'date' | 'custom'>('alphabetical');
    const [customCardOrder, setCustomCardOrder] = useState<Record<string, string[]>>({}); // category -> cardId[]
    const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

    // Animation state: cardId -> translateY value
    const [animatingCards, setAnimatingCards] = useState<Record<string, number>>({});
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

    // Tracking for keyboard shortcuts
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
    const [hoverInfo, setHoverInfo] = useState<{ category: string, index: number } | null>(null);
    const categoryDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Scryfall data cache: card_name -> { images: string[]; typeLine?: string }
    const scryfallCache = useRef<Record<string, { images: string[]; typeLine?: string }>>({});

    const { addToast } = useToast();

    // expand grid categories handlers
    const [expandedGrids, setExpandedGrids] = useState<Record<string, boolean>>({});
    const toggleGridExpand = (category: string) => {
        setExpandedGrids(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    const fetchDeck = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/api/decks/${deckId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setDeck(data.deck);
                setNameValue(data.deck.name);
                if (data.deck.custom_categories) {
                    try {
                        setCustomCategories(JSON.parse(data.deck.custom_categories));
                    } catch (e) {
                        console.error('Failed to parse custom categories:', e);
                    }
                }
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

                    // Handle dual faces
                    const images = data.image_uris
                        ? [data.image_uris.normal || data.image_uris.small]
                        : (data.card_faces ? data.card_faces.map((f: any) => f.image_uris?.normal || f.image_uris?.small).filter(Boolean) : []);

                    scryfallCache.current[scryfallName] = { images, typeLine: data.type_line };
                    scryfallCache.current[card.card_name] = { images, typeLine: data.type_line };
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

    // ── Category Cleanup ──
    const handleCleanupCategory = useCallback(async (categoryName: string, currentCards: Card[]) => {
        if (!categoryName || categoryName === 'Uncategorized') return;

        // Check if there are any cards left in this category in the UPDATED card list
        const hasCards = currentCards.some(c => c.category === categoryName);

        if (!hasCards && customCategories.includes(categoryName)) {
            // Auto-delete the category
            const updatedCustom = customCategories.filter(cat => cat !== categoryName);
            setCustomCategories(updatedCustom);
            setCategoryOrder(prev => prev.filter(cat => cat !== categoryName));

            try {
                await fetch(`${apiUrl}/api/decks/${deckId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: deck?.name,
                        custom_categories: JSON.stringify(updatedCustom)
                    })
                });
                console.log(`Auto-cleaned category: ${categoryName}`);
            } catch (err) {
                console.error('Failed to persist auto-cleanup:', err);
            }
        }
    }, [customCategories, apiUrl, deckId, deck?.name]);

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
                const updatedCards = deck?.cards ? deck.cards.filter(c => c.id !== cardId) : [];
                const deletedCard = deck?.cards.find(c => c.id === cardId);

                setDeck(prev => {
                    if (!prev) return prev;
                    return { ...prev, cards: updatedCards };
                });

                if (deletedCard?.category) {
                    handleCleanupCategory(deletedCard.category, updatedCards);
                }
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

        // 1. Group all cards
        deck?.cards.forEach(card => {
            const cat = card.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(card);
        });

        // 2. Ensure all custom categories exist
        customCategories.forEach(cat => {
            if (!groups[cat]) groups[cat] = [];
        });

        // 3. Apply sorting within each group
        Object.keys(groups).forEach(cat => {
            if (sortMode === 'alphabetical') {
                groups[cat].sort((a, b) => a.card_name.localeCompare(b.card_name));
            } else if (sortMode === 'date') {
                groups[cat].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else if (sortMode === 'custom') {
                const customOrder = customCardOrder[cat] || [];
                if (customOrder.length > 0) {
                    const orderMap = new Map(customOrder.map((id, idx) => [id, idx]));
                    groups[cat].sort((a, b) => {
                        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
                        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
                        return idxA - idxB;
                    });
                } else {
                    groups[cat].sort((a, b) => a.card_name.localeCompare(b.card_name));
                }
            }
        });

        // 4. Convert to array and sort categories
        let categories = Object.keys(groups);

        if (categoryOrder.length > 0) {
            // Respect manual order, but handle new categories by putting them at the end
            categories.sort((a, b) => {
                const idxA = categoryOrder.indexOf(a);
                const idxB = categoryOrder.indexOf(b);

                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });
        } else {
            // Default to alphabetical
            categories.sort((a, b) => a.localeCompare(b));
        }

        return categories.map(cat => ({
            category: cat,
            cards: groups[cat]
        }));
    }, [deck?.cards, customCategories, categoryOrder, sortMode, customCardOrder]);

    // ── SRM Fix: Re-evaluate hover state when deck changes ──
    useEffect(() => {
        if (!hoverInfo || !deck) return;
        const { category, index } = hoverInfo;
        const catGroup = groupedCards.find(g => g.category === category);
        if (catGroup && catGroup.cards[index]) {
            const currentCardId = catGroup.cards[index].id;
            if (currentCardId !== hoveredCardId) {
                setHoveredCardId(currentCardId);
            }
        } else {
            setHoveredCardId(null);
        }
    }, [deck, hoverInfo, hoveredCardId, groupedCards]);



    const handleRenameCategory = useCallback(async (oldName: string, newNameRaw: string) => {
        const newName = newNameRaw.trim().toUpperCase();
        if (!newName || oldName === newName) return;

        // 1. Update cards locally
        setDeck(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                cards: prev.cards.map(card =>
                    card.category === oldName ? { ...card, category: newName } : card
                )
            };
        });

        // 2. Update custom categories & manual order locally
        const updatedCustom = customCategories.map(cat => cat === oldName ? newName : cat);
        setCustomCategories(updatedCustom);
        setCategoryOrder(prev => prev.map(cat => cat === oldName ? newName : cat));

        // 3. Persist to backend (deck-level for custom_categories and card-level for category updates)
        try {
            // Update cards that had the category
            const cardsToUpdate = deck?.cards.filter(c => c.category === oldName) || [];
            await Promise.all(cardsToUpdate.map(card =>
                fetch(`${apiUrl}/api/decks/${deckId}/cards/${card.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ category: newName })
                })
            ));

            // Update deck custom_categories
            await fetch(`${apiUrl}/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: deck?.name,
                    custom_categories: JSON.stringify(updatedCustom)
                })
            });

            addToast(`Category renamed and persisted!`, 'success');
        } catch (err) {
            console.error('Rename persistence error:', err);
            addToast('Updated locally, but failed to save to server', 'warning');
        }
    }, [addToast, customCategories, deck, apiUrl, deckId]);

    const handleDeleteCategory = useCallback(async (name: string) => {
        // 1. Check if category is empty
        const hasCards = (deck?.cards || []).some(c => c.category === name);
        if (hasCards) {
            addToast(`Cannot delete category "${name}" because it still contains cards.`, 'error');
            return;
        }

        // 2. Update locally
        const updatedCustom = customCategories.filter(cat => cat !== name);
        setCustomCategories(updatedCustom);
        setCategoryOrder(prev => prev.filter(cat => cat !== name));

        // 3. Persist to backend
        try {
            await fetch(`${apiUrl}/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: deck?.name,
                    custom_categories: JSON.stringify(updatedCustom)
                })
            });
            addToast(`Category "${name}" removed.`, 'success');
        } catch (err) {
            console.error('Delete category error:', err);
            addToast('Removed locally, but failed to save to server', 'warning');
        }
    }, [deck, customCategories, apiUrl, deckId, addToast]);


    const handleConfirmAddCategory = async () => {
        let name = newCategoryName.trim().toUpperCase();
        if (name) {
            if (!customCategories.includes(name)) {
                const updated = [...customCategories, name];
                setCustomCategories(updated);

                // Persist to backend
                try {
                    await fetch(`${apiUrl}/api/decks/${deckId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            name: deck?.name,
                            description: deck?.description,
                            custom_categories: JSON.stringify(updated)
                        })
                    });
                    addToast(`Created category "${name}"`, 'success');
                } catch (err) {
                    console.error('Failed to save category:', err);
                    addToast('Failed to save category to database', 'error');
                }
            }
            setNewCategoryName('');
            setIsAddingCategory(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, card: Card) => {
        e.dataTransfer.setData('cardId', card.id);
        e.dataTransfer.setData('sourceCategory', card.category || 'Uncategorized');
        setDraggedCardId(card.id);
    };

    const handleCardDrop = useCallback(async (e: React.DragEvent, targetCategory: string, dropIndex?: number) => {
        e.preventDefault();
        setDraggedCardId(null);
        const cardId = e.dataTransfer.getData('cardId');
        const sourceCategory = e.dataTransfer.getData('sourceCategory');

        const card = deck?.cards.find(c => c.id === cardId);
        if (!card) return;

        // 1. Optimistic UI Update: Change category immediately if needed
        if (card.category !== targetCategory) {
            const oldCategory = card.category;

            // Immediately update deck state for snappiness
            setDeck(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    cards: prev.cards.map(c => c.id === cardId ? { ...c, category: targetCategory } : c)
                };
            });

            // Persist to backend (fire and forget except for cleanup logic)
            handleUpdateCard(card, { category: targetCategory }).then(() => {
                addToast(`Moved ${card.card_name} to ${targetCategory}`, 'success');
                // Cleanup old category if it's now empty
                setDeck(currentDeck => {
                    if (oldCategory && currentDeck) {
                        handleCleanupCategory(oldCategory, currentDeck.cards);
                    }
                    return currentDeck;
                });
            });
        }

        // 2. Clear reorder indicators
        setSortMode('custom');

        // 3. Update Custom Order for BOTH categories
        setCustomCardOrder(prev => {
            const nextOrder = { ...prev };

            // A. Remove card from SOURCE category custom order if cross-category move
            if (sourceCategory && sourceCategory !== targetCategory) {
                const sourceList = nextOrder[sourceCategory] || [];
                nextOrder[sourceCategory] = sourceList.filter(id => id !== cardId);
            }

            // B. Calculate TARGET category order
            const currentTargetCards = groupedCards.find(g => g.category === targetCategory)?.cards || [];

            if (sourceCategory && sourceCategory !== targetCategory) {
                // CROSS-CATEGORY: Always insert ALPHABETICALLY as per user request
                const allCardsWithNew = [...currentTargetCards, card];
                const sortedIds = allCardsWithNew
                    .sort((a, b) => a.card_name.localeCompare(b.card_name))
                    .map(c => c.id);
                nextOrder[targetCategory] = sortedIds;
            } else {
                // INTRA-CATEGORY: Standard reordering logic
                const currentIds = currentTargetCards.map(c => c.id);
                let newTargetOrder = currentIds.filter(id => id !== cardId);

                // Insert at new position
                if (typeof dropIndex === 'number') {
                    newTargetOrder.splice(dropIndex, 0, cardId);
                } else {
                    newTargetOrder.push(cardId);
                }
                nextOrder[targetCategory] = newTargetOrder;
            }

            return nextOrder;
        });
    }, [deck, handleUpdateCard, addToast, groupedCards, handleCleanupCategory]);

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
            if (!['A', 'S', 'M', 'G', 'T'].includes(key) || !deck) return;

            if (key === 'G') {
                setViewMode('grid')
            } else if (key === 'T') {
                setViewMode('table')
            }

            if (!hoveredCardId) return;

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
                            const images = data.image_uris
                                ? [data.image_uris.normal || data.image_uris.small]
                                : (data.card_faces ? data.card_faces.map((f: any) => f.image_uris?.normal || f.image_uris?.small).filter(Boolean) : []);
                            scryfallCache.current[card.card_name] = {
                                images,
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
                const oldCategory = card.category;

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

                    if (oldCategory) {
                        const updatedCards = deck.cards.map(c =>
                            c.id === card.id ? { ...c, category: targetCategory } : c
                        );
                        handleCleanupCategory(oldCategory, updatedCards);
                    }
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

    const hasSingleCategory = groupedCards.length === 1;

    return (
        <main className="min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="w-full px-8 flex items-center justify-between">
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

            <div className="w-full p-8">
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

                    <div className={`relative h-9 transition-all duration-300 ${isAddingCategory ? 'w-64' : 'w-40'} ml-auto`}>
                        {/* Compact Add Button */}
                        <div className={`absolute inset-0 transition-all duration-300 ${!isAddingCategory ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-75 invisible pointer-events-none'}`}>
                            <button
                                onClick={() => setIsAddingCategory(true)}
                                className="w-full h-full flex items-center justify-center gap-2 px-3 bg-white border border-gray-200 rounded-md text-gray-600 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-all group shadow-sm text-xs font-bold uppercase tracking-wider"
                            >
                                <span className="text-lg">+</span>
                                <span>Add Category</span>
                            </button>
                        </div>

                        {/* Compact Input Box */}
                        <div className={`absolute inset-0 transition-all duration-300 ${isAddingCategory ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'}`}>
                            <div className="flex items-center gap-1 bg-white border border-blue-500 rounded-md p-0.5 shadow-md h-full">
                                <input
                                    autoFocus={isAddingCategory}
                                    type="text"
                                    placeholder="Category name..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleConfirmAddCategory();
                                        if (e.key === 'Escape') setIsAddingCategory(false);
                                    }}
                                    className="flex-1 px-2 text-xs font-semibold outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
                                />
                                <button
                                    onClick={handleConfirmAddCategory}
                                    className="bg-blue-600 text-white w-7 h-7 rounded flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
                                >
                                    <span className="font-bold pb-0.5">›</span>
                                </button>
                                <button
                                    onClick={() => setIsAddingCategory(false)}
                                    className="bg-red-400 text-red-1000 w-7 h-7 rounded flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowReorderModal(true)}
                        className="bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 font-bold rounded-md text-xs px-3 py-2 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1 uppercase tracking-tight"
                        title="Reorder Categories"
                    >
                        <span>Categories</span>
                        <span>⇅</span>
                    </button>

                    <SortSelector
                        current={sortMode}
                        onChange={setSortMode}
                    />

                    <button
                        onClick={() => setShowSearchModal(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md text-sm px-4 py-2 transition-colors cursor-pointer"
                    >
                        🔍 Search Cards
                    </button>

                    {/* View Toggle */}
                    <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-md ml-2">
                        {viewMode === 'grid' && (
                            <div className="flex items-center gap-2 bg-white/40 px-1 py-1 rounded-lg border border-white/40 shadow-sm mr-2">
                                <button
                                    onClick={() => setGridScale(1.95)}
                                    className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale < 2.1 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-white/20'}`}
                                    title="Default Zoom"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                </button>
                                <button
                                    onClick={() => setGridScale(2.3)}
                                    className={`w-14 h-8 flex items-center justify-center rounded-md transition-all ${gridScale >= 2.1 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-white/20'}`}
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
                ) : viewMode === 'table' ? (
                    /* Unified Table View for perfect column alignment */
                    <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="min-w-full">
                            <thead className="hidden">
                                <tr>
                                    <th className="w-8"></th>
                                    <th className="w-12">#</th>
                                    <th className="w-10">👁</th>
                                    <th className="w-20">Qty</th>
                                    <th>Name</th>
                                    <th className="w-20 text-right">Actions</th>
                                </tr>
                            </thead>
                            {groupedCards.map(({ category, cards: catCards }) => {
                                const isForeign = draggedCardId !== null && !catCards.some(c => c.id === draggedCardId);
                                return (
                                    <TableView
                                        key={category}
                                        categoryName={category}
                                        cards={catCards}
                                        draggedCardId={draggedCardId}
                                        isForeign={isForeign}
                                        onUpdate={handleUpdateCard}
                                        onDelete={handleDeleteCard}
                                        rowRefs={rowRefs}
                                        scryfallCache={scryfallCache}
                                        onDragStart={handleDragStart}
                                        onDragEnd={() => setDraggedCardId(null)}
                                        onHoverCard={(id: string | null, index?: number) => {
                                            setHoveredCardId(id);
                                            setHoverInfo(id ? { category, index: index ?? 0 } : null);
                                        }}
                                        onDrop={(e, dropIdx) => handleCardDrop(e, category, dropIdx)}
                                    />
                                );
                            })}
                        </table>
                    </div>
                ) : (
                    /* Categorized Grid View Shelves */
                    <div className={`grid grid-cols-1 ${hasSingleCategory ? '' : 'xl:grid-cols-2'} gap-8`}>
                        {groupedCards.map(({ category, cards }) => (
                            <div
                                key={category}
                                className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleCardDrop(e, category)}
                            >
                                <div className="bg-blue-50/80 px-4 py-2 border-b border-gray-100 flex justify-between items-center group/cat">
                                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                                        📁 {category}
                                        <span className="text-xs font-medium text-blue-400 normal-case">({cards.reduce((s: number, c: Card) => s + c.quantity, 0)} cards)</span>
                                    </h3>
                                    <button
                                        onClick={() => toggleGridExpand(category)}
                                        className="text-xs font-bold text-blue-600 bg-white/60 hover:bg-white px-2 py-1 rounded shadow-sm transition-colors"
                                    >
                                        {expandedGrids[category] ? '⏶ Collapse' : '⏵ Expand'}
                                    </button>
                                </div>
                                <div className="p-1">
                                    <GridView
                                        cards={cards}
                                        onUpdate={handleUpdateCard}
                                        onDelete={handleDeleteCard}
                                        scryfallCache={scryfallCache}
                                        scale={gridScale}
                                        onDragStart={handleDragStart}
                                        onHoverCard={(id: string | null, index?: number) => {
                                            setHoveredCardId(id);
                                            setHoverInfo(id ? { category, index: index ?? 0 } : null);
                                        }}
                                        onDrop={(e, dropIdx) => handleCardDrop(e, category, dropIdx)}
                                        draggedCardId={draggedCardId}
                                        isExpanded={!!expandedGrids[category]}
                                        isForeign={draggedCardId !== null && !cards.some(c => c.id === draggedCardId)}
                                        categoryName={category}
                                    />
                                    {cards.length === 0 && (
                                        <div className="py-8 text-center text-gray-400 text-sm italic">
                                            Drop cards here to move them to this category
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Proxy Preview Sheet */}
            {showProxySheet && (
                <ProxySheet
                    cards={deck.cards}
                    scryfallCache={Object.fromEntries(
                        Object.entries(scryfallCache.current).map(([name, data]) => [name, data.images[0]])
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
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setShowSearchModal(false)}
                >
                    <div
                        className="w-full max-w-6xl max-h-[90vh] flex flex-col cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CardSearcher
                            onSyncQuantity={handleSyncCardQuantity}
                            onClose={() => setShowSearchModal(false)}
                            existingQuantities={cardQuantities}
                        />
                    </div>
                </div>
            )}
            {showReorderModal && (
                <CategoryReorderModal
                    categories={groupedCards.map(g => g.category)}
                    onOrderChange={setCategoryOrder}
                    onRenameCategory={handleRenameCategory}
                    onDeleteCategory={handleDeleteCategory}
                    onClose={() => setShowReorderModal(false)}
                />
            )}
        </main>
    );
}

function CategoryReorderModal({ categories, onOrderChange, onRenameCategory, onDeleteCategory, onClose }: {
    categories: string[];
    onOrderChange: (newOrder: string[]) => void;
    onRenameCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (name: string) => void;
    onClose: () => void;
}) {
    const [localOrder, setLocalOrder] = useState(categories);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleDragStart = (idx: number) => {
        if (editingIndex !== null) return;
        setDraggedIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === idx || editingIndex !== null) return;

        const newOrder = [...localOrder];
        const draggedItem = newOrder[draggedIndex];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(idx, 0, draggedItem);
        setLocalOrder(newOrder);
        setDraggedIndex(idx);
    };

    const handleStartRename = (idx: number, name: string) => {
        setEditingIndex(idx);
        setEditValue(name);
    };

    const handleConfirmRename = (idx: number) => {
        const oldName = localOrder[idx];
        const newName = editValue.trim().toUpperCase();
        if (newName && oldName !== newName) {
            onRenameCategory(oldName, newName);
            const nextOrder = [...localOrder];
            nextOrder[idx] = newName;
            setLocalOrder(nextOrder);
        }
        setEditingIndex(null);
    };

    const handleDelete = (name: string) => {
        onDeleteCategory(name);
        setLocalOrder(prev => prev.filter(c => c !== name));
    };

    const handleSave = () => {
        onOrderChange(localOrder);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Reorder & Rename</h2>
                        <p className="text-xs text-gray-400 mt-1">Drag to reorder, use pencil to rename</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
                    {localOrder.map((cat, idx) => (
                        <div
                            key={cat}
                            draggable={editingIndex === null}
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={() => setDraggedIndex(null)}
                            className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border transition-all ${editingIndex === null ? 'cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50/30' : ''
                                } ${draggedIndex === idx ? 'opacity-30 border-blue-500 scale-95' : ''
                                }`}
                        >
                            <span className="text-gray-400 font-mono text-xs">⠿</span>

                            {editingIndex === idx ? (
                                <div className="flex-1 flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleConfirmRename(idx);
                                            if (e.key === 'Escape') setEditingIndex(null);
                                        }}
                                        className="flex-1 px-2 py-1 bg-white border border-blue-500 rounded text-sm font-semibold outline-none shadow-sm"
                                    />
                                    <button
                                        onClick={() => handleConfirmRename(idx)}
                                        className="text-green-600 hover:text-green-700 p-1"
                                        title="Confirm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </button>
                                    <button
                                        onClick={() => setEditingIndex(null)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                        title="Cancel"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm font-semibold text-gray-700">{cat}</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleStartRename(idx, cat)}
                                            className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                                            title="Rename category"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat)}
                                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                            title="Delete category"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        Apply Order
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Grid View Components ──
function GridView({ cards, onUpdate, onDelete, scryfallCache, scale, onDragStart, onHoverCard, onDrop, draggedCardId, isExpanded, isForeign, categoryName }: {
    cards: Card[];
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    scryfallCache: React.MutableRefObject<Record<string, { images: string[]; typeLine?: string }>>;
    scale: number;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onHoverCard: (id: string | null, index?: number) => void;
    onDrop: (e: React.DragEvent, index?: number) => void;
    draggedCardId: string | null;
    isExpanded: boolean;
    isForeign: boolean;
    categoryName: string;
}) {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isBlockDragOver, setIsBlockDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    useEffect(() => {
        if (!draggedCardId) {
            setDragOverIndex(null);
        }
    }, [draggedCardId]);

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.stopPropagation();
        setDragOverIndex(null);
        onDrop(e, index);
    };

    // Standard base 100px
    const cardWidth = Math.round(100 * scale);
    // Calculate the class dynamically based on the prop
    const containerClass = isExpanded
        ? "flex flex-wrap gap-4 p-4 min-h-[200px]"
        : "flex flex-row overflow-x-auto pb-6 gap-4 p-4 min-h-[200px] custom-scrollbar";

    return (
        <div
            className={`${containerClass} relative`}
            onDragEnter={(e) => {
                if (isForeign) {
                    e.preventDefault();
                    setIsBlockDragOver(true);
                }
            }}
            onDragLeave={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
                    setIsBlockDragOver(false);
                }
            }}
            onMouseLeave={() => {
                setDragOverIndex(null);
                setIsBlockDragOver(false);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                if (isForeign) {
                    setIsBlockDragOver(true);
                    setDragOverIndex(null);
                }
            }}
            onDrop={(e) => {
                e.stopPropagation();
                setIsBlockDragOver(false);
                setDragOverIndex(null);
                onDrop(e, isForeign ? undefined : (dragOverIndex ?? undefined));
            }}
        >
            {/* Block Drag Overlay for Grid */}
            {isForeign && isBlockDragOver && (
                <div className="pointer-events-none absolute inset-0 z-[100] flex flex-col items-center justify-center w-full h-full bg-blue-600/20 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-lg animate-in fade-in zoom-in duration-200">
                    <div className="bg-blue-600 text-white p-3 rounded-full shadow-2xl mb-3 scale-125 animate-bounce">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-3 3 3" /><path d="M19 13V21" /><path d="M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /><path d="M21 7V3" /><path d="M21 11V3" /></svg>
                    </div>
                    <span className="text-blue-800 font-black text-lg uppercase tracking-[0.2em] drop-shadow-md">
                        Drop to move to {categoryName}
                    </span>
                </div>
            )}
            {cards.map((card, idx) => {
                let shift = 0;
                if (dragOverIndex !== null && idx >= dragOverIndex) {
                    shift = Math.round(100 * scale) + 16; // width + gap
                }

                return (
                    <GridCard
                        key={card.id}
                        card={card}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        scryfallCache={scryfallCache}
                        scale={scale}
                        index={idx}
                        shift={shift}
                        onDragStart={onDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onHover={(idx: number) => onHoverCard(card.id, idx)}
                        onLeave={() => onHoverCard(null)}
                    />
                );
            })}
        </div>
    );
}

// ── Table View Components ──
function TableView({ categoryName, cards, draggedCardId, isForeign, onUpdate, onDelete, rowRefs, scryfallCache, onDragStart, onDragEnd, onHoverCard, onDrop }: {
    categoryName: string;
    cards: Card[];
    draggedCardId: string | null;
    isForeign: boolean;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    rowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
    scryfallCache: React.MutableRefObject<Record<string, { images: string[]; typeLine?: string }>>;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onDragEnd: () => void;
    onHoverCard: (id: string | null, index?: number) => void;
    onDrop: (e: React.DragEvent, index?: number) => void;
}) {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isBlockDragOver, setIsBlockDragOver] = useState(false);

    useEffect(() => {
        if (!draggedCardId) {
            setDragOverIndex(null);
        }
    }, [draggedCardId]);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.stopPropagation();
        setDragOverIndex(null);
        onDrop(e, index);
    };

    const draggedIndexInThisCat = draggedCardId ? cards.findIndex(c => c.id === draggedCardId) : -1;

    return (
        <tbody
            className="divide-y divide-gray-50 relative"
            onDragEnter={(e) => {
                if (isForeign) {
                    e.preventDefault();
                    setIsBlockDragOver(true);
                }
            }}
            onDragLeave={(e) => {
                // Check if we are really leaving the tbody or just entering a child
                const rect = e.currentTarget.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
                    setIsBlockDragOver(false);
                }
            }}
            onMouseLeave={() => {
                setDragOverIndex(null);
                setIsBlockDragOver(false);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                if (isForeign) {
                    setIsBlockDragOver(true);
                    setDragOverIndex(null); // Clear individual row shifts for block drag
                }
            }}
            onDrop={(e) => {
                e.stopPropagation();
                setIsBlockDragOver(false);
                setDragOverIndex(null);

                // If dropping on block (foreign), index is undefined
                // If dropping on specific row (intra-category), index is provided by handleDrop
                onDrop(e, isForeign ? undefined : (dragOverIndex ?? undefined));
            }}
        >
            {/* Block Drag Overlay */}
            {isForeign && isBlockDragOver && (
                <tr className="pointer-events-none absolute inset-0 z-[100] block w-full h-full">
                    <td className="block w-full h-full p-0 border-none">
                        <div className="flex flex-col items-center justify-center w-full h-full bg-blue-600/20 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-lg animate-in fade-in zoom-in duration-200">
                            <div className="bg-blue-600 text-white p-3 rounded-full shadow-2xl mb-3 scale-125 animate-bounce">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-3 3 3" /><path d="M19 13V21" /><path d="M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /><path d="M21 7V3" /><path d="M21 11V3" /></svg>
                            </div>
                            <span className="text-blue-800 font-black text-lg uppercase tracking-[0.2em] drop-shadow-md">
                                Drop to move to {categoryName}
                            </span>
                        </div>
                    </td>
                </tr>
            )}
            {/* Category Header Row */}
            <tr className="bg-blue-50/80 group/cat sticky top-0 z-20">
                <td colSpan={6} className="px-4 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                        📁 {categoryName}
                        <span className="text-xs font-medium text-blue-400 normal-case">({cards.reduce((s: number, c: Card) => s + c.quantity, 0)} cards)</span>
                    </h3>
                </td>
            </tr>

            {cards.length === 0 ? (
                <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-sm italic bg-white/30">
                        Drop cards here to move them to this category
                    </td>
                </tr>
            ) : (
                cards.map((card, idx) => {
                    let shiftY = 0;
                    const rowHeight = 45; // Match fixed height in CardRow
                    const isDragged = card.id === draggedCardId;

                    if (dragOverIndex !== null && !isForeign) {
                        if (isDragged) {
                            // The row being dragged slides to the target slot
                            shiftY = (dragOverIndex - idx) * rowHeight;
                        } else if (draggedIndexInThisCat !== -1) {
                            // Fluid swap logic within the same category
                            if (draggedIndexInThisCat < dragOverIndex) {
                                // Dragging DOWN: rows between original and target shift UP
                                if (idx > draggedIndexInThisCat && idx <= dragOverIndex) {
                                    shiftY = -rowHeight;
                                }
                            } else if (draggedIndexInThisCat > dragOverIndex) {
                                // Dragging UP: rows between target and original shift DOWN
                                if (idx >= dragOverIndex && idx < draggedIndexInThisCat) {
                                    shiftY = rowHeight;
                                }
                            }
                        } else {
                            // If dragging from ANOTHER category (draggedIndexInThisCat === -1)
                            // Standard "open gap" logic
                            if (idx >= dragOverIndex) {
                                shiftY = rowHeight;
                            }
                        }
                    }

                    return (
                        <CardRow
                            key={card.id}
                            card={card}
                            index={idx}
                            isFirst={idx === 0}
                            isLast={idx === cards.length - 1}
                            shiftY={shiftY}
                            isDragged={isDragged}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            rowRefs={rowRefs}
                            scryfallCache={scryfallCache}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onDragEnter={(e) => !isDragged && handleDragOver(e, idx)}
                            onDragOver={(e) => !isDragged && handleDragOver(e, idx)}
                            onDrop={(e) => !isDragged && handleDrop(e, idx)}
                            onHover={() => onHoverCard(card.id, idx)}
                            onLeave={() => onHoverCard(null)}
                        />
                    );
                })
            )}
        </tbody>
    );
}

function GridCard({ card, onUpdate, onDelete, scryfallCache, scale, index, shift, onDragStart, onDragOver, onDrop, onHover, onLeave }: {
    card: Card;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    scryfallCache: React.MutableRefObject<Record<string, { images: string[]; typeLine?: string }>>;
    scale: number;
    index: number;
    shift: number;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onDragOver: (e: React.DragEvent, index: number) => void;
    onDrop: (e: React.DragEvent, index: number) => void;
    onHover: (index: number) => void;
    onLeave: () => void;
}) {
    const [images, setImages] = useState<string[]>([]);
    const [faceIndex, setFaceIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        if (card.custom_image) {
            setImages([card.custom_image]);
            return;
        }
        const fetchImg = async () => {
            const name = card.card_name;
            if (scryfallCache.current[name] !== undefined) {
                setImages(scryfallCache.current[name].images);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                if (res.ok) {
                    const data = await res.json();
                    const imgs = data.image_uris
                        ? [data.image_uris.normal || data.image_uris.small]
                        : (data.card_faces ? data.card_faces.map((f: any) => f.image_uris?.normal || f.image_uris?.small).filter(Boolean) : []);
                    scryfallCache.current[name] = { images: imgs, typeLine: data.type_line };
                    setImages(imgs);
                } else {
                    scryfallCache.current[name] = { images: [] };
                    setImages([]);
                }
            } catch {
                scryfallCache.current[name] = { images: [] };
                setImages([]);
            } finally {
                setLoading(false);
            }
        };
        fetchImg();
    }, [card.card_name, card.custom_image, scryfallCache]);

    const handleFlip = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFlipping) return;

        setIsFlipping(true);
        setTimeout(() => {
            setFaceIndex((prev) => (prev + 1) % images.length);
            setIsFlipping(false);
        }, 150);
    };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, card)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => onDrop(e, index)}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={onLeave}
            className="group relative flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all transition-[width,transform] duration-300 ease-in-out hover:shadow-md hover:border-blue-300 cursor-grab active:cursor-grabbing flex-shrink-0"
            style={{
                width: Math.round(100 * scale),
                transform: shift ? `translateX(${shift}px)` : undefined,
            }}
        >
            {/* Image Container */}
            <div className="aspect-[63/88] bg-gray-50 relative overflow-hidden flex items-center justify-center">
                {loading ? (
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <img
                        src={images[faceIndex] || "/placeholder.png"}
                        alt={card.card_name}
                        className="w-full h-full object-cover select-none transition-transform duration-150 ease-in-out"
                        style={{ transform: isFlipping ? 'scaleX(0)' : 'scaleX(1)' }}
                    />
                )}

                {/* Flip Button Overlay */}
                {images.length > 1 && (
                    <button
                        onClick={handleFlip}
                        className="absolute bottom-2 right-2 bg-purple-600/80 hover:bg-purple-600 text-white w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md border border-white/20 transition-all active:scale-90 z-20 shadow-lg"
                        title="Flip card"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21l-4-4 4-4" /><path d="M3 17h18" /><path d="M17 3l4 4-4 4" /><path d="M21 7H3" /></svg>
                    </button>
                )}

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 ">
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

function CardRow({ card, index, isFirst, isLast, shiftY, isDragged, onUpdate, onDelete, rowRefs, scryfallCache, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, onHover, onLeave }: {
    card: Card;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    shiftY: number;
    isDragged: boolean;
    onUpdate: (card: Card, updates: Partial<Card>) => void;
    onDelete: (id: string) => void;
    rowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
    scryfallCache: React.MutableRefObject<Record<string, { images: string[]; typeLine?: string }>>;
    onDragStart: (e: React.DragEvent, card: Card) => void;
    onDragEnd: () => void;
    onDragEnter: (e: React.DragEvent, index: number) => void;
    onDragOver: (e: React.DragEvent, index: number) => void;
    onDrop: (e: React.DragEvent, index: number) => void;
    onHover: (index: number) => void;
    onLeave: () => void;
}) {
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(card.card_name);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [faceIndex, setFaceIndex] = useState(0);
    const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);
    const [showFlipHint, setShowFlipHint] = useState(false);
    const flipHintTimer = useRef<NodeJS.Timeout | null>(null);

    const handleNameSave = () => {
        if (nameVal.trim() && nameVal !== card.card_name) {
            onUpdate(card, { card_name: nameVal.trim() });
        }
        setEditingName(false);
    };

    const handlePreviewEnter = async () => {
        setShowPreview(true);
        if (card.custom_image) {
            setPreviewImages([card.custom_image]);
            return;
        }
        const name = card.card_name;
        // Check cache first
        if (scryfallCache.current[name] !== undefined) {
            const imgs = scryfallCache.current[name].images;
            setPreviewImages(imgs);
            if (imgs.length > 1) {
                setShowFlipHint(true);
                if (flipHintTimer.current) clearTimeout(flipHintTimer.current);
                flipHintTimer.current = setTimeout(() => setShowFlipHint(false), 3000);
            }
            return;
        }
        setPreviewLoading(true);
        try {
            const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
            if (res.ok) {
                const data = await res.json();
                const imgs = data.image_uris
                    ? [data.image_uris.normal || data.image_uris.small]
                    : (data.card_faces ? data.card_faces.map((f: any) => f.image_uris?.normal || f.image_uris?.small).filter(Boolean) : []);
                scryfallCache.current[name] = { images: imgs, typeLine: data.type_line };
                setPreviewImages(imgs);
                if (imgs.length > 1) {
                    setShowFlipHint(true);
                    if (flipHintTimer.current) clearTimeout(flipHintTimer.current);
                    flipHintTimer.current = setTimeout(() => setShowFlipHint(false), 3000);
                }
            } else {
                scryfallCache.current[name] = { images: [] };
                setPreviewImages([]);
            }
        } catch {
            scryfallCache.current[name] = { images: [] };
            setPreviewImages([]);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handlePreviewMove = (e: React.MouseEvent) => {
        setPreviewPos({ x: e.clientX - 270, y: e.clientY - 100 });
    };

    const handleToggleFlip = (e: React.MouseEvent) => {
        if (previewImages.length > 1 && !isFlipping) {
            e.stopPropagation();
            setIsFlipping(true);
            setTimeout(() => {
                setFaceIndex(prev => (prev + 1) % previewImages.length);
                setIsFlipping(false);
            }, 150);
        }
    };

    const handlePreviewLeave = () => {
        setShowPreview(false);
        setPreviewImages([]);
        setFaceIndex(0);
        setPreviewLoading(false);
        setShowFlipHint(false);
        if (flipHintTimer.current) clearTimeout(flipHintTimer.current);
    };

    return (
        <tr
            ref={(el) => { rowRefs.current[card.id] = el; }}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => onDrop(e, index)}
            onDragStart={(e) => onDragStart(e, card)}
            onDragEnd={onDragEnd}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={onLeave}
            className={`hover:bg-blue-50/40 border-b border-gray-50 group/row transition-[background-color,opacity] duration-300 ease-out h-[45px] ${shiftY !== 0 ? 'z-10 relative' : ''} ${isDragged ? 'opacity-40 bg-blue-50/20' : 'opacity-100'}`}
            style={{ transform: shiftY ? `translateY(${shiftY}px)` : undefined }}
        >
            <td className="px-2 py-2 text-center">
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, card)}
                    className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-500 transition-colors py-1"
                    title="Drag to reorder"
                >
                    ⠿
                </div>
            </td>
            <td className="px-4 py-2 text-sm text-gray-400">{index + 1}</td>
            <td className="px-2 py-2 text-center">
                <span
                    className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors text-sm select-none"
                    onMouseEnter={handlePreviewEnter}
                    onMouseMove={handlePreviewMove}
                    onMouseLeave={handlePreviewLeave}
                    onClick={handleToggleFlip}
                >
                    👁
                </span>
                {showPreview && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed z-[100] pointer-events-none group/preview"
                        style={{ left: previewPos.x, top: previewPos.y }}
                    >
                        {previewLoading ? (
                            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-xs text-gray-500">
                                Loading...
                            </div>
                        ) : (
                            <div className="relative">
                                <img
                                    src={previewImages[faceIndex] || '/placeholder.png'}
                                    alt={card.card_name}
                                    className="rounded-lg shadow-2xl border border-white/20 transition-transform duration-150 ease-in-out"
                                    style={{
                                        width: 250,
                                        height: 'auto',
                                        transform: isFlipping ? 'scaleX(0)' : 'scaleX(1)'
                                    }}
                                />
                                {previewImages.length > 1 && showFlipHint && (
                                    <div className="absolute bottom-4 right-4 bg-black/60 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/20 animate-in fade-in duration-300">
                                        Click 👁 to flip
                                    </div>
                                )}
                            </div>
                        )}
                    </div>,
                    document.body
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
            <td className="px-4 py-2 text-right">
                <button
                    onClick={() => onDelete(card.id)}
                    className="p-1 px-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors cursor-pointer"
                    title="Delete card"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                </button>
            </td>
        </tr>
    );
}
