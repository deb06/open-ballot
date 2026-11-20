<?php

declare(strict_types=1);

/**
 * PDO connection, schema bootstrap and first-run seed data.
 */

function db_connect(): PDO
{
    $cfg = config('db');
    $driver = $cfg['driver'] ?? 'mysql';
    if ($driver === 'pgssl') {
        $driver = 'pgsql';
    }
    if ($driver === 'pgsql') {
        $sslmode = $cfg['sslmode'] ?? 'require';
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;sslmode=%s', $cfg['host'], (int) $cfg['port'], $cfg['name'], $sslmode);
        // Neon's pooler requires the endpoint ID when the client's libpq does
        // not send SNI (older builds, e.g. Alpine PostgreSQL clients). Passing
        // it explicitly is harmless for clients that do support SNI.
        if (str_ends_with((string) $cfg['host'], '.neon.tech')) {
            $endpoint = explode('.', (string) $cfg['host'])[0];
            $dsn .= ";options='endpoint=$endpoint'";
        }
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], (int) $cfg['port'], $cfg['name']);
    }

    $driver = $cfg['driver'] ?? 'mysql';
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // PostgreSQL with server-side prepares caches query plans across DDL,
        // which produces "cached plan must not change result type" in a
        // long-lived server. Client-side emulation avoids stale plans. All
        // LIMIT/OFFSET values in this app are inlined ints, so this is safe.
        PDO::ATTR_EMULATE_PREPARES => $driver === 'pgsql',
        PDO::ATTR_STRINGIFY_FETCHES => false,
        // Reuse connections across requests: remote DBs (Neon) can take
        // seconds per handshake, which would otherwise block every request.
        PDO::ATTR_PERSISTENT => $driver === 'pgsql',
    ]);

    if ($driver === 'pgsql') {
        $pdo->exec("SET client_encoding TO 'UTF8'");
    }

    return $pdo;
}

/**
 * Drop the cached connection. Called after DDL so PostgreSQL discards cached
 * query plans whose result type changed (otherwise: "cached plan must not
 * change result type").
 */
function db_reconnect(): void
{
    if (isset($GLOBALS['__ob_pdo']) && $GLOBALS['__ob_pdo'] instanceof PDO) {
        $GLOBALS['__ob_pdo'] = null;
    }
}

function db(): PDO
{
    if (!isset($GLOBALS['__ob_pdo']) || !($GLOBALS['__ob_pdo'] instanceof PDO)) {
        $GLOBALS['__ob_pdo'] = db_connect();
    }
    return $GLOBALS['__ob_pdo'];
}

/**
 * Execute a prepared statement. Returns the statement for further reads.
 */
function db_query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function db_all(string $sql, array $params = []): array
{
    return db_query($sql, $params)->fetchAll();
}

function db_one(string $sql, array $params = []): ?array
{
    $row = db_query($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function db_scalar(string $sql, array $params = []): mixed
{
    $value = db_query($sql, $params)->fetchColumn();
    return $value === false ? null : $value;
}

function db_exec(string $sql, array $params = []): int
{
    return db_query($sql, $params)->rowCount();
}

function db_insert(string $sql, array $params = []): int
{
    db_query($sql, $params);
    return (int) db()->lastInsertId();
}

/**
 * Run a unit of work in a single transaction. Every write inside the callback
 * is committed together, or rolled back together if anything throws.
 */
function db_transaction(callable $work): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $work();
        $pdo->commit();
        return $result;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

/** True for a MySQL/MariaDB duplicate-key violation (SQLSTATE 23000, code 1062). */
function db_is_duplicate(PDOException $error): bool
{
    $sqlState = $error->getCode();
    if ($sqlState === '23505') {
        return true; // PostgreSQL unique violation
    }
    return (int) ($error->errorInfo[1] ?? 0) === 1062 || $sqlState === '23000';
}

function db_schema_sql(): string
{
    static $sql = null;
    if (!is_string($sql)) {
        $cfg = config('db');
        $file = ($cfg['driver'] ?? 'mysql') === 'pgsql' ? 'schema.pgsql' : 'schema.sql';
        $sql = (string) file_get_contents(__DIR__ . '/' . $file);
    }
    return $sql;
}

function db_run_script(PDO $pdo, string $script): void
{
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $script) ?: [] as $statement) {
        $statement = trim($statement);
        if ($statement !== '') {
            $pdo->exec($statement);
        }
    }
}

/**
 * Drop every application table. Used by the test harness and `--reset`.
 */
function db_reset(): void
{
    $pdo = db();
    $cfg = config('db');
    if (($cfg['driver'] ?? 'mysql') === 'pgsql') {
        $pdo->exec('SET session_replication_role = replica');
    } else {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    }
    foreach (['audit_log', 'sessions', 'participation', 'votes', 'vote_choices', 'candidates', 'elections', 'users', 'password_resets', 'email_verifications', 'rate_limits', 'mfa_challenges'] as $table) {
        $pdo->exec('DROP TABLE IF EXISTS ' . $table . ' CASCADE');
    }
    if (($cfg['driver'] ?? 'mysql') === 'pgsql') {
        $pdo->exec('SET session_replication_role = origin');
    } else {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
}

function db_table_exists(string $table): bool
{
    $cfg = config('db');
    if (($cfg['driver'] ?? 'mysql') === 'pgsql') {
        $row = db_one(
            'SELECT COUNT(*) AS found FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?',
            [$table],
        );
    } else {
        $row = db_one(
            'SELECT COUNT(*) AS found FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            [$table],
        );
    }
    return $row !== null && (int) $row['found'] > 0;
}

function db_column_exists(string $table, string $column): bool
{
    $cfg = config('db');
    if (($cfg['driver'] ?? 'mysql') === 'pgsql') {
        $row = db_one(
            'SELECT COUNT(*) AS found FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?',
            [$table, $column],
        );
    } else {
        $row = db_one(
            'SELECT COUNT(*) AS found FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$table, $column],
        );
    }
    return $row !== null && (int) $row['found'] > 0;
}

/**
 * Upgrade a database created before ballots became fully anonymous.
 *
 * The old `votes` table stored a keyed voter hash and a timestamp. This moves
 * "who voted" into `participation` (re-deriving the account from the old hash)
 * and rebuilds `votes` with random ids and no voter or time columns. Existing
 * receipt hashes are preserved, so previously issued receipts still verify.
 */
function db_migrate_legacy_votes(): void
{
    if (!db_table_exists('votes') || !db_column_exists('votes', 'voter_hash')) {
        return;
    }

    $legacyVotes = db_all('SELECT election_id, voter_hash, cast_at FROM votes');
    $users = db_all('SELECT id FROM users');
    foreach ($legacyVotes as $vote) {
        $voterId = null;
        foreach ($users as $user) {
            $candidateHash = hmac(sprintf('ballot:%d:%d', (int) $vote['election_id'], (int) $user['id']));
            if (hash_equals((string) $vote['voter_hash'], $candidateHash)) {
                $voterId = (int) $user['id'];
                break;
            }
        }
        if ($voterId !== null) {
            db_exec(
                'INSERT IGNORE INTO participation (election_id, voter_id, voted_at) VALUES (?, ?, ?)',
                [(int) $vote['election_id'], $voterId, $vote['cast_at']],
            );
        }
    }

    $pdo = db();
    $pdo->exec('DROP TABLE IF EXISTS votes_v2');
    $pdo->exec(
        'CREATE TABLE votes_v2 (
            id           CHAR(32) NOT NULL,
            election_id  INT UNSIGNED NOT NULL,
            candidate_id INT UNSIGNED NOT NULL,
            receipt_hash CHAR(64) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_votes_receipt (receipt_hash),
            KEY idx_votes_election (election_id),
            KEY idx_votes_candidate (candidate_id),
            CONSTRAINT fk_votes_v2_election FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
            CONSTRAINT fk_votes_v2_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    );
    $pdo->exec(
        "INSERT INTO votes_v2 (id, election_id, candidate_id, receipt_hash)
         SELECT REPLACE(UUID(), '-', ''), election_id, candidate_id, receipt_hash FROM votes",
    );
    $pdo->exec('RENAME TABLE votes TO votes_legacy, votes_v2 TO votes');
    $pdo->exec('DROP TABLE votes_legacy');

    if (db_column_exists('elections', 'allow_vote_change')) {
        $pdo->exec('ALTER TABLE elections DROP COLUMN allow_vote_change');
    }
}

function db_migrate_quick_wins(): void
{
    $pdo = db();
    if (!db_column_exists('users', 'email_verified_at')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN email_verified_at DATETIME(3) NULL DEFAULT NULL AFTER active');
    }
    if (!db_column_exists('users', 'student_id')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN student_id VARCHAR(40) NULL DEFAULT NULL AFTER active');
    }
    if (!db_column_exists('users', 'mfa_secret')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64) NULL DEFAULT NULL AFTER email_verified_at');
    }
    if (!db_column_exists('users', 'mfa_enabled')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER mfa_secret');
    }
    // CREATE TABLE IF NOT EXISTS for the new tables.
    $pdo->exec('CREATE TABLE IF NOT EXISTS password_resets (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL DEFAULT NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_password_resets_token (token_hash),
        KEY idx_password_resets_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS email_verifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL DEFAULT NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_email_verifications_token (token_hash),
        KEY idx_email_verifications_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS rate_limits (
        `key` VARCHAR(120) NOT NULL,
        window_start DATETIME(3) NOT NULL,
        count INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (`key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS mfa_challenges (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_mfa_challenges_token (token_hash),
        KEY idx_mfa_challenges_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function db_migrate_multi_choice(): void
{
    $pdo = db();
    if (!db_column_exists('elections', 'max_choices')) {
        $pdo->exec('ALTER TABLE elections ADD COLUMN max_choices TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER results_visibility');
    }
    if (db_column_exists('votes', 'candidate_id')) {
        // make nullable
        $pdo->exec('ALTER TABLE votes MODIFY candidate_id INT UNSIGNED NULL DEFAULT NULL');
    }
    $pdo->exec('CREATE TABLE IF NOT EXISTS vote_choices (
        vote_id CHAR(32) NOT NULL,
        candidate_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (vote_id, candidate_id),
        KEY idx_vote_choices_candidate (candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    // migrate existing single choices
    $pdo->exec('INSERT IGNORE INTO vote_choices (vote_id, candidate_id) SELECT id, candidate_id FROM votes WHERE candidate_id IS NOT NULL');
}

function db_add_column(string $table, string $column, string $mysqlDef, string $pgDef): void
{
    if (db_column_exists($table, $column)) {
        return;
    }
    $cfg = config('db');
    $def = ($cfg['driver'] ?? 'mysql') === 'pgsql' ? $pgDef : $mysqlDef;
    try {
        db()->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$def}");
    } catch (Throwable) { /* already present or not supported */ }
}

function db_migrate_final(): void
{
    db_add_column('users', 'recovery_email', 'VARCHAR(160) NULL DEFAULT NULL', 'VARCHAR(160) NULL');
    db_add_column('users', 'recovery_verified_at', 'DATETIME(3) NULL DEFAULT NULL', 'TIMESTAMP(3) NULL');
    db_add_column('users', 'digest_optin', 'TINYINT(1) NOT NULL DEFAULT 0', 'SMALLINT NOT NULL DEFAULT 0');
    db_add_column('elections', 'ballot_type', "VARCHAR(20) NOT NULL DEFAULT 'single'", "VARCHAR(20) NOT NULL DEFAULT 'single'");
    db_add_column('elections', 'brand_color', 'VARCHAR(20) NULL DEFAULT NULL', 'VARCHAR(20) NULL');
    db_add_column('elections', 'logo_url', 'VARCHAR(300) NULL DEFAULT NULL', 'VARCHAR(300) NULL');
    db_add_column('candidates', 'position', 'INT UNSIGNED NOT NULL DEFAULT 0', 'INT NOT NULL DEFAULT 0');
    db_add_column('vote_choices', 'rank', 'INT UNSIGNED NOT NULL DEFAULT 0', 'INT NOT NULL DEFAULT 0');
    db_add_column('users', 'organization_id', 'INT UNSIGNED NULL DEFAULT NULL', 'INT NULL');
    db_add_column('elections', 'organization_id', 'INT UNSIGNED NULL DEFAULT NULL', 'INT NULL');
    db_add_column('elections', 'kind', "VARCHAR(10) NOT NULL DEFAULT 'election'", "VARCHAR(10) NOT NULL DEFAULT 'election'");
    db_add_column('elections', 'slug', 'VARCHAR(80) NULL DEFAULT NULL', 'VARCHAR(80) NULL');
    db_add_column('elections', 'allow_anonymous', 'TINYINT(1) NOT NULL DEFAULT 0', 'SMALLINT NOT NULL DEFAULT 0');
    db_add_column('participation', 'voter_token', 'CHAR(64) NULL DEFAULT NULL', 'CHAR(64) NULL');
    $cfg = config('db');
    if (($cfg['driver'] ?? 'mysql') !== 'pgsql') {
        try { db()->exec('ALTER TABLE participation MODIFY COLUMN voter_id INT UNSIGNED NULL DEFAULT NULL'); } catch (Throwable) {}
    } else {
        try { db()->exec('ALTER TABLE participation ALTER COLUMN voter_id DROP NOT NULL'); } catch (Throwable) {}
    }
    if (($cfg['driver'] ?? 'mysql') !== 'pgsql') {
        try {
            db()->exec("ALTER TABLE users MODIFY COLUMN role ENUM('voter','admin','observer','org_admin') NOT NULL DEFAULT 'voter'");
        } catch (Throwable) { /* keep existing enum */ }
    } else {
        // Postgres uses a CHECK constraint; recreate it so org admins are allowed.
        try {
            db()->exec('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            db()->exec("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('voter','admin','observer','org_admin'))");
        } catch (Throwable) { /* constraint may be managed externally */ }
    }
    try { db()->exec('CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id)'); } catch (Throwable) {}
    try { db()->exec('CREATE INDEX IF NOT EXISTS idx_elections_organization ON elections(organization_id)'); } catch (Throwable) {}
    try { db()->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_elections_slug ON elections(slug)'); } catch (Throwable) {}
    try { db()->exec('CREATE INDEX IF NOT EXISTS idx_participation_token ON participation(voter_token)'); } catch (Throwable) {}
    try { db()->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_participation_election_token ON participation(election_id, voter_token)'); } catch (Throwable) {}
}

function db_schema_installed(): bool
{
    try {
        db()->query('SELECT 1 FROM users LIMIT 1');
        return true;
    } catch (PDOException) {
        return false;
    }
}

function db_migrate_merkle(): void
{
    $pdo = db();
    if (!db_column_exists('elections', 'merkle_root')) {
        try {
            $pdo->exec('ALTER TABLE elections ADD COLUMN merkle_root VARCHAR(64) NULL');
        } catch (Throwable) {
            // column may already exist on this driver
        }
    }
}

function db_ensure_ready(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo = db();
    if (!db_schema_installed()) {
        db_run_script($pdo, db_schema_sql());
    } else {
        // CREATE TABLE IF NOT EXISTS also adds the participation table to a
        // database that was created by an earlier version.
        db_run_script($pdo, db_schema_sql());
        $cfg = config('db');
        if (($cfg['driver'] ?? 'mysql') !== 'pgsql') {
            db_migrate_legacy_votes();
            db_migrate_quick_wins();
            db_migrate_multi_choice();
        }
        db_migrate_merkle();
        db_migrate_final();
    }
    // DDL above may have changed table shapes; drop the connection so PostgreSQL
    // discards cached plans tied to the old result types.
    db_reconnect();
    // Rate-limit counters are per process lifetime in the original design; clearing
    // them on (re)start keeps the limits effective without permanently blocking
    // a client across server restarts (and keeps the test suite repeatable).
    try { db_exec('DELETE FROM rate_limits'); } catch (Throwable) { }
    db_seed();
    $ready = true;
}

function db_seed(): void
{
    $userCount = (int) db_scalar('SELECT COUNT(*) FROM users');
    if ($userCount === 0) {
        $admin = config('admin');
        db_insert(
            'INSERT INTO users (name, email, password_hash, role, active, email_verified_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            [
                $admin['name'],
                $admin['email'],
                hash_password((string) $admin['password']),
                'admin',
                iso_to_sql(now_iso()),
                iso_to_sql(now_iso()),
            ],
        );
        error_log('[seed] Administrator account created: ' . $admin['email']);
    }

    $electionCount = (int) db_scalar('SELECT COUNT(*) FROM elections');
    if ($electionCount > 0) {
        return;
    }

    $adminId = db_scalar("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    $adminId = $adminId === null ? null : (int) $adminId;
    $now = time();

    $demoId = db_insert(
        'INSERT INTO elections
           (title, description, status, results_visibility, opens_at, closes_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            'Student Council President 2026',
            'Choose the next president of the student council. The elected candidate will serve a one-year term and represent students in meetings with the faculty board.',
            'open',
            'after_vote',
            iso_to_sql(now_iso_at($now - 14 * 86400)),
            iso_to_sql(now_iso_at($now + 20 * 86400)),
            $adminId,
            iso_to_sql(now_iso_at($now)),
            iso_to_sql(now_iso_at($now)),
        ],
    );

    $candidates = [
        ['Aarav Mehta', 'Unity Slate', 'Third-year economics student. Wants transparent budgets and a permanent student food bank.'],
        ['Sofia Alvarez', 'Progress Network', 'Second-year design student. Campaigning for later library hours and free mental-health counselling.'],
        ['Noah Williams', 'Independent', 'Final-year engineering student. Focused on better lab equipment and a student-run maker space.'],
        ['Priya Raman', 'Green Campus', 'First-year environmental science student. Plans a campus-wide recycling overhaul and bicycle scheme.'],
    ];
    $createdAt = iso_to_sql(now_iso_at($now));
    foreach ($candidates as [$name, $party, $bio]) {
        db_insert(
            'INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)',
            [$demoId, $name, $party, $bio, $createdAt],
        );
    }

    $draftId = db_insert(
        'INSERT INTO elections
           (title, description, status, results_visibility, opens_at, closes_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            'Community Budget Priorities',
            'Rank the three proposed investments for next year’s neighbourhood budget. This is a sample draft election — open it from the admin dashboard when you are ready.',
            'draft',
            'after_close',
            iso_to_sql(now_iso_at($now + 7 * 86400)),
            iso_to_sql(now_iso_at($now + 21 * 86400)),
            $adminId,
            $createdAt,
            $createdAt,
        ],
    );

    $options = [
        ['New community playground', 'Parks & recreation', 'A fully accessible playground beside the community centre.'],
        ['Street lighting upgrades', 'Public safety', 'LED lighting on the three darkest residential streets.'],
        ['Neighbourhood tool library', 'Shared resources', 'A lending library for tools, ladders and garden equipment.'],
    ];
    foreach ($options as [$name, $party, $bio]) {
        db_insert(
            'INSERT INTO candidates (election_id, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?)',
            [$draftId, $name, $party, $bio, $createdAt],
        );
    }
}
