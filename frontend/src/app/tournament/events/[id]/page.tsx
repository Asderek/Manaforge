"use client";

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useToast } from '../../../components/Toast';

type Player = { id: string; name: string };
type Tournament = {
    id: string;
    name: string;
    num_tables: number;
    status: string;
    start_date: string;
    end_date: string;
};

type Registration = {
    id: string;
    player_id: string;
    player_name: string;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    dropped: boolean;
};

type Match = {
    id: string;
    round_number: number;
    p1_id: string;
    p1_name: string;
    p2_id: string;
    p2_name: string;
    p1_score: number;
    p2_score: number;
    draws: number;
    status: string;
    table_number: number;
    scheduled_at: string | null;
};

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = use(params);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'standings' | 'matches'>('standings');
    
    // UI state
    const [showRegModal, setShowRegModal] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showMapModal, setShowMapModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<number | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const { addToast } = useToast();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        loadData();
    }, [tournamentId]);

    const loadData = async () => {
        try {
            const [tRes, rRes, mRes, pRes] = await Promise.all([
                fetch(`${apiUrl}/api/tournaments/${tournamentId}`, { credentials: 'include' }),
                fetch(`${apiUrl}/api/tournaments/${tournamentId}/registrations`, { credentials: 'include' }),
                fetch(`${apiUrl}/api/tournaments/${tournamentId}/matches`, { credentials: 'include' }),
                fetch(`${apiUrl}/api/players`, { credentials: 'include' })
            ]);

            const [tData, rData, mData, pData] = await Promise.all([
                tRes.json(), rRes.json(), mRes.json(), pRes.json()
            ]);

            if (tData.success) setTournament(tData.tournament);
            if (rData.success) setRegistrations(rData.registrations);
            if (mData.success) setMatches(mData.matches);
            if (pData.success) setAllPlayers(pData.players);
        } catch (err) {
            addToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!selectedPlayerId) return;
        try {
            const res = await fetch(`${apiUrl}/api/tournaments/${tournamentId}/registrations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: selectedPlayerId }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast('Player registered', 'success');
                setShowRegModal(false);
                setSelectedPlayerId(''); // Reset selection
                loadData();
            } else {
                addToast(data.message || 'Error registering player', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        }
    };

    const handleRemoveRegistration = async (regId: string) => {
        if (pendingDeleteId !== regId) {
            setPendingDeleteId(regId);
            addToast('Click again to confirm removal', 'warning');
            setTimeout(() => setPendingDeleteId(null), 3000);
            return;
        }
        try {
            const res = await fetch(`${apiUrl}/api/tournaments/${tournamentId}/registrations/${regId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast('Registration removed', 'success');
                setPendingDeleteId(null);
                loadData();
            }
        } catch (err) {
            addToast('Error removing registration', 'error');
            setPendingDeleteId(null);
        }
    };

    const handleGenerateRounds = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch(`${apiUrl}/api/tournaments/${tournamentId}/pairings`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast(`Round ${data.round} generated!`, 'success');
                setActiveTab('matches');
                loadData();
            } else {
                addToast(data.message || 'Error generating rounds', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const getTimeSlots = () => {
        if (!tournament) return [];
        const start = new Date(tournament.start_date);
        const end = new Date(tournament.end_date);
        const slots = [];
        let current = new Date(start);
        
        while (current < end) {
            const next = new Date(current.getTime() + 2 * 60 * 60 * 1000);
            slots.push({
                start: current.toISOString(),
                label: `${current.getHours().toString().padStart(2, '0')}:00 - ${next.getHours().toString().padStart(2, '0')}:00`
            });
            current = next;
        }
        return slots;
    };

    const handleAssignMatch = async (matchId: string, table: number, slot: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/tournaments/${tournamentId}/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_number: table,
                    scheduled_at: slot,
                    status: 'ongoing'
                }),
                credentials: 'include'
            });
            if (res.ok) {
                addToast('Match assigned successfully', 'success');
                loadData();
            }
        } catch (err) {
            addToast('Failed to assign match', 'error');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
    );

    if (!tournament) return <div>Tournament not found</div>;

    return (
        <main className="min-h-screen">
            {/* Contextual Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-4 mb-2">
                        <Link href="/tournament/events" className="text-gray-400 hover:text-blue-600">← Events</Link>
                        <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold px-2 py-0.5 bg-blue-50 border border-blue-100 rounded">
                            {tournament.status}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-black text-gray-900">{tournament.name}</h1>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setSelectedPlayerId('');
                                    setShowRegModal(true);
                                }}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm text-sm"
                            >
                                + Register Player
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-8 mt-6">
                        <button 
                            onClick={() => setActiveTab('standings')}
                            className={`pb-4 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'standings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Standings ({registrations.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('matches')}
                            className={`pb-4 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'matches' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Match History ({matches.length})
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {/* Arena Control Panel */}
                <div className="mb-8">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Arena Control Panel</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <button 
                            onClick={handleGenerateRounds}
                            disabled={isGenerating || (registrations.length < 2) || (matches.length > 0)}
                            className="bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none flex flex-col items-center justify-center gap-2 group"
                        >
                            <span className="text-2xl group-hover:scale-110 transition-transform">🎲</span>
                            <span>{isGenerating ? 'Generating...' : 'Generate Round 1'}</span>
                        </button>
                        
                        <button 
                            onClick={() => {
                                setShowMapModal(true);
                                const slots = getTimeSlots();
                                if (slots.length > 0 && !selectedSlot) setSelectedSlot(slots[0].start);
                            }}
                            className="bg-emerald-600 text-white p-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm flex flex-col items-center justify-center gap-2 group"
                        >
                            <span className="text-2xl group-hover:scale-110 transition-transform">🗺️</span>
                            <span>Arena Map</span>
                        </button>
                        
                        <button disabled className="bg-gray-50 border border-gray-100 text-gray-300 p-4 rounded-xl font-bold cursor-not-allowed flex flex-col items-center justify-center gap-2">
                            <span className="text-2xl grayscale opacity-50">📊</span>
                            <span>Placeholder</span>
                        </button>
                        
                        <button disabled className="bg-gray-50 border border-gray-100 text-gray-300 p-4 rounded-xl font-bold cursor-not-allowed flex flex-col items-center justify-center gap-2">
                            <span className="text-2xl grayscale opacity-50">⚙️</span>
                            <span>Placeholder</span>
                        </button>
                    </div>
                </div>

                {activeTab === 'standings' ? (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Rank</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Player</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Score</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">W-L-D</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Points</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {registrations.map((reg, idx) => (
                                    <tr key={reg.id} className={`${reg.dropped ? 'opacity-50 grayscale' : ''} hover:bg-gray-50/50 transition-colors`}>
                                        <td className="px-6 py-4 font-mono text-gray-400">{idx + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{reg.player_name}</div>
                                            {reg.dropped && <span className="text-[10px] text-red-500 font-bold uppercase">Dropped</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600 font-medium">
                                            {reg.wins*3 + reg.draws} pts
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-400">
                                            {reg.wins} / {reg.losses} / {reg.draws}
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-blue-600">
                                            {reg.points}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleRemoveRegistration(reg.id)}
                                                className={`${pendingDeleteId === reg.id ? 'text-red-600 scale-110' : 'text-red-400'} hover:text-red-600 text-xs font-bold transition-all`}
                                            >
                                                {pendingDeleteId === reg.id ? 'Confirm?' : 'Un-register'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {registrations.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                            No players registered yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {matches.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                                <p className="text-gray-500 mb-4">No matches recorded yet.</p>
                                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm">
                                    Start Round 1
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {matches.map(match => (
                                    <div key={match.id} className="bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-6">
                                            <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">
                                                T{match.table_number || '?'}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{match.p1_name}</p>
                                                </div>
                                                <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-black text-gray-500">
                                                    {match.p1_score} - {match.p2_score}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{match.p2_name}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${match.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 animate-pulse'}`}>
                                                {match.status}
                                            </span>
                                            <button className="text-blue-600 font-bold text-sm hover:underline">Edit</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            {showRegModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900">Add Player to Tournament</h3>
                            <button onClick={() => setShowRegModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select from Community</label>
                            <select 
                                value={selectedPlayerId}
                                onChange={e => setSelectedPlayerId(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white mb-6"
                            >
                                <option value="">-- Choose a Player --</option>
                                {allPlayers
                                    .filter(p => !registrations.find(r => r.player_id === p.id))
                                    .map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))
                                }
                            </select>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowRegModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleRegister}
                                    disabled={!selectedPlayerId}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    Register Player
                                </button>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                                <p className="text-xs text-gray-400">Can't find the player?</p>
                                <Link href="/tournament/players" className="text-xs text-purple-600 font-bold hover:underline">
                                    Create new Player account →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Arena Map Modal */}
            {showMapModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Arena Map & Scheduling</h3>
                                <p className="text-sm text-gray-500">Assign pairings to physical tables and time slots</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowMapModal(false);
                                    setSelectedTable(null);
                                }} 
                                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all shadow-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Main Map Area */}
                            <div className="flex-1 p-8 overflow-y-auto bg-gray-50/30">
                                {/* Time Slot Selector */}
                                <div className="mb-8">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Select Time Slot</h4>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                        {getTimeSlots().map(slot => (
                                            <button
                                                key={slot.start}
                                                onClick={() => {
                                                    setSelectedSlot(slot.start);
                                                    setSelectedTable(null);
                                                }}
                                                className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all border-2 ${
                                                    selectedSlot === slot.start 
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-600'
                                                }`}
                                            >
                                                {slot.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Table Grid */}
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Arena Tables</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {Array.from({ length: tournament.num_tables || 0 }).map((_, i) => {
                                        const tableNum = i + 1;
                                        const assignedMatch = matches.find(m => m.table_number === tableNum && m.scheduled_at === selectedSlot);
                                        
                                        return (
                                            <button
                                                key={tableNum}
                                                onClick={() => !assignedMatch && setSelectedTable(tableNum)}
                                                className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative group ${
                                                    assignedMatch 
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-default' 
                                                    : selectedTable === tableNum
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xl shadow-emerald-100 ring-4 ring-emerald-50'
                                                    : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                {assignedMatch ? (
                                                    <>
                                                        <span className="text-xl">⚔️</span>
                                                        <span className="text-[10px] font-black uppercase leading-tight px-2 text-center">
                                                            {assignedMatch.p1_name.split(' ')[0]} <br/> vs <br/> {assignedMatch.p2_name.split(' ')[0]}
                                                        </span>
                                                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-6 h-6 rounded-lg flex items-center justify-center font-bold shadow-lg">
                                                            {tableNum}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-col items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <div className="flex gap-4 mb-1">
                                                                <span className="text-xs">🪑</span>
                                                                <span className="text-xs">🪑</span>
                                                            </div>
                                                            <div className="w-12 h-8 bg-gray-200 rounded-lg group-hover:bg-blue-200" />
                                                        </div>
                                                        <span className="text-xs font-black text-gray-400 group-hover:text-blue-600">Table {tableNum}</span>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sidebar: Pairings */}
                            <div className="w-80 bg-gray-50 border-l border-gray-100 flex flex-col">
                                <div className="p-6 border-b border-gray-200 bg-white">
                                    <h4 className="text-sm font-black text-gray-900 mb-1">Available Pairings</h4>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Drafting for Table {selectedTable || '?'}</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {matches
                                        .filter(m => !m.scheduled_at)
                                        .map(match => (
                                            <button
                                                key={match.id}
                                                disabled={!selectedTable || !selectedSlot}
                                                onClick={() => {
                                                    if (selectedTable && selectedSlot) {
                                                        handleAssignMatch(match.id, selectedTable, selectedSlot);
                                                        setSelectedTable(null);
                                                    }
                                                }}
                                                className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                                                    selectedTable 
                                                    ? 'bg-white border-gray-200 hover:border-emerald-500 hover:shadow-lg hover:scale-[1.02] cursor-pointer' 
                                                    : 'bg-gray-100 border-transparent opacity-60 cursor-not-allowed'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded italic">Round {match.round_number}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-black text-gray-800">{match.p1_name}</p>
                                                    <div className="h-px bg-gray-100 w-full" />
                                                    <p className="text-xs font-black text-gray-800">{match.p2_name}</p>
                                                </div>
                                            </button>
                                        ))}
                                    {matches.filter(m => !m.scheduled_at).length === 0 && (
                                        <div className="text-center py-12 opacity-40 italic flex flex-col items-center">
                                            <span className="text-3xl mb-2">✨</span>
                                            <p className="text-xs">All matches assigned!</p>
                                        </div>
                                    )}
                                </div>
                                {!selectedTable && matches.filter(m => !m.scheduled_at).length > 0 && (
                                    <div className="p-4 bg-blue-50 border-t border-blue-100">
                                        <p className="text-[10px] text-blue-700 font-bold text-center leading-tight">
                                            💡 Select a table on the map <br/> to assign a match
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </main>
    );
}
