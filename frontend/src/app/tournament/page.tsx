"use client";

import React from 'react';
import Link from 'next/link';

export default function TournamentPage() {
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
                        <Link href="/tournament/matches" className="text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors">
                            Matches
                        </Link>
                        <Link href="/tournament/calendar" className="text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors">
                            Calendar
                        </Link>
                        <Link href="/tournament/timeline" className="text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors">
                            Timeline
                        </Link>
                    </nav>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {/* Welcome / Stats Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Total Players</p>
                        <h3 className="text-2xl font-bold text-gray-900">0</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Scheduled Matches</p>
                        <h3 className="text-2xl font-bold text-gray-900">0</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">Active Events</p>
                        <h3 className="text-2xl font-bold text-gray-900">0</h3>
                    </div>
                </div>

                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-12 text-center">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                        🏗️
                    </div>
                    <h2 className="text-2xl font-bold text-purple-900 mb-4">Under Construction</h2>
                    <p className="text-purple-700 max-w-md mx-auto mb-8">
                        The Tournament Arena is coming soon. Soon you'll be able to manage players, 
                        track matches, and coordinate your local MTG community here.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/" className="bg-white border border-purple-200 text-purple-600 px-6 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
