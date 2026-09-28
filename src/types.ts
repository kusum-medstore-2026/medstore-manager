export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'pharmacist' | 'cashier';
  token?: string;
  storeName?: string;
  phone?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  error?: string;
}

export interface Medicine {
  id: string;
  name: string;
  batch: string;
  expiryDate: string | null;
  expiryTimestamp?: any;
  daysToExpiry: number | null;
  stock: number;
  price: number;
  supplier: string;
  stockStatus: 'normal' | 'low_stock' | 'out_of_stock';
  expiryStatus: 'valid' | 'expiring_soon' | 'expired';
  createdAt?: string | null;
}

export interface Sale {
  id: string;
  medicineName: string;
  medicineId?: string;
  batch?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  customerName: string;
  date: string;
  remainingStock?: number;
}

export interface BackendStatus {
  status: string;
  isLiveFirestore: boolean;
  database: string;
  medicinesCount: number;
  salesCount: number;
  authMethod: string;
}

export interface LowStockAlertResponse {
  success: boolean;
  count: number;
  threshold: number;
  medicines: Medicine[];
}

export interface ExpiringAlertResponse {
  success: boolean;
  totalAlerts: number;
  expiringNext30DaysCount: number;
  expiredCount: number;
  medicines: Medicine[];
}
