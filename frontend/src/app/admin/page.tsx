"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminGuard } from '../utils/auth';

type RegistrationRequest = {
    id: string;
    email: string;
    display_name: string;
    note: string;
    recaptcha_checked_at: string;
    status: 'pending' | 'approved' | 'rejected';
};

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchRequests = async () => {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            const res = await fetch(`${backendUrl}/api/admin/registration-requests`, {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                setRequests(data.requests);
            } else {
                setError(data.error || 'Failed to fetch requests');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id: string) => {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            const res = await fetch(`${backendUrl}/api/admin/registration-requests/${id}/approve`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                fetchRequests();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Network error while approving request.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this specific request?')) return;

        try {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            const res = await fetch(`${backendUrl}/api/admin/registration-requests/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                fetchRequests();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('Network error while deleting request.');
        }
    };

    return (
        <AdminGuard>
            <main className="min-h-screen p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Registration Requests</h1>
                        <Link 
                            href="/admin/sql" 
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
                        >
                            <span>⚡</span>
                            <span>SQL Executor</span>
                        </Link>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                            <p className="font-medium">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {requests.map((req) => (
                                    <tr key={req.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.display_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{req.note || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {req.status === 'pending' && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Pending</span>}
                                            {req.status === 'approved' && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Approved</span>}
                                            {req.status === 'rejected' && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                {req.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        className="text-white bg-green-600 hover:bg-green-700 font-medium rounded text-xs px-3 py-1.5 transition-colors"
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(req.id)}
                                                    className="text-white bg-red-600 hover:bg-red-700 font-medium rounded text-xs px-3 py-1.5 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {requests.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No registration requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </AdminGuard>
    );
}
