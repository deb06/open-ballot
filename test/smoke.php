<?php

declare(strict_types=1);

/**
 * End-to-end smoke test.
 *
 * Boots the PHP application on an ephemeral port against the open_ballot_test
 * database, then exercises registration, authentication, ballots, receipts,
 * admin workflows and security guards.
 *
 *   php test/smoke.php
 *   npm test
 */

$root = dirname(__DIR__);
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'openballot-test-' . bin2hex(random_bytes(6));
if (!mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
    fwrite(STDERR, "Cannot create temporary directory: {$tempDir}\n");
    exit(1);
}

putenv('DATA_DIR=' . $tempDir);
putenv('DB_NAME=open_ballot_test');
putenv('ADMIN_PASSWORD=TestAdmin#123');
putenv('ADMIN_EMAIL=admin@openballot.local');
putenv('CRON_SECRET=TestCron#123');

require $root . '/src/php/bootstrap.php';

/* ------------------------------------------------------------------ */
/* Assertions and HTTP client                                          */
/* ------------------------------------------------------------------ */

$passed = 0;

function step(string $name, callable $fn): void
{
    global $passed;
    try {
        $fn();
        $passed += 1;
        echo "  \u{2713} {$name}\n";
    } catch (Throwable $error) {
        echo "  \u{2717} {$name}\n";
        throw $error;
    }
}

function assert_true(mixed $condition, string $message = 'Expected a truthy value.'): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assert_same(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message !== ''
            ? $message
            : 'Expected ' . json_encode($expected) . ', got ' . json_encode($actual));
    }
}

/**
 * @return array{status:int,text:string,headers:array<int,string>}
 */
function http_request(string $method, string $url, ?string $rawBody = null, array $headers = []): array
{
    $ch = curl_init($url);
    $responseHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => array_merge($headers, ['Expect:']),
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
            $trimmed = trim($line);
            if ($trimmed !== '') {
                $responseHeaders[] = $trimmed;
            }
            return strlen($line);
        },
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PATH_AS_IS => true,
    ]);
    if ($rawBody !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
    }

    $text = curl_exec($ch);
    if ($text === false) {
        $error = curl_error($ch);
        throw new RuntimeException('HTTP request failed: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    return ['status' => $status, 'text' => (string) $text, 'headers' => $responseHeaders];
}

final class Client
{
    public string $base;
    public string $cookie = '';
    /** @var array<int,string> */
    public array $extraCookies = [];
    public ?string $csrf = null;

    public function __construct(string $base)
    {
        $this->base = $base;
    }

    /**
     * @return array{status:int,data:mixed,text:string,headers:array<int,string>}
     */
    public function request(string $method, string $path, ?array $body = null, array $options = []): array
    {
        $headers = ['Accept: application/json'];
        $raw = null;
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            $raw = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        $cookies = array_filter(array_merge([$this->cookie], $this->extraCookies));
        if ($cookies !== []) {
            $headers[] = 'Cookie: ' . implode('; ', $cookies);
        }
        if (($options['csrf'] ?? true) !== false && $this->csrf !== null && $method !== 'GET') {
            $headers[] = 'X-CSRF-Token: ' . ($options['csrfToken'] ?? $this->csrf);
        }

        $response = http_request($method, $this->base . $path, $raw, $headers);
        foreach ($response['headers'] as $line) {
            if (stripos($line, 'Set-Cookie:') === 0) {
                $cookie = explode(';', trim(substr($line, strlen('Set-Cookie:'))))[0];
                if (str_starts_with($cookie, 'ob_session=')) {
                    $this->cookie = $cookie;
                } elseif (str_starts_with($cookie, 'ob_vote_')) {
                    $this->extraCookies[] = $cookie;
                }
            }
        }

        $data = null;
        if ($response['text'] !== '') {
            try {
                $data = json_decode($response['text'], true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                $data = null;
            }
        }

        return [
            'status' => $response['status'],
            'data' => $data,
            'text' => $response['text'],
            'headers' => $response['headers'],
        ];
    }
}

/* ------------------------------------------------------------------ */
/* Boot the application on an ephemeral port                           */
/* ------------------------------------------------------------------ */

function free_port(): int
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
    if ($socket === false) {
        throw new RuntimeException('Cannot allocate a port: ' . $errstr);
    }
    $name = stream_socket_get_name($socket, false);
    fclose($socket);
    if (!is_string($name)) {
        throw new RuntimeException('Cannot determine the allocated port.');
    }
    return (int) substr($name, strrpos($name, ':') + 1);
}

$port = free_port();
$base = 'http://127.0.0.1:' . $port;

try {
    db_reset();
    db_ensure_ready();
} catch (Throwable $error) {
    fwrite(STDERR, "\nCannot prepare the test database.\n  " . $error->getMessage() . "\n\n");
    fwrite(STDERR, "Is MariaDB running? Try: powershell -File scripts/db-start.ps1\n\n");
    exit(1);
}

$env = getenv();
$env['DATA_DIR'] = $tempDir;
$env['DB_NAME'] = 'open_ballot_test';
$env['ADMIN_EMAIL'] = 'admin@openballot.local';
$env['ADMIN_PASSWORD'] = 'TestAdmin#123';

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['file', $tempDir . DIRECTORY_SEPARATOR . 'server-out.log', 'a'],
    2 => ['file', $tempDir . DIRECTORY_SEPARATOR . 'server-err.log', 'a'],
];

$process = proc_open(
    [PHP_BINARY, '-d', 'display_errors=0', '-S', '127.0.0.1:' . $port, '-t', $root . '/public', $root . '/router.php'],
    $descriptors,
    $pipes,
    $root,
    $env,
);

if (!is_resource($process)) {
    fwrite(STDERR, "Cannot start the PHP development server.\n");
    exit(1);
}
if (isset($pipes[0]) && is_resource($pipes[0])) {
    fclose($pipes[0]);
}

$stopServer = static function () use ($process): void {
    $status = proc_get_status($process);
    if ($status['running']) {
        proc_terminate($process);
        for ($i = 0; $i < 50; $i += 1) {
            usleep(100000);
            $status = proc_get_status($process);
            if (!$status['running']) {
                break;
            }
        }
    }
    proc_close($process);
};

$serverReady = false;
for ($i = 0; $i < 80; $i += 1) {
    usleep(150000);
    $status = proc_get_status($process);
    if (!$status['running']) {
        break;
    }
    try {
        $health = http_request('GET', $base . '/api/health');
        if ($health['status'] === 200) {
            $serverReady = true;
            break;
        }
    } catch (Throwable) {
        // Server not accepting connections yet.
    }
}

if (!$serverReady) {
    $stopServer();
    $log = @file_get_contents($tempDir . DIRECTORY_SEPARATOR . 'server-err.log');
    fwrite(STDERR, "The test server did not start.\n" . ($log !== false ? $log : '') . "\n");
    exit(1);
}

echo "\nOpen Ballot smoke test — {$base}\n\n";

$voter = new Client($base);
$admin = new Client($base);

$demoElectionId = null;
$voterCsrf = null;
$receipt = null;
$newElectionId = null;
$newCandidateIds = [];

try {
    step('health endpoint responds', static function () use ($voter): void {
        $res = $voter->request('GET', '/api/health');
        assert_same(200, $res['status']);
        assert_same(true, $res['data']['ok']);
    });

    step('public stats report seeded election', static function () use ($voter): void {
        $res = $voter->request('GET', '/api/stats');
        assert_same(200, $res['status']);
        assert_true($res['data']['openElections'] >= 1);
        assert_true($res['data']['registeredVoters'] >= 1);
    });

    step('static frontend is served', static function () use ($voter): void {
        $res = $voter->request('GET', '/');
        assert_same(200, $res['status']);
        assert_true(str_contains($res['text'], 'Open Ballot'));
    });

    step('rejects path traversal on static files', static function () use ($base): void {
        $res = http_request('GET', $base . '/..%2f..%2fpackage.json');
        assert_true($res['status'] !== 200, 'Expected traversal to be rejected.');
    });

    step('registers a voter', static function () use ($voter, &$voterCsrf): void {
        $res = $voter->request('POST', '/api/auth/register', [
            'name' => 'Test Voter',
            'email' => 'voter@example.test',
            'password' => 'VoterPass#12',
        ]);
        assert_same(201, $res['status']);
        assert_same('voter', $res['data']['user']['role']);
        assert_true(!empty($res['data']['csrf']));
        $voterCsrf = $res['data']['csrf'];
        $voter->csrf = $res['data']['csrf'];
        assert_true(str_starts_with($voter->cookie, 'ob_session='));
    });

    step('returns the signed-in user', static function () use ($voter, &$voterCsrf): void {
        $res = $voter->request('GET', '/api/auth/me');
        assert_same(200, $res['status']);
        assert_same('voter@example.test', $res['data']['user']['email']);
        assert_same($voterCsrf, $res['data']['csrf']);
    });

    step('lists the seeded open election', static function () use ($voter, &$demoElectionId): void {
        $res = $voter->request('GET', '/api/elections');
        assert_same(200, $res['status']);
        $demo = null;
        foreach ($res['data']['elections'] as $election) {
            if ($election['status'] === 'open') {
                $demo = $election;
                break;
            }
        }
        assert_true($demo !== null, 'Expected an open demo election.');
        $demoElectionId = $demo['id'];
        assert_true($demo['candidateCount'] >= 2);
    });

    step('rejects a second registration with the same email', static function () use ($voter): void {
        $res = $voter->request('POST', '/api/auth/register', [
            'name' => 'Duplicate',
            'email' => 'voter@example.test',
            'password' => 'VoterPass#12',
        ]);
        assert_same(409, $res['status']);
    });

    step('blocks ballot without CSRF header', static function () use ($voter, &$demoElectionId): void {
        $detail = $voter->request('GET', '/api/elections/' . $demoElectionId);
        $candidateId = $detail['data']['candidates'][0]['id'];
        $res = $voter->request(
            'POST',
            '/api/elections/' . $demoElectionId . '/vote',
            ['candidateId' => $candidateId],
            ['csrf' => false],
        );
        assert_same(403, $res['status']);
        assert_same('csrf_failed', $res['data']['error']['code']);
    });

    step('blocks ballot with a wrong CSRF token', static function () use ($voter, &$demoElectionId): void {
        $detail = $voter->request('GET', '/api/elections/' . $demoElectionId);
        $candidateId = $detail['data']['candidates'][0]['id'];
        $res = $voter->request(
            'POST',
            '/api/elections/' . $demoElectionId . '/vote',
            ['candidateId' => $candidateId],
            ['csrfToken' => 'not-the-right-token'],
        );
        assert_same(403, $res['status']);
    });

    step('rejects a candidate from another election', static function () use ($voter, &$demoElectionId): void {
        $res = $voter->request(
            'POST',
            '/api/elections/' . $demoElectionId . '/vote',
            ['candidateId' => 999999],
        );
        assert_same(400, $res['status']);
    });

    step('casts a ballot and returns a receipt', static function () use ($voter, &$demoElectionId, &$receipt): void {
        $detail = $voter->request('GET', '/api/elections/' . $demoElectionId);
        $candidateId = $detail['data']['candidates'][2]['id'];
        $res = $voter->request(
            'POST',
            '/api/elections/' . $demoElectionId . '/vote',
            ['candidateId' => $candidateId],
        );
        assert_same(201, $res['status']);
        assert_true(
            preg_match('/^OB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', (string) $res['data']['receipt']) === 1,
            'Receipt did not match the expected format.',
        );
        $receipt = $res['data']['receipt'];
        assert_same($candidateId, $res['data']['candidate']['id']);
    });

    step('enforces one ballot per voter', static function () use ($voter, &$demoElectionId): void {
        $detail = $voter->request('GET', '/api/elections/' . $demoElectionId);
        $candidateId = $detail['data']['candidates'][0]['id'];
        $res = $voter->request(
            'POST',
            '/api/elections/' . $demoElectionId . '/vote',
            ['candidateId' => $candidateId],
        );
        assert_same(409, $res['status']);
        assert_same('already_voted', $res['data']['error']['code']);
    });

    step('verifies the receipt and reveals its choice', static function () use ($voter, &$receipt, &$demoElectionId): void {
        $res = $voter->request('GET', '/api/verify/' . rawurlencode((string) $receipt));
        assert_same(200, $res['status']);
        assert_same(true, $res['data']['valid']);
        assert_same(true, $res['data']['counted']);
        assert_same($demoElectionId, $res['data']['election']['id']);
        assert_true(!empty($res['data']['candidate']['name']));
        assert_true(!array_key_exists('castAt', $res['data']), 'Ballots must not expose a timestamp.');
    });

    step('rejects an unknown receipt', static function () use ($voter): void {
        $res = $voter->request('GET', '/api/verify/OB-AAAA-BBBB-CCCC-DDDD');
        assert_same(404, $res['status']);
    });

    step('publishes results after voting (after_vote)', static function () use ($voter, &$demoElectionId): void {
        $res = $voter->request('GET', '/api/elections/' . $demoElectionId);
        assert_same(true, $res['data']['election']['resultsVisible']);
        assert_same(1, $res['data']['election']['results']['totalVotes']);
        assert_true(is_int($res['data']['election']['results']['registeredVoters']));
    });

    step('lists the voter ballots', static function () use ($voter, &$demoElectionId): void {
        $res = $voter->request('GET', '/api/my/votes');
        assert_same(200, $res['status']);
        assert_same(1, count($res['data']['ballots']));
        assert_same($demoElectionId, $res['data']['ballots'][0]['electionId']);
        assert_true(!array_key_exists('candidate', $res['data']['ballots'][0]), 'My votes must not reveal a choice.');
        assert_true(!empty($res['data']['ballots'][0]['votedAt']));
    });

    step('rejects wrong credentials', static function () use ($voter): void {
        $res = $voter->request('POST', '/api/auth/login', [
            'email' => 'voter@example.test',
            'password' => 'wrong-password',
        ]);
        assert_same(401, $res['status']);
    });

    step('denies admin API to voters', static function () use ($voter): void {
        $res = $voter->request('GET', '/api/admin/overview');
        assert_same(403, $res['status']);
    });

    step('signs the voter out', static function () use ($voter): void {
        $res = $voter->request('POST', '/api/auth/logout');
        assert_same(200, $res['status']);
        $me = $voter->request('GET', '/api/auth/me');
        assert_same(null, $me['data']['user']);
    });

    step('signs in as administrator', static function () use ($admin): void {
        $res = $admin->request('POST', '/api/auth/login', [
            'email' => 'admin@openballot.local',
            'password' => 'TestAdmin#123',
        ]);
        assert_same(200, $res['status']);
        assert_same('admin', $res['data']['user']['role']);
        assert_true(!empty($res['data']['csrf']));
        $admin->csrf = $res['data']['csrf'];
    });

    step('loads the admin overview', static function () use ($admin): void {
        $res = $admin->request('GET', '/api/admin/overview');
        assert_same(200, $res['status']);
        assert_true($res['data']['users']['total'] >= 2);
        assert_true($res['data']['ballots']['total'] >= 1);
    });

    step('creates a draft election', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('POST', '/api/admin/elections', [
            'title' => 'Smoke Test Election',
            'description' => 'Created by the automated test.',
            'resultsVisibility' => 'after_close',
            'opensAt' => gmdate('Y-m-d\TH:i:s\Z', time() - 60),
            'closesAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600),
        ]);
        assert_same(201, $res['status']);
        assert_same('draft', $res['data']['election']['status']);
        $newElectionId = $res['data']['election']['id'];
    });

    step('refuses to open an election with fewer than two candidates', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('PATCH', '/api/admin/elections/' . $newElectionId, ['status' => 'open']);
        assert_same(400, $res['status']);
        assert_same('not_enough_candidates', $res['data']['error']['code']);
    });

    step('adds two candidates', static function () use ($admin, &$newElectionId, &$newCandidateIds): void {
        foreach (['Candidate One', 'Candidate Two'] as $name) {
            $res = $admin->request('POST', '/api/admin/elections/' . $newElectionId . '/candidates', [
                'name' => $name,
                'party' => 'Test Party',
                'bio' => $name . ' is running in the smoke test.',
            ]);
            assert_same(201, $res['status']);
            $newCandidateIds[] = $res['data']['candidate']['id'];
        }
    });

    step('opens voting', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('PATCH', '/api/admin/elections/' . $newElectionId, ['status' => 'open']);
        assert_same(200, $res['status']);
        assert_same('open', $res['data']['election']['status']);
    });

    step('shows the new election publicly', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('GET', '/api/elections');
        $found = false;
        foreach ($res['data']['elections'] as $election) {
            if ($election['id'] === $newElectionId) {
                $found = true;
                break;
            }
        }
        assert_true($found, 'New election was not listed publicly.');
    });

    step('changes an election setting', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('PATCH', '/api/admin/elections/' . $newElectionId, [
            'resultsVisibility' => 'always',
        ]);
        assert_same(200, $res['status']);
        assert_same('always', $res['data']['election']['resultsVisibility']);
        assert_true(!array_key_exists('allowVoteChange', $res['data']['election']), 'Vote changes must not be configurable.');
    });

    step('votes in the new election as a voter', static function () use ($voter, &$newElectionId, &$newCandidateIds): void {
        $login = $voter->request('POST', '/api/auth/login', [
            'email' => 'voter@example.test',
            'password' => 'VoterPass#12',
        ]);
        assert_same(200, $login['status']);
        $voter->csrf = $login['data']['csrf'];
        $res = $voter->request('POST', '/api/elections/' . $newElectionId . '/vote', [
            'candidateId' => $newCandidateIds[0],
        ]);
        assert_same(201, $res['status']);
    });

    step('locks candidates after the first ballot', static function () use ($admin, &$newElectionId, &$newCandidateIds): void {
        $patch = $admin->request('PATCH', '/api/admin/candidates/' . $newCandidateIds[0], ['name' => 'Renamed']);
        assert_same(409, $patch['status']);
        $delete = $admin->request('DELETE', '/api/admin/candidates/' . $newCandidateIds[0]);
        assert_same(409, $delete['status']);
        $add = $admin->request('POST', '/api/admin/elections/' . $newElectionId . '/candidates', ['name' => 'Late Entry']);
        assert_same(409, $add['status']);
    });

    step('protects elections that contain ballots', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('DELETE', '/api/admin/elections/' . $newElectionId);
        assert_same(409, $res['status']);
    });

    step('exports admin results with turnout data', static function () use ($admin, &$newElectionId): void {
        $res = $admin->request('GET', '/api/admin/elections/' . $newElectionId . '/results');
        assert_same(200, $res['status']);
        assert_same(1, $res['data']['results']['totalVotes']);
        assert_true($res['data']['registeredVoters'] >= 1);
        assert_true(is_array($res['data']['timeline']));
    });

    step('lists accounts for administrators', static function () use ($admin): void {
        $res = $admin->request('GET', '/api/admin/users');
        assert_same(200, $res['status']);
        assert_true(count($res['data']['users']) >= 2);
        foreach ($res['data']['users'] as $user) {
            assert_true(is_int($user['ballotsCast']), 'ballotsCast should be an integer.');
        }
    });

    step('promotes a voter to administrator', static function () use ($admin): void {
        $users = $admin->request('GET', '/api/admin/users?q=voter@example.test');
        $target = $users['data']['users'][0];
        $res = $admin->request('PATCH', '/api/admin/users/' . $target['id'], ['role' => 'admin']);
        assert_same(200, $res['status']);
        assert_same('admin', $res['data']['user']['role']);
        $admin->request('PATCH', '/api/admin/users/' . $target['id'], ['role' => 'voter']);
    });

    step('prevents an administrator from deactivating themselves', static function () use ($admin): void {
        $me = $admin->request('GET', '/api/auth/me');
        $res = $admin->request('PATCH', '/api/admin/users/' . $me['data']['user']['id'], ['active' => false]);
        assert_same(400, $res['status']);
    });

    step('records an audit trail', static function () use ($admin): void {
        $res = $admin->request('GET', '/api/admin/audit?limit=50');
        assert_same(200, $res['status']);
        assert_true($res['data']['total'] >= 10);
        $hasVoteCast = false;
        foreach ($res['data']['entries'] as $entry) {
            if ($entry['action'] === 'vote.cast') {
                $hasVoteCast = true;
                $details = (array) $entry['details'];
                assert_true(!array_key_exists('candidateId', $details), 'Ballots must stay secret in the audit log.');
            }
        }
        assert_true($hasVoteCast, 'Expected a vote.cast audit entry.');
    });

    step('changes the voter password and invalidates old credentials', static function () use ($voter): void {
        $wrong = $voter->request('POST', '/api/auth/password', [
            'currentPassword' => 'nope',
            'newPassword' => 'NewVoterPass#2',
        ]);
        assert_same(401, $wrong['status']);
        $ok = $voter->request('POST', '/api/auth/password', [
            'currentPassword' => 'VoterPass#12',
            'newPassword' => 'NewVoterPass#2',
        ]);
        assert_same(200, $ok['status']);
        $relogin = $voter->request('POST', '/api/auth/login', [
            'email' => 'voter@example.test',
            'password' => 'NewVoterPass#2',
        ]);
        assert_same(200, $relogin['status']);
        $voter->csrf = (string) $relogin['data']['csrf'];
    });

    step('rejects malformed JSON bodies', static function () use ($base): void {
        $res = http_request(
            'POST',
            $base . '/api/auth/login',
            '{not json',
            ['Content-Type: application/json'],
        );
        assert_same(400, $res['status']);
    });

    /* Organization tenancy */

    $tag = bin2hex(random_bytes(4));
    $orgDomain = $tag . '.edu';
    $orgAdmin = new Client($base);
    $orgId = 0;
    $orgCsrf = '';

    step('registers an organization with its administrator', static function () use ($orgAdmin, $tag, $orgDomain, &$orgId, &$orgCsrf): void {
        $res = $orgAdmin->request('POST', '/api/organizations/register', [
            'organizationName' => 'Test College ' . $tag,
            'slug' => 'college-' . $tag,
            'domain' => $orgDomain,
            'membershipMode' => 'domain',
            'adminName' => 'Org Admin',
            'adminEmail' => 'admin@' . $orgDomain,
            'adminPassword' => 'OrgAdmin#2026!',
        ]);
        assert_same(201, $res['status'], 'Organization registration failed: ' . $res['text']);
        assert_same('org_admin', $res['data']['user']['role']);
        assert_same('active', $res['data']['organization']['status']);
        $orgId = (int) $res['data']['organization']['id'];
        $orgCsrf = (string) $res['data']['csrf'];
        $orgAdmin->csrf = $orgCsrf;
    });

    step('organization administrator reads scoped organization', static function () use ($orgAdmin, $orgId): void {
        $res = $orgAdmin->request('GET', '/api/org');
        assert_same(200, $res['status']);
        assert_same($orgId, (int) $res['data']['organization']['id']);
        assert_same(1, (int) $res['data']['members']);
    });

    step('member with matching domain joins automatically', static function () use ($base, $orgDomain, $orgId): void {
        $member = new Client($base);
        $res = $member->request('POST', '/api/auth/register', [
            'name' => 'Domain Member',
            'email' => 'member@' . $orgDomain,
            'password' => 'Member#2026!',
        ]);
        assert_same(201, $res['status'], $res['text']);
        assert_same($orgId, (int) $res['data']['user']['organizationId']);
    });

    step('organization administrator manages only their elections', static function () use ($orgAdmin, $orgId): void {
        $created = $orgAdmin->request('POST', '/api/admin/elections', [
            'title' => 'Org election ' . $orgId,
            'description' => 'Scoped to the organization',
        ]);
        assert_same(201, $created['status'], $created['text']);
        $list = $orgAdmin->request('GET', '/api/admin/elections');
        assert_same(200, $list['status']);
        $ids = array_column($list['data']['elections'], 'id');
        assert_true(in_array($created['data']['election']['id'], $ids, true), 'New org election missing from scoped list.');
        $denied = $orgAdmin->request('GET', '/api/admin/api-keys');
        assert_same(403, $denied['status'], 'Org admins must not access platform settings.');
    });

    step('invite-only organization joins through an invitation', static function () use ($base, $tag): void {
        $invAdmin = new Client($base);
        $domain = 'inv-' . $tag . '.edu';
        $created = $invAdmin->request('POST', '/api/organizations/register', [
            'organizationName' => 'Invite Corp ' . $tag,
            'slug' => 'invite-' . $tag,
            'domain' => $domain,
            'membershipMode' => 'invite',
            'adminName' => 'Invite Admin',
            'adminEmail' => 'admin@' . $domain,
            'adminPassword' => 'OrgAdmin#2026!',
        ]);
        assert_same(201, $created['status'], $created['text']);
        $invAdmin->csrf = (string) $created['data']['csrf'];
        $inviteId = (int) $created['data']['organization']['id'];

        $invited = $invAdmin->request('POST', '/api/org/invites', ['email' => 'friend@' . $domain, 'role' => 'voter']);
        assert_same(201, $invited['status'], $invited['text']);
        parse_str((string) parse_url($invited['data']['invite']['link'], PHP_URL_QUERY) ?: '', $query);
        $token = (string) ($query['token'] ?? '');

        $joiner = new Client($base);
        $res = $joiner->request('POST', '/api/auth/register', [
            'name' => 'Invited Member',
            'email' => 'friend@' . $domain,
            'password' => 'Member#2026!',
            'inviteToken' => $token,
        ]);
        assert_same(201, $res['status'], $res['text']);
        assert_same($inviteId, (int) $res['data']['user']['organizationId']);
    });

    step('platform administrator lists organizations', static function () use ($admin, $orgId): void {
        $res = $admin->request('GET', '/api/admin/organizations');
        assert_same(200, $res['status'], $res['text']);
        $ids = array_column($res['data']['organizations'], 'id');
        assert_true(in_array($orgId, $ids, true), 'Registered organization missing from platform list.');
    });

    /* Public polls */

    $pollSlug = '';
    $pollOptionId = 0;
    step('creates a shareable public poll', static function () use ($voter, &$pollSlug, &$pollOptionId): void {
        $res = $voter->request('POST', '/api/polls', [
            'title' => 'Best team lunch spot?',
            'description' => 'One quick question for everyone.',
            'options' => ['Cafeteria', 'Food truck', 'Pizza place'],
            'resultsVisibility' => 'always',
        ]);
        assert_same(201, $res['status'], $res['text']);
        assert_same('poll', $res['data']['poll']['kind']);
        $pollSlug = (string) $res['data']['poll']['slug'];
        $pollOptionId = (int) ($res['data']['candidates'][0]['id'] ?? 0);
        assert_true(str_contains($res['data']['shareLink'], '/p/' . $pollSlug));
    });

    step('lists polls created by the signed-in user', static function () use ($voter, $pollSlug): void {
        $res = $voter->request('GET', '/api/polls/mine');
        assert_same(200, $res['status'], $res['text']);
        $slugs = array_column($res['data']['polls'], 'slug');
        assert_true(in_array($pollSlug, $slugs, true), 'Created poll missing from owner list.');
    });

    step('lets an anonymous visitor vote once with a share link', static function () use ($base, $pollSlug, $pollOptionId): void {
        $visitor = new Client($base);
        $view = $visitor->request('GET', '/api/polls/' . $pollSlug);
        assert_same(200, $view['status'], $view['text']);
        assert_same(false, $view['data']['poll']['hasVoted']);

        $vote = $visitor->request('POST', '/api/polls/' . $pollSlug . '/vote', ['candidateId' => $pollOptionId]);
        assert_same(201, $vote['status'], $vote['text']);
        assert_true(!empty($vote['data']['receipt']), 'Expected a receipt code.');

        $again = $visitor->request('POST', '/api/polls/' . $pollSlug . '/vote', ['candidateId' => $pollOptionId]);
        assert_same(409, $again['status'], 'The same browser must not vote twice.');

        $after = $visitor->request('GET', '/api/polls/' . $pollSlug);
        assert_same(true, $after['data']['poll']['hasVoted']);
        $results = $visitor->request('GET', '/api/polls/' . $pollSlug . '/results');
        assert_same(200, $results['status'], $results['text']);
    });

    /* Poll reporting and moderation */

    step('lets a visitor report a poll once', static function () use ($base, $pollSlug): void {
        $visitor = new Client($base);
        $res = $visitor->request('POST', '/api/polls/' . $pollSlug . '/report', [
            'reason' => 'spam', 'details' => 'Test report',
        ]);
        assert_same(201, $res['status'], $res['text']);
        $again = $visitor->request('POST', '/api/polls/' . $pollSlug . '/report', [
            'reason' => 'spam', 'details' => 'Test report',
        ]);
        assert_same(409, $again['status'], 'A browser must not report the same poll twice.');
    });

    $pollId = 0;
    step('platform admin sees reported polls and their reports', static function () use ($admin, $pollSlug, &$pollId): void {
        $list = $admin->request('GET', '/api/admin/polls');
        assert_same(200, $list['status'], $list['text']);
        $match = null;
        foreach ($list['data']['polls'] as $poll) {
            if ($poll['slug'] === $pollSlug) { $match = $poll; break; }
        }
        assert_true($match !== null, 'Reported poll missing from moderation list.');
        assert_true((int) $match['openReports'] >= 1, 'Report was not counted.');
        $pollId = (int) $match['id'];

        $reports = $admin->request('GET', '/api/admin/polls/' . $pollId . '/reports');
        assert_same(200, $reports['status'], $reports['text']);
        assert_true(count($reports['data']['reports']) >= 1, 'Expected at least one report.');
        $reportId = (int) $reports['data']['reports'][0]['id'];
        $resolved = $admin->request('PATCH', '/api/admin/polls/' . $pollId . '/reports/' . $reportId, ['status' => 'resolved']);
        assert_same(200, $resolved['status'], $resolved['text']);
    });

    step('platform admin can close and reopen a poll', static function () use ($admin, $pollId): void {
        $close = $admin->request('PATCH', '/api/admin/polls/' . $pollId, ['action' => 'close']);
        assert_same(200, $close['status'], $close['text']);
        assert_same('closed', $close['data']['poll']['status']);
        $reopen = $admin->request('PATCH', '/api/admin/polls/' . $pollId, ['action' => 'reopen']);
        assert_same(200, $reopen['status'], $reopen['text']);
        assert_same('open', $reopen['data']['poll']['status']);
    });

    /* Poll reminders */

    step('poll reminder opt-in and cron delivery', static function () use ($voter, $base): void {
        $created = $voter->request('POST', '/api/polls', [
            'title' => 'Reminder check poll',
            'description' => 'Closes soon',
            'options' => ['A', 'B'],
            'resultsVisibility' => 'always',
            'closesAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600),
        ]);
        assert_same(201, $created['status'], $created['text']);
        $slug = (string) $created['data']['poll']['slug'];

        $sub = $voter->request('POST', '/api/polls/' . $slug . '/subscribe');
        assert_same(201, $sub['status'], $sub['text']);
        // The test database can retain subscriptions across runs; make this
        // poll eligible for a reminder again.
        db_exec('UPDATE poll_subscriptions SET reminded_at = NULL WHERE poll_id = ?', [(int) $created['data']['poll']['id']]);
        $view = $voter->request('GET', '/api/polls/' . $slug);
        assert_same(true, $view['data']['poll']['subscribed']);

        $denied = http_request('GET', $base . '/api/cron/poll-reminders?secret=wrong', null, ['Accept: application/json']);
        assert_same(401, $denied['status']);
        $cron = http_request('GET', $base . '/api/cron/poll-reminders?secret=' . urlencode('TestCron#123'), null, ['Accept: application/json']);
        assert_same(200, $cron['status'], $cron['text']);
        $body = json_decode($cron['text'], true);
        assert_true((int) ($body['sent'] ?? 0) >= 1, 'Expected at least one reminder email.');

        $unsub = $voter->request('DELETE', '/api/polls/' . $slug . '/subscribe');
        assert_same(200, $unsub['status'], $unsub['text']);
    });

    /* Security phase 1 — credentials and transport */

    step('serves hardening headers on API responses', static function () use ($base): void {
        $res = http_request('GET', $base . '/api/health', null, ['Accept: application/json']);
        $headers = implode("\n", $res['headers']);
        foreach (['Content-Security-Policy:', 'X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY',
                  'Referrer-Policy: no-referrer', 'Cache-Control: no-store'] as $needle) {
            assert_true(str_contains($headers, $needle), 'Missing header: ' . $needle);
        }
    });

    step('stores new passwords with a memory-hard hash', static function (): void {
        $hash = (string) db_scalar("SELECT password_hash FROM users WHERE email = 'voter@example.test'");
        if (defined('PASSWORD_ARGON2ID')) {
            assert_true(str_starts_with($hash, '$argon2id$'), 'Expected Argon2id hash, got ' . substr($hash, 0, 12));
        } else {
            assert_true(password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => 13]) === false, 'Expected cost-13 bcrypt hash.');
        }
    });

    step('upgrades legacy password hashes on successful sign-in', static function () use ($voter, $base): void {
        if (!defined('PASSWORD_ARGON2ID')) {
            return; // bcrypt builds have no stronger algorithm to upgrade to.
        }
        $legacy = password_hash('NewVoterPass#2', PASSWORD_BCRYPT, ['cost' => 10]);
        db_exec("UPDATE users SET password_hash = ? WHERE email = 'voter@example.test'", [$legacy]);
        $login = http_request('POST', $base . '/api/auth/login',
            json_encode(['email' => 'voter@example.test', 'password' => 'NewVoterPass#2']),
            ['Content-Type: application/json'],
        );
        assert_same(200, $login['status'], $login['text']);
        $data = json_decode($login['text'], true);
        $voter->cookie = '';
        $voter->csrf = null;
        foreach ($login['headers'] as $line) {
            if (stripos($line, 'Set-Cookie:') === 0 && str_starts_with(trim(substr($line, 11)), 'ob_session=')) {
                $voter->cookie = explode(';', trim(substr($line, 11)))[0];
            }
        }
        if (isset($data['csrf'])) { $voter->csrf = (string) $data['csrf']; }
        $upgraded = (string) db_scalar("SELECT password_hash FROM users WHERE email = 'voter@example.test'");
        assert_true(str_starts_with($upgraded, '$argon2id$'), 'Hash was not upgraded on login.');
    });

    echo "\n  {$passed} checks passed.\n\n";
    $stopServer();
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, "\nSmoke test failed: " . $error->getMessage() . "\n");
    if ($error->getFile() !== '') {
        fwrite(STDERR, '  at ' . $error->getFile() . ':' . $error->getLine() . "\n");
    }
    $stopServer();
    $log = @file_get_contents($tempDir . DIRECTORY_SEPARATOR . 'server-err.log');
    if (is_string($log) && trim($log) !== '') {
        fwrite(STDERR, "\nServer log (tail):\n" . implode("\n", array_slice(explode("\n", trim($log)), -20)) . "\n");
    }
    fwrite(STDERR, "\n");
    exit(1);
}
