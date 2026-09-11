-- =============================================================================
-- BOQPilot migration verification: 00000000000001 .. 00000000000014
-- =============================================================================
-- READ-ONLY. Does not create, alter, or drop anything, and does not touch any
-- application data. Every check is a SELECT against information_schema /
-- pg_catalog / storage.buckets / pg_policies. Safe to run in the Supabase SQL
-- Editor (or psql) against production at any time.
--
-- What it checks, per migration file, in the FINAL expected state (i.e. if a
-- later migration renamed/dropped/altered something an earlier migration
-- created, the check reflects the current expected shape, not the
-- intermediate one — e.g. payments.provider was renamed to payment_provider
-- by migration 3, so migration 2's row checks for columns that were NOT
-- later touched, and migration 3 has its own row confirming the rename).
--
-- Output: one row per expected object with PRESENT / MISSING.
-- Run the whole script — it is a single statement (one big UNION ALL CTE) so
-- the SQL Editor will return exactly one result grid with every row.
--
-- To find out which migrations still need manual attention: look for any
-- MISSING rows and read off their migration column. A migration with zero
-- MISSING rows is fully reflected in the live database.
-- =============================================================================

with checks(ord, migration, object_type, expected_object, present) as (

  -- ============================================================ migration 1
  select 1, '00000000000001_init', 'extension', 'pgcrypto',
    exists (select 1 from pg_extension where extname = 'pgcrypto')
  union all
  select 2, '00000000000001_init', 'table', 'public.profiles',
    to_regclass('public.profiles') is not null
  union all
  select 3, '00000000000001_init', 'columns',
    'profiles(id, full_name, company_name, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = any (array['id','full_name','company_name','created_at','updated_at'])) = 5
  union all
  select 4, '00000000000001_init', 'table', 'public.projects',
    to_regclass('public.projects') is not null
  union all
  select 5, '00000000000001_init', 'columns',
    'projects(id, name, description, status, created_at, updated_at) [owner_id later renamed -> see migration 4]',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = any (array['id','name','description','status','created_at','updated_at'])) = 6
  union all
  select 6, '00000000000001_init', 'table', 'public.boq_items',
    to_regclass('public.boq_items') is not null
  union all
  select 7, '00000000000001_init', 'columns',
    'boq_items(id, project_id, item_code, description, unit, quantity, unit_rate, benchmark_rate, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boq_items'
        and column_name = any (array['id','project_id','item_code','description','unit','quantity','unit_rate','benchmark_rate','created_at','updated_at'])) = 10
  union all
  select 8, '00000000000001_init', 'rls', 'profiles: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'profiles' and c.relrowsecurity)
  union all
  select 9, '00000000000001_init', 'rls', 'projects: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'projects' and c.relrowsecurity)
  union all
  select 10, '00000000000001_init', 'rls', 'boq_items: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'boq_items' and c.relrowsecurity)
  union all
  select 11, '00000000000001_init', 'policy', 'profiles: "Users can view their own profile"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can view their own profile')
  union all
  select 12, '00000000000001_init', 'policy', 'profiles: "Users can update their own profile"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can update their own profile')
  union all
  select 13, '00000000000001_init', 'policy', 'boq_items: "Users can manage BOQ items on their own projects"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boq_items'
      and policyname = 'Users can manage BOQ items on their own projects')
  union all
  select 14, '00000000000001_init', 'function', 'public.handle_new_user()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user')
  union all
  select 15, '00000000000001_init', 'trigger', 'auth.users: on_auth_user_created',
    exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created' and not t.tgisinternal)

  -- ============================================================ migration 2
  union all
  select 16, '00000000000002_payments', 'table (removed)', 'public.stripe_customers should NOT exist',
    to_regclass('public.stripe_customers') is null
  union all
  select 17, '00000000000002_payments', 'table', 'public.payments',
    to_regclass('public.payments') is not null
  union all
  select 18, '00000000000002_payments', 'columns',
    'payments(id, user_id, amount, currency, item_name, raw_itn, created_at, updated_at) [provider/provider_payment_id/status/m_payment_id later renamed or dropped -> see migration 3]',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'payments'
        and column_name = any (array['id','user_id','amount','currency','item_name','raw_itn','created_at','updated_at'])) = 8
  union all
  select 19, '00000000000002_payments', 'index', 'payments_user_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payments_user_id_idx')
  union all
  select 20, '00000000000002_payments', 'rls', 'payments: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'payments' and c.relrowsecurity)
  union all
  select 21, '00000000000002_payments', 'policy', 'payments: "Users can view their own payments"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments'
      and policyname = 'Users can view their own payments')
  union all
  select 22, '00000000000002_payments', 'policy', 'payments: "Users can create their own pending payments"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments'
      and policyname = 'Users can create their own pending payments')

  -- ============================================================ migration 3
  union all
  select 23, '00000000000003_boq_pricing', 'columns',
    'profiles(free_boq_used, free_boq_used_at, paid_boq_count, total_pages_processed, lifetime_spend)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = any (array['free_boq_used','free_boq_used_at','paid_boq_count','total_pages_processed','lifetime_spend'])) = 5
  union all
  select 24, '00000000000003_boq_pricing', 'table', 'public.boqs',
    to_regclass('public.boqs') is not null
  union all
  select 25, '00000000000003_boq_pricing', 'columns',
    'boqs(id, user_id, project_id, filename, page_count, pricing_tier, price, currency, is_free, created_at, updated_at) [status column later dropped -> see migration 4]',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boqs'
        and column_name = any (array['id','user_id','project_id','filename','page_count','pricing_tier','price','currency','is_free','created_at','updated_at'])) = 11
  union all
  select 26, '00000000000003_boq_pricing', 'index', 'boqs_user_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'boqs_user_id_idx')
  union all
  select 27, '00000000000003_boq_pricing', 'rls', 'boqs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'boqs' and c.relrowsecurity)
  union all
  select 28, '00000000000003_boq_pricing', 'column rename', 'payments.provider -> payment_provider',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_provider')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider')
  union all
  select 29, '00000000000003_boq_pricing', 'column rename', 'payments.provider_payment_id -> provider_transaction_id',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_transaction_id')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_payment_id')
  union all
  select 30, '00000000000003_boq_pricing', 'column rename', 'payments.status -> payment_status',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_status')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'status')
  union all
  select 31, '00000000000003_boq_pricing', 'columns', 'payments(boq_id, pricing_tier, payment_date) added',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'payments'
        and column_name = any (array['boq_id','pricing_tier','payment_date'])) = 3
  union all
  select 32, '00000000000003_boq_pricing', 'column dropped', 'payments.m_payment_id should NOT exist',
    not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'm_payment_id')
  union all
  select 33, '00000000000003_boq_pricing', 'index', 'payments_boq_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payments_boq_id_idx')

  -- ============================================================ migration 4
  union all
  select 34, '00000000000004_enterprise_architecture', 'extension', 'vector',
    exists (select 1 from pg_extension where extname = 'vector')
  union all
  select 35, '00000000000004_enterprise_architecture', 'table', 'public.organisations',
    to_regclass('public.organisations') is not null
  union all
  select 36, '00000000000004_enterprise_architecture', 'columns', 'organisations(id, name, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'organisations'
        and column_name = any (array['id','name','created_at','updated_at'])) = 4
  union all
  select 37, '00000000000004_enterprise_architecture', 'columns', 'profiles(organisation_id NOT NULL, role)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'organisation_id' and is_nullable = 'NO')
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role')
  union all
  select 38, '00000000000004_enterprise_architecture', 'rls', 'organisations: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'organisations' and c.relrowsecurity)
  union all
  select 39, '00000000000004_enterprise_architecture', 'policy', 'organisations: "Users can view their own organisation"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organisations'
      and policyname = 'Users can view their own organisation')
  union all
  select 40, '00000000000004_enterprise_architecture', 'function', 'public.current_organisation_id()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'current_organisation_id')
  union all
  select 41, '00000000000004_enterprise_architecture', 'column rename', 'projects.owner_id -> created_by',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'created_by')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'owner_id')
  union all
  select 42, '00000000000004_enterprise_architecture', 'columns',
    'projects(organisation_id, project_number, tender_number, contract_number, client_name, contractor_name, province, municipality, town, physical_address, sector, estimated_contract_value, tender_closing_date, award_date, notes)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = any (array['organisation_id','project_number','tender_number','contract_number','client_name','contractor_name','province','municipality','town','physical_address','sector','estimated_contract_value','tender_closing_date','award_date','notes'])) = 15
  union all
  select 43, '00000000000004_enterprise_architecture', 'constraint', 'projects_status_check includes ''archived''',
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.projects') and conname = 'projects_status_check'
      and pg_get_constraintdef(oid) ilike '%archived%')
  union all
  select 44, '00000000000004_enterprise_architecture', 'policy', 'projects: "Organisation members can manage their projects" (replaces old owner-only policy)',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects'
      and policyname = 'Organisation members can manage their projects')
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects'
      and policyname = 'Users can manage their own projects')
  union all
  select 45, '00000000000004_enterprise_architecture', 'index', 'projects_organisation_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'projects_organisation_id_idx')
  union all
  select 46, '00000000000004_enterprise_architecture', 'table', 'public.project_versions',
    to_regclass('public.project_versions') is not null
  union all
  select 47, '00000000000004_enterprise_architecture', 'columns',
    'project_versions(id, project_id, version_number, version_label, created_by, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'project_versions'
        and column_name = any (array['id','project_id','version_number','version_label','created_by','created_at'])) = 6
  union all
  select 48, '00000000000004_enterprise_architecture', 'constraint', 'project_versions: unique(project_id, version_number)',
    exists (
      select 1 from information_schema.table_constraints tc
      where tc.table_schema = 'public' and tc.table_name = 'project_versions' and tc.constraint_type = 'UNIQUE'
        and (select count(*) from information_schema.key_column_usage kcu
              where kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
                and kcu.column_name in ('project_id','version_number')) = 2
    )
  union all
  select 49, '00000000000004_enterprise_architecture', 'rls', 'project_versions: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'project_versions' and c.relrowsecurity)
  union all
  select 50, '00000000000004_enterprise_architecture', 'policy', 'project_versions: "Organisation members can view their project versions"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_versions'
      and policyname = 'Organisation members can view their project versions')
  union all
  select 51, '00000000000004_enterprise_architecture', 'policy', 'project_versions: "Organisation members can create project versions"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_versions'
      and policyname = 'Organisation members can create project versions')
  union all
  select 52, '00000000000004_enterprise_architecture', 'index', 'project_versions_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'project_versions_project_id_idx')
  union all
  select 53, '00000000000004_enterprise_architecture', 'columns', 'boqs(project_version_id, file_size_bytes) added',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boqs'
        and column_name = any (array['project_version_id','file_size_bytes'])) = 2
  union all
  select 54, '00000000000004_enterprise_architecture', 'column dropped', 'boqs.status should NOT exist',
    not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boqs' and column_name = 'status')
  union all
  select 55, '00000000000004_enterprise_architecture', 'policy', 'boqs: "Organisation members can manage their BOQs" (replaces old owner-only policy)',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boqs'
      and policyname = 'Organisation members can manage their BOQs')
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boqs'
      and policyname = 'Users can manage their own BOQs')
  union all
  select 56, '00000000000004_enterprise_architecture', 'index', 'boqs_project_version_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'boqs_project_version_id_idx')
  union all
  select 57, '00000000000004_enterprise_architecture', 'table', 'public.processing_jobs',
    to_regclass('public.processing_jobs') is not null
  union all
  select 58, '00000000000004_enterprise_architecture', 'columns',
    'processing_jobs(id, job_number, boq_id, project_id, status, progress, priority, estimated_completion, started_at, completed_at, retry_count, failure_reason, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'processing_jobs'
        and column_name = any (array['id','job_number','boq_id','project_id','status','progress','priority','estimated_completion','started_at','completed_at','retry_count','failure_reason','created_at','updated_at'])) = 14
  union all
  select 59, '00000000000004_enterprise_architecture', 'constraint', 'processing_jobs status check includes ''AI_EXTRACTION'' and ''GENERATING_EXPORT''',
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.processing_jobs') and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%AI_EXTRACTION%' and pg_get_constraintdef(oid) ilike '%GENERATING_EXPORT%')
  union all
  select 60, '00000000000004_enterprise_architecture', 'rls', 'processing_jobs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'processing_jobs' and c.relrowsecurity)
  union all
  select 61, '00000000000004_enterprise_architecture', 'policy', 'processing_jobs: "Organisation members can manage their processing jobs"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'processing_jobs'
      and policyname = 'Organisation members can manage their processing jobs')
  union all
  select 62, '00000000000004_enterprise_architecture', 'index', 'processing_jobs_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'processing_jobs_project_id_idx')
  union all
  select 63, '00000000000004_enterprise_architecture', 'table', 'public.pricing_runs',
    to_regclass('public.pricing_runs') is not null
  union all
  select 64, '00000000000004_enterprise_architecture', 'columns',
    'pricing_runs(id, run_number, project_id, boq_id, created_by, ai_recommendation, final_approved_rates, manual_changes, confidence_scores, benchmark_results, comments, completed_at, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'pricing_runs'
        and column_name = any (array['id','run_number','project_id','boq_id','created_by','ai_recommendation','final_approved_rates','manual_changes','confidence_scores','benchmark_results','comments','completed_at','created_at','updated_at'])) = 14
  union all
  select 65, '00000000000004_enterprise_architecture', 'function', 'public.prevent_completed_pricing_run_update()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'prevent_completed_pricing_run_update')
  union all
  select 66, '00000000000004_enterprise_architecture', 'trigger', 'pricing_runs: pricing_runs_immutable_after_completion',
    exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pricing_runs' and t.tgname = 'pricing_runs_immutable_after_completion' and not t.tgisinternal)
  union all
  select 67, '00000000000004_enterprise_architecture', 'rls', 'pricing_runs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pricing_runs' and c.relrowsecurity)
  union all
  select 68, '00000000000004_enterprise_architecture', 'policy', 'pricing_runs: "Organisation members can manage their pricing runs"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pricing_runs'
      and policyname = 'Organisation members can manage their pricing runs')
  union all
  select 69, '00000000000004_enterprise_architecture', 'index', 'pricing_runs_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pricing_runs_project_id_idx')
  union all
  select 70, '00000000000004_enterprise_architecture', 'table', 'public.exports',
    to_regclass('public.exports') is not null
  union all
  select 71, '00000000000004_enterprise_architecture', 'columns',
    'exports(id, project_id, boq_id, pricing_run_id, export_type, file_path, created_by, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'exports'
        and column_name = any (array['id','project_id','boq_id','pricing_run_id','export_type','file_path','created_by','created_at'])) = 8
  union all
  select 72, '00000000000004_enterprise_architecture', 'rls', 'exports: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'exports' and c.relrowsecurity)
  union all
  select 73, '00000000000004_enterprise_architecture', 'policy', 'exports: "Organisation members can manage their exports"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'exports'
      and policyname = 'Organisation members can manage their exports')
  union all
  select 74, '00000000000004_enterprise_architecture', 'index', 'exports_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'exports_project_id_idx')
  union all
  select 75, '00000000000004_enterprise_architecture', 'table', 'public.audit_log',
    to_regclass('public.audit_log') is not null
  union all
  select 76, '00000000000004_enterprise_architecture', 'columns',
    'audit_log(id, organisation_id, actor_user_id, event_type, entity_type, entity_id, metadata, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_log'
        and column_name = any (array['id','organisation_id','actor_user_id','event_type','entity_type','entity_id','metadata','created_at'])) = 8
  union all
  select 77, '00000000000004_enterprise_architecture', 'rls', 'audit_log: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'audit_log' and c.relrowsecurity)
  union all
  select 78, '00000000000004_enterprise_architecture', 'policy', 'audit_log: "Organisation members can view their audit log"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_log'
      and policyname = 'Organisation members can view their audit log')
  union all
  select 79, '00000000000004_enterprise_architecture', 'policy', 'audit_log: "Organisation members can append to their audit log"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_log'
      and policyname = 'Organisation members can append to their audit log')
  union all
  select 80, '00000000000004_enterprise_architecture', 'index', 'audit_log_organisation_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'audit_log_organisation_id_idx')
  union all
  select 81, '00000000000004_enterprise_architecture', 'table', 'public.project_timeline',
    to_regclass('public.project_timeline') is not null
  union all
  select 82, '00000000000004_enterprise_architecture', 'columns',
    'project_timeline(id, project_id, event_type, event_at, metadata, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'project_timeline'
        and column_name = any (array['id','project_id','event_type','event_at','metadata','created_at'])) = 6
  union all
  select 83, '00000000000004_enterprise_architecture', 'rls', 'project_timeline: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'project_timeline' and c.relrowsecurity)
  union all
  select 84, '00000000000004_enterprise_architecture', 'policy', 'project_timeline: "Organisation members can view their project timeline"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_timeline'
      and policyname = 'Organisation members can view their project timeline')
  union all
  select 85, '00000000000004_enterprise_architecture', 'policy', 'project_timeline: "Organisation members can append to their project timeline"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_timeline'
      and policyname = 'Organisation members can append to their project timeline')
  union all
  select 86, '00000000000004_enterprise_architecture', 'index', 'project_timeline_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'project_timeline_project_id_idx')
  union all
  select 87, '00000000000004_enterprise_architecture', 'table', 'public.rate_library_items',
    to_regclass('public.rate_library_items') is not null
  union all
  select 88, '00000000000004_enterprise_architecture', 'columns',
    'rate_library_items(id, organisation_id, source_boq_id, original_description, normalised_description, construction_category, normalised_unit, material_classification, historical_stats, embedding, ai_confidence, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'rate_library_items'
        and column_name = any (array['id','organisation_id','source_boq_id','original_description','normalised_description','construction_category','normalised_unit','material_classification','historical_stats','embedding','ai_confidence','created_at','updated_at'])) = 13
  union all
  select 89, '00000000000004_enterprise_architecture', 'rls', 'rate_library_items: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'rate_library_items' and c.relrowsecurity)
  union all
  select 90, '00000000000004_enterprise_architecture', 'policy', 'rate_library_items: "Organisation members can manage their rate library"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rate_library_items'
      and policyname = 'Organisation members can manage their rate library')
  union all
  select 91, '00000000000004_enterprise_architecture', 'index', 'rate_library_items_organisation_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_organisation_id_idx')

  -- ============================================================ migration 5
  union all
  select 92, '00000000000005_historical_boq_library', 'storage.bucket', 'historical-boqs (private)',
    exists (select 1 from storage.buckets where id = 'historical-boqs' and public = false)
  union all
  select 93, '00000000000005_historical_boq_library', 'storage.policy', 'storage.objects: "Organisation members can read their historical BOQ files"',
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Organisation members can read their historical BOQ files')
  union all
  select 94, '00000000000005_historical_boq_library', 'storage.policy', 'storage.objects: "Organisation members can upload their historical BOQ files"',
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Organisation members can upload their historical BOQ files')
  union all
  select 95, '00000000000005_historical_boq_library', 'table', 'public.historical_boqs',
    to_regclass('public.historical_boqs') is not null
  union all
  select 96, '00000000000005_historical_boq_library', 'columns',
    'historical_boqs(id, organisation_id, project_id, uploaded_by, source_type, original_filename, storage_path, file_size_bytes, mime_type, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'historical_boqs'
        and column_name = any (array['id','organisation_id','project_id','uploaded_by','source_type','original_filename','storage_path','file_size_bytes','mime_type','created_at','updated_at'])) = 11
  union all
  select 97, '00000000000005_historical_boq_library', 'rls', 'historical_boqs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'historical_boqs' and c.relrowsecurity)
  union all
  select 98, '00000000000005_historical_boq_library', 'policy', 'historical_boqs: "Organisation members can manage their historical BOQs"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'historical_boqs'
      and policyname = 'Organisation members can manage their historical BOQs')
  union all
  select 99, '00000000000005_historical_boq_library', 'index', 'historical_boqs_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boqs_project_id_idx')
  union all
  select 100, '00000000000005_historical_boq_library', 'index', 'historical_boqs_organisation_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boqs_organisation_id_idx')
  union all
  select 101, '00000000000005_historical_boq_library', 'table', 'public.historical_boq_processing_jobs',
    to_regclass('public.historical_boq_processing_jobs') is not null
  union all
  select 102, '00000000000005_historical_boq_library', 'columns',
    'historical_boq_processing_jobs(id, job_number, historical_boq_id, project_id, status, rows_detected, rows_extracted, rows_needs_review, rows_error, error_summary, failure_reason, started_at, completed_at, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'historical_boq_processing_jobs'
        and column_name = any (array['id','job_number','historical_boq_id','project_id','status','rows_detected','rows_extracted','rows_needs_review','rows_error','error_summary','failure_reason','started_at','completed_at','created_at','updated_at'])) = 15
  union all
  select 103, '00000000000005_historical_boq_library', 'rls', 'historical_boq_processing_jobs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'historical_boq_processing_jobs' and c.relrowsecurity)
  union all
  select 104, '00000000000005_historical_boq_library', 'index', 'historical_boq_processing_jobs_project_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_processing_jobs_project_id_idx')
  union all
  select 105, '00000000000005_historical_boq_library', 'table', 'public.historical_boq_items',
    to_regclass('public.historical_boq_items') is not null
  union all
  select 106, '00000000000005_historical_boq_library', 'columns',
    'historical_boq_items(id, organisation_id, project_id, historical_boq_id, uploaded_at, row_number, section, item_code, description, unit, quantity, unit_rate, amount, category, status, validation_errors, raw_row, created_at, description_search)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'historical_boq_items'
        and column_name = any (array['id','organisation_id','project_id','historical_boq_id','uploaded_at','row_number','section','item_code','description','unit','quantity','unit_rate','amount','category','status','validation_errors','raw_row','created_at','description_search'])) = 19
  union all
  select 107, '00000000000005_historical_boq_library', 'rls', 'historical_boq_items: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'historical_boq_items' and c.relrowsecurity)
  union all
  select 108, '00000000000005_historical_boq_library', 'policy', 'historical_boq_items: "Organisation members can manage their historical BOQ items"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'historical_boq_items'
      and policyname = 'Organisation members can manage their historical BOQ items')
  union all
  select 109, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_org_project_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_org_project_idx')
  union all
  select 110, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_historical_boq_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_historical_boq_id_idx')
  union all
  select 111, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_section_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_section_idx')
  union all
  select 112, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_unit_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_unit_idx')
  union all
  select 113, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_category_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_category_idx')
  union all
  select 114, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_status_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_status_idx')
  union all
  select 115, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_uploaded_at_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_uploaded_at_idx')
  union all
  select 116, '00000000000005_historical_boq_library', 'index', 'historical_boq_items_description_search_idx (gin)',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_description_search_idx')
  union all
  select 117, '00000000000005_historical_boq_library', 'function', 'public.list_historical_boq_sections()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_historical_boq_sections')
  union all
  select 118, '00000000000005_historical_boq_library', 'function', 'public.list_historical_boq_units()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_historical_boq_units')
  union all
  select 119, '00000000000005_historical_boq_library', 'function', 'public.list_historical_boq_categories()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_historical_boq_categories')

  -- ============================================================ migration 6
  union all
  select 120, '00000000000006_construction_intelligence', 'column', 'historical_boq_items.canonical_item_id',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boq_items' and column_name = 'canonical_item_id')
  union all
  select 121, '00000000000006_construction_intelligence', 'index', 'historical_boq_items_canonical_item_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_canonical_item_id_idx')
  union all
  select 122, '00000000000006_construction_intelligence', 'columns',
    'rate_library_items(category_division, duplicate_group_key, sample_count, project_count, avg_rate, median_rate, min_rate, max_rate, stddev_rate, most_recent_rate, most_recent_rate_at, most_recent_historical_boq_id, normalised_description_search)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'rate_library_items'
        and column_name = any (array['category_division','duplicate_group_key','sample_count','project_count','avg_rate','median_rate','min_rate','max_rate','stddev_rate','most_recent_rate','most_recent_rate_at','most_recent_historical_boq_id','normalised_description_search'])) = 13
  union all
  select 123, '00000000000006_construction_intelligence', 'index (unique)', 'rate_library_items_org_dup_key_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_org_dup_key_idx' and indexdef ilike '%unique%')
  union all
  select 124, '00000000000006_construction_intelligence', 'index', 'rate_library_items_category_division_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_category_division_idx')
  union all
  select 125, '00000000000006_construction_intelligence', 'index', 'rate_library_items_construction_category_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_construction_category_idx')
  union all
  select 126, '00000000000006_construction_intelligence', 'index', 'rate_library_items_normalised_unit_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_normalised_unit_idx')
  union all
  select 127, '00000000000006_construction_intelligence', 'index', 'rate_library_items_avg_rate_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_avg_rate_idx')
  union all
  select 128, '00000000000006_construction_intelligence', 'index', 'rate_library_items_normalised_description_search_idx (gin)',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_normalised_description_search_idx')
  union all
  select 129, '00000000000006_construction_intelligence', 'function', 'public.recompute_rate_library_stats(uuid[])',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'recompute_rate_library_stats')
  union all
  select 130, '00000000000006_construction_intelligence', 'function', 'public.list_rate_library_divisions() [pre-migration-7 form]',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_divisions')
  union all
  select 131, '00000000000006_construction_intelligence', 'function', 'public.list_rate_library_categories() [pre-migration-7 form]',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_categories')
  union all
  select 132, '00000000000006_construction_intelligence', 'function', 'public.list_rate_library_units() [pre-migration-7 form]',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_units')

  -- ============================================================ migration 7
  union all
  select 133, '00000000000007_canonical_item_admin', 'columns', 'rate_library_items(merged_into_id, admin_notes)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'rate_library_items'
        and column_name = any (array['merged_into_id','admin_notes'])) = 2
  union all
  select 134, '00000000000007_canonical_item_admin', 'index', 'rate_library_items_merged_into_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_merged_into_id_idx')
  union all
  select 135, '00000000000007_canonical_item_admin', 'function (redefined)', 'public.list_rate_library_divisions() filters merged_into_id is null',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_divisions' and pg_get_functiondef(p.oid) ilike '%merged_into_id%')
  union all
  select 136, '00000000000007_canonical_item_admin', 'function (redefined)', 'public.list_rate_library_categories() filters merged_into_id is null',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_categories' and pg_get_functiondef(p.oid) ilike '%merged_into_id%')
  union all
  select 137, '00000000000007_canonical_item_admin', 'function (redefined)', 'public.list_rate_library_units() filters merged_into_id is null',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_rate_library_units' and pg_get_functiondef(p.oid) ilike '%merged_into_id%')

  -- ============================================================ migration 8
  union all
  select 138, '00000000000008_historical_boq_row_type', 'column + constraint', 'historical_boq_items.row_type (check includes ''preliminary_general'')',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boq_items' and column_name = 'row_type')
    and exists (select 1 from pg_constraint where conrelid = to_regclass('public.historical_boq_items') and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%row_type%' and pg_get_constraintdef(oid) ilike '%preliminary_general%')
  union all
  select 139, '00000000000008_historical_boq_row_type', 'index', 'historical_boq_items_row_type_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_items_row_type_idx')

  -- ============================================================ migration 9
  union all
  select 140, '00000000000009_canonical_item_embeddings', 'columns',
    'rate_library_items(embedding_input_text, embedding_model, embedding_generated_at, embedding_last_error)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'rate_library_items'
        and column_name = any (array['embedding_input_text','embedding_model','embedding_generated_at','embedding_last_error'])) = 4
  union all
  select 141, '00000000000009_canonical_item_embeddings', 'index (partial)', 'rate_library_items_embedding_pending_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rate_library_items_embedding_pending_idx'
      and indexdef ilike '%where%embedding%is null%')

  -- ============================================================ migration 10
  union all
  select 142, '00000000000010_boq_pricing_line_items', 'storage.bucket', 'pricing-boqs (private)',
    exists (select 1 from storage.buckets where id = 'pricing-boqs' and public = false)
  union all
  select 143, '00000000000010_boq_pricing_line_items', 'storage.policy', 'storage.objects: "Organisation members can read their pricing BOQ files"',
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Organisation members can read their pricing BOQ files')
  union all
  select 144, '00000000000010_boq_pricing_line_items', 'storage.policy', 'storage.objects: "Organisation members can upload their pricing BOQ files"',
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Organisation members can upload their pricing BOQ files')
  union all
  select 145, '00000000000010_boq_pricing_line_items', 'columns', 'boqs(storage_path, source_format)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boqs'
        and column_name = any (array['storage_path','source_format'])) = 2
  union all
  select 146, '00000000000010_boq_pricing_line_items', 'table', 'public.boq_line_items',
    to_regclass('public.boq_line_items') is not null
  union all
  select 147, '00000000000010_boq_pricing_line_items', 'columns',
    'boq_line_items(id, organisation_id, project_id, boq_id, row_number, row_type, section, item_code, description, unit, quantity, unit_rate, amount, category, status, validation_errors, raw_row, source_format, normalised_description, normalised_unit, category_division, construction_category, estimator_rate, rate_source, rate_notes, priced_at, priced_by, created_at, updated_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boq_line_items'
        and column_name = any (array['id','organisation_id','project_id','boq_id','row_number','row_type','section','item_code','description','unit','quantity','unit_rate','amount','category','status','validation_errors','raw_row','source_format','normalised_description','normalised_unit','category_division','construction_category','estimator_rate','rate_source','rate_notes','priced_at','priced_by','created_at','updated_at'])) = 29
  union all
  select 148, '00000000000010_boq_pricing_line_items', 'rls', 'boq_line_items: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'boq_line_items' and c.relrowsecurity)
  union all
  select 149, '00000000000010_boq_pricing_line_items', 'policy', 'boq_line_items: "Organisation members can manage their BOQ line items"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boq_line_items'
      and policyname = 'Organisation members can manage their BOQ line items')
  union all
  select 150, '00000000000010_boq_pricing_line_items', 'index', 'boq_line_items_boq_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'boq_line_items_boq_id_idx')
  union all
  select 151, '00000000000010_boq_pricing_line_items', 'index', 'boq_line_items_org_project_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'boq_line_items_org_project_idx')
  union all
  select 152, '00000000000010_boq_pricing_line_items', 'table', 'public.pricing_markup_settings',
    to_regclass('public.pricing_markup_settings') is not null
  union all
  select 153, '00000000000010_boq_pricing_line_items', 'columns',
    'pricing_markup_settings(organisation_id, wastage_percent, site_overhead_percent, head_office_overhead_percent, profit_percent, contingency_percent, updated_at, updated_by)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'pricing_markup_settings'
        and column_name = any (array['organisation_id','wastage_percent','site_overhead_percent','head_office_overhead_percent','profit_percent','contingency_percent','updated_at','updated_by'])) = 8
  union all
  select 154, '00000000000010_boq_pricing_line_items', 'rls', 'pricing_markup_settings: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pricing_markup_settings' and c.relrowsecurity)
  union all
  select 155, '00000000000010_boq_pricing_line_items', 'policy', 'pricing_markup_settings: "Organisation members can manage their pricing markup settings"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pricing_markup_settings'
      and policyname = 'Organisation members can manage their pricing markup settings')

  -- ============================================================ migration 11
  union all
  select 156, '00000000000011_boq_pricing_export_snapshots', 'columns',
    'boq_line_items(cost_buildup_components, cost_buildup_markups, benchmark_snapshot, system_suggested_snapshot, system_suggested_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'boq_line_items'
        and column_name = any (array['cost_buildup_components','cost_buildup_markups','benchmark_snapshot','system_suggested_snapshot','system_suggested_at'])) = 5

  -- ============================================================ migration 12
  union all
  select 157, '00000000000012_market_research', 'table', 'public.market_research_runs',
    to_regclass('public.market_research_runs') is not null
  union all
  select 158, '00000000000012_market_research', 'columns',
    'market_research_runs(id, organisation_id, project_id, boq_id, line_item_id, provider, search_spec, search_spec_hash, status, error_message, overall_confidence, observed_range_min, observed_range_max, observed_range_unit, representative_baseline, high_variance, requested_by, researched_at, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'market_research_runs'
        and column_name = any (array['id','organisation_id','project_id','boq_id','line_item_id','provider','search_spec','search_spec_hash','status','error_message','overall_confidence','observed_range_min','observed_range_max','observed_range_unit','representative_baseline','high_variance','requested_by','researched_at','created_at'])) = 19
  union all
  select 159, '00000000000012_market_research', 'rls', 'market_research_runs: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'market_research_runs' and c.relrowsecurity)
  union all
  select 160, '00000000000012_market_research', 'policy', 'market_research_runs: "Organisation members can manage their market research runs"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'market_research_runs'
      and policyname = 'Organisation members can manage their market research runs')
  union all
  select 161, '00000000000012_market_research', 'index', 'market_research_runs_line_item_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'market_research_runs_line_item_idx')
  union all
  select 162, '00000000000012_market_research', 'index', 'market_research_runs_cache_lookup_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'market_research_runs_cache_lookup_idx')
  union all
  select 163, '00000000000012_market_research', 'table', 'public.market_evidence',
    to_regclass('public.market_evidence') is not null
  union all
  select 164, '00000000000012_market_research', 'columns',
    'market_evidence(id, research_run_id, organisation_id, project_id, line_item_id, supplier_name, source_title, source_url, source_domain, product_description, manufacturer, brand, specification, dimensions, source_price, currency, vat_status, pricing_basis, pack_quantity, normalised_unit, normalised_price, normalisation_calculation, delivery_status, geographic_relevance, evidence_classification, match_type, evidence_quality, verified, is_accepted, rejection_reason, is_manual, quote_reference, source_date, retrieved_at, notes, created_by, created_at)',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'market_evidence'
        and column_name = any (array['id','research_run_id','organisation_id','project_id','line_item_id','supplier_name','source_title','source_url','source_domain','product_description','manufacturer','brand','specification','dimensions','source_price','currency','vat_status','pricing_basis','pack_quantity','normalised_unit','normalised_price','normalisation_calculation','delivery_status','geographic_relevance','evidence_classification','match_type','evidence_quality','verified','is_accepted','rejection_reason','is_manual','quote_reference','source_date','retrieved_at','notes','created_by','created_at'])) = 37
  union all
  select 165, '00000000000012_market_research', 'rls', 'market_evidence: row level security enabled',
    exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'market_evidence' and c.relrowsecurity)
  union all
  select 166, '00000000000012_market_research', 'policy', 'market_evidence: "Organisation members can manage their market evidence"',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'market_evidence'
      and policyname = 'Organisation members can manage their market evidence')
  union all
  select 167, '00000000000012_market_research', 'index', 'market_evidence_research_run_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'market_evidence_research_run_idx')
  union all
  select 168, '00000000000012_market_research', 'index', 'market_evidence_line_item_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'market_evidence_line_item_idx')
  union all
  select 169, '00000000000012_market_research', 'column', 'boq_line_items.market_research_snapshot',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boq_line_items' and column_name = 'market_research_snapshot')

  -- ============================================================ migration 13
  union all
  select 170, '00000000000013_market_research_hardening', 'column + constraint', 'market_evidence.source_origin (check includes ''international'')',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'market_evidence' and column_name = 'source_origin')
    and exists (select 1 from pg_constraint where conrelid = to_regclass('public.market_evidence') and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_origin%' and pg_get_constraintdef(oid) ilike '%international%')
  union all
  select 171, '00000000000013_market_research_hardening', 'column', 'market_research_runs.comparability_note',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'market_research_runs' and column_name = 'comparability_note')

  -- ============================================================ migration 14
  union all
  select 172, '00000000000014_historical_boq_org_library', 'column nullable', 'historical_boqs.project_id is nullable',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boqs'
      and column_name = 'project_id' and is_nullable = 'YES')
  union all
  select 173, '00000000000014_historical_boq_org_library', 'fk', 'historical_boqs_project_id_fkey ON DELETE SET NULL',
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.historical_boqs')
      and conname = 'historical_boqs_project_id_fkey' and contype = 'f' and confdeltype = 'n')
  union all
  select 174, '00000000000014_historical_boq_org_library', 'column nullable', 'historical_boq_items.project_id is nullable',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boq_items'
      and column_name = 'project_id' and is_nullable = 'YES')
  union all
  select 175, '00000000000014_historical_boq_org_library', 'fk', 'historical_boq_items_project_id_fkey ON DELETE SET NULL',
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.historical_boq_items')
      and conname = 'historical_boq_items_project_id_fkey' and contype = 'f' and confdeltype = 'n')
  union all
  select 176, '00000000000014_historical_boq_org_library', 'column', 'historical_boq_processing_jobs.organisation_id (NOT NULL, FK to organisations)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boq_processing_jobs'
      and column_name = 'organisation_id' and is_nullable = 'NO')
    and exists (select 1 from pg_constraint where conrelid = to_regclass('public.historical_boq_processing_jobs')
      and contype = 'f' and confrelid = to_regclass('public.organisations')
      and (select array_agg(a.attname::text) from unnest(conkey) k join pg_attribute a on a.attrelid = conrelid and a.attnum = k) = array['organisation_id'])
  union all
  select 177, '00000000000014_historical_boq_org_library', 'column nullable', 'historical_boq_processing_jobs.project_id is nullable',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historical_boq_processing_jobs'
      and column_name = 'project_id' and is_nullable = 'YES')
  union all
  select 178, '00000000000014_historical_boq_org_library', 'fk', 'historical_boq_processing_jobs_project_id_fkey ON DELETE SET NULL',
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.historical_boq_processing_jobs')
      and conname = 'historical_boq_processing_jobs_project_id_fkey' and contype = 'f' and confdeltype = 'n')
  union all
  select 179, '00000000000014_historical_boq_org_library', 'index', 'historical_boq_processing_jobs_organisation_id_idx',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'historical_boq_processing_jobs_organisation_id_idx')
  union all
  select 180, '00000000000014_historical_boq_org_library', 'policy (redefined)', 'historical_boq_processing_jobs: "Organisation members can manage their historical BOQ jobs" scoped directly by organisation_id',
    exists (
      select 1 from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'historical_boq_processing_jobs'
        and pol.polname = 'Organisation members can manage their historical BOQ jobs'
        and pg_get_expr(pol.polqual, pol.polrelid) ilike '%organisation_id%current_organisation_id%'
    )

)
select
  ord,
  migration,
  object_type,
  expected_object,
  case when present then 'PRESENT' else 'MISSING' end as status
from checks
order by ord;
