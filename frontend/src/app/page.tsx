"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
    email: string;
    display_name: string;
};

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' });
                const data = await res.json();
                if (data.success && data.user) {
                    setUser(data.user);
                }
            } catch {
                // Not logged in
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [apiUrl]);

    if (loading) {
        return (
            <main className="min-h-[80vh] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </main>
        );
    }

    if (user) {
        return (
            <main className="min-h-[80vh] max-w-5xl mx-auto p-8 flex flex-col items-center justify-center">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user.display_name}</h1>
                    <p className="text-gray-600">Choose your workspace to begin</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 w-full">
                    {/* Deck Foundry Portal */}
                    <Link href="/decks" className="group block">
                        <div className="h-full p-8 bg-white border-2 border-transparent group-hover:border-blue-500 rounded-2xl shadow-sm group-hover:shadow-xl transition-all flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                ⚒️
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">Deck Foundry</h2>
                            <p className="text-gray-600 mb-6">
                                Craft your MTG decks, manage your card collection, and export proxy sheets for playtesting.
                            </p>
                            <span className="mt-auto text-blue-600 font-bold flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                Enter Foundry →
                            </span>
                        </div>
                    </Link>

                    {/* Tournament Arena Portal */}
                    <Link href="/tournament" className="group block">
                        <div className="h-full p-8 bg-white border-2 border-transparent group-hover:border-purple-500 rounded-2xl shadow-sm group-hover:shadow-xl transition-all flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                🏟️
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">Tournament Arena</h2>
                            <p className="text-gray-600 mb-6">
                                Manage players, track match results, and view event schedules in the new tournament hub.
                            </p>
                            <span className="mt-auto text-purple-600 font-bold flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                Enter Arena →
                            </span>
                        </div>
                    </Link>
                </div>
            </main>
        );
    }

    // Guest View
    return (
        <main className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                Mana Forge
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl">
                The ultimate companion for Magic: The Gathering playtesting. Create, edit, and export high-quality proxy sheets with ease.
            </p>

            <div className="flex gap-6">
                <Link
                    href="/login"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-blue-200 transition-all hover:-translate-y-1"
                >
                    Log In
                </Link>
                <Link
                    href="/register"
                    className="bg-white hover:bg-gray-50 text-blue-600 border-2 border-blue-600 font-bold py-3 px-8 rounded-lg transition-all hover:-translate-y-1"
                >
                    Request Access
                </Link>
            </div>
        </main>
    );
}
