"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }, [removeToast]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(timersRef.current).forEach(clearTimeout);
        };
    }, []);

    const typeStyles: Record<ToastType, string> = {
        info: 'bg-blue-600/60 text-white backdrop-blur-md border border-blue-700',
        success: 'bg-green-600/60 text-white backdrop-blur-md border border-green-700',
        warning: 'bg-amber-500/60 text-white backdrop-blur-md border border-amber-600',
        error: 'bg-red-600/60 text-white backdrop-blur-md border border-red-700',
    };

    const typeIcons: Record<ToastType, string> = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast container - bottom right */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-md">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`${typeStyles[toast.type]} rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 animate-slide-in-right cursor-pointer`}
                        onClick={() => removeToast(toast.id)}
                        role="alert"
                    >
                        <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[toast.type]}</span>
                        <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
                            className="text-white/70 hover:text-white flex-shrink-0 text-lg leading-none mt-0.5"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
