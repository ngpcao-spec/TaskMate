import {
  parseFamilyDetail,
  parseFamilyPage,
  parseHealth,
  parseOverview,
  parseSeries,
  parseUsage,
  type FamilyDetail,
  type FamilyPage,
  type FamilySort,
  type Health,
  type Overview,
  type Series,
  type Usage,
} from '@/domain/admin-stats';
import { supabase } from './supabase';

/**
 * Suivi des utilisateurs (D-102) : TOUT passe par des RPC `admin_*` qui commencent par `catalog_require_admin()` côté base. Lecture seule : aucune écriture
 * n'existe ici. Les agrégats sont calculés en SQL ; seuls des nombres, un pays et une classe arrivent (jamais de contenu ni de prénom d'enfant).
 */
const fail = (error: { message: string } | null): void => {
  if (error) throw error;
};

export async function fetchAdminOverview(): Promise<Overview> {
  const { data, error } = await supabase.rpc('admin_stats_overview');
  fail(error);
  return parseOverview(data);
}

export async function fetchAdminSeries(): Promise<Series> {
  const { data, error } = await supabase.rpc('admin_stats_series');
  fail(error);
  return parseSeries(data);
}

export async function fetchAdminUsage(): Promise<Usage> {
  const { data, error } = await supabase.rpc('admin_stats_usage');
  fail(error);
  return parseUsage(data);
}

export async function fetchAdminFamilies(search: string, sort: FamilySort, dir: 'asc' | 'desc', page: number): Promise<FamilyPage> {
  const { data, error } = await supabase.rpc('admin_families', { p_search: search, p_sort: sort, p_dir: dir, p_page: page });
  fail(error);
  return parseFamilyPage(data);
}

export async function fetchAdminFamily(familyId: string): Promise<FamilyDetail> {
  const { data, error } = await supabase.rpc('admin_family_detail', { p_family: familyId });
  fail(error);
  return parseFamilyDetail(data);
}

export async function fetchAdminHealth(): Promise<Health> {
  const { data, error } = await supabase.rpc('admin_health');
  fail(error);
  return parseHealth(data);
}
