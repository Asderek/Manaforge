"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';

const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
    width: '100%',
    height: '400px'
};
const defaultCenter = {
    lat: -23.5505,
    lng: -46.6333
};

type Tournament = {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
    location?: string | null;
    num_tables?: number;
    format?: string | null;
};

export default function CalendarPage() {
    const [events, setEvents] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const { addToast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        start_date: '',
        end_date: '',
        location: '',
        num_tables: 8,
        format: '',
        status: 'draft'
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: mapsKey,
        libraries
    });

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
        setSelectedDay(null);
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDay(null);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
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

    const handleCreateClick = (dayOverride?: number | null) => {
        const day = dayOverride !== undefined ? dayOverride : selectedDay;
        const baseDate = day
            ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 8, 0)
            : new Date();

        if (!day) baseDate.setHours(8, 0, 0, 0);

        const endDate = new Date(baseDate.getTime() + 4 * 60 * 60 * 1000); // +4 hours

        const formatDate = (d: Date) => {
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        setFormData({
            ...formData,
            start_date: formatDate(baseDate),
            end_date: formatDate(endDate),
            name: '',
            location: '',
            status: 'draft'
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`${apiUrl}/api/tournaments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast('Event created successfully', 'success');
                setShowModal(false);
                fetchEvents();
            } else {
                addToast(data.message || 'Error creating event', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        } finally {
            setIsSubmitting(false);
        }
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
                    <button
                        onClick={() => handleCreateClick()}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm text-sm"
                    >
                        + Create Event
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto">
                <div className="ms-8 mb-1 mt-8 flex items-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200"></span>
                        Standard Event
                    </div>
                    <div className="text-xs font-medium">
                        💡 Tip: Double click on any day to schedule a new event.
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h2 className="text-xl font-black text-gray-900">{monthName} {currentDate.getFullYear()}</h2>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600 font-bold">
                                ←
                            </button>
                            <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(null); }} className="px-4 py-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-sm font-bold text-gray-600">
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
                            const isSelected = day === selectedDay;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                                    onDoubleClick={() => {
                                        if (day) {
                                            setSelectedDay(day);
                                            handleCreateClick(day);
                                        }
                                    }}
                                    className={`min-h-[120px] p-2 border-r border-b border-gray-100 transition-all last:border-r-0 ${!day ? 'bg-gray-50/50' : 'cursor-pointer'} ${isSelected ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-500/20' : 'bg-white hover:bg-gray-50/50'}`}
                                >
                                    {day && (
                                        <>
                                            <div className={`text-sm font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${isToday ? 'bg-blue-600 text-white' : isSelected ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}>
                                                {day}
                                            </div>
                                            <div className="space-y-1">
                                                {dayEvents.map(event => (
                                                    <Link
                                                        key={event.id}
                                                        href={`/tournament/events/${event.id}`}
                                                        onClick={(e) => e.stopPropagation()}
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
            </div>

            {/* Create Event Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">
                                Schedule New Tournament
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tournament Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium transition-all"
                                    placeholder="Friday Night Magic"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date/Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date/Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium transition-all"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full pl-4 pr-16 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 transition-all font-medium"
                                            placeholder="Main Game Room"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowMapPicker(true)}
                                            className="absolute right-1 top-1 bottom-1 px-2.5 bg-gray-50 text-gray-500 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-all text-[10px] font-black uppercase flex items-center gap-1 border border-transparent hover:border-blue-100"
                                        >
                                            📍 Map
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tables</label>
                                    <input
                                        type="number"
                                        value={formData.num_tables}
                                        onChange={e => setFormData({ ...formData, num_tables: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Format</label>
                                <select
                                    value={formData.format}
                                    onChange={e => setFormData({ ...formData, format: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white font-medium"
                                >
                                    <option value="">Casual / Other</option>
                                    <option value="Standard">Standard</option>
                                    <option value="Modern">Modern</option>
                                    <option value="Pioneer">Pioneer</option>
                                    <option value="Legacy">Legacy</option>
                                    <option value="Commander">Commander</option>
                                    <option value="Limited">Limited (Draft/Sealed)</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-black uppercase tracking-widest text-xs hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : 'Create Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Map Picker Modal */}
            {showMapPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900 text-lg">Pick Venue Location</h3>
                            <button onClick={() => setShowMapPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {!isLoaded ? (
                                <div className="p-12 text-center text-gray-500">Loading Maps...</div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Autocomplete
                                            onLoad={setAutocomplete}
                                            onPlaceChanged={() => {
                                                if (autocomplete) {
                                                    const place = autocomplete.getPlace();
                                                    if (place.formatted_address) {
                                                        setFormData({ ...formData, location: place.formatted_address });
                                                        if (place.geometry?.location) {
                                                            setMapCenter({
                                                                lat: place.geometry.location.lat(),
                                                                lng: place.geometry.location.lng()
                                                            });
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <input
                                                type="text"
                                                placeholder="Search for a location..."
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 shadow-sm"
                                            />
                                        </Autocomplete>
                                    </div>
                                    <div className="rounded-xl overflow-hidden border border-gray-200">
                                        <GoogleMap
                                            mapContainerStyle={mapContainerStyle}
                                            center={mapCenter}
                                            zoom={15}
                                            onClick={(e) => {
                                                if (e.latLng) {
                                                    const lat = e.latLng.lat();
                                                    const lng = e.latLng.lng();
                                                    setMapCenter({ lat, lng });
                                                    const geocoder = new google.maps.Geocoder();
                                                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                                                        if (status === "OK" && results?.[0]) {
                                                            setFormData({ ...formData, location: results[0].formatted_address });
                                                        }
                                                    });
                                                }
                                            }}
                                        >
                                            <Marker position={mapCenter} />
                                        </GoogleMap>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowMapPicker(false)}
                                            className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
