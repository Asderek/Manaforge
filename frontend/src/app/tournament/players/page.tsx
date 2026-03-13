"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '../../components/Toast';

type Player = {
    id: string;
    name: string;
    dob: string | null;
    country: string | null;
    email: string | null;
    created_at: string;
};

export default function PlayersPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'name' | 'country' | 'created_at'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        country: '',
        email: ''
    });

    const { addToast } = useToast();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        fetchPlayers();
    }, []);

    const fetchPlayers = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/players`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setPlayers(data.players);
            }
        } catch (err) {
            addToast('Failed to fetch players', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const method = editingPlayer ? 'PUT' : 'POST';
        const url = editingPlayer ? `${apiUrl}/api/players/${editingPlayer.id}` : `${apiUrl}/api/players`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast(editingPlayer ? 'Player updated' : 'Player added', 'success');
                setShowModal(false);
                setEditingPlayer(null);
                setFormData({ name: '', dob: '', country: '', email: '' });
                fetchPlayers();
            } else {
                addToast(data.message || 'Error saving player', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (player: Player) => {
        setEditingPlayer(player);
        setFormData({
            name: player.name,
            dob: player.dob ? player.dob.split('T')[0] : '',
            country: player.country || '',
            email: player.email || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (pendingDeleteId !== id) {
            setPendingDeleteId(id);
            addToast('Click again to delete', 'warning');
            setTimeout(() => setPendingDeleteId(null), 3000);
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/players/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast('Player deleted', 'success');
                setPendingDeleteId(null);
                fetchPlayers();
            }
        } catch (err) {
            addToast('Error deleting player', 'error');
            setPendingDeleteId(null);
        }
    };

    const filteredPlayers = players
        .filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.country?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (p.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            let valA: any = a[sortField] || '';
            let valB: any = b[sortField] || '';

            if (sortField === 'created_at') {
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    const toggleSort = (field: 'name' | 'country' | 'created_at') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: 'name' | 'country' | 'created_at' }) => {
        if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>;
        return <span className="text-purple-600 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <main className="min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/tournament" className="text-gray-400 hover:text-purple-600">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Community Players</h1>
                    </div>
                    <button
                        onClick={() => {
                            setEditingPlayer(null);
                            setFormData({ name: '', dob: '', country: '', email: '' });
                            setShowModal(true);
                        }}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        + Add Player
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {/* Search and Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 opacity-50">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name, country or email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm transition-all text-gray-900"
                        />
                    </div>
                    <div className="bg-gray-100/50 px-4 py-3 rounded-xl border border-gray-200 text-xs text-gray-400 flex items-center gap-2">
                        <span className="text-purple-500 font-bold">Total:</span>
                        <span className="text-gray-900 font-normal">{filteredPlayers.length} players</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                ) : players.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                        <p className="text-gray-500 mb-4">No players found in your community yet.</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-purple-600 font-bold hover:underline"
                        >
                            Add your first player →
                        </button>
                    </div>
                ) : filteredPlayers.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
                        <p className="text-gray-500 italic">No players match your search "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th
                                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name <SortIcon field="name" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleSort('country')}
                                    >
                                        <div className="flex items-center">
                                            Country <SortIcon field="country" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Email</th>
                                    <th
                                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleSort('created_at')}
                                    >
                                        <div className="flex items-center">
                                            Joined <SortIcon field="created_at" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPlayers.map(player => (
                                    <tr key={player.id} className="hover:bg-purple-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">{player.name}</div>
                                            {player.dob && <div className="text-[10px] text-gray-400 font-medium uppercase">{new Date(player.dob).toLocaleDateString(undefined, { timeZone: 'UTC' })}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{player.country || '-'}</td>
                                        <td className="px-6 py-4 text-gray-600">{player.email || '-'}</td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(player.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-3">
                                            <button
                                                onClick={() => handleEdit(player)}
                                                className="text-blue-500 hover:text-blue-700 text-xs font-bold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(player.id)}
                                                className={`${pendingDeleteId === player.id ? 'text-red-600 scale-110' : 'text-red-400'} hover:text-red-600 text-xs font-bold transition-all`}
                                            >
                                                {pendingDeleteId === player.id ? 'Confirm?' : 'Remove'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900">
                                {editingPlayer ? 'Edit Player' : 'Add New Player'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                                    placeholder="e.g. Jon Finkel"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Birth Date</label>
                                    <input
                                        type="date"
                                        value={formData.dob}
                                        onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                                        placeholder="USA"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                                    placeholder="jon@example.com"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            {editingPlayer ? 'Saving...' : 'Adding...'}
                                        </>
                                    ) : (
                                        editingPlayer ? 'Save Changes' : 'Add Player'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


        </main>
    );
}
