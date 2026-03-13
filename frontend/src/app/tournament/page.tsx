"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
    total_players: number;
    scheduled_matches: number;
    active_events: number;
}

export default function TournamentPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/tournaments/dashboard-stats`, {
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.success) {
                    setStats(data.stats);
                }
            } catch (err) {
                console.error('Error fetching dashboard stats:', err);
            }
        };
        fetchStats();
    }, [apiUrl]);

    return (
        <main className="min-h-screen bg-transparent">
            {/* Header / Sub-nav */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-purple-500 font-bold">Tournament Arena</span>
                        <h1 className="text-xl font-bold text-gray-900">Event Management</h1>
                    </div>

                    <nav className="flex items-center gap-6">
                        <Link href="/tournament/players" className="text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors">
                            Players
                        </Link>
                        <Link href="/tournament/events" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
                            Events
                        </Link>
                        <Link href="/tournament/calendar" className="text-sm font-medium text-gray-500 hover:text-green-600 transition-colors">
                            Calendar
                        </Link>
                    </nav>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {/* Welcome / Stats Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Total Players</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats?.total_players ?? '...'}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Scheduled Matches</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats?.scheduled_matches ?? '...'}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Active Events</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats?.active_events ?? '...'}</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Players Portal */}
                    <Link href="/tournament/players" className="group block">
                        <div className="h-full p-8 bg-white border border-gray-200 group-hover:border-purple-500 rounded-2xl shadow-sm group-hover:shadow-xl transition-all flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                👥
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Players</h3>
                            <p className="text-gray-600 mb-6">Manage your local community, track player stats and history.</p>
                            <span className="text-purple-600 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center">
                                Manage Players →
                            </span>
                        </div>
                    </Link>

                    {/* Events Portal */}
                    <Link href="/tournament/events" className="group block">
                        <div className="h-full p-8 bg-white border border-gray-200 group-hover:border-blue-500 rounded-2xl shadow-sm group-hover:shadow-xl transition-all flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                ⚔️
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Events</h3>
                            <p className="text-gray-600 mb-6">Create tournaments, manage matches and automatic standings.</p>
                            <span className="text-blue-600 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center">
                                Manage Events →
                            </span>
                        </div>
                    </Link>

                    {/* Calendar Portal */}
                    <Link href="/tournament/calendar" className="group block">
                        <div className="h-full p-8 bg-white border border-gray-200 group-hover:border-emerald-500 rounded-2xl shadow-sm group-hover:shadow-xl transition-all flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                📅
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Calendar</h3>
                            <p className="text-gray-600 mb-6">Visual timeline of upcoming events, scheduling and registration.</p>
                            <span className="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center">
                                View Calendar →
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
        </main>
    );
}
