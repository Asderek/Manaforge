"use client";

import React, { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';

type User = {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'user';
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
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
            } catch (err) {
                console.error("Auth check failed:", err);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [apiUrl]);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Verifying Admin Access</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return <>{children}</>;
};
