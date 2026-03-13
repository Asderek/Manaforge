"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '../../components/Toast';

type Tournament = {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
};

export default function CalendarPage() {
    const [events, setEvents] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    
    const [currentDate, setCurrentDate] = useState(new Date());

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/tournaments`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setEvents(data.tournaments);
            }
        } catch (err) {
            addToast('Failed to load calendar events', 'error');
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Pad start
        for (let i = 0; i < firstDay; i++) days.push(null);
        // Add dates
        for (let i = 1; i <= lastDate; i++) days.push(i);
        
        return days;
    };

    const days = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const getEventsForDay = (day: number) => {
        if (!day) return [];
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => e.start_date.split('T')[0] === dateStr);
    };

    return (
        <main className="min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/tournament" className="text-gray-400 hover:text-green-600">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Event Calendar</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h2 className="text-xl font-black text-gray-900">{monthName} {currentDate.getFullYear()}</h2>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600 font-bold">
                                ←
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-sm font-bold text-gray-600">
                                Today
                            </button>
                            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600 font-bold">
                                →
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-3 text-center text-[10px] uppercase font-bold text-gray-400 tracking-widest border-r border-gray-50 last:border-0">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 bg-gray-50/30">
                        {days.map((day, idx) => {
                            const dayEvents = day ? getEventsForDay(day) : [];
                            const isToday = day && 
                                day === new Date().getDate() && 
                                currentDate.getMonth() === new Date().getMonth() && 
                                currentDate.getFullYear() === new Date().getFullYear();

                            return (
                                <div 
                                    key={idx} 
                                    className={`min-h-[120px] p-2 border-r border-b border-gray-100 bg-white transition-colors last:border-r-0 ${!day ? 'bg-gray-50/50' : ''}`}
                                >
                                    {day && (
                                        <>
                                            <div className={`text-sm font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-md ${isToday ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                                                {day}
                                            </div>
                                            <div className="space-y-1">
                                                {dayEvents.map(event => (
                                                    <Link 
                                                        key={event.id}
                                                        href={`/tournament/events/${event.id}`}
                                                        className="block text-[10px] p-1.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700 font-bold truncate hover:bg-blue-100 transition-colors"
                                                    >
                                                        ⚔️ {event.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200"></span>
                        Standard Event
                    </div>
                </div>
            </div>
        </main>
    );
}
