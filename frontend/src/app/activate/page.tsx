"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Link from "next/link";

export default function ActivateAccountPage() {
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    // Extract the token from the URL search parameters on component mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        if (urlToken) {
            setToken(urlToken);
        } else {
            setStatus("error");
            setErrorMessage("Invalid activation link. No token provided.");
        }
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            return; // Covered by useEffect error, but safety check
        }

        if (password.length < 8) {
            setStatus("error");
            setErrorMessage("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setStatus("error");
            setErrorMessage("Passwords do not match.");
            return;
        }

        setStatus("loading");
        setErrorMessage("");

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            const res = await fetch(`${apiUrl}/api/auth/activate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to activate account");
            }

            setStatus("success");
            // Automatically redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (err: any) {
            setStatus("error");
            setErrorMessage(err.message || "An unexpected error occurred");
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-blue-50/60 rounded-lg shadow-md p-8 border border-blue-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Activate Account</h1>
                    <p className="text-gray-600">Please set a password to complete your registration.</p>
                </div>

                {status === "success" ? (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-green-700 font-medium">
                                    Account activated successfully!
                                </p>
                                <p className="text-sm text-green-600 mt-1">
                                    Redirecting you to login...
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleActivate} className="space-y-6">

                        {status === "error" && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                <p className="text-sm text-red-700">{errorMessage}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                                New Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Min 8 characters"
                                disabled={status === "loading" || !token}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Min 8 characters"
                                disabled={status === "loading" || !token}
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={status === "loading" || !token}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {status === "loading" ? (
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "Activate Account"
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
