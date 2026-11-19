-- Open Ballot schema for PostgreSQL 14+.
-- Timestamps stored as UTC TIMESTAMP(3).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'voter' CHECK (role IN ('voter','admin')),
  active            SMALLINT NOT NULL DEFAULT 1,
  student_id        VARCHAR(40) NULL,
  email_verified_at TIMESTAMP(3) NULL,
  mfa_secret        VARCHAR(64) NULL,
  mfa_enabled       SMALLINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP(3) NOT NULL,
  last_login_at     TIMESTAMP(3) NULL
);

CREATE TABLE IF NOT EXISTS elections (
  id                 SERIAL PRIMARY KEY,
  title              VARCHAR(120) NOT NULL,
  description        TEXT NOT NULL,
  status             VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  results_visibility VARCHAR(12) NOT NULL DEFAULT 'after_close' CHECK (results_visibility IN ('always','after_vote','after_close','hidden')),
  max_choices        SMALLINT NOT NULL DEFAULT 1,
  opens_at           TIMESTAMP(3) NULL,
  closes_at          TIMESTAMP(3) NULL,
  created_by         INT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMP(3) NOT NULL,
  updated_at         TIMESTAMP(3) NOT NULL,
  merkle_root        VARCHAR(64) NULL
);
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_created ON elections(created_at);

CREATE TABLE IF NOT EXISTS candidates (
  id          SERIAL PRIMARY KEY,
  election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  party       VARCHAR(60) NOT NULL DEFAULT '',
  bio         VARCHAR(300) NOT NULL DEFAULT '',
  created_at  TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);

CREATE TABLE IF NOT EXISTS votes (
  id           CHAR(32) NOT NULL PRIMARY KEY,
  election_id  INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id INT NULL REFERENCES candidates(id) ON DELETE SET NULL,
  receipt_hash CHAR(64) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id);

CREATE TABLE IF NOT EXISTS vote_choices (
  vote_id      CHAR(32) NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  PRIMARY KEY (vote_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_vote_choices_candidate ON vote_choices(candidate_id);

CREATE TABLE IF NOT EXISTS participation (
  id          SERIAL PRIMARY KEY,
  election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at    TIMESTAMP(3) NOT NULL,
  UNIQUE (election_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_participation_election ON participation(election_id);
CREATE INDEX IF NOT EXISTS idx_participation_voter ON participation(voter_id);

CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(64) NOT NULL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  ip         VARCHAR(45) NULL,
  user_agent VARCHAR(300) NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  actor_id   INT NULL REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  details    TEXT NOT NULL,
  ip         VARCHAR(45) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP(3) NOT NULL,
  used_at    TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

CREATE TABLE IF NOT EXISTS email_verifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP(3) NOT NULL,
  used_at    TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          VARCHAR(120) NOT NULL PRIMARY KEY,
  window_start TIMESTAMP(3) NOT NULL,
  count        INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user ON mfa_challenges(user_id);

CREATE TABLE IF NOT EXISTS backup_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  CHAR(64) NOT NULL,
  used_at    TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_codes(user_id);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

CREATE TABLE IF NOT EXISTS passkeys (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id VARCHAR(255) NOT NULL UNIQUE,
  public_key   TEXT NOT NULL,
  sign_count   INT NOT NULL DEFAULT 0,
  device_name  VARCHAR(80) NULL,
  created_at   TIMESTAMP(3) NOT NULL,
  last_used_at TIMESTAMP(3) NULL
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id         SERIAL PRIMARY KEY,
  user_id    INT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge  CHAR(64) NOT NULL,
  type       VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(160) NOT NULL,
  body       VARCHAR(500) NOT NULL DEFAULT '',
  link       VARCHAR(200) NULL,
  read_at    TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url          VARCHAR(500) NOT NULL,
  events       VARCHAR(500) NOT NULL,
  secret       VARCHAR(64) NOT NULL,
  active       SMALLINT NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMP(3) NULL,
  created_at   TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id         SERIAL PRIMARY KEY,
  recorded_at TIMESTAMP(3) NOT NULL,
  status     VARCHAR(20) NOT NULL,
  checks     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_recorded ON health_snapshots(recorded_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(80) NOT NULL,
  key_hash   CHAR(64) NOT NULL UNIQUE,
  prefix     VARCHAR(12) NOT NULL,
  last_used_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL,
  revoked_at TIMESTAMP(3) NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id         SERIAL PRIMARY KEY,
  webhook_id INT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event      VARCHAR(60) NOT NULL,
  payload    TEXT NOT NULL,
  response_code INT NULL,
  success    SMALLINT NOT NULL DEFAULT 0,
  error      VARCHAR(300) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_hook ON webhook_deliveries(webhook_id);

CREATE TABLE IF NOT EXISTS election_templates (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  payload    TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON election_templates(user_id);

CREATE TABLE IF NOT EXISTS email_invitations (
  id         SERIAL PRIMARY KEY,
  election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  email      VARCHAR(160) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  sent_at    TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_election ON email_invitations(election_id);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   VARCHAR(30) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  UNIQUE (provider, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
