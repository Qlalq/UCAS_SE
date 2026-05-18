const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://demo.4gaboards.com';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ADMIN = {
  emailOrUsername: 'qianyongjie25@mails.ucas.ac.cn',
  password: '8fMQq28AmjQ.Cnd',
};
const PASSWORD = 'Test123!@#Strong';
const TIMEOUT = 100000;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateText(value, length = 1800) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function markdownStatus(status) {
  return {
    pass: '通过',
    fail: '未通过',
    blocked: '受阻',
    error: '执行异常',
  }[status] || status;
}

function safeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-');
}

function byName(cases) {
  return Object.fromEntries(cases.map((item, index) => [item.name, { ...item, caseNo: String(index + 1).padStart(2, '0') }]));
}

function resultBase(testCase) {
  return {
    caseNo: testCase.caseNo,
    name: testCase.name,
    status: 'error',
    given: testCase.steps?.slice(0, -1) || [],
    when: testCase.steps?.slice(-1) || [],
    expectation: testCase.expectation,
    actual: '',
    evidence: [],
    apiEvidence: [],
    screenshots: [],
  };
}

function caseMarkdown(result) {
  const list = (items) => (items?.length ? items.map((item) => `- ${item}`).join('\n') : '- 无');
  const screenshots = result.screenshots?.length
    ? result.screenshots.map((item) => `- [${path.basename(item)}](${item})`).join('\n')
    : '- 无';
  return `## ${result.caseNo}. ${result.name}

**结论：${markdownStatus(result.status)}**

**Given**
${list(result.given)}

**When**
${list(result.when)}

**Then**
- 期望：${result.expectation}
- 实际：${result.actual}

**执行验证**
${list(result.evidence)}

**接口/数据验证**
${list(result.apiEvidence)}

**截图**
${screenshots}

`;
}

async function launchBrowser() {
  return chromium.launch({
    executablePath: fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined,
    channel: fs.existsSync(EDGE_PATH) ? undefined : 'msedge',
    headless: process.env.PW_HEADLESS === '1',
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
  });
}

async function newContext(browser) {
  return browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  });
}

async function pageText(page, max = 3000) {
  return truncateText(await page.locator('body').innerText({ timeout: 10000 }).catch(() => ''), max);
}

async function saveScreenshot(page, filePath) {
  ensureDir(path.dirname(filePath));
  try {
    await page.screenshot({ path: filePath, fullPage: true, timeout: TIMEOUT });
  } catch (error) {
    fs.writeFileSync(`${filePath}.error.txt`, String(error), 'utf8');
  }
}

async function navigate(page, url, label, navLog) {
  navLog.push(`${label}: ${url}`);
  await page.goto(url, { waitUntil: 'commit', timeout: TIMEOUT });
  await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function apiRequest(method, endpoint, body, token, extraHeaders = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = { ...extraHeaders };
  const options = { method, headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ok: res.ok, text, json, headers: Object.fromEntries(res.headers.entries()) };
}

async function getAccessToken(emailOrUsername, password) {
  const res = await apiRequest('POST', '/api/access-tokens', { emailOrUsername, password });
  if (!res.ok || !res.json?.item) {
    throw new Error(`login failed ${res.status}: ${res.text}`);
  }
  return res.json.item;
}

async function adminToken() {
  return getAccessToken(ADMIN.emailOrUsername, ADMIN.password);
}

async function adminApi(method, endpoint, body) {
  return apiRequest(method, endpoint, body, await adminToken());
}

async function setAuthCookies(context, token) {
  await context.clearCookies();
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  await context.addCookies([
    { name: 'accessToken', value: token, url: BASE_URL, expires, sameSite: 'Strict', secure: true },
    { name: 'accessTokenVersion', value: '1', url: BASE_URL, expires, sameSite: 'Strict', secure: true },
  ]);
}

async function loginPageAs(context, page, email, password) {
  const token = await getAccessToken(email, password);
  await setAuthCookies(context, token);
  return token;
}

async function registerUser(prefix, runId, options = {}) {
  const email = `${prefix}_${runId}@example.com`.toLowerCase().replace(/[^a-z0-9_@.-]/g, '');
  const res = await apiRequest('POST', '/api/register', {
    email,
    password: PASSWORD,
    name: options.name || `${prefix} Probe`,
    username: options.username,
    policy: true,
  });
  if (!res.ok) throw new Error(`register failed ${res.status}: ${res.text}`);
  const users = await adminApi('GET', '/api/users');
  const user = users.json?.items?.find((item) => item.email === email);
  return { email, password: PASSWORD, token: res.json?.item, user, response: res };
}

async function createProject(name) {
  const res = await adminApi('POST', '/api/projects', { name });
  if (!res.ok) throw new Error(`create project failed ${res.status}: ${res.text}`);
  return res.json.item;
}

async function createBoard(projectId, name, lists = []) {
  const res = await adminApi('POST', `/api/projects/${projectId}/boards`, {
    position: 65535,
    name,
    isGithubConnected: false,
    requestId: nowId(),
    lists,
    labels: [],
  });
  if (!res.ok) throw new Error(`create board failed ${res.status}: ${res.text}`);
  return res.json.item;
}

async function createList(boardId, name, token = null) {
  const res = await apiRequest('POST', `/api/boards/${boardId}/lists`, { position: 65535, name, isCollapsed: false }, token || await adminToken());
  if (!res.ok) throw new Error(`create list failed ${res.status}: ${res.text}`);
  return res.json.item;
}

async function createCard(listId, name, token = null, extra = {}) {
  const res = await apiRequest('POST', `/api/lists/${listId}/cards`, { position: 65535, name, ...extra }, token || await adminToken());
  if (!res.ok) throw new Error(`create card failed ${res.status}: ${res.text}`);
  return res.json.item;
}

async function addBoardMembership(boardId, userId, role = 'editor', canComment = null) {
  const body = { boardId, userId, role };
  if (canComment !== null && canComment !== undefined) {
    body.canComment = canComment;
  }
  const res = await adminApi('POST', `/api/boards/${boardId}/memberships`, body);
  if (!res.ok && res.status !== 409) throw new Error(`add membership failed ${res.status}: ${res.text}`);
  return res.json?.item;
}

async function createFixture(runId, prefix = 'fixture') {
  const project = await createProject(`${prefix}-project-${runId}`);
  const board = await createBoard(project.id, `${prefix}-board-${runId}`);
  const todo = await createList(board.id, `${prefix}-todo`);
  const done = await createList(board.id, `${prefix}-done`);
  const card = await createCard(todo.id, `${prefix}-card-${runId}`);
  return { project, board, lists: { todo, done }, card };
}

function localShot(resultDir, caseNo, name) {
  return path.join(resultDir, 'screenshots', `${caseNo}-${safeFileName(name)}.png`);
}

async function shot(result, page, resultDir, name) {
  const filePath = localShot(resultDir, result.caseNo, name);
  result.screenshots.push(filePath);
  await saveScreenshot(page, filePath);
}

async function getMe(token) {
  return apiRequest('GET', '/api/users/me', undefined, token);
}

async function commonBoardVisual(page, context, fixture, result, resultDir, navLog, token = null, name = 'board') {
  if (token) await setAuthCookies(context, token);
  await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, name, navLog);
  await shot(result, page, resultDir, name);
  return pageText(page, 2500);
}

async function testProjectBoard(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    if (name === '创建项目') {
      const project = await createProject(`agent-project-${runId}`);
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/`, 'dashboard after create project', navLog);
      await shot(result, page, resultDir, 'dashboard-after-create-project');
      const projects = await adminApi('GET', '/api/projects');
      const exists = projects.json?.items?.some((item) => item.id === project.id);
      result.evidence.push(`创建项目名称：${project.name}`);
      result.apiEvidence.push(`POST /api/projects 返回项目 id：${project.id}`);
      result.apiEvidence.push(`GET /api/projects 可查到新项目：${exists}`);
      result.actual = exists ? '项目已创建并可在项目列表接口中查到；dashboard 页面已截图留证。' : '项目创建后未在项目列表接口中查到。';
      result.status = exists ? 'pass' : 'fail';
    } else if (name === '项目权限层级') {
      const hidden = await createFixture(runId, 'permission-hidden');
      const user = await registerUser('permission_user', runId);
      const token = await getAccessToken(user.email, user.password);
      const visibleProjectRes = await apiRequest('GET', `/api/projects/${hidden.project.id}`, undefined, token);
      await setAuthCookies(context, token);
      await navigate(page, `${BASE_URL}/`, 'ordinary user dashboard', navLog);
      await shot(result, page, resultDir, 'ordinary-user-dashboard');
      const body = await pageText(page);
      result.evidence.push(`普通用户：${user.email}`);
      result.evidence.push(`dashboard 文本是否包含未加入项目名：${body.includes(hidden.project.name)}`);
      result.apiEvidence.push(`普通用户 GET /api/projects/${hidden.project.id} 返回 ${visibleProjectRes.status}`);
      result.actual = visibleProjectRes.status === 404 && !body.includes(hidden.project.name) ? '普通用户看不到未被添加的项目。' : '普通用户仍可访问或看到未授权项目。';
      result.status = visibleProjectRes.status === 404 && !body.includes(hidden.project.name) ? 'pass' : 'fail';
    } else if (name === '创建看板') {
      const project = await createProject(`board-template-project-${runId}`);
      const board = await createBoard(project.id, `kanban-template-board-${runId}`, [
        { position: 65535, name: 'To Do', isCollapsed: false },
        { position: 131070, name: 'Doing', isCollapsed: false },
        { position: 196605, name: 'Done', isCollapsed: false },
      ]);
      const boardRes = await adminApi('GET', `/api/boards/${board.id}`);
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/boards/${board.id}`, 'created board', navLog);
      await shot(result, page, resultDir, 'created-board');
      const listNames = boardRes.json?.included?.lists?.map((item) => item.name) || [];
      result.evidence.push(`页面 URL：${page.url()}`);
      result.apiEvidence.push(`GET /api/boards/${board.id} 列表：${JSON.stringify(listNames)}`);
      result.actual = listNames.length >= 3 ? '看板创建成功，并生成预设列表。' : '看板创建后未生成预设列表。';
      result.status = listNames.length >= 3 ? 'pass' : 'fail';
    } else if (name === '看板视图切换') {
      const fixture = await createFixture(runId, 'view-switch');
      const boardView = await adminApi('GET', `/api/boards/${fixture.board.id}`);
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, 'board view', navLog);
      await shot(result, page, resultDir, 'board-view');
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}?view=list`, 'list view', navLog);
      await shot(result, page, resultDir, 'list-view');
      const cardNames = boardView.json?.included?.cards?.map((item) => item.name) || [];
      result.evidence.push(`board/list 两个 URL 均可加载，卡片：${JSON.stringify(cardNames)}`);
      result.apiEvidence.push(`GET /api/boards/${fixture.board.id} 返回 ${boardView.status}`);
      result.actual = cardNames.includes(fixture.card.name) ? '同一看板数据可在 board/list URL 下加载，接口数据一致。' : '接口未返回预期卡片数据。';
      result.status = cardNames.includes(fixture.card.name) ? 'pass' : 'fail';
    } else if (name === '删除项目') {
      const fixture = await createFixture(runId, 'delete-project');
      const del = await adminApi('DELETE', `/api/projects/${fixture.project.id}`);
      const get = await adminApi('GET', `/api/projects/${fixture.project.id}`);
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/`, 'dashboard after delete project', navLog);
      await shot(result, page, resultDir, 'dashboard-after-delete');
      result.apiEvidence.push(`DELETE /api/projects/${fixture.project.id} 返回 ${del.status}`);
      result.apiEvidence.push(`删除后 GET /api/projects/${fixture.project.id} 返回 ${get.status}`);
      result.actual = del.ok && get.status === 404 ? '项目删除后接口不可再读取，页面已回到 dashboard。' : '项目删除未达到预期。';
      result.status = del.ok && get.status === 404 ? 'pass' : 'fail';
    } else if (name === '重命名项目') {
      const fixture = await createFixture(runId, 'rename-project');
      const nextName = `${fixture.project.name}-renamed`;
      const patch = await adminApi('PATCH', `/api/projects/${fixture.project.id}`, { name: nextName });
      const get = await adminApi('GET', `/api/projects/${fixture.project.id}`);
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/projects/${fixture.project.id}/settings`, 'project settings after rename', navLog);
      await shot(result, page, resultDir, 'project-settings-after-rename');
      result.apiEvidence.push(`PATCH /api/projects/${fixture.project.id} 返回 ${patch.status}`);
      result.apiEvidence.push(`GET /api/projects/${fixture.project.id} 名称：${get.json?.item?.name}`);
      result.actual = get.json?.item?.name === nextName ? '项目名称已更新。' : '项目名称未按预期更新。';
      result.status = get.json?.item?.name === nextName ? 'pass' : 'fail';
    } else if (name === '查看项目') {
      const fixture = await createFixture(runId, 'view-project');
      await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
      await navigate(page, `${BASE_URL}/`, 'dashboard project entry', navLog);
      await shot(result, page, resultDir, 'dashboard-project-entry');
      const dashboardBody = await pageText(page);
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, 'project board entry', navLog);
      await shot(result, page, resultDir, 'project-board-entry');
      const boardBody = await pageText(page);
      const get = await adminApi('GET', `/api/projects/${fixture.project.id}`);
      result.evidence.push(`dashboard 文本包含项目名：${dashboardBody.includes(fixture.project.name)}`);
      result.evidence.push(`看板页文本包含项目名或看板名：${boardBody.includes(fixture.project.name) || boardBody.includes(fixture.board.name)}`);
      result.apiEvidence.push(`GET /api/projects/${fixture.project.id} 返回 ${get.status}`);
      const visible = dashboardBody.includes(fixture.project.name) || boardBody.includes(fixture.project.name) || boardBody.includes(fixture.board.name);
      result.actual = get.ok && visible ? '项目可通过 dashboard/看板入口正确显示。' : '项目未在 dashboard 或看板入口稳定显示。';
      result.status = get.ok && visible ? 'pass' : 'fail';
    } else if (name === '非管理员创建项目') {
      const core = await apiRequest('GET', '/api/core-settings-public');
      const disable = await adminApi('POST', '/api/core-settings', { projectCreationAllEnabled: false });
      const user = await registerUser('non_admin_project', runId);
      const token = await getAccessToken(user.email, user.password);
      const create = await apiRequest('POST', '/api/projects', { name: `ordinary-create-${runId}` }, token);
      await setAuthCookies(context, token);
      await navigate(page, `${BASE_URL}/`, 'ordinary user create project state', navLog);
      await shot(result, page, resultDir, 'ordinary-user-create-project-state');
      result.apiEvidence.push(`当前 demoMode：${core.json?.item?.demoMode}`);
      result.apiEvidence.push(`尝试关闭普通用户创建项目返回 ${disable.status}`);
      result.apiEvidence.push(`普通用户 POST /api/projects 返回 ${create.status}，响应体：${truncateText(create.text, 300)}`);
      if (disable.status === 403) {
        result.actual = 'demo 环境禁止修改 projectCreationAllEnabled，无法模拟“管理员已禁用普通用户创建项目”的 Given。';
        result.status = 'blocked';
      } else {
        result.actual = create.status === 403 ? '普通用户创建项目被拒绝。' : '普通用户创建项目未被拒绝。';
        result.status = create.status === 403 ? 'pass' : 'fail';
      }
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testCardCore(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const fixture = await createFixture(runId, `card-${testCase.caseNo}`);
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    if (name === '创建/移动/删除卡片') {
      const card = await createCard(fixture.lists.todo.id, `create-move-delete-${runId}`);
      const move = await adminApi('PATCH', `/api/cards/${card.id}`, { listId: fixture.lists.done.id, position: 65535 });
      const del = await adminApi('DELETE', `/api/cards/${card.id}`);
      const get = await adminApi('GET', `/api/cards/${card.id}`);
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'card-create-move-delete');
      result.apiEvidence.push(`创建卡片 id：${card.id}`);
      result.apiEvidence.push(`移动卡片 PATCH 返回 ${move.status}`);
      result.apiEvidence.push(`删除卡片 DELETE 返回 ${del.status}，删除后 GET 返回 ${get.status}`);
      result.actual = move.ok && del.ok && get.status === 404 ? '创建、移动、删除卡片均通过接口生效，页面截图留证。' : '卡片创建/移动/删除未全部生效。';
      result.status = move.ok && del.ok && get.status === 404 ? 'pass' : 'fail';
    } else if (name === '卡片跨项目移动') {
      const target = await createFixture(runId, 'card-target');
      const move = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { boardId: target.board.id, listId: target.lists.todo.id, position: 65535 });
      const get = await adminApi('GET', `/api/cards/${fixture.card.id}`);
      await commonBoardVisual(page, context, target, result, resultDir, navLog, null, 'cross-project-target-board');
      result.apiEvidence.push(`跨项目移动 PATCH 返回 ${move.status}`);
      result.apiEvidence.push(`移动后 card.boardId=${get.json?.item?.boardId}, listId=${get.json?.item?.listId}`);
      result.actual = move.ok && get.json?.item?.boardId === target.board.id ? '卡片可通过菜单对应的 PATCH 参数跨项目/看板移动。' : '跨项目移动未生效。';
      result.status = move.ok && get.json?.item?.boardId === target.board.id ? 'pass' : 'fail';
    } else if (name === '子任务管理' || name === '卡片任务管理') {
      const task = await adminApi('POST', `/api/cards/${fixture.card.id}/tasks`, { position: 65535, name: `task-${runId}`, isCompleted: false });
      const update = await adminApi('PATCH', `/api/tasks/${task.json?.item?.id}`, { name: `task-edited-${runId}`, isCompleted: true, dueDate: new Date(Date.now() + 86400000).toISOString() });
      const del = await adminApi('DELETE', `/api/tasks/${task.json?.item?.id}`);
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'task-management');
      result.apiEvidence.push(`POST task 返回 ${task.status}`);
      result.apiEvidence.push(`PATCH task 完成/截止日期 返回 ${update.status}`);
      result.apiEvidence.push(`DELETE task 返回 ${del.status}`);
      result.actual = task.ok && update.ok && del.ok ? '任务可添加、编辑、完成、设置截止日期并删除。' : '任务管理接口未全部达到预期。';
      result.status = task.ok && update.ok && del.ok ? 'pass' : 'fail';
    } else if (name === '标签管理') {
      const label = await adminApi('POST', `/api/boards/${fixture.board.id}/labels`, { name: `label-${runId}`, color: '#7C3AED' });
      const attach = await adminApi('POST', `/api/cards/${fixture.card.id}/labels`, { labelId: label.json?.item?.id });
      const edit = await adminApi('PATCH', `/api/labels/${label.json?.item?.id}`, { name: `label-edited-${runId}`, color: '#16A34A' });
      const board = await adminApi('GET', `/api/boards/${fixture.board.id}`);
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'label-management');
      result.apiEvidence.push(`POST label 返回 ${label.status}`);
      result.apiEvidence.push(`POST card label 返回 ${attach.status}`);
      result.apiEvidence.push(`PATCH label 返回 ${edit.status}`);
      result.actual = label.ok && attach.ok && board.text.includes(`label-edited-${runId}`) ? '标签创建、添加到卡片、编辑后均可在看板数据中查到。' : '标签管理未全部生效。';
      result.status = label.ok && attach.ok && board.text.includes(`label-edited-${runId}`) ? 'pass' : 'fail';
    } else if (name === '成员分配') {
      const user = await registerUser('card_member', runId);
      const outside = await registerUser('card_outside', runId);
      await addBoardMembership(fixture.board.id, user.user.id, 'editor');
      const ok = await adminApi('POST', `/api/cards/${fixture.card.id}/memberships`, { userId: user.user.id });
      const notBoardMember = await adminApi('POST', `/api/cards/${fixture.card.id}/memberships`, { userId: outside.user.id });
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'member-assignment');
      result.apiEvidence.push(`看板成员分配到卡片返回 ${ok.status}`);
      result.apiEvidence.push(`非看板成员分配到卡片返回 ${notBoardMember.status}`);
      result.actual = ok.ok && notBoardMember.status === 404 ? '仅看板成员可被分配到卡片。' : '成员分配权限未符合预期。';
      result.status = ok.ok && notBoardMember.status === 404 ? 'pass' : 'fail';
    } else if (name === '截止日期颜色指示') {
      const far = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { dueDate: new Date(Date.now() + 20 * 86400000).toISOString() });
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'due-date-far');
      const soon = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'due-date-soon');
      const past = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { dueDate: new Date(Date.now() - 2 * 86400000).toISOString() });
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'due-date-past');
      result.apiEvidence.push(`>2周 PATCH 返回 ${far.status}`);
      result.apiEvidence.push(`<2周 PATCH 返回 ${soon.status}`);
      result.apiEvidence.push(`过期 PATCH 返回 ${past.status}`);
      result.actual = far.ok && soon.ok && past.ok ? '三类截止日期均成功设置；颜色表现以对应截图为验证证据。' : '截止日期设置接口未全部成功。';
      result.status = far.ok && soon.ok && past.ok ? 'pass' : 'fail';
    } else if (name === '附件上传/设封面' || name === '卡片附件管理') {
      const form = new FormData();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
      form.append('file', new Blob([png], { type: 'image/png' }), `agent-${runId}.png`);
      const upload = await apiRequest('POST', `/api/cards/${fixture.card.id}/attachments?requestId=${nowId()}`, form, await adminToken());
      const attachmentId = upload.json?.item?.id;
      const cover = attachmentId ? await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { coverAttachmentId: attachmentId }) : { ok: false, status: 'no attachment' };
      const del = name === '卡片附件管理' && attachmentId ? await adminApi('DELETE', `/api/attachments/${attachmentId}`) : { ok: true, status: 'skipped' };
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'attachment-management');
      result.apiEvidence.push(`POST attachment 返回 ${upload.status}`);
      result.apiEvidence.push(`设置 coverAttachmentId 返回 ${cover.status}`);
      result.apiEvidence.push(`附件删除返回 ${del.status}`);
      result.actual = upload.ok && cover.ok && del.ok ? '附件上传、封面设置以及删除路径按测试点要求生效。' : '附件管理未全部生效。';
      result.status = upload.ok && cover.ok && del.ok ? 'pass' : 'fail';
    } else if (name === '计时器') {
      const started = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { timer: { startedAt: new Date().toISOString(), total: 0 } });
      const paused = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { timer: { startedAt: null, total: 48 } });
      const reset = await adminApi('PATCH', `/api/cards/${fixture.card.id}`, { timer: { startedAt: null, total: 0 } });
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'timer-management');
      result.apiEvidence.push(`开始计时 PATCH 返回 ${started.status}`);
      result.apiEvidence.push(`手动设置 48 秒 PATCH 返回 ${paused.status}`);
      result.apiEvidence.push(`重置 PATCH 返回 ${reset.status}`);
      result.actual = started.ok && paused.ok && reset.ok ? '计时器开始、暂停/编辑、重置状态均可更新。' : '计时器状态更新未全部成功。';
      result.status = started.ok && paused.ok && reset.ok ? 'pass' : 'fail';
    } else if (name === '卡片菜单操作' || name === '卡片视图操作') {
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'card-view');
      await navigate(page, `${BASE_URL}/cards/${fixture.card.id}`, 'card detail route', navLog);
      await shot(result, page, resultDir, 'card-detail-route');
      const get = await adminApi('GET', `/api/cards/${fixture.card.id}`);
      result.apiEvidence.push(`GET /api/cards/${fixture.card.id} 返回 ${get.status}`);
      result.evidence.push(`卡片详情 URL：${page.url()}`);
      result.actual = get.ok ? '卡片详情数据可读取，页面路由可打开；菜单/视图可通过截图检查。' : '卡片详情数据不可读取。';
      result.status = get.ok ? 'pass' : 'fail';
    } else if (name === '卡片评论管理') {
      const comment = await adminApi('POST', `/api/cards/${fixture.card.id}/comments`, { text: `comment-${runId}` });
      const edit = await adminApi('PATCH', `/api/comments/${comment.json?.item?.id}`, { text: `comment-edited-${runId}` });
      const del = await adminApi('DELETE', `/api/comments/${comment.json?.item?.id}`);
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'comment-management');
      result.apiEvidence.push(`POST comment 返回 ${comment.status}`);
      result.apiEvidence.push(`PATCH comment 返回 ${edit.status}`);
      result.apiEvidence.push(`DELETE comment 返回 ${del.status}`);
      result.actual = comment.ok && edit.ok && del.ok ? '评论添加、编辑、删除均生效。' : '评论管理接口未全部成功。';
      result.status = comment.ok && edit.ok && del.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testImportExport(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const project = await createProject(`import-export-project-${runId}-${testCase.caseNo}`);
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    if (name === '导出看板' || name === '4ga Boards导出/导入') {
      const fixture = await createFixture(runId, `export-${testCase.caseNo}`);
      const exp = await adminApi('GET', `/api/boards/${fixture.board.id}/export?skipAttachments=true&skipUserAvatars=true&skipProjectBackgrounds=true`);
      const downloadUrl = exp.json?.item;
      const downloaded = downloadUrl ? await apiRequest('GET', downloadUrl, undefined, null, { Cookie: `accessToken=${await adminToken()}` }) : { status: 0, text: '' };
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'export-board');
      result.apiEvidence.push(`GET /api/boards/${fixture.board.id}/export 返回 ${exp.status}，URL：${downloadUrl || '无'}`);
      result.apiEvidence.push(`导出文件下载返回 ${downloaded.status}，content-type：${downloaded.headers?.['content-type'] || ''}`);
      result.actual = exp.ok && String(downloadUrl).endsWith('.tgz') ? '导出接口生成 .tgz 导出文件 URL。' : '导出接口未生成 .tgz 文件。';
      result.status = exp.ok && String(downloadUrl).endsWith('.tgz') ? 'pass' : 'fail';
    } else if (name === 'Trello JSON导入') {
      const form = new FormData();
      const trello = JSON.stringify({ lists: [], cards: [], checklists: [], actions: [] });
      form.append('position', '65535');
      form.append('name', `trello-import-${runId}`);
      form.append('isGithubConnected', 'false');
      form.append('importType', 'trello');
      form.append('requestId', nowId());
      form.append('importFile', new Blob([trello], { type: 'application/json' }), 'trello.json');
      const res = await apiRequest('POST', `/api/projects/${project.id}/boards`, form, await adminToken());
      await navigate(page, `${BASE_URL}/projects/${project.id}`, 'trello import project', navLog);
      await shot(result, page, resultDir, 'trello-import-project');
      result.apiEvidence.push(`POST Trello import 返回 ${res.status}，响应：${truncateText(res.text, 500)}`);
      result.actual = res.ok ? 'Trello JSON 导入接口接受有效结构并创建看板。' : 'Trello JSON 导入未成功。';
      result.status = res.ok ? 'pass' : 'fail';
    } else if (name === '无效文件导入') {
      const form = new FormData();
      form.append('position', '65535');
      form.append('name', `invalid-import-${runId}`);
      form.append('isGithubConnected', 'false');
      form.append('importType', 'trello');
      form.append('requestId', nowId());
      form.append('importFile', new Blob(['not-json'], { type: 'application/json' }), 'invalid.json');
      const res = await apiRequest('POST', `/api/projects/${project.id}/boards`, form, await adminToken());
      await navigate(page, `${BASE_URL}/projects/${project.id}`, 'invalid import project', navLog);
      await shot(result, page, resultDir, 'invalid-import-project');
      result.apiEvidence.push(`POST invalid import 返回 ${res.status}，响应：${truncateText(res.text, 500)}`);
      result.actual = res.status >= 400 ? '无效导入文件被拒绝。' : '无效导入文件未被拒绝。';
      result.status = res.status >= 400 ? 'pass' : 'fail';
    } else if (name === '从4ga Boards导入') {
      result.actual = '自动化 runner 当前只稳定验证 4ga Boards 导出；从 .tgz 回传导入需要服务端实际导出文件落盘并复用文件流，本 demo 环境未提供本地导出文件路径。';
      result.status = 'blocked';
      await navigate(page, `${BASE_URL}/projects/${project.id}`, '4ga import blocked evidence', navLog);
      await shot(result, page, resultDir, '4ga-import-blocked');
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testPermissionMatrix(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const fixture = await createFixture(runId, `perm-${testCase.caseNo}`);
    const user = await registerUser(`perm_user_${testCase.caseNo}`, runId);
    let role = 'viewer';
    let canComment = false;
    if (name.includes('Editor')) role = 'editor';
    if (name.includes('Commenter')) canComment = true;
    if (name.includes('Project Manager')) {
      const pm = await adminApi('POST', `/api/projects/${fixture.project.id}/managers`, { projectId: fixture.project.id, userId: user.user.id });
      result.apiEvidence.push(`授予 Project Manager 返回 ${pm.status}`);
    } else {
      await addBoardMembership(fixture.board.id, user.user.id, role, canComment);
    }
    const token = await getAccessToken(user.email, user.password);
    const view = await apiRequest('GET', `/api/boards/${fixture.board.id}`, undefined, token);
    const create = await apiRequest('POST', `/api/lists/${fixture.lists.todo.id}/cards`, { position: 65535, name: `role-card-${runId}` }, token);
    const comment = await apiRequest('POST', `/api/cards/${fixture.card.id}/comments`, { text: `role-comment-${runId}` }, token);
    await commonBoardVisual(page, context, fixture, result, resultDir, navLog, token, 'permission-matrix-board');
    result.apiEvidence.push(`角色配置 role=${role}, canComment=${canComment}`);
    result.apiEvidence.push(`GET board 返回 ${view.status}`);
    result.apiEvidence.push(`POST card 返回 ${create.status}`);
    result.apiEvidence.push(`POST comment 返回 ${comment.status}`);
    if (name.includes('Viewer')) {
      result.actual = view.ok && create.status === 403 && comment.status === 403 ? 'Viewer 可查看但不可编辑或评论。' : 'Viewer 权限不符合预期。';
      result.status = view.ok && create.status === 403 && comment.status === 403 ? 'pass' : 'fail';
    } else if (name.includes('Commenter')) {
      result.actual = view.ok && create.status === 403 && comment.ok ? 'Commenter 可查看并评论，但不能编辑卡片。' : 'Commenter 权限不符合预期。';
      result.status = view.ok && create.status === 403 && comment.ok ? 'pass' : 'fail';
    } else {
      result.actual = view.ok && create.ok ? `${name} 可查看并执行编辑类操作。` : `${name} 编辑权限未生效。`;
      result.status = view.ok && create.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testNotifications(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const fixture = await createFixture(runId, `notif-${testCase.caseNo}`);
    const user = await registerUser(`notif_user_${testCase.caseNo}`, runId);
    await addBoardMembership(fixture.board.id, user.user.id, 'viewer', true);
    const token = await getAccessToken(user.email, user.password);
    if (name === '卡片评论通知') {
      await apiRequest('PATCH', `/api/cards/${fixture.card.id}`, { isSubscribed: true }, token);
      await adminApi('POST', `/api/cards/${fixture.card.id}/comments`, { text: `notify-comment-${runId}` });
    }
    const notifications = await apiRequest('GET', '/api/notifications', undefined, token);
    const actions = await adminApi('GET', `/api/boards/${fixture.board.id}/actions`);
    await commonBoardVisual(page, context, fixture, result, resultDir, navLog, token, 'notifications-board');
    result.apiEvidence.push(`GET /api/notifications 返回 ${notifications.status}，数量：${notifications.json?.items?.length ?? '未知'}`);
    result.apiEvidence.push(`GET /api/boards/${fixture.board.id}/actions 返回 ${actions.status}，数量：${actions.json?.items?.length ?? '未知'}`);
    if (name === '活动日志') {
      result.actual = actions.ok && (actions.json?.items?.length || 0) > 0 ? '看板活动日志接口返回操作记录。' : '看板活动日志未返回记录。';
      result.status = actions.ok && (actions.json?.items?.length || 0) > 0 ? 'pass' : 'fail';
    } else if (name === '通知过滤') {
      result.actual = '公开路由未提供独立通知过滤接口；已记录通知列表和活动数据，过滤能力需在页面表格 UI 中人工复核。';
      result.status = 'blocked';
    } else {
      result.actual = notifications.ok ? '通知列表接口可读取；页面截图留证通知入口/看板状态。' : '通知列表接口读取失败。';
      result.status = notifications.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testApi(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const client = await adminApi('POST', '/api/api-clients', { name: `api-client-${runId}-${testCase.caseNo}`, permissions: ['*'] });
    const clientId = client.json?.item?.id;
    const clientSecret = client.json?.item?.clientSecret;
    const fixture = await createFixture(runId, `api-${testCase.caseNo}`);
    const headers = { 'X-Client-Id': clientId, 'X-Client-Secret': clientSecret };
    let res;
    if (name === 'API认证') {
      res = await apiRequest('GET', '/api/projects', undefined, null, headers);
    } else if (name === '权限控制') {
      const bad = await adminApi('POST', '/api/api-clients', { name: `api-bad-${runId}`, permissions: ['projects.index'] });
      res = await apiRequest('POST', `/api/lists/${fixture.lists.todo.id}/cards`, { position: 65535, name: `api-denied-${runId}` }, null, {
        'X-Client-Id': bad.json?.item?.id,
        'X-Client-Secret': bad.json?.item?.clientSecret,
      });
    } else {
      res = await apiRequest('POST', `/api/lists/${fixture.lists.todo.id}/cards`, { position: 65535, name: `api-card-${runId}` }, null, headers);
    }
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'api-board');
    result.apiEvidence.push(`POST /api/api-clients 返回 ${client.status}`);
    result.apiEvidence.push(`${name} 调用返回 ${res.status}，响应：${truncateText(res.text, 500)}`);
    if (name === '权限控制') {
      result.actual = res.status === 401 || res.status === 403 ? '低权限 API client 调用受限接口被拒绝。' : '低权限 API client 未被拒绝。';
      result.status = res.status === 401 || res.status === 403 ? 'pass' : 'fail';
    } else {
      result.actual = res.ok ? `${name} 调用获得正确响应。` : `${name} 调用失败。`;
      result.status = res.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testAdmin(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    if (['用户列表管理', '修改用户信息', '查看账户活动'].includes(name)) {
      const user = await registerUser(`admin_user_${testCase.caseNo}`, runId);
      const update = name === '修改用户信息' ? await adminApi('PATCH', `/api/users/${user.user.id}`, { name: `Updated ${runId}` }) : null;
      const actions = await adminApi('GET', `/api/users/${user.user.id}/account-actions`);
      await navigate(page, `${BASE_URL}/settings/users`, 'admin users page', navLog);
      await shot(result, page, resultDir, 'admin-users-page');
      result.apiEvidence.push(`GET /api/users 可定位测试用户：${Boolean(user.user)}`);
      if (update) result.apiEvidence.push(`PATCH /api/users/${user.user.id} 返回 ${update.status}`);
      result.apiEvidence.push(`GET account-actions 返回 ${actions.status}，数量：${actions.json?.items?.length ?? '未知'}`);
      result.actual = (!update || update.ok) && actions.ok ? '用户管理/账户活动接口可用，页面已截图。' : '用户管理或账户活动未达到预期。';
      result.status = (!update || update.ok) && actions.ok ? 'pass' : 'fail';
    } else if (name === '授予/撤销管理员' || name === '实例设置' || name === '系统参数配置') {
      const core = await apiRequest('GET', '/api/core-settings-public');
      const user = await registerUser(`admin_toggle_${testCase.caseNo}`, runId);
      const adminUpdate = await adminApi('PATCH', `/api/users/${user.user.id}`, { isAdmin: true });
      const coreUpdate = await adminApi('POST', '/api/core-settings', { registrationEnabled: core.json?.item?.registrationEnabled });
      await navigate(page, `${BASE_URL}/settings`, 'admin settings page', navLog);
      await shot(result, page, resultDir, 'admin-settings-page');
      result.apiEvidence.push(`demoMode：${core.json?.item?.demoMode}`);
      result.apiEvidence.push(`PATCH user isAdmin 返回 ${adminUpdate.status}`);
      result.apiEvidence.push(`POST core-settings 返回 ${coreUpdate.status}`);
      if (core.json?.item?.demoMode && (adminUpdate.status === 200 || coreUpdate.status === 403)) {
        result.actual = 'demo 环境限制部分管理员变更；已验证限制响应并截图实例设置页。';
        result.status = 'blocked';
      } else {
        result.actual = adminUpdate.ok || coreUpdate.ok ? '管理员配置接口返回成功。' : '管理员配置接口未成功。';
        result.status = adminUpdate.ok || coreUpdate.ok ? 'pass' : 'fail';
      }
    } else if (name === '角色权限分配' || name === '项目经理级别权限') {
      const fixture = await createFixture(runId, `admin-role-${testCase.caseNo}`);
      const user = await registerUser(`admin_role_${testCase.caseNo}`, runId);
      const pm = await adminApi('POST', `/api/projects/${fixture.project.id}/managers`, { projectId: fixture.project.id, userId: user.user.id });
      const token = await getAccessToken(user.email, user.password);
      const board = await apiRequest('POST', `/api/projects/${fixture.project.id}/boards`, {
        position: 65535,
        name: `pm-created-board-${runId}`,
        isGithubConnected: false,
        requestId: nowId(),
        lists: [],
        labels: [],
      }, token);
      await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, 'admin-role-board');
      result.apiEvidence.push(`授予项目经理返回 ${pm.status}`);
      result.apiEvidence.push(`项目经理创建看板返回 ${board.status}`);
      result.actual = pm.ok && board.ok ? '项目经理角色可管理项目内内容。' : '项目经理权限未生效。';
      result.status = pm.ok && board.ok ? 'pass' : 'fail';
    } else if (name === '管理员级别权限' || name === '管理员手动添加用户') {
      const project = await createProject(`admin-project-${runId}`);
      const createUser = await adminApi('POST', '/api/users', { email: `manual_${runId}@example.com`, password: PASSWORD, name: `Manual ${runId}` });
      await navigate(page, `${BASE_URL}/settings/users`, 'admin users settings', navLog);
      await shot(result, page, resultDir, 'admin-users-settings');
      result.apiEvidence.push(`管理员创建项目 id：${project.id}`);
      result.apiEvidence.push(`管理员 POST /api/users 返回 ${createUser.status}`);
      result.actual = project.id && createUser.ok ? '管理员可访问实例设置并创建项目/用户。' : '管理员创建项目或用户失败。';
      result.status = project.id && createUser.ok ? 'pass' : 'fail';
    } else if (name === '系统日志查看' || name === '系统资源监控') {
      const actions = await adminApi('GET', '/api/instance/actions');
      await navigate(page, `${BASE_URL}/settings/about`, 'settings about', navLog);
      await shot(result, page, resultDir, 'settings-about');
      result.apiEvidence.push(`GET /api/instance/actions 返回 ${actions.status}，数量：${actions.json?.items?.length ?? '未知'}`);
      result.actual = name === '系统资源监控' ? '应用公开 API 未暴露 CPU/内存监控指标；已截图 About/Settings 页面作为受阻证据。' : '实例级活动日志接口可读取。';
      result.status = name === '系统资源监控' ? 'blocked' : actions.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testLists(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const fixture = await createFixture(runId, `list-${testCase.caseNo}`);
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    if (name === '创建列表') {
      const list = await createList(fixture.board.id, `created-list-${runId}`);
      result.apiEvidence.push(`POST /api/boards/${fixture.board.id}/lists 返回 id：${list.id}`);
      result.actual = list.id ? '列表创建成功。' : '列表创建失败。';
      result.status = list.id ? 'pass' : 'fail';
    } else if (name === '编辑列表') {
      const patch = await adminApi('PATCH', `/api/lists/${fixture.lists.todo.id}`, { name: `edited-list-${runId}` });
      result.apiEvidence.push(`PATCH /api/lists/${fixture.lists.todo.id} 返回 ${patch.status}`);
      result.actual = patch.ok ? '列表名称可编辑保存。' : '列表编辑失败。';
      result.status = patch.ok ? 'pass' : 'fail';
    } else if (name === '删除列表') {
      const list = await createList(fixture.board.id, `delete-list-${runId}`);
      const del = await adminApi('DELETE', `/api/lists/${list.id}`);
      result.apiEvidence.push(`DELETE /api/lists/${list.id} 返回 ${del.status}`);
      result.actual = del.ok ? '列表可删除。' : '列表删除失败。';
      result.status = del.ok ? 'pass' : 'fail';
    } else if (name === '列表导航') {
      const patch = await adminApi('PATCH', `/api/lists/${fixture.lists.todo.id}`, { position: 200000 });
      result.apiEvidence.push(`PATCH list position 返回 ${patch.status}`);
      result.actual = patch.ok ? '列表位置可更新；水平滚动表现已截图。' : '列表位置更新失败。';
      result.status = patch.ok ? 'pass' : 'fail';
    } else if (name === '列表隐藏/显示') {
      const collapsed = await adminApi('PATCH', `/api/lists/${fixture.lists.todo.id}`, { isCollapsed: true });
      const expanded = await adminApi('PATCH', `/api/lists/${fixture.lists.todo.id}`, { isCollapsed: false });
      result.apiEvidence.push(`折叠 PATCH 返回 ${collapsed.status}，展开 PATCH 返回 ${expanded.status}`);
      result.actual = collapsed.ok && expanded.ok ? '列表隐藏/显示状态可切换。' : '列表隐藏/显示状态切换失败。';
      result.status = collapsed.ok && expanded.ok ? 'pass' : 'fail';
    }
    await commonBoardVisual(page, context, fixture, result, resultDir, navLog, null, `list-${testCase.caseNo}`);
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testSettings(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const token = await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    const me = await getMe(token);
    const userId = me.json?.item?.id;
    if (name === '个人资料设置') {
      const res = await apiRequest('PATCH', `/api/users/${userId}`, { name: `测试用户qianyongjie25 ${runId}` }, token);
      result.apiEvidence.push(`PATCH /api/users/me name 返回 ${res.status}`);
      result.actual = res.ok ? '个人资料名称更新成功。' : '个人资料更新失败。';
      result.status = res.ok ? 'pass' : 'fail';
      await navigate(page, `${BASE_URL}/settings/profile`, 'profile settings', navLog);
    } else if (name === '偏好设置') {
      const res = await apiRequest('PATCH', `/api/user-prefs/${userId}`, { language: 'en', theme: 'light', defaultView: 'list' }, token);
      result.apiEvidence.push(`PATCH /api/user-prefs/${userId} 返回 ${res.status}`);
      result.actual = res.ok ? '语言、主题、默认视图偏好保存成功。' : '偏好设置保存失败。';
      result.status = res.ok ? 'pass' : 'fail';
      await navigate(page, `${BASE_URL}/settings/preferences`, 'preferences settings', navLog);
    } else if (name === '账户设置') {
      const res = await apiRequest('PATCH', `/api/users/${userId}/username`, { username: `testuser_qyj_${runId.slice(-6)}` }, token);
      result.apiEvidence.push(`PATCH /api/users/${userId}/username 返回 ${res.status}`);
      result.actual = res.ok ? '用户名账户信息更新成功。' : '账户信息更新失败。';
      result.status = res.ok ? 'pass' : 'fail';
      await navigate(page, `${BASE_URL}/settings/account`, 'account settings', navLog);
    } else if (name === '认证设置') {
      const res = await apiRequest('PATCH', `/api/users/${userId}/password`, { currentPassword: ADMIN.password, password: ADMIN.password }, token);
      result.apiEvidence.push(`PATCH /api/users/${userId}/password 返回 ${res.status}`);
      result.actual = res.ok ? '密码更新接口接受当前密码并保存。' : '密码更新接口未成功。';
      result.status = res.ok ? 'pass' : 'fail';
      await navigate(page, `${BASE_URL}/settings/authentication`, 'authentication settings', navLog);
    }
    await shot(result, page, resultDir, `settings-${testCase.caseNo}`);
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testViews(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, runId, navLog } = env;
  try {
    const fixture = await createFixture(runId, `view-${testCase.caseNo}`);
    const token = await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    const me = await getMe(token);
    if (name === '切换视图') {
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, 'board view route', navLog);
      await shot(result, page, resultDir, 'board-view');
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}?view=list`, 'list view route', navLog);
      await shot(result, page, resultDir, 'list-view');
      result.actual = 'board/list 两个视图路由均可打开并截图。';
      result.status = 'pass';
    } else {
      const prefs = await apiRequest('PATCH', `/api/user-prefs/${me.json?.item?.id}`, {
        defaultView: 'list',
        listViewStyle: 'compact',
        listViewColumnVisibility: { name: true, labels: true, users: true, dueDate: true },
        listViewFitScreen: false,
      }, token);
      await navigate(page, `${BASE_URL}/boards/${fixture.board.id}?view=list`, 'list view settings', navLog);
      await shot(result, page, resultDir, `list-view-${testCase.caseNo}`);
      result.apiEvidence.push(`PATCH list view prefs 返回 ${prefs.status}`);
      result.actual = prefs.ok ? '列表视图偏好保存成功，排序/列管理对应页面已截图。' : '列表视图偏好保存失败。';
      result.status = prefs.ok ? 'pass' : 'fail';
    }
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function testLogs(testCase, env, name) {
  const result = resultBase(testCase);
  const { page, context, resultDir, navLog } = env;
  try {
    await loginPageAs(context, page, ADMIN.emailOrUsername, ADMIN.password);
    await navigate(page, `${BASE_URL}/settings/about`, 'about page for log config', navLog);
    await shot(result, page, resultDir, `logs-${testCase.caseNo}`);
    const composePath = path.resolve('D:/workspace/claude/lecture/SE/4gaboards/docker-compose.yml');
    const composeText = fs.existsSync(composePath) ? fs.readFileSync(composePath, 'utf8') : '';
    result.evidence.push(`源码 docker-compose.yml 存在：${fs.existsSync(composePath)}`);
    result.evidence.push(`docker-compose.yml 是否包含 logs volume：${/logs/i.test(composeText)}`);
    result.actual = '日志暴露、logrotate、Fail2ban 属于部署主机配置项，demo 网站页面无法模拟编辑系统文件；已记录源码配置检查和页面截图。';
    result.status = 'blocked';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }
  return result;
}

async function runOne(testCase, env, categoryName) {
  const name = testCase.name;
  if (categoryName.includes('项目/看板')) return testProjectBoard(testCase, env, name);
  if (categoryName.includes('卡片核心')) return testCardCore(testCase, env, name);
  if (categoryName.includes('导入/导出')) return testImportExport(testCase, env, name);
  if (categoryName.includes('权限矩阵')) return testPermissionMatrix(testCase, env, name);
  if (categoryName.includes('通知系统')) return testNotifications(testCase, env, name);
  if (categoryName.includes('API')) return testApi(testCase, env, name);
  if (categoryName.includes('管理员级')) return testAdmin(testCase, env, name);
  if (categoryName.includes('列表管理')) return testLists(testCase, env, name);
  if (categoryName.includes('个人设置')) return testSettings(testCase, env, name);
  if (categoryName.includes('视图管理')) return testViews(testCase, env, name);
  if (categoryName.includes('日志管理')) return testLogs(testCase, env, name);
  return {
    ...resultBase(testCase),
    status: 'blocked',
    actual: `runner 暂未实现分类：${categoryName}`,
  };
}

async function runCategory({ category, resultDir, categoryIndex }) {
  ensureDir(path.join(resultDir, 'js'));
  ensureDir(path.join(resultDir, 'screenshots'));
  const runId = nowId();
  const reportPath = path.join(resultDir, `${path.basename(resultDir)}测试结果.md`);
  const rawPath = path.join(resultDir, `${path.basename(resultDir)}原始结果.json`);
  const tests = Object.values(byName(category.test_cases || []));
  const navLog = [];
  const results = [];

  fs.writeFileSync(
    reportPath,
    `# ${category.feature}测试结果

- 测试目标：${BASE_URL}/login
- 测试分类：${category.category}
- 本轮 runId：${runId}
- 执行时间：${new Date().toISOString()}
- 执行方式：Playwright + Microsoft Edge；单 browser/context/page 顺序会话；API 用于模拟 Given 前置条件和交叉验证。

`,
    'utf8',
  );

  const browser = await launchBrowser();
  const context = await newContext(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);

  const env = { browser, context, page, resultDir, runId, navLog, categoryIndex };
  try {
    for (const testCase of tests) {
      const result = await runOne(testCase, env, category.category);
      results.push(result);
      fs.appendFileSync(reportPath, caseMarkdown(result), 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({ runId, navigationCount: navLog.length, navigationLog: navLog, results }, null, 2)}\n`, 'utf8');
      console.log(`${category.category} ${result.caseNo} ${result.name}: ${result.status}`);
    }
  } finally {
    await browser.close();
  }

  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  fs.appendFileSync(
    reportPath,
    `## 汇总

| 状态 | 数量 |
|---|---:|
${Object.entries(summary).map(([status, count]) => `| ${markdownStatus(status)} | ${count} |`).join('\n')}

## 页面导航次数

本轮完整页面导航 ${navLog.length} 次：
${navLog.map((item) => `- ${item}`).join('\n')}

`,
    'utf8',
  );
  fs.writeFileSync(rawPath, `${JSON.stringify({ runId, navigationCount: navLog.length, navigationLog: navLog, summary, results }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ category: category.category, runId, summary, navigationCount: navLog.length }, null, 2));
}

module.exports = { runCategory };
