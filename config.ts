/**
 * ACCESS CONTROL
 * The app owner's Gmail address. Only this account receives the "admin" role
 * and can see or open the Management Dashboard; for everyone else the page
 * does not appear and /#admin redirects to the homepage.
 * Replace the placeholder below with the owner's real Gmail.
 *
 * IMPORTANT: this app runs entirely in the browser, so the check is a
 * front-end gate only. Before going live, move authentication to a real
 * provider (Google OAuth / Firebase Auth) and enforce the admin role on a
 * server or in database rules.
 */
export const ADMIN_EMAILS: string[] = ['santhosh2982008@gmail.com'];

/** Sign-in protection */
export const SESSION_HOURS = 8;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 5;

/** Shipping, GST, payment methods and coupons are now edited in the Management Dashboard. */
export const KEY_PREFIX = 'vel.v1.';

export const ORDER_STATUSES = ['Pending Owner Approval', 'Placed', 'Packaged', 'Couriered', 'Out for delivery', 'Delivered', 'Cancelled'] as const;
/** The only stages a vendor moves an order through, in order. */
export const VENDOR_STAGES = ['Placed', 'Packaged', 'Couriered', 'Out for delivery', 'Delivered'] as const;
export const ENQUIRY_STATUSES = ['New', 'Contacted', 'Scheduled', 'Closed'] as const;

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;
