"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import { AdminGuard } from '../../utils/auth';

export default function SQLAdminPage() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    const handleRunQuery = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch(`${apiUrl}/api/admin/sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setResult(data);
                addToast('Query executed successfully', 'success');
            } else {
                addToast(data.message || 'Error executing query', 'error');
                setResult({ error: data.message || 'Error executing query' });
            }
        } catch (err: any) {
            addToast('Network error', 'error');
            setResult({ error: 'Network error: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminGuard>
            <main className="min-h-screen p-8 bg-gray-50/50">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <Link href="/admin" className="text-gray-400 hover:text-blue-600">← Admin Dashboard</Link>
                        <h1 className="text-2xl font-black text-gray-900">SQL Executor</h1>
                        <span className="text-[10px] uppercase font-bold text-red-500 px-2 py-0.5 bg-red-50 border border-red-100 rounded">Danger Zone</span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden mb-8">
                        <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/20" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                                <div className="w-3 h-3 rounded-full bg-green-500/20" />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">D1 Database Console</span>
                        </div>
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="-- Enter your SQL here&#10;SELECT * FROM players LIMIT 10;"
                            className="w-full h-64 p-6 font-mono text-sm bg-gray-900 text-emerald-400 focus:outline-none resize-none placeholder-gray-700"
                        />
                        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                ⚠️ Queries will execute directly against the production D1 instance
                            </p>
                            <button
                                onClick={handleRunQuery}
                                disabled={loading || !query.trim()}
                                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : '⚡'}
                                <span>{loading ? 'Executing...' : 'Run Query'}</span>
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 border-b border-gray-100 bg-white flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-1">Query Results</h3>
                                    {result.meta && (
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                            Affected: <span className="text-blue-600">{result.meta.changes}</span> •
                                            Execution: <span className="text-blue-600">{(result.meta.duration || 0).toFixed(2)}ms</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {result.error ? (
                                <div className="p-12 text-center bg-red-50/30">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4 text-xl">❌</div>
                                    <h4 className="text-red-900 font-black mb-2">Execution Failed</h4>
                                    <div className="max-w-2xl mx-auto">
                                        <pre className="text-xs text-red-600 font-mono bg-white border border-red-100 p-4 rounded-xl text-left overflow-x-auto whitespace-pre-wrap">
                                            {result.error}
                                        </pre>
                                    </div>
                                </div>
                            ) : result.results && result.results.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-gray-50/50 border-b border-gray-100">
                                            <tr>
                                                {Object.keys(result.results[0]).map(key => (
                                                    <th key={key} className="px-6 py-4 font-black text-gray-400 uppercase text-[10px] tracking-wider">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {result.results.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                                    {Object.values(row).map((val: any, j: number) => (
                                                        <td key={j} className="px-6 py-4 text-gray-600 font-mono text-xs">
                                                            {val === null ? (
                                                                <span className="text-gray-300 italic">null</span>
                                                            ) : typeof val === 'object' ? (
                                                                JSON.stringify(val)
                                                            ) : (
                                                                String(val)
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-20 text-center text-gray-400 flex flex-col items-center">
                                    <span className="text-4xl mb-4">📭</span>
                                    <p className="text-sm font-bold">Query returned no rows.</p>
                                    <p className="text-xs">If this was a DDL/DML, check the changes count above.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </AdminGuard>
    );
}
