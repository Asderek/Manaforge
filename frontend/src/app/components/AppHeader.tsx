"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type User = {
    email: string;
    display_name: string;
    role: string;
};

export default function AppHeader() {
    const pathname = usePathname();
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
                // Not logged in, that's fine
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [apiUrl]);

    const handleLogout = async () => {
        try {
            await fetch(`${apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = '/';
        } catch {
            window.location.href = '/';
        }
    };

    const [isNavOpen, setIsNavOpen] = useState(false);
    const isTournamentArea = pathname?.startsWith('/tournament');

    return (
        <header className="bg-blue-50/60 border-b border-blue-200 px-6 py-3">
            <div className={`flex w-full items-center ${user ? 'justify-between' : 'justify-center gap-6'} px-4 py-2`}>
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                        ⚒ Mana Forge
                    </Link>

                    {user && isTournamentArea && (
                        <div className="flex items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Go to:</span>
                            <button 
                                onClick={() => setIsNavOpen(!isNavOpen)}
                                className={`ml-2 w-5 h-5 flex items-center justify-center rounded-md border border-gray-200 bg-white text-[10px] text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all ${isNavOpen ? 'rotate-90' : ''}`}
                            >
                                ❯
                            </button>
                            <div className={`flex items-center gap-4 transition-all duration-500 ease-out overflow-hidden whitespace-nowrap ${isNavOpen ? 'max-w-[400px] opacity-100 ml-4' : 'max-w-0 opacity-0 ml-0'}`}>
                                <Link 
                                    href="/tournament/players" 
                                    className="text-[10px] uppercase font-black text-gray-500 hover:text-purple-600 transition-colors tracking-widest border-b-2 border-transparent hover:border-purple-200 pb-0.5"
                                    onClick={() => setIsNavOpen(false)}
                                >
                                    Players
                                </Link>
                                <Link 
                                    href="/tournament/events" 
                                    className="text-[10px] uppercase font-black text-gray-500 hover:text-blue-600 transition-colors tracking-widest border-b-2 border-transparent hover:border-blue-200 pb-0.5"
                                    onClick={() => setIsNavOpen(false)}
                                >
                                    Events
                                </Link>
                                <Link 
                                    href="/tournament/calendar" 
                                    className="text-[10px] uppercase font-black text-gray-500 hover:text-green-600 transition-colors tracking-widest border-b-2 border-transparent hover:border-green-200 pb-0.5"
                                    onClick={() => setIsNavOpen(false)}
                                >
                                    Calendar
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                <nav className="flex items-center gap-4">
                    {loading ? (
                        <span className="text-sm text-gray-400">...</span>
                    ) : user ? (
                        <>
                            <Link href="/decks" className="text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                                My Decks
                            </Link>
                            {user.role === 'admin' && (
                                <Link href="/admin" className="text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                                    Admin
                                </Link>
                            )}
                            <span className="text-sm text-gray-500">
                                {user.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                            >
                                Log out
                            </button>
                        </>
                    ) : (
                        <>

                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
