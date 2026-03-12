interface ImportModalProps {
    onClose: () => void;
    onImport: () => void;
    importText: string;
    setImportText: (text: string) => void;
    importError: string;
    setImportError: (error: string) => void;
    importProgress: string;
    setImportProgress: (progress: string) => void;
    saving: boolean;
}

export default function ImportDeckModal({ onClose, onImport, importText, setImportText, importError, setImportError, importProgress, setImportProgress, saving }: ImportModalProps) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Import Decklist</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Paste your decklist below. Supports formats like <code className="bg-gray-100 px-1 rounded">4 Lightning Bolt</code> or <code className="bg-gray-100 px-1 rounded">4x Lightning Bolt</code>.
                    Lines starting with <code className="bg-gray-100 px-1 rounded">//</code> or <code className="bg-gray-100 px-1 rounded">#</code> are ignored.
                </p>
                <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`4 Lightning Bolt\n4 Monastery Swiftspear\n2 Eidolon of the Great Revel\n20 Mountain`}
                    className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm resize-none"
                />
                {importError && (
                    <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
                        {importError}
                    </div>
                )}
                {importProgress && (
                    <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-blue-700 text-sm rounded flex items-center gap-2">
                        <span className="animate-spin text-xs">⏳</span> {importProgress}
                    </div>
                )}
                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-800 font-medium text-sm px-4 py-2 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onImport}
                        disabled={saving || !importText.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm px-6 py-2 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Validating & Importing...' : 'Import Cards'}
                    </button>
                </div>
            </div>
        </div>
    );
}