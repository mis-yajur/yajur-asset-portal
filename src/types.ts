export type Page = 'dashboard' | 'lifting' | 'pi' | 'customers' | 'products' | 'reports' | 'settings' | 'audit-log' | 'ledger' | 'archive';

export interface User {
  username: string;
  name: string;
  role: string;
}

export type FontStyle = 'sans' | 'serif' | 'mono' | 'display';

export interface ThemeSettings {
  themeId: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: FontStyle;
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: Date;
}

export interface Customer {
  SL?: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  ADDRESS1?: string;
  ADDRESS2?: string;
  ADDRESS3?: string;
  STATE_CODE?: string;
  GSTIN?: string;
  PAN_NO?: string;
  MOBILE_NO?: string;
  EMAIL_ID?: string;
  BANK_CODE?: string;
  IFSC_BRANCH?: string;
  IFSC_CODE?: string;
  ACC_NO?: string;
  CREATED_DATE?: string;
}

export interface Product {
  SL?: number;
  QLTY_CODE: string;
  QLTY_NAME: string;
  HSN_CODE?: string;
  TYPE: string;
  CREATED_DATE?: string;
}

export interface PIItem {
  PRODUCT_QUALITY: string;
  HSN_CODE?: string;
  QUANTITY_KG: number;
  RATE_PER_UNIT: number;
  UNIT_COUNT: number;
  AMOUNT?: number;
}

export interface PI {
  PI_NO: string;
  INVOICE_DATE: string;
  ITEMS?: string | PIItem[];
  CURRENCY?: string;
  SELLER_NAME: string;
  SELLER_GSTIN?: string;
  SELLER_CIN?: string;
  CERTIFICATE_NO?: string;
  CUSTOMER_NAME: string;
  CUSTOMER_GST_NO?: string;
  CUSTOMER_ADDRESS?: string;
  DELIVERY_NAME?: string;
  DELIVERY_ADDRESS?: string;
  DELIVERY_GST_NO?: string;
  DELIVERY_STATE?: string;
  DELIVERY_PIN?: string;
  PRODUCT_QUALITY: string;
  UNIT_COUNT: number;
  QUANTITY_KG: number;
  RATE_PER_UNIT: number;
  ITEM_TOTAL: number;
  NET_AMOUNT: number;
  AUTHORIZED_SIGNATORY: string;
  STATUS: 'RUNNING' | 'COMPLETE';
  
  // Extras
  PAYMENT_TERMS?: string;
  NOTE?: string;
  CONSIGNMENT_NOTE?: string;
  VEHICLE_NO?: string;
  TRANSPORT_MODE?: string;
  
  DELIVERY_CHARGES?: string;
  CGST_PERCENT?: string;
  SGST_PERCENT?: string;
  IGST_PERCENT?: string;
  OTHER_CHARGES?: string;
  
  CREATED_DATE?: string;
  // Computed fields
  totalDelivered?: number;
  remaining?: number;
  isComplete?: boolean;
}

export interface DeliveryRecord {
  id: string;
  liftingId: string;
  piNo: string;
  quantityKg: number;
  deliveryDate: string;
  timestamp: string;
}

export interface Lifting {
  LIFTING_ID: string;
  PI_NO: string;
  ACCOUNT: string;
  CONTACT?: string;
  RUNNING_PI_KG: number;
  TARGET_KG: number;
  DELIVERED_KG: number;
  REMAINING_KG: number;
  FREQUENCY: number;
  STATUS: 'RUNNING' | 'COMPLETE' | 'NOT STARTED';
  LAST_DELIVERY_DATE?: string;
  LAST_QTY?: number;
  NOTES?: string;
  CREATED_DATE?: string;
  HISTORY?: DeliveryRecord[];
}
