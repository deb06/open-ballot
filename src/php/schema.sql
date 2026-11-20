-- Open Ballot schema for MySQL 8+ / MariaDB 10.6+.
-- Timestamps are stored as UTC DATETIME(3) and converted to ISO-8601 in PHP.
--
-- Ballot anonymity: `participation` records WHO voted (one row per voter per
-- election), while `votes` records WHAT was chosen with no voter id and no
-- timestamp. The two tables share no key, so the database cannot link a voter
-- to a choice.

CREATE TABLE IF NOT EXISTS organizations (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(160) NOT NULL,
  slug            VARCHAR(80) NOT NULL,
  domain          VARCHAR(190) NULL DEFAULT NULL,
  membership_mode ENUM('domain','invite') NOT NULL DEFAULT 'domain',
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_by      INT UNSIGNED NULL DEFAULT NULL,
  created_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_slug (slug),
  UNIQUE KEY uq_organizations_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(80) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('voter', 'admin', 'observer', 'org_admin') NOT NULL DEFAULT 'voter',
  active            TINYINT(1) NOT NULL DEFAULT 1,
  student_id        VARCHAR(40) NULL DEFAULT NULL,
  email_verified_at DATETIME(3) NULL DEFAULT NULL,
  mfa_secret        VARCHAR(64) NULL DEFAULT NULL,
  mfa_enabled       TINYINT(1) NOT NULL DEFAULT 0,
  created_at        DATETIME(3) NOT NULL,
  last_login_at     DATETIME(3) NULL DEFAULT NULL,
  organization_id   INT UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_invites (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id INT UNSIGNED NOT NULL,
  email           VARCHAR(255) NOT NULL,
  role            ENUM('voter','observer','org_admin') NOT NULL DEFAULT 'voter',
  token           CHAR(64) NOT NULL,
  expires_at      DATETIME(3) NULL DEFAULT NULL,
  accepted_at     DATETIME(3) NULL DEFAULT NULL,
  created_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invites_token (token),
  UNIQUE KEY uq_invites_org_email (organization_id, email),
  KEY idx_invites_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS elections (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title              VARCHAR(120) NOT NULL,
  description        TEXT NOT NULL,
  status             ENUM('draft', 'open', 'closed') NOT NULL DEFAULT 'draft',
  results_visibility ENUM('always', 'after_vote', 'after_close', 'hidden') NOT NULL DEFAULT 'after_close',
  max_choices        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  opens_at           DATETIME(3) NULL DEFAULT NULL,
  closes_at          DATETIME(3) NULL DEFAULT NULL,
  created_by         INT UNSIGNED NULL DEFAULT NULL,
  created_at         DATETIME(3) NOT NULL,
  updated_at         DATETIME(3) NOT NULL,
  merkle_root        VARCHAR(64) NULL DEFAULT NULL,
  organization_id    INT UNSIGNED NULL DEFAULT NULL,
  kind               ENUM('election','poll') NOT NULL DEFAULT 'election',
  slug               VARCHAR(80) NULL DEFAULT NULL,
  allow_anonymous    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_elections_slug (slug),
  KEY idx_elections_status (status),
  KEY idx_elections_created (created_at),
  CONSTRAINT fk_elections_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidates (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  election_id INT UNSIGNED NOT NULL,
  name        VARCHAR(80) NOT NULL,
  party       VARCHAR(60) NOT NULL DEFAULT '',
  bio         VARCHAR(300) NOT NULL DEFAULT '',
  created_at  DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_candidates_election (election_id),
  CONSTRAINT fk_candidates_election FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Anonymous ballots. A random primary key avoids leaking insertion order, and
-- there is deliberately no user id, voter hash or timestamp in this table.
CREATE TABLE IF NOT EXISTS votes (
  id           CHAR(32) NOT NULL,
  election_id  INT UNSIGNED NOT NULL,
  candidate_id INT UNSIGNED NULL DEFAULT NULL,
  receipt_hash CHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_votes_receipt (receipt_hash),
  KEY idx_votes_election (election_id),
  CONSTRAINT fk_votes_election FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
  CONSTRAINT fk_votes_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vote_choices (
  vote_id      CHAR(32) NOT NULL,
  candidate_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (vote_id, candidate_id),
  KEY idx_vote_choices_candidate (candidate_id),
  CONSTRAINT fk_vote_choices_vote FOREIGN KEY (vote_id) REFERENCES votes (id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_choices_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Election participation: the only table that knows who voted. The unique key
-- is the database-level guarantee behind "one person, one vote".
CREATE TABLE IF NOT EXISTS participation (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  election_id INT UNSIGNED NOT NULL,
  voter_id    INT UNSIGNED NULL DEFAULT NULL,
  voter_token CHAR(64) NULL DEFAULT NULL,
  voted_at    DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participation_voter (election_id, voter_id),
  UNIQUE KEY uq_participation_token (election_id, voter_token),
  KEY idx_participation_election (election_id),
  KEY idx_participation_voter (voter_id),
  CONSTRAINT fk_participation_election FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
  CONSTRAINT fk_participation_voter FOREIGN KEY (voter_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(64) NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  csrf       VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  ip         VARCHAR(45) NULL DEFAULT NULL,
  user_agent VARCHAR(300) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id   INT UNSIGNED NULL DEFAULT NULL,
  action     VARCHAR(60) NOT NULL,
  details    TEXT NOT NULL,
  ip         VARCHAR(45) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_action (action),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_verifications_token (token_hash),
  KEY idx_email_verifications_user (user_id),
  CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  `key`       VARCHAR(120) NOT NULL,
  window_start DATETIME(3) NOT NULL,
  count       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mfa_challenges_token (token_hash),
  KEY idx_mfa_challenges_user (user_id),
  CONSTRAINT fk_mfa_challenges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trusted_devices (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  name       VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trusted_devices_token (token_hash),
  KEY idx_trusted_devices_user (user_id),
  CONSTRAINT fk_trusted_devices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS backup_codes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  code_hash  CHAR(64) NOT NULL,
  used_at    DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_backup_codes_user (user_id),
  CONSTRAINT fk_backup_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passkeys (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  credential_id VARCHAR(255) NOT NULL,
  public_key  TEXT NOT NULL,
  sign_count  INT UNSIGNED NOT NULL DEFAULT 0,
  device_name VARCHAR(80) NULL DEFAULT NULL,
  created_at  DATETIME(3) NOT NULL,
  last_used_at DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_passkeys_cred (credential_id),
  KEY idx_passkeys_user (user_id),
  CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL,
  challenge  CHAR(64) NOT NULL,
  type       ENUM('register','authenticate') NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_webauthn_challenges_user (user_id),
  KEY idx_webauthn_challenges_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(160) NOT NULL,
  body       VARCHAR(500) NOT NULL DEFAULT '',
  link       VARCHAR(200) NULL DEFAULT NULL,
  read_at    DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id),
  KEY idx_notifications_read (read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhooks (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  events     VARCHAR(500) NOT NULL,
  secret     VARCHAR(64) NOT NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  last_sent_at DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_webhooks_user (user_id),
  CONSTRAINT fk_webhooks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_snapshots (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recorded_at DATETIME(3) NOT NULL,
  status     VARCHAR(20) NOT NULL,
  checks     TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_health_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_keys (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(80) NOT NULL,
  key_hash   CHAR(64) NOT NULL,
  prefix     VARCHAR(12) NOT NULL,
  last_used_at DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_keys_hash (key_hash),
  KEY idx_api_keys_user (user_id),
  CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  webhook_id INT UNSIGNED NOT NULL,
  event      VARCHAR(60) NOT NULL,
  payload    TEXT NOT NULL,
  response_code INT NULL DEFAULT NULL,
  success    TINYINT(1) NOT NULL DEFAULT 0,
  error      VARCHAR(300) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_deliveries_hook (webhook_id),
  CONSTRAINT fk_deliveries_hook FOREIGN KEY (webhook_id) REFERENCES webhooks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS election_templates (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(120) NOT NULL,
  payload    TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_templates_user (user_id),
  CONSTRAINT fk_templates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_invitations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  election_id INT UNSIGNED NOT NULL,
  email      VARCHAR(160) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  sent_at    DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_invites_election (election_id),
  CONSTRAINT fk_invites_election FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  provider   VARCHAR(30) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth (provider, provider_id),
  KEY idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
