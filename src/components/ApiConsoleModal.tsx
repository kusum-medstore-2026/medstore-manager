import React, { useState } from 'react';
import { X, Code2, Play, Check, Copy } from 'lucide-react';

interface ApiConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const ApiConsoleModal: React.FC<ApiConsoleModalProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'lowStock' | 'expiring' | 'getMeds' | 'postMed' | 'postSale' | 'authLogin' | 'downloadZip'>('lowStock');
  const [responseOutput, setResponseOutput] = useState<string>('Click "Execute Endpoint" below to view live server output.');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const endpoints = {
    lowStock: {
      method: 'GET',
      url: '/api/alerts/low-stock',
      desc: 'Retrieves medicines with stock < 10',
      curl: 'curl -X GET http://localhost:3000/api/alerts/low-stock'
    },
    expiring: {
      method: 'GET',
      url: '/api/alerts/expiring',
      desc: 'Retrieves medicines expiring within the next 30 days',
      curl: 'curl -X GET http://localhost:3000/api/alerts/expiring'
    },
    getMeds: {
      method: 'GET',
      url: '/api/medicines',
      desc: 'Lists all medicines stored in Firestore',
      curl: 'curl -X GET http://localhost:3000/api/medicines'
    },
    postMed: {
      method: 'POST',
      url: '/api/medicines',
      desc: 'Adds a new medicine with timestamp and batch number',
      curl: `curl -X POST http://localhost:3000/api/medicines \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Doxycycline 100mg",\n    "batch": "DOX-2024-05",\n    "expiryDate": "2024-12-31",\n    "stock": 15,\n    "price": 8.50,\n    "supplier": "BioMed Labs"\n  }'`
    },
    postSale: {
      method: 'POST',
      url: '/api/sales',
      desc: 'Creates sale and automatically decreases stock via atomic transaction',
      curl: `curl -X POST http://localhost:3000/api/sales \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "medicineName": "Amoxicillin 500mg",\n    "quantity": 2,\n    "customerName": "Robert Vance"\n  }'`
    },
    authLogin: {
      method: 'POST',
      url: '/api/auth/login',
      desc: 'Authenticates staff members and returns session token',
      curl: `curl -X POST http://localhost:3000/api/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "email": "pharmacist@medstore.com",\n    "password": "pharma123"\n  }'`
    },
    downloadZip: {
      method: 'GET',
      url: '/api/download-zip',
      desc: 'Downloads complete project code as medstore-manager.zip',
      curl: 'curl -OJ http://localhost:3000/api/download-zip'
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResponseOutput('Sending request to Express server...');
    const ep = endpoints[activeTab];

    try {
      if (activeTab === 'downloadZip') {
        const link = document.createElement('a');
        link.href = '/api/download-zip';
        link.download = 'medstore-manager.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setResponseOutput('HTTP/1.1 200 OK\nContent-Type: application/zip\nContent-Disposition: attachment; filename="medstore-manager.zip"\n\nDownload initiated successfully in your browser!');
        return;
      }

      let res;
      if (ep.method === 'GET') {
        res = await fetch(ep.url);
      } else if (activeTab === 'postMed') {
        res = await fetch('/api/medicines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Test Med-${Math.floor(Math.random() * 1000)}`,
            batch: `TST-${Math.floor(Math.random() * 9000 + 1000)}`,
            expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            stock: 8,
            price: 14.50,
            supplier: 'Global Health Co'
          })
        });
      } else if (activeTab === 'authLogin') {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'pharmacist@medstore.com',
            password: 'pharma123'
          })
        });
      } else {
        // postSale
        res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medicineName: 'Amoxicillin 500mg',
            quantity: 1,
            customerName: `Customer ${Math.floor(Math.random() * 500)}`
          })
        });
      }

      const json = await res.json();
      setResponseOutput(JSON.stringify(json, null, 2));
      onRefreshData();
    } catch (err: any) {
      setResponseOutput(`Error executing API: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(endpoints[activeTab].curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="modal-api-console-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="modal-api-console-content"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Backend API Endpoints Console</h2>
              <p className="text-xs text-slate-500">Express routes targeting Firestore collections: <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">medicines</code> & <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">sales</code></p>
            </div>
          </div>
          <button
            id="btn-close-api-console"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('lowStock')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'lowStock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GET /alerts/low-stock
            </button>
            <button
              onClick={() => setActiveTab('expiring')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'expiring' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GET /alerts/expiring
            </button>
            <button
              onClick={() => setActiveTab('getMeds')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'getMeds' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GET /medicines
            </button>
            <button
              onClick={() => setActiveTab('postMed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'postMed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              POST /medicines
            </button>
            <button
              onClick={() => setActiveTab('postSale')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'postSale' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              POST /sales
            </button>
            <button
              onClick={() => setActiveTab('authLogin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'authLogin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              POST /auth/login
            </button>
            <button
              onClick={() => setActiveTab('downloadZip')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'downloadZip' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GET /download-zip
            </button>
          </div>

          {/* Endpoint description */}
          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-mono text-emerald-700 font-bold mr-2">{endpoints[activeTab].method}</span>
              <span className="font-mono font-medium text-slate-800">{endpoints[activeTab].url}</span>
              <p className="text-slate-500 mt-1">{endpoints[activeTab].desc}</p>
            </div>
            <button
              id="btn-copy-curl"
              onClick={handleCopyCurl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy cURL'}</span>
            </button>
          </div>

          {/* Terminal output */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">Live JSON Response:</span>
              <button
                id="btn-run-endpoint"
                onClick={handleExecute}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isLoading ? 'Executing...' : 'Execute Endpoint'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono rounded-xl overflow-x-auto max-h-60 border border-slate-800 select-all">
              {responseOutput}
            </pre>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Target Firestore: Database <strong className="text-slate-700">(default)</strong></span>
          <span>Auth: <code className="font-mono text-slate-700">process.env.FIREBASE_SERVICEACCOUNT</code></span>
        </div>
      </div>
    </div>
  );
};
