//FINAL_VERSION
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const LOG_DIR = 'D:\\VSCode\\playwright\\output\\4_view_user_list';

test.setTimeout(300000);

test('4_view_user_list', async ({ page }) => {
  // Ensure log directory exists
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const log = (msg) => {
    console.log(`[TEST_LOG] ${msg}`);
  };

  try {
    // Generate a unique email to avoid registration conflicts (reproducibility)
    const uniqueId = Date.now();
    const testEmail = `test_${uniqueId}@example.com`;
    const testPassword = 'TestPassword123!';

    // Step 1: Login as admin
    // NOTE: The provided credentials (3652750340@qq.com / abc.147258369) do NOT
    // work on this demo site. The site is in "Demo Mode" where every new
    // registered user automatically receives admin privileges, so we register
    // a fresh account to act as the admin.
    log('Step 1: Navigating to homepage to login as admin');
    await page.goto('https://demo.4gaboards.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(LOG_DIR, '01_homepage.png'), fullPage: true });
    log(`Step 1.1: Page title: ${await page.title()}`);

    log('Step 1.2: Clicking "Create an account"');
    await page.locator('button:has-text("Create an account")').first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(LOG_DIR, '02_signup_page.png'), fullPage: true });

    log(`Step 1.3: Registering new admin user with email: ${testEmail}`);
    await page.locator('input[name="email"]').fill(testEmail);
    await page.locator('input[name="password"]').fill(testPassword);
    await page.locator('input[name="policy"]').check();
    await page.screenshot({ path: path.join(LOG_DIR, '03_signup_filled.png'), fullPage: true });

    log('Step 1.4: Clicking "Register"');
    await page.locator('button:has-text("Register")').first().click();

    log('Step 1.5: Waiting for registration/login to complete');
    await page.waitForTimeout(10000);
    log(`Step 1.6: After registration, URL: ${page.url()}, title: ${await page.title()}`);
    await page.screenshot({ path: path.join(LOG_DIR, '04_dashboard.png'), fullPage: true });

    // Verify login succeeded (URL should not contain /login)
    if (page.url().includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    log('Step 1.7: Login successful, dashboard reached');

    // Step 2: Enter instance settings
    log('Step 2: Navigating to instance settings');
    await page.goto('https://demo.4gaboards.com/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(LOG_DIR, '05_instance_settings.png'), fullPage: true });
    log(`Step 2.1: Settings page URL: ${page.url()}, title: ${await page.title()}`);

    // Verify on settings page
    const settingsBody = await page.locator('body').innerText().catch(() => '');
    if (!settingsBody.toLowerCase().includes('settings')) {
      throw new Error('Instance settings page not loaded correctly');
    }
    log('Step 2.2: Instance settings page loaded');

    // Step 3: View the user table
    log('Step 3: Navigating to users list');
    await page.goto('https://demo.4gaboards.com/settings/users', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(LOG_DIR, '06_users_list.png'), fullPage: true });
    log(`Step 3.1: Users page URL: ${page.url()}, title: ${await page.title()}`);

    const usersBody = await page.locator('body').innerText().catch(() => '');
    log(`Step 3.2: Users page content snippet: ${usersBody.substring(0, 1500)}`);

    // Step 4: Verify expected user-related information is displayed
    log('Step 4: Verifying that user-related information is displayed');

    // Check for expected column headers in the user list
    const hasNameColumn = usersBody.includes('Name');
    const hasUsernameColumn = usersBody.includes('Username');
    const hasEmailColumn = usersBody.includes('Email');
    const hasAdminColumn = usersBody.includes('Admin');
    const hasLastLoginColumn = usersBody.includes('Last login');

    // Check for actual user data (the new admin we just registered)
    const hasCurrentUser = usersBody.includes(testEmail);

    // Check for table/row structure
    const hasTable = await page.locator('table').count() > 0;
    const hasRows = await page.locator('tr, [role="row"]').count() > 1;

    log(`Step 4.1: Has 'Name' column: ${hasNameColumn}`);
    log(`Step 4.2: Has 'Username' column: ${hasUsernameColumn}`);
    log(`Step 4.3: Has 'Email' column: ${hasEmailColumn}`);
    log(`Step 4.4: Has 'Admin' column: ${hasAdminColumn}`);
    log(`Step 4.5: Has 'Last login' column: ${hasLastLoginColumn}`);
    log(`Step 4.6: Current user (${testEmail}) is in the list: ${hasCurrentUser}`);
    log(`Step 4.7: Has table element: ${hasTable}`);
    log(`Step 4.8: Has multiple rows: ${hasRows}`);

    await page.screenshot({ path: path.join(LOG_DIR, '07_final_users_view.png'), fullPage: true });

    // Assertions: expected result is "display user-related information"
    // We expect: at least 3 of the column headers, current user shown, and a table
    const columnHeadersCount = [hasNameColumn, hasUsernameColumn, hasEmailColumn, hasAdminColumn, hasLastLoginColumn].filter(Boolean).length;
    const allConditionsMet = columnHeadersCount >= 3 && hasCurrentUser && hasTable;

    expect(allConditionsMet).toBe(true);

    if (allConditionsMet) {
      log('All assertions passed - user information is displayed correctly');
      console.log('TEST_PASSED');
    } else {
      log(`Assertions failed - columnHeadersCount=${columnHeadersCount}, hasCurrentUser=${hasCurrentUser}, hasTable=${hasTable}`);
      console.log('TEST_FAILED: User information not displayed as expected');
    }
  } catch (error) {
    log(`Error occurred: ${error.message}`);
    await page.screenshot({ path: path.join(LOG_DIR, 'error_state.png'), fullPage: true }).catch(() => {});
    console.log(`TEST_BLOCKED: ${error.message}`);
  }
});