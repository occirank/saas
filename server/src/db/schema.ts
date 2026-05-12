import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum, bigint, boolean } from 'drizzle-orm/pg-core';
import type { AuditResult } from '../types.js';

export const auditStatusEnum = pgEnum('audit_status', ['pending', 'running', 'completed', 'failed']);
export const auditTypeEnum = pgEnum('audit_type', ['single', 'crawl', 'full']);

export const audits = pgTable('audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  url: text('url').notNull(),
  overallScore: integer('overall_score').notNull().default(0),
  status: auditStatusEnum('status').notNull().default('completed'),
  auditType: auditTypeEnum('audit_type').notNull().default('single'),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time').defaultNow().notNull(),
  auditData: jsonb('audit_data').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AuditRecord = typeof audits.$inferSelect;
export type NewAudit = typeof audits.$inferInsert;

// GSC OAuth tokens table
export const gscTokens = pgTable('gsc_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiryDate: bigint('expiry_date', { mode: 'number' }).notNull(),
  tokenType: text('token_type').notNull().default('Bearer'),
  scope: text('scope'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// GSC sites configuration
export const gscSites = pgTable('gsc_sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteUrl: text('site_url').notNull().unique(),
  permissionLevel: text('permission_level').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// GSC cached analytics data
export const gscAnalytics = pgTable('gsc_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteUrl: text('site_url').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  analyticsData: jsonb('analytics_data').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type GscTokenRecord = typeof gscTokens.$inferSelect;
export type NewGscToken = typeof gscTokens.$inferInsert;
export type GscSiteRecord = typeof gscSites.$inferSelect;
export type NewGscSite = typeof gscSites.$inferInsert;
export type GscAnalyticsRecord = typeof gscAnalytics.$inferSelect;
export type NewGscAnalytics = typeof gscAnalytics.$inferInsert;

// GSC index coverage cache
export const gscIndexCache = pgTable('gsc_index_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteUrl: text('site_url').notNull().unique(),
  results: jsonb('results').notNull().$type<Record<string, unknown>[]>(),
  summary: jsonb('summary').notNull().$type<{ total: number; indexed: number; notIndexed: number; errors: number }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type GscIndexCacheRecord = typeof gscIndexCache.$inferSelect;
export type NewGscIndexCache = typeof gscIndexCache.$inferInsert;

// GA OAuth tokens table
export const gaTokens = pgTable('ga_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiryDate: bigint('expiry_date', { mode: 'number' }).notNull(),
  tokenType: text('token_type').notNull().default('Bearer'),
  scope: text('scope'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// GA properties configuration
export const gaProperties = pgTable('ga_properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: text('property_id').notNull().unique(),
  propertyName: text('property_name').notNull(),
  accountName: text('account_name').notNull(),
  websiteUrl: text('website_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// GA cached analytics data
export const gaAnalytics = pgTable('ga_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: text('property_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  analyticsData: jsonb('analytics_data').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type GaTokenRecord = typeof gaTokens.$inferSelect;
export type NewGaToken = typeof gaTokens.$inferInsert;
export type GaPropertyRecord = typeof gaProperties.$inferSelect;
export type NewGaProperty = typeof gaProperties.$inferInsert;
export type GaAnalyticsRecord = typeof gaAnalytics.$inferSelect;
export type NewGaAnalytics = typeof gaAnalytics.$inferInsert;


// SEOptimer audit cache
export const seoptimerCache = pgTable('seoptimer_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  url: text('url').notNull().unique(),
  reportId: text('report_id').notNull(),
  auditData: jsonb('audit_data').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Page target keywords - keywords to target per URL
export const pageKeywords = pgTable('page_keywords', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditId: uuid('audit_id').notNull().references(() => audits.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  keyword: text('keyword').notNull(),
  priority: integer('priority').notNull().default(1), // 1=primary, 2=secondary, 3=tertiary
  source: text('source').notNull().default('manual'), // manual, gsc, suggested
  searchVolume: integer('search_volume'),
  difficulty: integer('difficulty'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type PageKeywordRecord = typeof pageKeywords.$inferSelect;
export type NewPageKeyword = typeof pageKeywords.$inferInsert;

// Page priority/importance - mark important pages for SEO
export const pagePriorities = pgTable('page_priorities', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditId: uuid('audit_id').notNull().references(() => audits.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  priority: integer('priority').notNull().default(1), // 1=critical, 2=high, 3=medium, 4=low
  isLandingPage: boolean('is_landing_page').notNull().default(false),
  isConversionPage: boolean('is_conversion_page').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type PagePriorityRecord = typeof pagePriorities.$inferSelect;
export type NewPagePriority = typeof pagePriorities.$inferInsert;

// Navigation structure - extracted nav elements per page
export const navigationStructure = pgTable('navigation_structure', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditId: uuid('audit_id').notNull().references(() => audits.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  navItems: jsonb('nav_items').notNull().$type<NavItem[]>().default([]),
  hasMainNav: boolean('has_main_nav').notNull().default(false),
  hasFooterNav: boolean('has_footer_nav').notNull().default(false),
  hasBreadcrumb: boolean('has_breadcrumb').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export interface NavItem {
  text: string;
  href: string;
  level: number;
  parentHref?: string;
  isCurrent?: boolean;
}

export type NavigationStructureRecord = typeof navigationStructure.$inferSelect;
export type NewNavigationStructure = typeof navigationStructure.$inferInsert;

// SEO audit answers - cached answers to the 50 questions
export const seoAuditAnswers = pgTable('seo_audit_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditId: uuid('audit_id').notNull().references(() => audits.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull(), // Q1, Q2, etc.
  question: text('question').notNull(),
  answer: text('answer').notNull(), // 'yes', 'no', 'partial', 'unknown'
  status: text('status').notNull(), // 'pass', 'fail', 'warning', 'info'
  details: text('details'),
  affectedPages: jsonb('affected_pages').$type<string[]>().default([]),
  metrics: jsonb('metrics').$type<Record<string, number>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SeoAuditAnswerRecord = typeof seoAuditAnswers.$inferSelect;
export type NewSeoAuditAnswer = typeof seoAuditAnswers.$inferInsert;

export type SeoptimerCacheRecord = typeof seoptimerCache.$inferSelect;
export type NewSeoptimerCache = typeof seoptimerCache.$inferInsert;

// Keyword tracking - projects to group keywords by domain
export const keywordProjects = pgTable('keyword_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Keywords being tracked
export const keywords = pgTable('keywords', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => keywordProjects.id, { onDelete: 'cascade' }),
  keyword: text('keyword').notNull(),
  targetUrl: text('target_url'),
  searchEngine: text('search_engine').notNull().default('google'),
  location: text('location').notNull().default('us'),
  device: text('device').notNull().default('desktop'),
  language: text('language').notNull().default('en'),
  isActive: boolean('is_active').notNull().default(true),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Daily ranking snapshots
export const keywordRankings = pgTable('keyword_rankings', {
  id: uuid('id').defaultRandom().primaryKey(),
  keywordId: uuid('keyword_id').notNull().references(() => keywords.id, { onDelete: 'cascade' }),
  position: integer('position'),
  previousPosition: integer('previous_position'),
  urlFound: text('url_found'),
  title: text('title'),
  description: text('description'),
  searchVolume: integer('search_volume'),
  difficulty: integer('difficulty'),
  resultCount: bigint('result_count', { mode: 'number' }),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

// SERP result cache (top 100 results per keyword check)
export const serpResults = pgTable('serp_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  keywordId: uuid('keyword_id').notNull().references(() => keywords.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  url: text('url').notNull(),
  title: text('title'),
  description: text('description'),
  domain: text('domain'),
  isVideo: boolean('is_video').notNull().default(false),
  videoDuration: text('video_duration'),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
});

export type KeywordProjectRecord = typeof keywordProjects.$inferSelect;
export type NewKeywordProject = typeof keywordProjects.$inferInsert;
export type KeywordRecord = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type KeywordRankingRecord = typeof keywordRankings.$inferSelect;
export type NewKeywordRanking = typeof keywordRankings.$inferInsert;
export type SerpResultRecord = typeof serpResults.$inferSelect;
export type NewSerpResult = typeof serpResults.$inferInsert;