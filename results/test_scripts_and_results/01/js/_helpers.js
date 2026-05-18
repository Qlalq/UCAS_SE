const fs = require('fs');
const path = require('path');
const { chromium } = require('D:/workspace/claude/lecture/SE/4gaboards/tests/node_modules/@playwright/test');

const BASE_URL = 'https://demo.4gaboards.com';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ADMIN = {
  emailOrUsername: 'qianyongjie25@mails.ucas.ac.cn',
  password: '8fMQq28AmjQ.Cnd',
};

async function launchBrowser() {
  return chromium.launch({
    executablePath: EDGE_PATH,
    // headless: process.env.PW_HEADLESS !== '0',
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
  });
}

async function newContext(browser) {
  return browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

function resultRoot() {
  return path.resolve(__dirname, '..');
}

function screenshotDir() {
  return path.join(resultRoot(), 'screenshots');
}

function jsDir() {
  return path.join(resultRoot(), 'js');
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function appendMarkdown(filePath, markdown) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, markdown, 'utf8');
}

function resetFile(filePath, content = '') {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function markdownStatus(status) {
  if (status === 'pass') {
    return '通过';
  }
  if (status === 'fail') {
    return '未通过';
  }
  if (status === 'blocked') {
    return '受阻';
  }
  if (status === 'error') {
    return '执行异常';
  }
  return status;
}

function truncateText(value, length = 3000) {
  if (value === undefined || value === null) {
    return value;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

async function waitForLoginForm(page) {
  for (let i = 0; i < 3; i += 1) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'commit', timeout: 30000 });
    try {
      await page.waitForSelector('input[name="emailOrUsername"]', { timeout: 15000 });
      return;
    } catch (error) {
      if (i === 2) {
        throw error;
      }
    }
  }
}

async function loginAsAdmin(page) {
  await waitForLoginForm(page);
  await page.locator('input[name="emailOrUsername"]').fill(ADMIN.emailOrUsername);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.locator('button[type="submit"][title="Log in"]').click();
  await page.waitForTimeout(12000);
}

async function loginWithCredentials(page, emailOrUsername, password) {
  await waitForLoginForm(page);
  await page.locator('input[name="emailOrUsername"]').fill(emailOrUsername);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"][title="Log in"]').click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(5000);
}

async function ensureAdminUiReady(page) {
  await loginAsAdmin(page);
  await page.waitForFunction(
    () => !document.querySelector('[class*=Loader_loaderWrapper]') && document.body.innerText.includes('Dashboard'),
    undefined,
    { timeout: 30000 },
  );
}

async function adminApi(page, method, endpoint, body) {
  const token = await getAccessToken(ADMIN.emailOrUsername, ADMIN.password);
  return apiRequest(method, endpoint, body, token);
}

async function getAccessToken(emailOrUsername, password) {
  const loginRes = await fetch(`${BASE_URL}/api/access-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  });
  const text = await loginRes.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!loginRes.ok || !json?.item) {
    throw new Error(`login failed ${loginRes.status}: ${text}`);
  }
  return json.item;
}

async function apiRequest(method, endpoint, body, token) {
  const absoluteEndpoint = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(absoluteEndpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

async function createUserViaApi(page, data) {
  return adminApi(page, 'POST', '/api/users', data);
}

async function registerPublicUser(data) {
  const res = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

async function publicApi(method, endpoint, body) {
  return apiRequest(method, endpoint, body);
}

async function listUsersViaApi(page) {
  return adminApi(page, 'GET', '/api/users');
}

async function createProjectViaApi(page, name) {
  return adminApi(page, 'POST', '/api/projects', { name });
}

async function listProjectsViaApi(page) {
  return adminApi(page, 'GET', '/api/projects');
}

async function createBoardViaApi(page, projectId, name) {
  return adminApi(page, 'POST', `/api/projects/${projectId}/boards`, {
    position: 65535,
    name,
    isGithubConnected: false,
    requestId: nowId(),
    lists: [],
    labels: [],
  });
}

async function addBoardMembershipViaApi(page, boardId, userId, role = 'viewer', canComment = false) {
  return adminApi(page, 'POST', `/api/boards/${boardId}/memberships`, {
    boardId,
    userId,
    role,
    canComment,
  });
}

async function createListViaApi(page, boardId, name) {
  return adminApi(page, 'POST', `/api/boards/${boardId}/lists`, {
    position: 65535,
    name,
  });
}

async function getBoardViaApi(page, boardId, token) {
  if (token) {
    return apiRequest('GET', `/api/boards/${boardId}`, undefined, token);
  }
  return adminApi(page, 'GET', `/api/boards/${boardId}`);
}

async function getProjectViaApi(page, projectId, token) {
  if (token) {
    return apiRequest('GET', `/api/projects/${projectId}`, undefined, token);
  }
  return adminApi(page, 'GET', `/api/projects/${projectId}`);
}

async function setAuthCookies(context, accessToken) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  await context.addCookies([
    {
      name: 'accessToken',
      value: accessToken,
      url: BASE_URL,
      expires,
      sameSite: 'Strict',
      secure: true,
    },
    {
      name: 'accessTokenVersion',
      value: '1',
      url: BASE_URL,
      expires,
      sameSite: 'Strict',
      secure: true,
    },
  ]);
}

async function updateMyLanguageToEnglish(page) {
  return page.evaluate(async () => {
    const loginRes = await fetch('/api/access-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: 'qianyongjie25@mails.ucas.ac.cn',
        password: '8fMQq28AmjQ.Cnd',
      }),
    });
    const loginBody = await loginRes.json();
    const token = loginBody.item;
    const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
    const meBody = await meRes.json();
    const userId = meBody.item.id;
    const prefsRes = await fetch(`/api/user-prefs/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'en' }),
    });
    return { status: prefsRes.status, body: await prefsRes.text() };
  });
}

async function saveScreenshot(page, filePath) {
  ensureDir(path.dirname(filePath));
  try {
    await page.screenshot({ path: filePath, fullPage: true, timeout: 100000 });
  } catch (error) {
    try {
      const client = await page.context().newCDPSession(page);
      const { data } = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true,
      });
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      fs.writeFileSync(`${filePath}.error.txt`, `Playwright screenshot fallback used after: ${String(error)}`, 'utf8');
    } catch (fallbackError) {
      fs.writeFileSync(`${filePath}.error.txt`, `${String(error)}\nCDP fallback failed: ${String(fallbackError)}`, 'utf8');
    }
  }
}

module.exports = {
  BASE_URL,
  ADMIN,
  launchBrowser,
  newContext,
  ensureDir,
  nowId,
  safeName,
  resultRoot,
  screenshotDir,
  jsDir,
  writeJson,
  appendMarkdown,
  resetFile,
  markdownStatus,
  truncateText,
  waitForLoginForm,
  loginAsAdmin,
  loginWithCredentials,
  ensureAdminUiReady,
  adminApi,
  getAccessToken,
  apiRequest,
  publicApi,
  createUserViaApi,
  registerPublicUser,
  listUsersViaApi,
  createProjectViaApi,
  listProjectsViaApi,
  createBoardViaApi,
  addBoardMembershipViaApi,
  createListViaApi,
  getBoardViaApi,
  getProjectViaApi,
  setAuthCookies,
  updateMyLanguageToEnglish,
  saveScreenshot,
};
