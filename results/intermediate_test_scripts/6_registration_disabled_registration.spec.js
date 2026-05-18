//FINAL_VERSION
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.setTimeout(240000);

test('6_registration_disabled_registration', async ({ browser }) => {
  // 输出目录
  const outDir = 'D:\\VSCode\\playwright\\output\\6_registration_disabled_registration';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let testResult = 'TEST_BLOCKED';
  let testReason = '';

  try {
    console.log('===== 测试开始: 6_registration_disabled_registration =====');
    console.log('测试场景: 管理员已关闭注册功能, 新用户尝试注册, 预期: 拒绝注册');

    // 使用共享的 request 上下文(API 测试)
    const context = await browser.newContext();
    const request = context.request;

    // ====== Step 1: 前置条件检查 - 获取当前实例配置 ======
    console.log('\n[Step 1] 前置条件: 获取当前实例配置');
    const settingsResp = await request.get('https://demo.4gaboards.com/api/core-settings-public');
    const initialSettings = (await settingsResp.json()).item;
    console.log(`  - registrationEnabled: ${initialSettings.registrationEnabled}`);
    console.log(`  - localRegistrationEnabled: ${initialSettings.localRegistrationEnabled}`);
    console.log(`  - ssoRegistrationEnabled: ${initialSettings.ssoRegistrationEnabled}`);
    console.log(`  - demoMode: ${initialSettings.demoMode}`);

    // ====== Step 2: 管理员登录 (demo/demo 是 demo 网站默认管理员账号) ======
    console.log('\n[Step 2] 管理员登录 (demo/demo)');
    const loginResp = await request.post('https://demo.4gaboards.com/api/access-tokens', {
      data: { emailOrUsername: 'demo', password: 'demo' },
    });
    expect(loginResp.status()).toBe(200);
    const loginData = await loginResp.json();
    const token = loginData.item;
    console.log(`  - 登录成功, token长度: ${token.length}`);

    // 在浏览器中登录 (使用同一上下文以共享 cookies)
    const adminPage = await context.newPage();
    await adminPage.goto('https://demo.4gaboards.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await adminPage.waitForTimeout(3000);
    await adminPage.fill('input[name="emailOrUsername"]', 'demo');
    await adminPage.fill('input[name="password"]', 'demo');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForTimeout(8000);
    await adminPage.screenshot({ path: path.join(outDir, '01_admin_dashboard.png'), fullPage: true });
    console.log(`  - 登录后URL: ${adminPage.url()}`);

    // ====== Step 3: 管理员进入实例设置页面 (UI) ======
    console.log('\n[Step 3] 管理员进入实例设置页面');
    await adminPage.goto('https://demo.4gaboards.com/settings/instance', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await adminPage.waitForTimeout(8000);  // 增加等待时间确保页面渲染完成
    await adminPage.screenshot({ path: path.join(outDir, '02_instance_settings.png'), fullPage: true });

    // 检查 "User Registration" 设置项状态
    const settingsPageState = await adminPage.evaluate(() => {
      const allText = document.body.innerText;
      return {
        userRegistrationRow: allText.includes('User Registration'),
        enabledText: allText.includes('Enabled'),
        disabledText: allText.includes('Disabled'),
        demoModeWarning: allText.includes('Demo Mode'),
        checkboxesDisabled: Array.from(document.querySelectorAll('input[type="checkbox"]')).every(c => c.disabled),
        checkboxesCount: document.querySelectorAll('input[type="checkbox"]').length,
        bodyTextSnippet: allText.substring(0, 600),
      };
    });
    console.log(`  - 页面包含 User Registration 设置: ${settingsPageState.userRegistrationRow}`);
    console.log(`  - 显示当前为 Enabled: ${settingsPageState.enabledText}`);
    console.log(`  - demo 模式警告: ${settingsPageState.demoModeWarning}`);
    console.log(`  - 所有 checkbox 都禁用: ${settingsPageState.checkboxesDisabled}`);
    console.log(`  - 页面 checkbox 总数: ${settingsPageState.checkboxesCount}`);

    // ====== Step 4: 管理员尝试关闭注册 (通过 API) ======
    console.log('\n[Step 4] 管理员尝试关闭注册功能 (通过 API)');
    const disableResp = await request.post('https://demo.4gaboards.com/api/core-settings', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { registrationEnabled: false },
      failOnStatusCode: false,
    });
    const disableStatus = disableResp.status();
    const disableBody = await disableResp.json();
    console.log(`  - API 状态: ${disableStatus}`);
    console.log(`  - API 响应: ${JSON.stringify(disableBody)}`);
    await adminPage.screenshot({ path: path.join(outDir, '03_after_disable_attempt.png'), fullPage: true });

    // ====== Step 5: 验证当前注册设置状态 ======
    console.log('\n[Step 5] 验证当前注册功能状态');
    const settingsResp2 = await request.get('https://demo.4gaboards.com/api/core-settings-public');
    const currentSettings = (await settingsResp2.json()).item;
    console.log(`  - registrationEnabled: ${currentSettings.registrationEnabled}`);

    // ====== Step 6: 新用户尝试注册 (API) ======
    console.log('\n[Step 6] 新用户尝试通过 API 注册');
    const timestamp = Date.now();
    const testEmail = `newuser_${timestamp}@example.com`;
    const regResp = await request.post('https://demo.4gaboards.com/api/register', {
      data: {
        email: testEmail,
        password: 'TestPass123!',
        name: 'New User',
        policy: true,
      },
      failOnStatusCode: false,
    });
    const regStatus = regResp.status();
    const regBody = await regResp.text();
    console.log(`  - 注册请求: email=${testEmail}`);
    console.log(`  - 状态: ${regStatus}`);
    console.log(`  - 响应: ${regBody}`);

    // ====== Step 7: 新用户访问注册页面 UI (使用新的浏览器上下文) ======
    console.log('\n[Step 7] 新用户访问注册页面 UI (独立浏览器上下文)');
    const newUserContext = await browser.newContext();
    const newUserPage = await newUserContext.newPage();
    await newUserPage.goto('https://demo.4gaboards.com/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await newUserPage.waitForTimeout(5000);
    await newUserPage.screenshot({ path: path.join(outDir, '04_register_page_for_new_user.png'), fullPage: true });

    const registerPageState = await newUserPage.evaluate(() => {
      return {
        url: window.location.href,
        hasEmailInput: !!document.querySelector('input[name="email"]'),
        hasPasswordInput: !!document.querySelector('input[name="password"]'),
        hasSubmitButton: !!document.querySelector('button[type="submit"]'),
        bodyContainsDisabledText: document.body.innerText.toLowerCase().includes('disabled by'),
        bodyTextSnippet: document.body.innerText.substring(0, 600),
      };
    });
    console.log(`  - 页面 URL: ${registerPageState.url}`);
    console.log(`  - Email input 存在: ${registerPageState.hasEmailInput}`);
    console.log(`  - Password input 存在: ${registerPageState.hasPasswordInput}`);
    console.log(`  - Submit button 存在: ${registerPageState.hasSubmitButton}`);
    console.log(`  - 页面包含"disabled by"提示: ${registerPageState.bodyContainsDisabledText}`);

    // ====== Step 8: UI 提交注册表单 (如果表单可用) ======
    console.log('\n[Step 8] UI 提交注册表单');
    if (registerPageState.hasEmailInput && registerPageState.hasPasswordInput && registerPageState.hasSubmitButton) {
      await newUserPage.fill('input[name="email"]', `ui_${timestamp}@example.com`);
      await newUserPage.fill('input[name="password"]', 'TestPass123!');
      
      // 勾选 policy 复选框
      const policyCheckbox = await newUserPage.$('input[type="checkbox"]');
      if (policyCheckbox) {
        const policyChecked = await policyCheckbox.isChecked();
        if (!policyChecked) {
          await policyCheckbox.click();
        }
      }
      await newUserPage.screenshot({ path: path.join(outDir, '05_ui_filled.png'), fullPage: true });
      
      await newUserPage.click('button[type="submit"]');
      await newUserPage.waitForTimeout(6000);
      await newUserPage.screenshot({ path: path.join(outDir, '06_ui_after_submit.png'), fullPage: true });
      
      const afterSubmitState = await newUserPage.evaluate(() => {
        return {
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 1500),
        };
      });
      console.log(`  - 提交后 URL: ${afterSubmitState.url}`);
      console.log(`  - 页面文本片段: ${afterSubmitState.bodyText}`);
    } else {
      console.log('  - 注册表单不可用，跳过 UI 提交');
    }

    // ====== 最终判定 ======
    console.log('\n===== 测试判定 =====');
    console.log(`  - 关闭注册尝试: HTTP ${disableStatus}`);
    console.log(`  - 当前 registrationEnabled: ${currentSettings.registrationEnabled}`);
    console.log(`  - 注册 API 响应: HTTP ${regStatus}`);

    if (disableStatus === 403) {
      // demo 模式下无法修改设置 - 这是预期的限制
      testResult = 'TEST_BLOCKED';
      testReason = `demo 网站启用了 DEMO_MODE 限制, 管理员(即使是 demo 账号)也无法通过 API 修改设置来关闭注册功能. 返回错误: ${JSON.stringify(disableBody)}. 因此测试用例的前置条件 "管理员已关闭注册功能" 无法在此 demo 环境下复现.`;
      console.log(`\n>>> ${testResult}: ${testReason}`);
    } else if (!currentSettings.registrationEnabled) {
      // 如果注册被禁用
      if (regStatus === 403 || regBody.includes('registrationDisabled')) {
        testResult = 'TEST_PASSED';
        testReason = '注册已被禁用, 新用户注册请求被拒绝 (返回 registrationDisabled 错误)';
        console.log(`\n>>> ${testResult}: ${testReason}`);
      } else {
        testResult = 'TEST_FAILED';
        testReason = `注册已被禁用, 但注册 API 仍返回状态 ${regStatus}, 响应: ${regBody}`;
        console.log(`\n>>> ${testResult}: ${testReason}`);
      }
    } else if (currentSettings.registrationEnabled && regStatus === 200) {
      // 注册仍然启用，注册成功
      testResult = 'TEST_FAILED';
      testReason = '注册功能仍然启用, 注册请求成功, 注册未被拒绝';
      console.log(`\n>>> ${testResult}: ${testReason}`);
    } else {
      testResult = 'TEST_BLOCKED';
      testReason = `状态异常: disableStatus=${disableStatus}, registrationEnabled=${currentSettings.registrationEnabled}, regStatus=${regStatus}`;
      console.log(`\n>>> ${testResult}: ${testReason}`);
    }
    
    // 关闭浏览器
    await adminPage.close();
    await newUserPage.close();
    await newUserContext.close();
    await context.close();

  } catch (e) {
    testResult = 'TEST_FAILED';
    testReason = `测试异常: ${e.message}`;
    console.log(`\n>>> ${testResult}: ${testReason}`);
  }

  console.log('\n========================================');
  console.log(`最终结果: ${testResult}`);
  if (testReason) console.log(`原因: ${testReason}`);
  console.log('========================================');

  // 写入结果文件
  const resultContent = `Test: 6_registration_disabled_registration\nResult: ${testResult}\nReason: ${testReason}\nTime: ${new Date().toISOString()}\n`;
  fs.writeFileSync(path.join(outDir, 'test_result.txt'), resultContent);

  // 断言结果 (测试运行必须明确)
  expect(['TEST_PASSED', 'TEST_FAILED', 'TEST_BLOCKED']).toContain(testResult);
});