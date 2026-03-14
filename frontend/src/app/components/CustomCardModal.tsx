import React, { useState } from 'react';

export default function CustomCardModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, imageUrl: string) => void }) {
    const [name, setName] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const isImageValid = (url: string) => {
        return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.startsWith('data:image/');
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 cursor-pointer"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-gray-900 mb-2">Create Custom Card</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Add a card that doesn't exist in the database.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Card Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. My Awesome Card"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Must end in .jpg, .jpeg, or .png</p>
                    </div>

                    {imageUrl && isImageValid(imageUrl) && (
                        <div className="mt-4 flex justify-center">
                            <div className="relative group">
                                <img
                                    src={imageUrl}
                                    alt="Preview"
                                    className="max-h-64 rounded-lg shadow-md border border-gray-200"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-50 text-white text-[10px] py-1 text-center rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    Preview
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-800 font-medium text-sm px-4 py-2"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onCreate(name, imageUrl)}
                        disabled={!name.trim() || !isImageValid(imageUrl)}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm px-6 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create Card
                    </button>
                </div>
            </div>
        </div>
    );
}