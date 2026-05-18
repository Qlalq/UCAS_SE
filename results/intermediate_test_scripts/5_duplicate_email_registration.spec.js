//FINAL_VERSION
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'D:\\VSCode\\playwright\\output\\5_duplicate_email_registration';
const LOG_FILE = path.join(SCREENSHOT_DIR, 'test.log');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

fs.writeFileSync(LOG_FILE, '');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

test.setTimeout(240000);

test('5_duplicate_email_registration', async ({ browser }) => {
  log('========================================');
  log('TEST_START: 重复邮箱注册测试');
  log('========================================');

  // 使用时间戳生成唯一的测试邮箱，避免历史脏数据干扰，保证可复现
  const timestamp = Date.now();
  const TEST_EMAIL = `test_dup_${timestamp}@example.com`;
  const TEST_PASSWORD = 'TestPassword123!';

  log('使用测试邮箱: ' + TEST_EMAIL);

  let testResult = 'TEST_FAILED';
  let failureReason = '';

  try {
    // ==== 阶段1：使用 context A 注册一个测试账户 ====
    log('---- 阶段1: 注册测试账户 ----');
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.setDefaultTimeout(60000);

    await pageA.goto('https://demo.4gaboards.com/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageA.waitForSelector('input[name="email"]', { timeout: 30000 });
    log('注册页面已加载');
    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, '01_register_page.png'), fullPage: true });

    await pageA.fill('input[name="email"]', TEST_EMAIL);
    await pageA.fill('input[name="password"]', TEST_PASSWORD);

    const policyCheckboxA = pageA.locator('input[name="policy"]');
    if (await policyCheckboxA.isVisible()) {
      await policyCheckboxA.check();
      log('已勾选服务条款和隐私政策');
    }

    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, '02_first_register_filled.png'), fullPage: true });

    await pageA.click('button[title="Register"]');
    log('已点击注册按钮');

    // 等待成功（离开 register 页面）
    await pageA.waitForURL((url) => !url.toString().includes('/register'), { timeout: 30000 });
    log('✓ 首次注册成功！URL: ' + pageA.url());
    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, '03_first_register_success.png'), fullPage: true });

    // 关闭 context A（包含登录状态），但保留已注册的账户
    await contextA.close();
    log('已关闭第一个浏览器上下文（保留注册的账户）');

    // ==== 阶段2：使用全新的 context B 重复注册同一邮箱 ====
    log('---- 阶段2: 在新浏览器上下文中重复注册同一邮箱 ----');
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.setDefaultTimeout(60000);

    await pageB.goto('https://demo.4gaboards.com/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageB.waitForSelector('input[name="email"]', { timeout: 30000 });
    log('注册页面已加载（新上下文）');
    await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, '04_register_page_again.png'), fullPage: true });

    await pageB.fill('input[name="email"]', TEST_EMAIL);
    await pageB.fill('input[name="password"]', TEST_PASSWORD);

    const policyCheckboxB = pageB.locator('input[name="policy"]');
    if (await policyCheckboxB.isVisible()) {
      await policyCheckboxB.check();
    }

    await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, '05_second_register_filled.png'), fullPage: true });

    await pageB.click('button[title="Register"]');
    log('已点击注册按钮（第二次注册）');

    // 等待响应（错误提示出现）
    await pageB.waitForTimeout(5000);
    await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, '06_after_second_register.png'), fullPage: true });

    // 验证注册失败 - 仍在注册页面
    const currentUrl = pageB.url();
    log('提交后URL: ' + currentUrl);

    if (!currentUrl.includes('/register')) {
      failureReason = '意外地离开了注册页面（可能重复注册成功了），URL: ' + currentUrl;
      log('TEST_FAILED: ' + failureReason);
      testResult = 'TEST_FAILED';
      await contextB.close();
      return;
    }

    // 获取页面文本查找错误信息
    const bodyText = await pageB.locator('body').innerText();
    log('页面文本内容:');
    log(bodyText.substring(0, 1500));

    // 检查错误信息 - 期望的错误关键词
    const expectedErrors = [
      'Email already in use',
      'emailAlreadyInUse',
      '邮箱已被使用',
      'already in use',
      'already exists',
      '已被使用',
      'already registered'
    ];

    let foundExpectedError = false;
    let foundErrorText = '';

    for (const errMsg of expectedErrors) {
      if (bodyText.toLowerCase().includes(errMsg.toLowerCase())) {
        foundExpectedError = true;
        foundErrorText = errMsg;
        break;
      }
    }

    if (foundExpectedError) {
      log('✓ 找到预期的错误提示: "' + foundErrorText + '"');

      // 进一步检查 - email 输入框的 error 样式
      try {
        const emailInput = pageB.locator('input[name="email"]');
        const emailClass = await emailInput.getAttribute('class').catch(() => '');
        log('Email input class: ' + emailClass);
        if (emailClass && emailClass.toLowerCase().includes('error')) {
          log('✓ Email 输入框有 error 状态样式');
        }
      } catch (e) {
        // ignore
      }

      await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, '07_duplicate_email_rejected.png'), fullPage: true });

      log('========================================');
      log('TEST_PASSED: 系统正确拒绝了重复邮箱的注册请求');
      log('========================================');
      testResult = 'TEST_PASSED';
    } else {
      failureReason = '未找到邮箱已存在的错误提示。系统未按预期拒绝重复邮箱注册';
      log('TEST_FAILED: ' + failureReason);
      log('完整页面文本:');
      log(bodyText);
      testResult = 'TEST_FAILED';
    }

    await contextB.close();

  } catch (e) {
    log('测试异常: ' + e.message);
    log('错误堆栈: ' + e.stack);
    try {
      const pages = browser.contexts().flatMap(c => c.pages());
      for (const p of pages) {
        await p.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
      }
    } catch (e2) {
      // ignore
    }
    failureReason = '测试异常: ' + e.message;
    testResult = 'TEST_BLOCKED';
  } finally {
    log('========================================');
    log('最终结果: ' + testResult);
    if (failureReason) {
      log('原因: ' + failureReason);
    }
    log('========================================');
  }
});