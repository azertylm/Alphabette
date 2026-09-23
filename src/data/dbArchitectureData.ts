export interface DBTableField {
  name: string;
  type: string;
  constraints: string;
  description: string;
}

export interface DBTableDef {
  name: string;
  purpose: string;
  partitionKey?: string;
  fields: DBTableField[];
}

export const DB_TABLES: DBTableDef[] = [
  {
    name: 'tenants',
    purpose: 'Gère les espaces clients ou collectifs (ex: foyer citoyen, collectivité, association, entreprise partenaire).',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Identifiant unique du tenant' },
      { name: 'slug', type: 'VARCHAR(64)', constraints: 'UNIQUE NOT NULL', description: 'Identifiant URL (ex: valentin-richaud, amap-provence)' },
      { name: 'name', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Nom de l’organisation ou du foyer' },
      { name: 'tier_default', type: 'VARCHAR(32)', constraints: 'DEFAULT \'free\'', description: 'Plan par défaut (free, single_app, pass)' },
      { name: 'data_residency_region', type: 'VARCHAR(32)', constraints: 'DEFAULT \'eu-fr-paris\'', description: 'Localisation stricte des données (Paris / EU)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Horodatage de création' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Dernière mise à jour' }
    ]
  },
  {
    name: 'users',
    purpose: 'Comptes d’authentification centralisés (SSO) pour l’ensemble des 50+ applications.',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Identifiant global de l’utilisateur' },
      { name: 'tenant_id', type: 'UUID', constraints: 'NOT NULL REFERENCES tenants(id) ON DELETE CASCADE', description: 'Tenant propriétaire (isolation multi-tenant)' },
      { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE NOT NULL', description: 'Adresse email unique de connexion' },
      { name: 'password_hash', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Hachage Argon2id sécurisé' },
      { name: 'full_name', type: 'VARCHAR(128)', constraints: 'NULL', description: 'Nom ou pseudonyme citoyen' },
      { name: 'is_email_verified', type: 'BOOLEAN', constraints: 'DEFAULT FALSE', description: 'Statut de validation d’email sans spam' },
      { name: 'global_role', type: 'VARCHAR(32)', constraints: 'DEFAULT \'citizen\'', description: 'Rôle d’écosystème : superadmin, tenant_admin, citizen' },
      { name: 'gdpr_consent_date', type: 'TIMESTAMPTZ', constraints: 'NOT NULL DEFAULT NOW()', description: 'Horodatage d’acceptation charte souveraine & RGPD' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Date d’inscription' }
    ]
  },
  {
    name: 'applications',
    purpose: 'Catalogue des applications fédérées (LIDARSOL, OSOLAR, PROXILIEN, INFOS PERSO, etc.).',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'ID unique d’application' },
      { name: 'slug', type: 'VARCHAR(64)', constraints: 'UNIQUE NOT NULL', description: 'Clé technique (ex: lidarsol, osolar, proxilien)' },
      { name: 'name', type: 'VARCHAR(128)', constraints: 'NOT NULL', description: 'Nom public de l’application' },
      { name: 'category', type: 'VARCHAR(64)', constraints: 'NOT NULL', description: 'Écologie, Social & Entraide, Outils IA, etc.' },
      { name: 'target_url', type: 'VARCHAR(512)', constraints: 'NOT NULL', description: 'URL de production de l’app' },
      { name: 'sso_redirect_url', type: 'VARCHAR(512)', constraints: 'NOT NULL', description: 'Point de terminaison callback SSO' },
      { name: 'shared_secret_hash', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Clé d’intégrité pour handoff JWT' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Statut opérationnel' }
    ]
  },
  {
    name: 'subscriptions',
    purpose: 'Gestion centrale des abonnements : Pass Complet (3 €/m), À la carte (1 €/m) ou Gratuit.',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'ID unique d’abonnement' },
      { name: 'tenant_id', type: 'UUID', constraints: 'NOT NULL REFERENCES tenants(id) ON DELETE CASCADE', description: 'Tenant facturé' },
      { name: 'user_id', type: 'UUID', constraints: 'NOT NULL REFERENCES users(id) ON DELETE CASCADE', description: 'Titulaire du compte payeur' },
      { name: 'plan_type', type: 'VARCHAR(32)', constraints: 'NOT NULL', description: 'free, single_app, alphabette_pass' },
      { name: 'monthly_price_cents', type: 'INTEGER', constraints: 'NOT NULL', description: 'Montant en centimes (ex: 300 pour 3€, 100 par app)' },
      { name: 'status', type: 'VARCHAR(32)', constraints: 'DEFAULT \'active\'', description: 'active, past_due, canceled, trialing' },
      { name: 'current_period_end', type: 'TIMESTAMPTZ', constraints: 'NOT NULL', description: 'Échéance de renouvellement' },
      { name: 'payment_provider', type: 'VARCHAR(32)', constraints: 'DEFAULT \'sepa_direct\'', description: 'SEPA européen ou passerelle souveraine' }
    ]
  },
  {
    name: 'subscription_single_apps',
    purpose: 'Liaison pour le modèle à la carte (1 € / mois par application individuelle).',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'ID d’attribution' },
      { name: 'subscription_id', type: 'UUID', constraints: 'NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE', description: 'Abonnement parent' },
      { name: 'application_id', type: 'UUID', constraints: 'NOT NULL REFERENCES applications(id)', description: 'Application débloquée à 1€' },
      { name: 'granted_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Date d’activation' }
    ]
  },
  {
    name: 'user_app_permissions',
    purpose: 'Rôles dynamiques spécifiques par utilisateur et par application (ex: Admin dans Lidarsol, Lecteur dans Proxilien).',
    fields: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'ID de droit' },
      { name: 'user_id', type: 'UUID', constraints: 'NOT NULL REFERENCES users(id) ON DELETE CASCADE', description: 'Utilisateur concerné' },
      { name: 'application_id', type: 'UUID', constraints: 'NOT NULL REFERENCES applications(id) ON DELETE CASCADE', description: 'App concernée' },
      { name: 'role', type: 'VARCHAR(64)', constraints: 'NOT NULL DEFAULT \'member\'', description: 'Rôle dynamique : viewer, member, editor, manager, admin' },
      { name: 'scoped_permissions', type: 'JSONB', constraints: 'DEFAULT \'{}\'::jsonb', description: 'Attributs fins (ex: {"can_export_dxf": true, "max_surveys": 100})' }
    ]
  },
  {
    name: 'sso_auth_tokens',
    purpose: 'Jetons d’échange éphémères signés par clé asymétrique Ed25519 / RS256 pour SSO zero-trust.',
    fields: [
      { name: 'token_jti', type: 'VARCHAR(64)', constraints: 'PRIMARY KEY', description: 'JWT ID unique pour éviter tout rejeu' },
      { name: 'user_id', type: 'UUID', constraints: 'NOT NULL REFERENCES users(id)', description: 'Sujet authentifié' },
      { name: 'target_app_id', type: 'UUID', constraints: 'NOT NULL REFERENCES applications(id)', description: 'Application de destination' },
      { name: 'expires_at', type: 'TIMESTAMPTZ', constraints: 'NOT NULL', description: 'Validité courte (ex: 60 secondes pour l’échange)' },
      { name: 'is_consumed', type: 'BOOLEAN', constraints: 'DEFAULT FALSE', description: 'Usage unique' }
    ]
  }
];

export const SQL_SCHEMA_SCRIPT = `-- =========================================================================
-- ALPHABETTE ECOSYSTEM : SCHEMA MULTI-TENANT & SERVICE D'AUTH SSO
-- Société éditrice : ALPHABETTE (Fondée par Valentin RICHAUD)
-- Standard : PostgreSQL 15+ avec Row Level Security (RLS) & Chiffrement
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANTS (Organisations, Foyers ou Collectivités)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tier_default VARCHAR(32) DEFAULT 'free',
    data_residency_region VARCHAR(32) DEFAULT 'eu-fr-paris',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. UTILISATEURS (Comptes centraux SSO)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128),
    is_email_verified BOOLEAN DEFAULT FALSE,
    global_role VARCHAR(32) DEFAULT 'citizen', -- superadmin, tenant_admin, citizen
    gdpr_consent_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- 3. APPLICATIONS FEDEREES (LIDARSOL, OSOLAR, PROXILIEN, etc.)
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    target_url VARCHAR(512) NOT NULL,
    sso_redirect_url VARCHAR(512) NOT NULL,
    shared_secret_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ABONNEMENTS (1€/mois par app ou 3€/mois Pass Alphabette)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(32) NOT NULL, -- 'free', 'single_app', 'alphabette_pass'
    monthly_price_cents INTEGER NOT NULL, -- 0, 100, 300
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'past_due', 'canceled'
    current_period_end TIMESTAMPTZ NOT NULL,
    payment_provider VARCHAR(32) DEFAULT 'sepa_direct',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);

-- 5. LIAISON APPS POUR L'OFFRE 1€/MOIS A LA CARTE
CREATE TABLE IF NOT EXISTS subscription_single_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscription_id, application_id)
);

-- 6. PERMISSIONS & ROLES DYNAMIQUES INTER-APPLICATIONS
CREATE TABLE IF NOT EXISTS user_app_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    role VARCHAR(64) NOT NULL DEFAULT 'member', -- 'viewer', 'member', 'editor', 'admin'
    scoped_permissions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, application_id)
);

-- 7. JETONS D'ECHANGE RAPIDE SSO (ANTI-REJEU & VALIDITE 60s)
CREATE TABLE IF NOT EXISTS sso_auth_tokens (
    token_jti VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_consumed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VUE OPTIMISEE D'AUTORISATION INSTANTANEE SSO :
CREATE OR REPLACE VIEW v_user_effective_access AS
SELECT 
    u.id AS user_id,
    u.tenant_id,
    u.email,
    a.id AS app_id,
    a.slug AS app_slug,
    CASE 
        WHEN s.plan_type = 'alphabette_pass' AND s.status = 'active' THEN TRUE
        WHEN s.plan_type = 'single_app' AND s.status = 'active' AND ssa.application_id IS NOT NULL THEN TRUE
        ELSE FALSE
    END AS is_unlocked,
    COALESCE(uap.role, 'member') AS app_role,
    s.plan_type AS active_plan
FROM users u
CROSS JOIN applications a
LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
LEFT JOIN subscription_single_apps ssa ON ssa.subscription_id = s.id AND ssa.application_id = a.id
LEFT JOIN user_app_permissions uap ON uap.user_id = u.id AND uap.application_id = a.id;
`;
