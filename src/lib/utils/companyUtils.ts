// Company and database utility functions to reduce code duplication
import { getCurrentCompany } from '../services/gameState';
import { supabase } from '../database/supabase';

// ===== COMPANY UTILITIES =====

/**
 * Get current company ID - fails fast if no company is active
 * This prevents silent failures when operations run against non-existent companies
 */
export function getCurrentCompanyId(): string {
  const currentCompany = getCurrentCompany();
  if (!currentCompany?.id) {
    throw new Error('No active company found. Please select or create a company before performing this action.');
  }
  return currentCompany.id;
}

// ===== DATABASE UTILITIES =====

/**
 * Get a query builder with company_id filter applied
 * Reduces duplication across all database operations
 */
export function getCompanyQuery(table: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).select().eq('company_id', companyId);
}

/**
 * Get a query builder for deleting company-specific records
 */
export function getCompanyDeleteQuery(table: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).delete().eq('company_id', companyId);
}

/**
 * Get a query builder for updating company-specific records
 */
export function getCompanyUpdateQuery(table: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).update({}).eq('company_id', companyId);
}

/**
 * Insert a record with company_id automatically added
 */
export async function insertCompanyRecord(table: string, data: any) {
  const companyId = getCurrentCompanyId();
  const recordWithCompany = { ...data, company_id: companyId };
  return supabase.from(table).insert(recordWithCompany);
}

/**
 * Upsert a record with company_id automatically added
 */
export async function upsertCompanyRecord(table: string, data: any) {
  const companyId = getCurrentCompanyId();
  const recordWithCompany = { ...data, company_id: companyId };
  return supabase.from(table).upsert(recordWithCompany);
}

/**
 * Get all records for current company
 */
export async function getAllCompanyRecords(table: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).select().eq('company_id', companyId);
}

/**
 * Get single record for current company by ID
 */
export async function getCompanyRecord(table: string, id: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).select().eq('company_id', companyId).eq('id', id).single();
}
