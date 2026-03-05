// Taster Demo Site - Interactive Simulation

document.addEventListener('DOMContentLoaded', () => {
  // Demo step navigation
  const stepButtons = document.querySelectorAll('.demo-step');
  const panels = {
    1: document.getElementById('panel-1'),
    2: document.getElementById('panel-2'),
    3: document.getElementById('panel-3'),
  };

  stepButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      stepButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(p => p.classList.add('hidden'));
      panels[step].classList.remove('hidden');
    });
  });

  // Typewriter for terminal
  function typeLines(terminalId, lines, onComplete) {
    const terminal = document.getElementById(terminalId);
    let i = 0;

    function nextLine() {
      if (i >= lines.length) {
        if (onComplete) onComplete();
        return;
      }
      const line = lines[i];
      const div = document.createElement('div');
      div.className = `terminal-line ${line.type || 'output'}`;
      terminal.appendChild(div);
      terminal.scrollTop = terminal.scrollHeight;

      const text = line.text;
      let charIndex = 0;
      const speed = line.fast ? 2 : line.instant ? 0 : 15;

      if (speed === 0) {
        div.textContent = text;
        i++;
        const delay = line.delay || 80;
        setTimeout(nextLine, delay);
      } else {
        function typeChar() {
          if (charIndex < text.length) {
            div.textContent = text.substring(0, charIndex + 1);
            charIndex++;
            terminal.scrollTop = terminal.scrollHeight;
            setTimeout(typeChar, speed);
          } else {
            i++;
            const delay = line.delay || 100;
            setTimeout(nextLine, delay);
          }
        }
        typeChar();
      }
    }

    nextLine();
  }

  // init command
  document.getElementById('btn-init').addEventListener('click', () => {
    const name = document.getElementById('init-name').value || 'my-app';
    const url = document.getElementById('init-url').value || 'https://staging.example.com';
    const ddKey = document.getElementById('init-dd-key').value;

    const terminal = document.getElementById('terminal-1');
    terminal.innerHTML = '';

    const ddConfigured = ddKey ? 'configured' : 'not configured';

    typeLines('terminal-1', [
      { text: `$ npx taster init ${name} --url ${url}`, type: 'prompt', delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: `Creating project "${name}"...`, type: 'dim', delay: 400 },
      { text: `  Creating directory: projects/${name}/`, type: 'output', fast: true, delay: 200 },
      { text: `  Copying template files...`, type: 'output', fast: true, delay: 300 },
      { text: `  Writing taster.config.json...`, type: 'output', fast: true, delay: 200 },
      { text: `  Writing .credentials...`, type: 'output', fast: true, delay: 200 },
      { text: `  Configuring playwright.config.ts (baseURL: ${url})`, type: 'output', fast: true, delay: 300 },
      { text: '', type: 'output', instant: true, delay: 100 },
      { text: `Project "${name}" initialized at projects/${name}/`, type: 'success', delay: 200 },
      { text: `  - Staging URL: ${url}`, type: 'output', instant: true, delay: 100 },
      { text: `  - Datadog: ${ddConfigured}`, type: 'output', instant: true, delay: 100 },
      { text: `  - Playwright: configured`, type: 'output', instant: true, delay: 200 },
      { text: '', type: 'output', instant: true, delay: 100 },
      { text: `Next steps:`, type: 'info', instant: true, delay: 100 },
      { text: `  1. Add test cases to projects/${name}/testcases/`, type: 'output', instant: true, delay: 100 },
      { text: `  2. Run: taster read-case --project ${name}`, type: 'output', instant: true },
    ], () => {
      // Mark step 1 as completed
      stepButtons[0].classList.add('completed');
    });
  });

  // read-case command
  document.getElementById('btn-read').addEventListener('click', () => {
    const provider = document.getElementById('read-provider').value;
    const dryRun = document.getElementById('read-dryrun').checked;

    const terminal = document.getElementById('terminal-2');
    terminal.innerHTML = '';

    let cmdStr = '$ npx taster read-case --project my-app';
    if (provider !== 'all') cmdStr += ` --provider ${provider}`;
    if (dryRun) cmdStr += ' --dry-run';

    const allCases = [
      { id: 'TC-001', name: 'Login Page Display', provider: 'datadog' },
      { id: 'TC-002', name: 'Login Flow', provider: 'playwright' },
      { id: 'TC-003', name: 'Top Page Display', provider: 'datadog' },
      { id: 'TC-004', name: 'User Registration', provider: 'playwright' },
    ];

    const cases = provider === 'all'
      ? allCases
      : allCases.filter(c => c.provider === provider);

    const lines = [
      { text: cmdStr, type: 'prompt', delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Reading test cases from projects/my-app/testcases/', type: 'dim', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: `Found ${cases.length} test cases:`, type: 'output', delay: 200 },
    ];

    cases.forEach(c => {
      lines.push({
        text: `  - ${c.id}: ${c.name} (${c.provider})`,
        type: 'output',
        instant: true,
        delay: 100,
      });
    });

    if (dryRun) {
      lines.push({ text: '', type: 'output', instant: true, delay: 200 });
      lines.push({ text: 'Dry run mode - no changes made.', type: 'warning', delay: 100 });
    } else {
      const ddCases = cases.filter(c => c.provider === 'datadog');
      const pwCases = cases.filter(c => c.provider === 'playwright');

      if (ddCases.length > 0) {
        lines.push({ text: '', type: 'output', instant: true, delay: 300 });
        lines.push({ text: 'Registering to Datadog Synthetics...', type: 'dim', delay: 300 });
        ddCases.forEach(c => {
          const fakeId = Math.random().toString(36).substring(2, 14);
          lines.push({
            text: `  [PASS] ${c.id}: Created (test_id: ${fakeId})`,
            type: 'success',
            fast: true,
            delay: 300,
          });
        });
      }

      if (pwCases.length > 0) {
        lines.push({ text: '', type: 'output', instant: true, delay: 300 });
        lines.push({ text: 'Generating Playwright tests...', type: 'dim', delay: 300 });
        pwCases.forEach(c => {
          const fileName = `${c.id}-${c.name.toLowerCase().replace(/\s+/g, '-')}.spec.ts`;
          lines.push({
            text: `  [PASS] ${c.id}: Generated -> tests/${fileName}`,
            type: 'success',
            fast: true,
            delay: 300,
          });
        });
      }

      const ddCount = ddCases.length;
      const pwCount = pwCases.length;
      lines.push({ text: '', type: 'output', instant: true, delay: 200 });
      lines.push({
        text: `Summary: ${cases.length} test cases processed (${ddCount} datadog, ${pwCount} playwright)`,
        type: 'info',
        delay: 100,
      });
    }

    typeLines('terminal-2', lines, () => {
      stepButtons[1].classList.add('completed');
    });
  });

  // run-case command
  document.getElementById('btn-run').addEventListener('click', () => {
    const provider = document.getElementById('run-provider').value;
    const caseId = document.getElementById('run-case').value;
    const headed = document.getElementById('run-headed').checked;

    const terminal = document.getElementById('terminal-3');
    terminal.innerHTML = '';

    let cmdStr = '$ npx taster run-case --project my-app';
    if (provider !== 'all') cmdStr += ` --provider ${provider}`;
    if (caseId !== 'all') cmdStr += ` --case ${caseId}`;
    if (headed) cmdStr += ' --headed';

    const allResults = [
      { id: 'TC-001', name: 'Login Page Display', provider: 'datadog', status: 'passed', duration: '2.3s' },
      { id: 'TC-002', name: 'Login Flow', provider: 'playwright', status: 'passed', duration: '5.1s' },
      { id: 'TC-003', name: 'Top Page Display', provider: 'datadog', status: 'passed', duration: '1.8s' },
      { id: 'TC-004', name: 'User Registration', provider: 'playwright', status: 'failed', duration: '3.2s', error: 'Assertion failed: expected "Registration Complete"' },
    ];

    let results = allResults;
    if (provider !== 'all') {
      results = results.filter(r => r.provider === provider);
    }
    if (caseId !== 'all') {
      results = results.filter(r => r.id === caseId);
    }

    const lines = [
      { text: cmdStr, type: 'prompt', delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Running tests for project: my-app', type: 'dim', delay: 400 },
    ];

    const ddResults = results.filter(r => r.provider === 'datadog');
    const pwResults = results.filter(r => r.provider === 'playwright');

    if (ddResults.length > 0) {
      lines.push({ text: '', type: 'output', instant: true, delay: 200 });
      lines.push({ text: 'Triggering Datadog tests...', type: 'dim', delay: 300 });
      ddResults.forEach(r => {
        lines.push({ text: `  [WAIT] ${r.id}: Running...`, type: 'warning', fast: true, delay: 800 });
        const type = r.status === 'passed' ? 'success' : 'error';
        const mark = r.status === 'passed' ? 'PASS' : 'FAIL';
        lines.push({ text: `  [${mark}] ${r.id}: ${r.status === 'passed' ? 'Passed' : 'Failed'} (${r.duration})`, type, fast: true, delay: 200 });
        if (r.error) {
          lines.push({ text: `       ${r.error}`, type: 'error', instant: true, delay: 100 });
        }
      });
    }

    if (pwResults.length > 0) {
      lines.push({ text: '', type: 'output', instant: true, delay: 200 });
      lines.push({ text: 'Running Playwright tests...', type: 'dim', delay: 300 });
      pwResults.forEach(r => {
        lines.push({ text: `  [WAIT] ${r.id}: Running...`, type: 'warning', fast: true, delay: 1000 });
        const type = r.status === 'passed' ? 'success' : 'error';
        const mark = r.status === 'passed' ? 'PASS' : 'FAIL';
        lines.push({ text: `  [${mark}] ${r.id}: ${r.status === 'passed' ? 'Passed' : 'Failed'} (${r.duration})`, type, fast: true, delay: 200 });
        if (r.error) {
          lines.push({ text: `       ${r.error}`, type: 'error', instant: true, delay: 100 });
        }
      });
    }

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    lines.push({ text: '', type: 'output', instant: true, delay: 200 });
    lines.push({ text: 'Results saved to: projects/my-app/results/2026-03-05 14:30:00/', type: 'dim', instant: true, delay: 200 });
    lines.push({ text: '', type: 'output', instant: true, delay: 100 });
    lines.push({ text: 'Summary:', type: 'info', instant: true, delay: 100 });
    lines.push({ text: `  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, type: 'output', instant: true, delay: 100 });
    lines.push({ text: `  Duration: 12.4s`, type: 'output', instant: true });

    typeLines('terminal-3', lines, () => {
      stepButtons[2].classList.add('completed');
      showResultDashboard(results);
    });
  });

  // Result Dashboard
  function showResultDashboard(results) {
    const dashboard = document.getElementById('result-dashboard');
    dashboard.classList.remove('hidden');

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    document.getElementById('stat-total').textContent = results.length;
    document.getElementById('stat-passed').textContent = passed;
    document.getElementById('stat-failed').textContent = failed;

    const tbody = document.getElementById('result-table-body');
    tbody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      const statusClass = r.status === 'passed' ? 'status-passed' : 'status-failed';
      const statusMark = r.status === 'passed' ? 'PASS' : 'FAIL';
      tr.innerHTML = `
        <td><span class="status-badge ${statusClass}">${statusMark}</span></td>
        <td>${r.id}</td>
        <td>${r.name}</td>
        <td>${r.provider}</td>
        <td>${r.duration}</td>
      `;
      tbody.appendChild(tr);
    });

    dashboard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // AI Crawl Demo
  document.getElementById('btn-ai-crawl').addEventListener('click', () => {
    const url = document.getElementById('ai-crawl-url').value || 'https://staging.example.com';
    const depth = document.getElementById('ai-crawl-depth').value || 3;
    const maxPages = document.getElementById('ai-crawl-pages').value || 50;

    const terminal = document.getElementById('terminal-ai');
    terminal.innerHTML = '';

    const lines = [
      { text: `$ npx taster generate-case --method crawl --depth ${depth} --max-pages ${maxPages}`, type: 'prompt', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: `Starting site crawl: ${url}`, type: 'dim', delay: 500 },
      { text: `Checking robots.txt...`, type: 'dim', fast: true, delay: 300 },
      { text: `Checking sitemap.xml...`, type: 'dim', fast: true, delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Crawling pages (BFS, depth limit: ' + depth + ')...', type: 'info', delay: 400 },
      { text: `  [1/8] ${url}/                       ... 12 elements found`, type: 'output', fast: true, delay: 400 },
      { text: `  [2/8] ${url}/login                  ... 5 forms, 3 buttons`, type: 'output', fast: true, delay: 500 },
      { text: `  [3/8] ${url}/register                ... 2 forms, 4 inputs`, type: 'output', fast: true, delay: 400 },
      { text: `  [4/8] ${url}/dashboard               ... 8 interactive elements`, type: 'output', fast: true, delay: 500 },
      { text: `  [5/8] ${url}/settings                 ... 3 forms`, type: 'output', fast: true, delay: 400 },
      { text: `  [6/8] ${url}/users                    ... table, pagination`, type: 'output', fast: true, delay: 400 },
      { text: `  [7/8] ${url}/users/new                ... 1 form, 6 inputs`, type: 'output', fast: true, delay: 500 },
      { text: `  [8/8] ${url}/reports                  ... charts, filters`, type: 'output', fast: true, delay: 400 },
      { text: '', type: 'output', instant: true, delay: 300 },
      { text: 'Crawl complete. 8 pages analyzed.', type: 'success', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Sending page data to AI (Claude API)...', type: 'info', delay: 600 },
      { text: '  Building prompt (3-layer structure)...', type: 'dim', fast: true, delay: 300 },
      { text: '  System prompt: TestCase schema + ActionType definitions', type: 'dim', fast: true, delay: 200 },
      { text: '  Context: 8 pages, 34 interactive elements, 11 forms', type: 'dim', fast: true, delay: 200 },
      { text: '  Requesting structured JSON output...', type: 'dim', fast: true, delay: 800 },
      { text: '', type: 'output', instant: true, delay: 300 },
      { text: 'AI response received. Parsing test cases...', type: 'info', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Generated 6 test cases:', type: 'success', delay: 300 },
      { text: '  AG-001: Top Page Navigation Test          (playwright, 4 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-002: Login Form Validation              (playwright, 8 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-003: User Registration Flow             (playwright, 10 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-004: Dashboard Display Verification      (datadog, 5 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-005: Settings Update Flow                (playwright, 7 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-006: User List & Pagination              (datadog, 6 steps)', type: 'output', instant: true, delay: 100 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Validating generated test cases...', type: 'dim', fast: true, delay: 300 },
      { text: '  [PASS] Schema validation passed (6/6 cases)', type: 'success', fast: true, delay: 200 },
      { text: '  [PASS] ActionType validation passed (40/40 steps)', type: 'success', fast: true, delay: 200 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Writing Excel: projects/my-app/testcases/auto-generated-2026-03-05.xlsx', type: 'info', fast: true, delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Generation Summary:', type: 'info', instant: true, delay: 100 },
      { text: '  Test Cases: 6 (4 playwright, 2 datadog)', type: 'output', instant: true, delay: 80 },
      { text: '  Total Steps: 40', type: 'output', instant: true, delay: 80 },
      { text: '  Pages Analyzed: 8', type: 'output', instant: true, delay: 80 },
      { text: '  Tokens Used: 12,450 (input: 8,200, output: 4,250)', type: 'output', instant: true, delay: 80 },
      { text: '  Estimated Cost: $0.09', type: 'output', instant: true, delay: 80 },
      { text: '', type: 'output', instant: true, delay: 100 },
      { text: 'Next: Run "taster read-case" to register generated test cases.', type: 'dim', instant: true },
    ];

    typeLines('terminal-ai', lines, () => {
      showGeneratedCases('crawl');
    });
  });

  // AI Repo Demo
  document.getElementById('btn-ai-repo').addEventListener('click', () => {
    const repoPath = document.getElementById('ai-repo-path').value || './my-app';
    const framework = document.getElementById('ai-repo-framework').value;

    const terminal = document.getElementById('terminal-ai');
    terminal.innerHTML = '';

    const frameworkLabel = framework === 'auto' ? 'auto-detecting' : framework;

    const lines = [
      { text: `$ npx taster generate-case --method repo --repo-path ${repoPath}${framework !== 'auto' ? ` --framework ${framework}` : ''}`, type: 'prompt', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: `Loading repository: ${repoPath}`, type: 'dim', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Detecting framework...', type: 'info', fast: true, delay: 500 },
      { text: '  Found: package.json -> next: "14.2.0"', type: 'output', fast: true, delay: 300 },
      { text: '  Framework detected: Next.js (App Router)', type: 'success', fast: true, delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Extracting routes...', type: 'info', fast: true, delay: 400 },
      { text: '  app/page.tsx                -> /', type: 'output', fast: true, delay: 200 },
      { text: '  app/login/page.tsx          -> /login', type: 'output', fast: true, delay: 200 },
      { text: '  app/register/page.tsx       -> /register', type: 'output', fast: true, delay: 200 },
      { text: '  app/dashboard/page.tsx      -> /dashboard', type: 'output', fast: true, delay: 200 },
      { text: '  app/settings/page.tsx       -> /settings', type: 'output', fast: true, delay: 200 },
      { text: '  app/users/page.tsx          -> /users', type: 'output', fast: true, delay: 200 },
      { text: '  app/users/[id]/page.tsx     -> /users/:id', type: 'output', fast: true, delay: 200 },
      { text: `  7 routes extracted`, type: 'success', fast: true, delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Analyzing components...', type: 'info', fast: true, delay: 400 },
      { text: '  LoginForm.tsx      -> form, 2 inputs, submit button', type: 'output', fast: true, delay: 200 },
      { text: '  RegisterForm.tsx   -> form, 4 inputs, submit button', type: 'output', fast: true, delay: 200 },
      { text: '  SettingsForm.tsx   -> form, 3 inputs, save button', type: 'output', fast: true, delay: 200 },
      { text: '  UserTable.tsx      -> table, pagination, search', type: 'output', fast: true, delay: 200 },
      { text: '  Navbar.tsx         -> nav, 5 links', type: 'output', fast: true, delay: 200 },
      { text: '  5 components with interactive elements found', type: 'success', fast: true, delay: 300 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Detecting selectors...', type: 'dim', fast: true, delay: 300 },
      { text: '  data-testid attributes found: 14', type: 'output', fast: true, delay: 200 },
      { text: '  ARIA labels found: 8', type: 'output', fast: true, delay: 200 },
      { text: '', type: 'output', instant: true, delay: 300 },
      { text: 'Sending analysis to AI (Claude API)...', type: 'info', delay: 600 },
      { text: '  CodeAnalysisResult: 7 routes, 5 components, 14 selectors', type: 'dim', fast: true, delay: 400 },
      { text: '  Requesting structured JSON output...', type: 'dim', fast: true, delay: 800 },
      { text: '', type: 'output', instant: true, delay: 300 },
      { text: 'AI response received. Parsing test cases...', type: 'info', delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Generated 5 test cases:', type: 'success', delay: 300 },
      { text: '  AG-001: Home Page Rendering              (datadog, 3 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-002: Login Authentication Flow         (playwright, 9 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-003: New User Registration             (playwright, 11 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-004: Settings Profile Update           (playwright, 7 steps)', type: 'output', instant: true, delay: 100 },
      { text: '  AG-005: User List Search & Pagination     (playwright, 8 steps)', type: 'output', instant: true, delay: 100 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Validating generated test cases...', type: 'dim', fast: true, delay: 300 },
      { text: '  [PASS] Schema validation passed (5/5 cases)', type: 'success', fast: true, delay: 200 },
      { text: '  [PASS] Selector validation: 38/38 selectors use data-testid or ARIA', type: 'success', fast: true, delay: 200 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Writing Excel: projects/my-app/testcases/auto-generated-2026-03-05.xlsx', type: 'info', fast: true, delay: 400 },
      { text: '', type: 'output', instant: true, delay: 200 },
      { text: 'Generation Summary:', type: 'info', instant: true, delay: 100 },
      { text: '  Test Cases: 5 (4 playwright, 1 datadog)', type: 'output', instant: true, delay: 80 },
      { text: '  Total Steps: 38', type: 'output', instant: true, delay: 80 },
      { text: '  Files Analyzed: 23', type: 'output', instant: true, delay: 80 },
      { text: '  Tokens Used: 9,800 (input: 6,500, output: 3,300)', type: 'output', instant: true, delay: 80 },
      { text: '  Estimated Cost: $0.07', type: 'output', instant: true, delay: 80 },
      { text: '', type: 'output', instant: true, delay: 100 },
      { text: 'Next: Run "taster read-case" to register generated test cases.', type: 'dim', instant: true },
    ];

    typeLines('terminal-ai', lines, () => {
      showGeneratedCases('repo');
    });
  });

  function showGeneratedCases(method) {
    const preview = document.getElementById('generated-preview');
    preview.classList.remove('hidden');

    const tbody = document.getElementById('generated-table-body');
    tbody.innerHTML = '';

    const cases = method === 'crawl' ? [
      { id: 'AG-001', name: 'Top Page Navigation Test', cat: 'Navigation', provider: 'playwright', priority: 'medium', steps: 4 },
      { id: 'AG-002', name: 'Login Form Validation', cat: 'Authentication', provider: 'playwright', priority: 'high', steps: 8 },
      { id: 'AG-003', name: 'User Registration Flow', cat: 'Registration', provider: 'playwright', priority: 'high', steps: 10 },
      { id: 'AG-004', name: 'Dashboard Display Verification', cat: 'Dashboard', provider: 'datadog', priority: 'medium', steps: 5 },
      { id: 'AG-005', name: 'Settings Update Flow', cat: 'Settings', provider: 'playwright', priority: 'low', steps: 7 },
      { id: 'AG-006', name: 'User List & Pagination', cat: 'User Management', provider: 'datadog', priority: 'medium', steps: 6 },
    ] : [
      { id: 'AG-001', name: 'Home Page Rendering', cat: 'Page Rendering', provider: 'datadog', priority: 'medium', steps: 3 },
      { id: 'AG-002', name: 'Login Authentication Flow', cat: 'Authentication', provider: 'playwright', priority: 'high', steps: 9 },
      { id: 'AG-003', name: 'New User Registration', cat: 'Registration', provider: 'playwright', priority: 'high', steps: 11 },
      { id: 'AG-004', name: 'Settings Profile Update', cat: 'Settings', provider: 'playwright', priority: 'medium', steps: 7 },
      { id: 'AG-005', name: 'User List Search & Pagination', cat: 'User Management', provider: 'playwright', priority: 'medium', steps: 8 },
    ];

    cases.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.cat}</td>
        <td>${c.provider}</td>
        <td>${c.priority}</td>
        <td>${c.steps}</td>
      `;
      tbody.appendChild(tr);
    });

    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
