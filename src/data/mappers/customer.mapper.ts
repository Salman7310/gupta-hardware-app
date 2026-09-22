import { Customer } from '../../models/customer';
import { customers } from '../db/schema';

type Row = typeof customers.$inferSelect;
type Insert = typeof customers.$inferInsert;

export function toCustomer(row: Row): Customer {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    phone: row.phone,
    address: row.address,
    gstin: row.gstin,
    updatedAt: row.updatedAt,
  };
}

export function toCustomerRow(customer: Customer, deviceId: string): Insert {
  return {
    id: customer.id,
    shopId: customer.shopId,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    gstin: customer.gstin,
    deviceId,
    updatedAt: customer.updatedAt,
    deletedAt: null,
  };
}
