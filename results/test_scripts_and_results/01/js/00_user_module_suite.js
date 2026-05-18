const fs = require('fs');
const path = require('path');

process.env.PW_HEADLESS ??= '0';

const {
  BASE_URL,
  ADMIN,
  launchBrowser,
  newContext,
  nowId,
  screenshotDir,
  writeJson,
  resetFile,
  markdownStatus,
  truncateText,
  adminApi,
  publicApi,
  registerPublicUser,
  listUsersViaApi,
  createProjectViaApi,
  createBoardViaApi,
  addBoardMembershipViaApi,
  createListViaApi,
  getAccessToken,
  getBoardViaApi,
  getProjectViaApi,
  setAuthCookies,
  saveScreenshot,
} = require('./_helpers');

const RESULTS_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(RESULTS_DIR, '用户级模块测试结果.md');
const RAW_PATH = path.join(RESULTS_DIR, '用户级模块原始结果.json');
const RUN_ID = nowId();
const PASSWORD = 'Test123!@#Strong';
const TIMEOUT = 100000;

function shotPath(caseNo, name) {
  return path.join(screenshotDir(), `${caseNo}-${name}.png`);
}

function evidenceLine(value) {
  return value ? `- ${value}` : '- 无';
}

function caseMarkdown(result) {
  const screenshots = result.screenshots?.length
    ? result.screenshots.map((item) => `- [${path.basename(item)}](${item})`).join('\n')
    : '- 无';

  const apiEvidence = result.apiEvidence?.length
    ? result.apiEvidence.map((item) => `- ${item}`).join('\n')
    : '- 无';

  return `## ${result.caseNo}. ${result.name}

**结论：${markdownStatus(result.status)}**

**Given**
${result.given.map(evidenceLine).join('\n')}

**When**
${result.when.map(evidenceLine).join('\n')}

**Then**
- 期望：${result.expectation}
- 实际：${result.actual}

**执行验证**
${result.evidence.map(evidenceLine).join('\n')}

**接口/数据验证**
${apiEvidence}

**截图**
${screenshots}

`;
}

function resultBase(caseNo, name, given, when, expectation) {
  return {
    caseNo,
    name,
    status: 'error',
    given,
    when,
    expectation,
    actual: '',
    evidence: [],
    apiEvidence: [],
    screenshots: [],
  };
}

async function pageText(page, max = 3000) {
  return truncateText(await page.locator('body').innerText().catch(() => ''), max);
}

async function navigate(page, url, label, navLog) {
  navLog.push(`${label}: ${url}`);
  await page.goto(url, { waitUntil: 'commit', timeout: TIMEOUT });
}

async function clearAndTypeRegisterForm(page, email, password = '') {
  await page.locator('input[name="email"]').fill('');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('');
  if (password) {
    await page.locator('input[name="password"]').fill(password);
  }
  const checkbox = page.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkbox.check();
  }
}

async function switchIdentity(context, token) {
  await context.clearCookies();
  await setAuthCookies(context, token);
}

async function createAccessFixture(prefix, withMembership) {
  const email = `user_module_${prefix}_${RUN_ID}@example.com`;
  const createUser = await registerPublicUser({
    email,
    password: PASSWORD,
    name: `${prefix} Probe`,
    policy: true,
  });
  const users = await listUsersViaApi();
  const user = users.json?.items?.find((item) => item.email === email);
  if (!user) {
    throw new Error(`fixture user not found after register: ${createUser.status} ${createUser.text}`);
  }

  const projectRes = await createProjectViaApi(null, `user-module-${prefix}-project-${RUN_ID}`);
  const project = projectRes.json?.item;
  const boardRes = await createBoardViaApi(null, project.id, `user-module-${prefix}-board-${RUN_ID}`);
  const board = boardRes.json?.item;
  await createListViaApi(null, board.id, `user-module-${prefix}-list-${RUN_ID}`);

  let membership = null;
  if (withMembership) {
    const membershipRes = await addBoardMembershipViaApi(null, board.id, user.id, 'viewer', false);
    membership = membershipRes.json?.item;
  }

  return { email, password: PASSWORD, user, project, board, membership };
}

async function testEmptyPassword(page) {
  const result = resultBase(
    '02',
    '空密码注册',
    ['用户在注册页面'],
    ['提交邮箱但密码为空'],
    '拒绝，提示密码必填',
  );

  try {
    const email = `user_module_empty_${RUN_ID}@example.com`;
    await clearAndTypeRegisterForm(page, email, '');
    result.screenshots.push(shotPath('02', 'empty-password-form'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const responses = [];
    const responseHandler = (res) => {
      if (res.url() === `${BASE_URL}/api/register`) {
        responses.push(res.status());
      }
    };
    page.on('response', responseHandler);

    const beforeUrl = page.url();
    await page.locator('button[type="submit"][title="Register"]').click();
    await page.waitForTimeout(1500);
    page.off('response', responseHandler);

    result.screenshots.push(shotPath('02', 'empty-password-after-submit'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const focusedName = await page.evaluate(() => document.activeElement?.getAttribute('name'));
    const passwordInput = page.locator('input[name="password"]');
    const inputHasErrorClass = await passwordInput.evaluate((el) => String(el.className).toLowerCase().includes('error')).catch(() => false);
    const body = await pageText(page);
    const apiRes = await publicApi('POST', '/api/register', {
      email: `user_module_empty_direct_${RUN_ID}@example.com`,
      password: '',
      name: 'Empty Password Direct',
      policy: true,
    });

    const rejected = beforeUrl === page.url() && responses.length === 0 && focusedName === 'password';
    const explicitHint = /password/i.test(body) && (/required|必填|不能为空|empty/i.test(body) || inputHasErrorClass);

    result.evidence.push(`点击提交后仍停留在：${page.url()}`);
    result.evidence.push(`提交后焦点字段：${focusedName || '无法识别'}`);
    result.evidence.push(`密码输入框错误样式：${inputHasErrorClass}`);
    result.evidence.push(`页面可见文本摘录：${body}`);
    result.apiEvidence.push(`页面点击未产生 /api/register 请求：${responses.length === 0}`);
    result.apiEvidence.push(`直接调用 POST /api/register 且 password 为空返回 ${apiRes.status}，响应体：${truncateText(apiRes.text, 300)}`);
    result.actual = rejected
      ? `前端拒绝提交并聚焦密码字段；页面${explicitHint ? '存在密码错误提示/样式' : '未显示明确“密码必填”文字'}。`
      : '空密码提交未被页面前端稳定拒绝。';
    result.status = rejected && explicitHint ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testDuplicateEmail(page) {
  const result = resultBase(
    '05',
    '重复邮箱注册',
    ['该邮箱已注册'],
    ['再次使用同一邮箱注册'],
    '拒绝，提示邮箱已存在',
  );

  try {
    const email = `user_module_duplicate_${RUN_ID}@example.com`;
    const first = await registerPublicUser({
      email,
      password: PASSWORD,
      name: 'Duplicate Probe',
      policy: true,
    });

    await clearAndTypeRegisterForm(page, email, PASSWORD);
    result.screenshots.push(shotPath('05', 'duplicate-before-submit'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const responsePromise = page.waitForResponse((res) => res.url() === `${BASE_URL}/api/register` && res.request().method() === 'POST', { timeout: TIMEOUT });
    await page.locator('button[type="submit"][title="Register"]').click();
    const response = await responsePromise;
    const responseText = await response.text();
    await page.waitForTimeout(1500);

    result.screenshots.push(shotPath('05', 'duplicate-after-submit'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const body = await pageText(page);
    const explicitHint = /already|use|存在|已被|email/i.test(body);

    result.evidence.push(`重复邮箱：${email}`);
    result.evidence.push(`页面文本摘录：${body}`);
    result.apiEvidence.push(`首次注册返回 ${first.status}，响应体：${truncateText(first.text, 300)}`);
    result.apiEvidence.push(`重复注册 POST /api/register 返回 ${response.status()}，响应体：${truncateText(responseText, 300)}`);
    result.actual = response.status() === 409 && explicitHint
      ? '系统拒绝重复邮箱注册，页面显示邮箱已被使用相关提示。'
      : '重复邮箱被拒绝或提示未完全匹配期望。';
    result.status = response.status() === 409 && explicitHint ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testSsoFromLoginPage(page, context, navLog) {
  const result = resultBase(
    '03',
    'SSO登录',
    ['系统已配置SSO提供商'],
    ['用户选择SSO方式登录'],
    '支持4种SSO提供商完成登录',
  );

  try {
    await context.clearCookies();
    await navigate(page, `${BASE_URL}/login`, 'login page for sso', navLog);
    await page.waitForSelector('button[title^="Continue with"]', { timeout: TIMEOUT });

    const core = await publicApi('GET', '/api/core-settings-public');
    const item = core.json?.item || {};
    const titles = await page.locator('button[title^="Continue with"]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('title')));
    const buttonTexts = await page.locator('button[title^="Continue with"]').evaluateAll((buttons) => buttons.map((button) => button.innerText.trim()));
    const ssoAvailable = Object.entries(item.ssoAvailable || {}).filter(([, available]) => available).map(([provider]) => provider);
    const oidcMethods = item.oidcEnabledMethods || [];

    result.screenshots.push(shotPath('03', 'login-sso-options'));
    await saveScreenshot(page, result.screenshots.at(-1));
    result.evidence.push(`登录页 SSO 按钮 title：${JSON.stringify(titles)}`);
    result.evidence.push(`登录页 SSO 按钮文本：${JSON.stringify(buttonTexts)}`);
    result.evidence.push(`demoMode：${item.demoMode}`);
    result.apiEvidence.push(`GET /api/core-settings-public 返回 ${core.status}`);
    result.apiEvidence.push(`ssoAvailable：${JSON.stringify(item.ssoAvailable)}`);
    result.apiEvidence.push(`oidcEnabledMethods：${JSON.stringify(oidcMethods)}`);

    const clickResults = [];
    for (let index = 0; index < titles.length; index += 1) {
      const title = titles[index];
      if (index > 0) {
        await navigate(page, `${BASE_URL}/login`, `sso reset before ${title}`, navLog);
      }
      await page.waitForSelector(`button[title="${title}"]`, { timeout: TIMEOUT });

      const beforeUrl = page.url();
      const popupPromise = page.waitForEvent('popup', { timeout: 7000 }).catch(() => null);
      const navPromise = page.waitForURL((url) => String(url) !== beforeUrl, { timeout: TIMEOUT }).catch(() => null);
      await page.locator(`button[title="${title}"]`).click();
      const popup = await popupPromise;
      await navPromise;
      const activePage = popup || page;
      await activePage.waitForLoadState('domcontentloaded', { timeout: TIMEOUT }).catch(() => {});
      await activePage.waitForTimeout(3000);
      const afterUrl = activePage.url();
      const afterText = await pageText(activePage, 1000);
      const provider = title.replace(/^Continue with\s+/i, '');
      const screenshot = shotPath('03', `after-click-${provider.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
      result.screenshots.push(screenshot);
      await saveScreenshot(activePage, screenshot);
      if (popup) {
        await popup.close().catch(() => {});
      }
      clickResults.push({
        title,
        beforeUrl,
        afterUrl,
        leftApp: !afterUrl.startsWith(BASE_URL) || /\/auth\//.test(afterUrl),
        text: truncateText(afterText, 500),
      });
    }

    clickResults.forEach((item) => {
      result.evidence.push(`${item.title} 点击后 URL：${item.afterUrl}`);
      result.evidence.push(`${item.title} 点击后文本摘录：${item.text}`);
    });

    const clickableCount = clickResults.filter((item) => item.afterUrl !== item.beforeUrl || item.leftApp).length;
    const configuredMethods = ssoAvailable.length + oidcMethods.length;
    result.actual = `登录页显示 ${titles.length} 个 SSO 按钮；实际点击 ${clickResults.length} 个，${clickableCount} 个点击后发生跳转或进入认证流程。公开配置中原生 provider ${ssoAvailable.length} 个，OIDC 方法 ${oidcMethods.length} 个。`;
    result.status = titles.length >= 3 && clickableCount === titles.length && configuredMethods >= 4 ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testRegisterSuccess(page) {
  const result = resultBase(
    '01',
    '用户注册（邮箱+密码）',
    ['用户在注册页面'],
    ['提交有效邮箱和密码'],
    '成功创建账户，可登录',
  );

  try {
    const email = `user_module_register_${RUN_ID}@example.com`;
    await clearAndTypeRegisterForm(page, email, PASSWORD);
    result.screenshots.push(shotPath('01', 'register-filled'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const responsePromise = page.waitForResponse((res) => res.url() === `${BASE_URL}/api/register` && res.request().method() === 'POST', { timeout: TIMEOUT });
    await page.locator('button[type="submit"][title="Register"]').click();
    const response = await responsePromise;
    const responseText = await response.text();
    await page.waitForTimeout(5000);

    result.screenshots.push(shotPath('01', 'after-register'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const loginToken = await getAccessToken(email, PASSWORD);
    const reloginOk = Boolean(loginToken);
    const body = await pageText(page);

    result.evidence.push(`注册邮箱：${email}`);
    result.evidence.push(`注册后页面 URL：${page.url()}`);
    result.evidence.push(`注册后页面文本摘录：${body}`);
    result.apiEvidence.push(`POST /api/register 返回 ${response.status()}，响应体：${truncateText(responseText, 300)}`);
    result.apiEvidence.push(`使用新账号调用 POST /api/access-tokens 可获取 token：${reloginOk}`);
    result.actual = response.status() === 200 && reloginOk
      ? '注册接口成功，且新账号可通过登录接口获取访问令牌。'
      : '注册或登录校验未达到预期。';
    result.status = response.status() === 200 && reloginOk ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testUserList(page, context, navLog) {
  const result = resultBase(
    '04',
    '用户列表查看',
    ['以管理员身份登录系统，进入实例设置'],
    ['查看用户表格'],
    '显示用户相关信息',
  );

  try {
    const users = await listUsersViaApi();
    const token = await getAccessToken(ADMIN.emailOrUsername, ADMIN.password);
    await switchIdentity(context, token);
    await navigate(page, `${BASE_URL}/settings/users`, 'admin users settings', navLog);
    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT }).catch(() => {});
    await page
      .waitForFunction(
        ({ firstEmail }) => {
          const text = document.body?.innerText || '';
          return (text.includes('Users') && text.includes('Email')) || (firstEmail && text.includes(firstEmail));
        },
        { firstEmail: users.json?.items?.[0]?.email || '' },
        { timeout: TIMEOUT },
      )
      .catch(() => {});

    result.screenshots.push(shotPath('04', 'users-settings'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const body = await pageText(page, 5000);
    const apiCount = users.json?.items?.length || 0;
    const firstUser = users.json?.items?.[0];
    const visibleHeaders = ['Name', 'Username', 'Email', 'Admin', 'Last login'].filter((text) => body.includes(text));
    const pageShowsUsers = visibleHeaders.length >= 3 || body.includes(firstUser?.email || '__never__');

    result.evidence.push(`页面 URL：${page.url()}`);
    result.evidence.push(`页面可见表头命中：${visibleHeaders.join(', ') || '无'}`);
    result.evidence.push(`页面文本摘录：${body}`);
    result.apiEvidence.push(`GET /api/users 返回 ${users.status}，items 数量：${apiCount}`);
    result.apiEvidence.push(`首条用户字段：${JSON.stringify(firstUser ? Object.keys(firstUser).slice(0, 12) : [])}`);
    result.actual = apiCount > 0 && pageShowsUsers
      ? `用户表格已显示，API 返回 ${apiCount} 个用户，页面可见关键用户字段。`
      : `API 返回 ${apiCount} 个用户，但页面未在等待时间内渲染出用户表格文本。`;
    result.status = apiCount > 0 && pageShowsUsers ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testRegistrationDisabled(page) {
  const result = resultBase(
    '06',
    '禁用注册后注册',
    ['管理员已关闭注册功能'],
    ['新用户尝试注册'],
    '拒绝新用户注册',
  );

  try {
    const email = `user_module_disabled_${RUN_ID}@example.com`;
    const coreBefore = await publicApi('GET', '/api/core-settings-public');
    const disable = await adminApi(null, 'POST', '/api/core-settings', {
      registrationEnabled: false,
      localRegistrationEnabled: false,
    });
    const direct = await registerPublicUser({
      email,
      password: PASSWORD,
      name: 'Disabled Registration Probe',
      policy: true,
    });
    const coreAfter = await publicApi('GET', '/api/core-settings-public');

    result.screenshots.push(shotPath('06', 'admin-current-page-after-disable-attempt'));
    await saveScreenshot(page, result.screenshots.at(-1));

    result.evidence.push(`当前实例 demoMode：${coreBefore.json?.item?.demoMode}`);
    result.evidence.push(`当前页面 URL：${page.url()}`);
    result.apiEvidence.push(`禁用前 GET /api/core-settings-public：${truncateText(JSON.stringify(coreBefore.json?.item), 800)}`);
    result.apiEvidence.push(`管理员 POST /api/core-settings 尝试关闭注册返回 ${disable.status}，响应体：${truncateText(disable.text, 300)}`);
    result.apiEvidence.push(`关闭尝试后 GET /api/core-settings-public：${truncateText(JSON.stringify(coreAfter.json?.item), 800)}`);
    result.apiEvidence.push(`关闭尝试后新用户 POST /api/register 返回 ${direct.status}，响应体：${truncateText(direct.text, 300)}`);
    result.actual = disable.status === 403
      ? '当前 demo 实例禁止管理员修改注册开关，无法模拟“已关闭注册功能”的 Given；关闭尝试失败后，新用户注册接口仍按当前配置执行。'
      : direct.status === 403
        ? '管理员成功关闭注册，新用户注册被拒绝。'
        : '管理员关闭注册后，新用户注册未被拒绝。';
    result.status = disable.status === 403 ? 'blocked' : direct.status === 403 ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testAccessDenied(page, context, navLog) {
  const result = resultBase(
    '07',
    '用户级别访问权限（拒绝访问）',
    ['以用户身份登录系统', '尝试访问未被添加的项目或看板'],
    ['访问未授权项目和看板 URL'],
    '系统应拒绝访问，显示权限不足提示',
  );

  try {
    const fixture = await createAccessFixture('deny', false);
    const token = await getAccessToken(fixture.email, fixture.password);
    const projectApi = await getProjectViaApi(null, fixture.project.id, token);
    const boardApi = await getBoardViaApi(null, fixture.board.id, token);
    await switchIdentity(context, token);
    await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, 'unauthorized board', navLog);
    await page
      .waitForFunction(
        ({ boardName }) => {
          const text = document.body?.innerText || '';
          return text.includes('Board not found') || text.includes('Project not found') || text.includes('Not Found') || text.includes('not found') || text.includes(boardName);
        },
        { boardName: fixture.board.name },
        { timeout: TIMEOUT },
      )
      .catch(() => {});

    result.screenshots.push(shotPath('07', 'unauthorized-board'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const boardBody = await pageText(page);
    const denied = boardApi.status === 404 && projectApi.status === 404 && !boardBody.includes(fixture.board.name);
    const permissionHint = /permission|insufficient|权限|无权|拒绝|forbidden/i.test(boardBody);

    result.evidence.push(`未授权用户：${fixture.email}`);
    result.evidence.push(`未授权项目/看板：${fixture.project.name} / ${fixture.board.name}`);
    result.evidence.push(`看板页面文本摘录：${boardBody}`);
    result.apiEvidence.push(`普通用户 GET /api/boards/${fixture.board.id} 返回 ${boardApi.status}，响应体：${truncateText(boardApi.text, 300)}`);
    result.apiEvidence.push(`普通用户 GET /api/projects/${fixture.project.id} 返回 ${projectApi.status}，响应体：${truncateText(projectApi.text, 300)}`);
    result.actual = denied
      ? `系统拒绝了未授权访问，但页面${permissionHint ? '显示权限相关提示' : '显示 Not Found 类提示，未出现明确权限不足提示'}。`
      : '未授权用户仍可看到未加入的项目或看板内容。';
    result.status = denied && permissionHint ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function testAccessAllowed(page, context, navLog) {
  const result = resultBase(
    '08',
    '用户级别访问权限（允许访问）',
    ['以用户身份登录系统', '访问已被添加的项目和看板'],
    ['访问授权项目和看板 URL'],
    '系统应允许正常访问',
  );

  try {
    const fixture = await createAccessFixture('allow', true);
    const token = await getAccessToken(fixture.email, fixture.password);
    const projectApi = await getProjectViaApi(null, fixture.project.id, token);
    const boardApi = await getBoardViaApi(null, fixture.board.id, token);
    await switchIdentity(context, token);
    await navigate(page, `${BASE_URL}/boards/${fixture.board.id}`, 'authorized board', navLog);
    await page
      .waitForFunction(
        ({ boardName, projectName }) => {
          const text = document.body?.innerText || '';
          return text.includes(boardName) || text.includes(projectName) || text.includes('Board not found') || text.includes('Project not found');
        },
        { boardName: fixture.board.name, projectName: fixture.project.name },
        { timeout: TIMEOUT },
      )
      .catch(() => {});

    result.screenshots.push(shotPath('08', 'authorized-board'));
    await saveScreenshot(page, result.screenshots.at(-1));

    const boardBody = await pageText(page);
    const allowedByApi = projectApi.status === 200 && boardApi.status === 200;
    const allowedByPage = boardBody.includes(fixture.project.name) || boardBody.includes(fixture.board.name);

    result.evidence.push(`授权用户：${fixture.email}`);
    result.evidence.push(`授权项目/看板：${fixture.project.name} / ${fixture.board.name}`);
    result.evidence.push(`看板页面文本摘录：${boardBody}`);
    result.apiEvidence.push(`管理员添加看板成员 membershipId：${fixture.membership?.id || '无'}`);
    result.apiEvidence.push(`授权用户 GET /api/projects/${fixture.project.id} 返回 ${projectApi.status}`);
    result.apiEvidence.push(`授权用户 GET /api/boards/${fixture.board.id} 返回 ${boardApi.status}`);
    result.actual = allowedByApi && allowedByPage
      ? '已加入看板的普通用户可通过页面和接口正常访问项目/看板。'
      : allowedByApi
        ? '接口确认授权用户可访问项目/看板；页面在等待时间内未渲染出项目/看板名称。'
        : '授权用户访问项目或看板接口未达到预期。';
    result.status = allowedByApi ? 'pass' : 'fail';
  } catch (error) {
    result.actual = `执行异常：${String(error)}`;
    result.error = String(error);
  }

  return result;
}

async function main() {
  resetFile(
    REPORT_PATH,
    `# 用户级模块测试结果

- 测试目标：https://demo.4gaboards.com/login
- 测试分类：一、用户级模块
- 本轮 runId：${RUN_ID}
- 执行时间：${new Date().toISOString()}
- 执行方式：Playwright + Microsoft Edge；单 browser/context/page 顺序会话；接口用于模拟 Given 前置条件和交叉验证。

`,
  );

  const browser = await launchBrowser();
  const context = await newContext(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  const results = [];
  const navLog = [];

  async function record(result) {
    results.push(result);
    fs.appendFileSync(REPORT_PATH, caseMarkdown(result), 'utf8');
    writeJson(RAW_PATH, { runId: RUN_ID, navigationCount: navLog.length, navigationLog: navLog, results });
    console.log(`${result.caseNo} ${result.name}: ${result.status}`);
  }

  try {
    await context.clearCookies();
    await navigate(page, `${BASE_URL}/register`, 'initial register page', navLog);
    await page.waitForSelector('input[name="email"]', { timeout: TIMEOUT });
    await saveScreenshot(page, shotPath('00', 'initial-register-page'));

    await record(await testEmptyPassword(page));
    await record(await testDuplicateEmail(page));
    await record(await testRegisterSuccess(page));
    await record(await testUserList(page, context, navLog));
    await record(await testRegistrationDisabled(page));
    await record(await testAccessDenied(page, context, navLog));
    await record(await testAccessAllowed(page, context, navLog));
    await record(await testSsoFromLoginPage(page, context, navLog));
  } finally {
    await browser.close();
  }

  const order = ['01', '02', '03', '04', '05', '06', '07', '08'];
  results.sort((a, b) => order.indexOf(a.caseNo) - order.indexOf(b.caseNo));
  writeJson(RAW_PATH, { runId: RUN_ID, navigationCount: navLog.length, navigationLog: navLog, results });

  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  fs.appendFileSync(
    REPORT_PATH,
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

  console.log(JSON.stringify({ runId: RUN_ID, summary, navigationCount: navLog.length, navigationLog: navLog }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
