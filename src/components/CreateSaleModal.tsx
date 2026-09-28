import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Medicine, Sale } from '../types';

interface CreateSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicines: Medicine[];
  initialMedicineId?: string;
  onSaleCompleted: (sale: Sale, updatedMedicine: { id: string; newStock: number }) => void;
}

export const CreateSaleModal: React.FC<CreateSaleModalProps> = ({
  isOpen,
  onClose,
  medicines,
  initialMedicineId,
  onSaleCompleted
}) => {
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialMedicineId) {
      setSelectedMedId(initialMedicineId);
    } else if (medicines.length > 0 && !selectedMedId) {
      setSelectedMedId(medicines[0].id);
    }
  }, [initialMedicineId, medicines, isOpen]);

  if (!isOpen) return null;

  const currentMed = medicines.find((m) => m.id === selectedMedId);
  const currentStock = currentMed ? currentMed.stock : 0;
  const unitPrice = currentMed ? currentMed.price : 0;
  const numQuantity = quantity === '' ? 0 : Number(quantity);
  const calculatedTotal = (numQuantity * unitPrice).toFixed(2);
  const remainingStockPreview = currentStock - numQuantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMedId) {
      setError('Please select a medicine.');
      return;
    }
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (numQuantity <= 0) {
      setError('Quantity must be at least 1 unit.');
      return;
    }
    if (numQuantity > currentStock) {
      setError(`Cannot sell ${numQuantity} units. Only ${currentStock} units in stock.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: selectedMedId,
          medicineName: currentMed?.name,
          quantity: numQuantity,
          totalPrice: Number(calculatedTotal),
          customerName: customerName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to process sale');
      }

      setSuccess(`Sale recorded! Stock for "${data.sale.medicineName}" decreased to ${data.sale.remainingStock ?? remainingStockPreview}.`);
      setTimeout(() => {
        onSaleCompleted(data.sale, {
          id: selectedMedId,
          newStock: data.updatedStock ? data.updatedStock.newStock : remainingStockPreview
        });
        setCustomerName('');
        setQuantity(1);
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Transaction error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-create-sale-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="modal-create-sale-content"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Record Medicine Sale</h2>
            <p className="text-xs text-slate-500">Atomic Firestore transaction reduces stock & logs sale record</p>
          </div>
          <button
            id="btn-close-create-sale"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Medicine *
            </label>
            <select
              id="select-sale-medicine"
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
            >
              {medicines.map((med) => (
                <option key={med.id} value={med.id} disabled={med.stock <= 0}>
                  {med.name} (Batch: {med.batch}) — {med.stock > 0 ? `${med.stock} in stock` : 'OUT OF STOCK'} — ₹{med.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {currentMed && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">Current Available Stock:</span>
                <span className={`font-semibold ${currentStock < 10 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {currentStock} units
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Unit Price:</span>
                <span className="font-semibold text-slate-800">₹{unitPrice.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Quantity to Sell *
              </label>
              <input
                id="input-sale-quantity"
                type="number"
                min="1"
                max={currentStock || 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Customer Name *
              </label>
              <input
                id="input-sale-customer"
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>
          </div>

          {/* Stock auto-decrease preview */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 font-medium">Total Charge:</span>
              <span className="text-base font-bold text-emerald-700">₹{calculatedTotal}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-emerald-200/40 text-emerald-900/80">
              <span>Automatic Stock Transition:</span>
              <span className="font-mono inline-flex items-center gap-1 font-semibold">
                <span>{currentStock} units</span>
                <ArrowRight className="w-3 h-3" />
                <span className={remainingStockPreview < 10 ? 'text-amber-600' : 'text-emerald-700'}>
                  {Math.max(0, remainingStockPreview)} units
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              id="btn-cancel-create-sale"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-sale"
              type="submit"
              disabled={isSubmitting || currentStock <= 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Transaction...' : 'Complete Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
