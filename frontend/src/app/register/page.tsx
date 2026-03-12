"use client";

import React, { useState, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const recaptchaRef = useRef<ReCAPTCHA>(null);

    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const recaptchaToken = recaptchaRef.current?.getValue();
        if (!recaptchaToken) {
            setErrorMessage('Please complete the reCAPTCHA challenge.');
            setStatus('error');
            return;
        }

        setStatus('submitting');
        setErrorMessage('');

        try {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

            const response = await fetch(`${backendUrl}/api/auth/register-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    displayName,
                    note,
                    recaptchaToken
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit request');
            }

            setStatus('success');
        } catch (err: any) {
            setErrorMessage(err.message || 'An unexpected error occurred.');
            setStatus('error');
            recaptchaRef.current?.reset();
        }
    };

    if (status === 'success') {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-blue-50/60 rounded-lg shadow-md border border-blue-100 p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Received</h2>
                    <p className="text-gray-600">
                        Your registration request has been submitted successfully. You will receive an email once an administrator reviews it.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-xl bg-blue-50/60 rounded-lg shadow-md border border-blue-100 p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Access to Mana Forge</h1>
                <p className="text-gray-600 mb-8">
                    Mana Forge is a closed playtest environment. Please submit a request to get an account.
                </p>

                {status === 'error' && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <p className="font-medium">Error</p>
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            id="register-email"
                            type="email"
                            placeholder="you@example.com"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="register-displayname" className="block text-sm font-medium text-gray-700 mb-1">
                            Display Name
                        </label>
                        <input
                            id="register-displayname"
                            type="text"
                            placeholder="How should we call you?"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="register-note" className="block text-sm font-medium text-gray-700 mb-1">
                            Optional Note (Who are you?)
                        </label>
                        <textarea
                            id="register-note"
                            placeholder="I play in the Friday playgroup..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm resize-none"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>

                    {recaptchaSiteKey ? (
                        <div className="flex justify-center my-6 overflow-hidden">
                            <ReCAPTCHA
                                ref={recaptchaRef}
                                sitekey={recaptchaSiteKey}
                            />
                        </div>
                    ) : (
                        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                            <p className="font-medium">Configuration Missing</p>
                            <p className="text-sm">The reCAPTCHA Site Key is not configured. Form submission will fail.</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {status === 'submitting' ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : null}
                        {status === 'submitting' ? 'Submitting...' : 'Submit Request'}
                    </button>
                </form>
            </div>
        </main>
    );
}
