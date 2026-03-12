"use client";

import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Mana Forge</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-2xl text-center">
        Create, edit, and export your Magic: The Gathering proxy sheets for private playtesting.
      </p>

      <div className="flex gap-4">
        <a
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
        >
          Log In
        </a>
        <a
          href="/register"
          className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-600 font-medium py-2 px-6 rounded-md transition-colors"
        >
          Request Access
        </a>
      </div>
    </main>
  );
}
