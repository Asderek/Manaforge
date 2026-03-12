"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setStatus("error");
            setErrorMessage("Please enter an email address.");
            return;
        }

        setStatus("loading");
        setErrorMessage("");

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to request password reset");
            }

            setStatus("success");
        } catch (err: any) {
            setStatus("error");
            setErrorMessage(err.message || "An unexpected error occurred");
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-blue-50/60 rounded-lg shadow-md p-8 border border-blue-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h1>
                    <p className="text-gray-600">Enter your email and we'll send you a reset link.</p>
                </div>

                {status === "success" ? (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-green-700 font-medium">
                                    Check your email
                                </p>
                                <p className="text-sm text-green-600 mt-1">
                                    If an account exists for that email, we've sent a password reset link.
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                                Return to login
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {status === "error" && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                <p className="text-sm text-red-700">{errorMessage}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                placeholder="you@example.com"
                                disabled={status === "loading"}
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={status === "loading" || !email}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {status === "loading" ? (
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </button>
                        </div>

                        <div className="text-center text-sm text-gray-600">
                            Remember your password?{' '}
                            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                                Sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
