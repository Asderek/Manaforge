"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
    const [showHelp, setShowHelp] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
    const isDeckArea = pathname?.startsWith('/decks');

    const [showHelpHint, setShowHelpHint] = useState(true);

    useEffect(() => {
        // Only show the hint and start the timer IF we are actually in the deck area
        if (isDeckArea) {
            setShowHelpHint(true); // Reset it to visible!

            const timer = setTimeout(() => {
                setShowHelpHint(false);
            }, 2000);

            // Cleanup the timer if they navigate away before 3 seconds
            return () => clearTimeout(timer);
        } else {
            // Immediately hide it if they navigate out of the deck area
            setShowHelpHint(false);
        }
    }, [pathname, isDeckArea]); // <--- This array is the magic fix

    return (
        <header className="bg-blue-50/60 border-b border-blue-200 px-6 py-3">
            <div className={`flex w-full items-center ${user ? 'justify-between' : 'justify-center gap-6'} px-4 py-2`}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                            ⚒ Mana Forge
                        </Link>
                        {isDeckArea && (
                            <>
                                <style jsx>{`
                                    @keyframes shake {
                                        0%, 100% { transform: translateX(0); }
                                        25% { transform: translateX(-5px); }
                                        75% { transform: translateX(5px); }
                                    }
                                    .animate-shake {
                                        animation: shake 1s ease-in-out infinite;
                                    }
                                `}</style>
                                <button
                                    onClick={() => setShowHelp(true)}
                                    className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-all shadow-sm border border-blue-200"
                                    title="Keyboard Shortcuts Help"
                                >
                                    <span className="text-[10px] font-bold">?</span>
                                </button>
                                <span
                                    className={`text-xs text-blue-500 font-medium transition-opacity duration-500 ${showHelpHint ? 'opacity-100 animate-shake' : 'opacity-0 pointer-events-none'}`}
                                >
                                    ← press for help
                                </span>
                            </>
                        )}
                    </div>

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

            {/* Help Modal */}
            {showHelp && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowHelp(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-blue-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <span className="text-lg">⌨️</span> Keyboard Shortcuts
                            </h3>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-blue-100 hover:text-white hover:bg-blue-500 rounded-lg p-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                    When hovering over a card
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <kbd className="min-w-[28px] h-7 flex items-center justify-center bg-gray-100 border-b-2 border-gray-300 rounded text-xs font-bold text-gray-700">S</kbd>
                                        <span className="text-sm text-gray-600 font-medium">Move to Sideboard</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <kbd className="min-w-[28px] h-7 flex items-center justify-center bg-gray-100 border-b-2 border-gray-300 rounded text-xs font-bold text-gray-700">A</kbd>
                                        <span className="text-sm text-gray-600 font-medium">Move to Auto Category</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <kbd className="min-w-[28px] h-7 flex items-center justify-center bg-gray-100 border-b-2 border-gray-300 rounded text-xs font-bold text-gray-700">M</kbd>
                                        <span className="text-sm text-gray-600 font-medium">Move to Maybeboard</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                                    When viewing a deck
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <kbd className="min-w-[28px] h-7 flex items-center justify-center bg-gray-100 border-b-2 border-gray-300 rounded text-xs font-bold text-gray-700">T</kbd>
                                        <span className="text-sm text-gray-600 font-medium">Switch to Table View</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <kbd className="min-w-[28px] h-7 flex items-center justify-center bg-gray-100 border-b-2 border-gray-300 rounded text-xs font-bold text-gray-700">G</kbd>
                                        <span className="text-sm text-gray-600 font-medium">Switch to Grid View</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 text-center border-t border-gray-100 text-[10px] text-gray-400 font-medium italic">
                            Tip: These shortcuts help you build decks much faster! ⚒️✨
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
}
