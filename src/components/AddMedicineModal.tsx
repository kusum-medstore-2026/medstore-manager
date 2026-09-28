import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Medicine } from '../types';

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMedicineAdded: (newMed: Medicine) => void;
}

export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
  isOpen,
  onClose,
  onMedicineAdded
}) => {
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [stock, setStock] = useState<number | ''>(25);
  const [price, setPrice] = useState<number | ''>(9.99);
  const [supplier, setSupplier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Medicine name is required.');
      return;
    }
    if (!batch.trim()) {
      setError('Batch identifier is required.');
      return;
    }
    if (!expiryDate) {
      setError('Expiry date is required.');
      return;
    }
    if (stock === '' || Number(stock) < 0) {
      setError('Stock must be a non-negative number.');
      return;
    }
    if (price === '' || Number(price) < 0) {
      setError('Price must be a valid positive number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          batch: batch.trim(),
          expiryDate: expiryDate,
          stock: Number(stock),
          price: Number(price),
          supplier: supplier.trim() || 'General Pharma Supplies'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to add medicine');
      }

      setSuccess(true);
      setTimeout(() => {
        onMedicineAdded(data.medicine);
        setName('');
        setBatch('');
        setExpiryDate('');
        setStock(25);
        setPrice(9.99);
        setSupplier('');
        setSuccess(false);
        onClose();
      }, 750);
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving to Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-add-medicine-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="modal-add-medicine-content"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Add New Medicine</h2>
            <p className="text-xs text-slate-500">Persists directly into Firestore <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[11px]">medicines</code> collection</p>
          </div>
          <button
            id="btn-close-add-medicine"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Medicine successfully registered in Firestore!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Medicine Name *
            </label>
            <input
              id="input-medicine-name"
              type="text"
              required
              placeholder="e.g. Ciprofloxacin 500mg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Batch Number *
              </label>
              <input
                id="input-medicine-batch"
                type="text"
                required
                placeholder="e.g. CIP-2024-03"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Expiry Date *
              </label>
              <input
                id="input-medicine-expiry"
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Initial Stock (Units) *
              </label>
              <input
                id="input-medicine-stock"
                type="number"
                min="0"
                required
                placeholder="25"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Stock &lt; 10 triggers low-stock alert</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unit Price (₹) *
              </label>
              <input
                id="input-medicine-price"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="9.99"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Supplier / Manufacturer
            </label>
            <input
              id="input-medicine-supplier"
              type="text"
              placeholder="e.g. Apex Bio Labs / MediLife"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              id="btn-cancel-add-medicine"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-submit-add-medicine"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Firestore...' : 'Save Medicine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
