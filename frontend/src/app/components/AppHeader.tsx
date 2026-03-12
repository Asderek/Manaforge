"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
    email: string;
    display_name: string;
    role: string;
};

export default function AppHeader() {
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

    return (
        <header className="bg-blue-50/60 border-b border-blue-200 px-6 py-3">
            <div className={`flex w-full items-center ${user ? 'justify-between' : 'justify-center gap-6'} px-4 py-2`}>
                <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                    ⚒ Mana Forge
                </Link>

                <nav className="flex items-center gap-4">
                    {loading ? (
                        <span className="text-sm text-gray-400">...</span>
                    ) : user ? (
                        <>
                            <Link href="/projects" className="text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                                My Projects
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
