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
    lat: -23.5505, // Placeholder (São Paulo)
    lng: -46.6333
};

type Tournament = {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string | null;
    num_tables: number;
    format: string | null;
    status: 'draft' | 'active' | 'completed';
};

export default function EventsPage() {
    const [events, setEvents] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [isMapViewOnly, setIsMapViewOnly] = useState(false);
    const [viewLocation, setViewLocation] = useState('');
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [editingEvent, setEditingEvent] = useState<Tournament | null>(null);
    const { addToast } = useToast();

    const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: mapsKey,
        libraries
    });

    const [formData, setFormData] = useState({
        name: '',
        start_date: '',
        end_date: '',
        location: '',
        num_tables: 0,
        format: '',
        status: 'draft'
    });

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
            addToast('Failed to fetch events', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const method = editingEvent ? 'PUT' : 'POST';
        const url = editingEvent ? `${apiUrl}/api/tournaments/${editingEvent.id}` : `${apiUrl}/api/tournaments`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast(editingEvent ? 'Event updated' : 'Event created', 'success');
                setShowModal(false);
                setEditingEvent(null);
                setFormData({ name: '', start_date: '', end_date: '', location: '', num_tables: 0, format: '', status: 'draft' });
                fetchEvents();
            } else {
                addToast(data.message || 'Error saving event', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewLocation = (location: string) => {
        if (!isLoaded) {
            addToast('Maps not loaded yet', 'warning');
            return;
        }
        setIsMapViewOnly(true);
        setViewLocation(location);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: location }, (results, status) => {
            if (status === "OK" && results?.[0]) {
                setMapCenter({
                    lat: results[0].geometry.location.lat(),
                    lng: results[0].geometry.location.lng()
                });
                setShowMapPicker(true);
            } else {
                addToast('Could not find location on map', 'error');
            }
        });
    };

    const handleEdit = (event: Tournament) => {
        setEditingEvent(event);
        setFormData({
            name: event.name,
            start_date: event.start_date.substring(0, 16), // Format for datetime-local
            end_date: event.end_date.substring(0, 16),
            location: event.location || '',
            num_tables: event.num_tables,
            format: event.format || '',
            status: event.status
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (pendingDeleteId !== id) {
            setPendingDeleteId(id);
            addToast('Click again to delete', 'warning');
            setTimeout(() => setPendingDeleteId(null), 3000);
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/tournaments/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                addToast('Tournament deleted', 'success');
                setPendingDeleteId(null);
                fetchEvents();
            }
        } catch (err) {
            addToast('Error deleting tournament', 'error');
            setPendingDeleteId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200';
            case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    return (
        <main className="min-h-screen">
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/tournament" className="text-gray-400 hover:text-blue-600">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Tournament List</h1>
                    </div>
                    <button
                        onClick={() => {
                            setEditingEvent(null);
                            setFormData({ name: '', start_date: '', end_date: '', location: '', num_tables: 0, format: '', status: 'draft' });
                            setShowModal(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        + Create Event
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                        <p className="text-gray-500 mb-4">No tournaments scheduled.</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            Schedule your first event →
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map(event => (
                            <div key={event.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(event.status)}`}>
                                            {event.status}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEdit(event)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                ✏️
                                            </button>
                                            <button onClick={() => handleDelete(event.id)} className={`transition-all ${pendingDeleteId === event.id ? 'scale-125 text-red-600' : 'text-gray-400 hover:text-red-500'}`}>
                                                {pendingDeleteId === event.id ? '🗑️!' : '🗑️'}
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{event.name}</h3>
                                    <div className="text-xs text-gray-500 mb-4">
                                        {event.location ? (
                                            <button 
                                                onClick={() => handleViewLocation(event.location!)}
                                                className="flex items-center gap-1 hover:text-blue-600 hover:underline transition-colors text-left"
                                            >
                                                📍 {event.location}
                                            </button>
                                        ) : (
                                            <span className="flex items-center gap-1">📍 Local Game Store</span>
                                        )}
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Start:</span>
                                            <span className="text-gray-700 font-medium">{new Date(event.start_date).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Tables:</span>
                                            <span className="text-gray-700 font-medium">{event.num_tables} available</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Format:</span>
                                            <span className="text-gray-700 font-medium">{event.format || 'Casual'}</span>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/tournament/events/${event.id}`}
                                        className="block w-full text-center bg-gray-50 text-gray-600 py-2 rounded-lg font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-100"
                                    >
                                        Manage Players →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900">
                                {editingEvent ? 'Edit Tournament' : 'Schedule New Tournament'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tournament Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
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
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date/Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
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
                                            className="w-full pl-4 pr-16 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 transition-all"
                                            placeholder="Main Game Room"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMapViewOnly(false);
                                                setShowMapPicker(true);
                                            }}
                                            className="absolute right-1 top-1 bottom-1 px-2.5 bg-gray-50 text-gray-500 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-all text-[10px] font-black uppercase flex items-center gap-1 border border-transparent hover:border-blue-100"
                                            title="Pick on Map"
                                        >
                                            <span className="text-sm">📍</span> Map
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Simultaneous Tables</label>
                                    <input
                                        type="number"
                                        value={formData.num_tables}
                                        onChange={e => setFormData({ ...formData, num_tables: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Format</label>
                                    <select
                                        value={formData.format}
                                        onChange={e => setFormData({ ...formData, format: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            {editingEvent ? 'Saving...' : 'Creating...'}
                                        </>
                                    ) : (
                                        editingEvent ? 'Save Changes' : 'Create Event'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Google Maps Picker Modal */}
            {showMapPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">
                                    {isMapViewOnly ? 'Venue Location' : 'Pick Venue Location'}
                                </h3>
                                <p className="text-[10px] text-gray-500 uppercase font-black">
                                    {isMapViewOnly ? 'Location preview' : 'Search or click on the map'}
                                </p>
                            </div>
                            <button onClick={() => setShowMapPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        {!mapsKey ? (
                            <div className="p-12 text-center space-y-4">
                                <div className="text-4xl">⚠️</div>
                                <h4 className="font-bold text-gray-900">Google Maps API Key Missing</h4>
                                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                    Please set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your <code className="bg-gray-100 px-1 rounded">.env.local</code> file to enable this feature.
                                </p>
                                <button 
                                    onClick={() => setShowMapPicker(false)}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        ) : !isLoaded ? (
                            <div className="p-12 text-center space-y-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="text-sm text-gray-500">Loading Google Maps...</p>
                            </div>
                        ) : loadError ? (
                            <div className="p-12 text-center space-y-4 text-red-600">
                                <div className="text-4xl">❌</div>
                                <h4 className="font-bold">Error Loading Google Maps</h4>
                                <p className="text-sm">Please check your internet connection or API key restrictions.</p>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4">
                                {!isMapViewOnly && (
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
                                )}
                                
                                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={mapCenter}
                                        zoom={15}
                                        onClick={(e) => {
                                            if (!isMapViewOnly && e.latLng) {
                                                const lat = e.latLng.lat();
                                                const lng = e.latLng.lng();
                                                setMapCenter({ lat, lng });
                                                
                                                // Reverse geocode to get address
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

                                <div className="pt-2 flex justify-end gap-3">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            {isMapViewOnly ? 'Venue Address' : 'Selected Place'}
                                        </p>
                                        <p className="text-xs text-gray-700 font-medium truncate bg-gray-50 p-2 rounded border border-gray-100 italic">
                                            {isMapViewOnly ? viewLocation : (formData.location || 'Click or search to select...')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowMapPicker(false)}
                                        className="px-8 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 self-end h-10"
                                    >
                                        {isMapViewOnly ? 'Close' : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


        </main>
    );
}
