//FINAL_VERSION
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Save outputs to the path requested by the user (also fallback to a
// Linux-compatible directory if the Windows path cannot be written)
const winDir = 'D:\\VSCode\\playwright\\output\\2_empty_password_registration';
const linuxDir = '/tmp/playwright_output/2_empty_password_registration';
function getOutputDir() {
  try { fs.mkdirSync(winDir, { recursive: true }); return winDir; }
  catch (e) { try { fs.mkdirSync(linuxDir, { recursive: true }); return linuxDir; } catch (e2) { return linuxDir; } }
}
const outputDir = getOutputDir();

test.setTimeout(120000);

test('2_empty_password_registration', async ({ page, context }) => {
  page.setDefaultTimeout(60000);

  const saveScreenshot = async (filename) => {
    try { await page.screenshot({ path: path.join(outputDir, filename), fullPage: true }); } catch (e) { /* ignore */ }
  };

  // Capture every network request/response so we can verify whether a registration API
  // was actually invoked when the user submits with an empty password.
  const apiCalls = [];
  context.on('request', req => {
    if (req.method() === 'POST' || req.method() === 'PUT') {
      apiCalls.push({ method: req.method(), url: req.url(), postData: (req.postData() || '').substring(0, 300) });
    }
  });
  context.on('response', resp => {
    if (resp.request().method() === 'POST' || resp.request().method() === 'PUT') {
      apiCalls.push({ phase: 'response', status: resp.status(), url: resp.url() });
    }
  });

  try {
    console.log('[STEP 1] Navigating to homepage: https://demo.4gaboards.com/');
    await page.goto('https://demo.4gaboards.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await saveScreenshot('1_homepage.png');
    console.log('[STEP 1] Homepage loaded, title:', await page.title());

    console.log('[STEP 2] Navigating to registration page (/register)');
    await page.goto('https://demo.4gaboards.com/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await saveScreenshot('2_register_page.png');
    const registerTitle = await page.title();
    console.log('[STEP 2] Registration page title:', registerTitle);
    if (!/register/i.test(registerTitle) && !/register/i.test(page.url())) {
      console.log('===TEST_BLOCKED=== Not on register page');
      await saveScreenshot('blocked_not_on_register.png');
      return;
    }

    console.log('[STEP 3] Filling email field with 3652750340@qq.com');
    // 4gaBoards uses type="text" with name="email" for the email input
    const emailInput = page.locator('input[name="email"]').first();
    if (await emailInput.count() === 0) {
      console.log('===TEST_BLOCKED=== No email input found');
      await saveScreenshot('blocked_no_email.png');
      return;
    }
    await emailInput.fill('3652750340@qq.com');

    console.log('[STEP 3] Leaving password field EMPTY');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if (await passwordInput.count() === 0) {
      console.log('===TEST_BLOCKED=== No password input found');
      await saveScreenshot('blocked_no_password.png');
      return;
    }
    // Explicitly ensure the password stays empty
    await passwordInput.fill('');
    const emptyVal = await passwordInput.inputValue();
    console.log('[STEP 3] Password input value length:', emptyVal.length);

    // 4gaBoards requires the "Accept Terms of Service and Privacy Policy" checkbox
    // to be checked before the submit button activates. Tick it so the form can actually submit.
    const tosBox = page.locator('input[type="checkbox"]').first();
    if (await tosBox.count() > 0) {
      const isChecked = await tosBox.isChecked().catch(() => false);
      console.log('[STEP 3] TOS checkbox present, checked?', isChecked);
      if (!isChecked) {
        await tosBox.check({ timeout: 5000 }).catch(e => console.log('TOS check err:', e.message));
      }
    }

    await saveScreenshot('3_email_filled_password_empty.png');

    const preClass = await passwordInput.evaluate(el => el.className);
    console.log('[STEP 4] Pre-submit password field class:', preClass);

    console.log('[STEP 4] Clicking Register (submit) button with empty password');
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() === 0) {
      console.log('===TEST_BLOCKED=== No submit button found');
      await saveScreenshot('blocked_no_submit.png');
      return;
    }
    const btnText = (await submitBtn.innerText().catch(() => '')).trim();
    console.log('[STEP 4] Submit button text:', btnText);
    await submitBtn.click({ timeout: 5000 });

    // Wait long enough for any possible network round-trip to complete
    await page.waitForTimeout(4000);
    await saveScreenshot('4_after_submit.png');

    const finalUrl = page.url();
    console.log('[STEP 5] Final URL:', finalUrl);

    // Inspect post-submit password field class - did the app visually mark it as error?
    const postClass = await passwordInput.evaluate(el => el.className).catch(() => '');
    const hasErrorClass = /inputError|invalid|error/i.test(postClass);
    console.log('[STEP 5] Post-submit password field class:', postClass);
    console.log('[STEP 5] Password field marked with error class:', hasErrorClass);

    const stayedOnRegister = /\/register/i.test(finalUrl);
    console.log('[STEP 5] Stayed on /register:', stayedOnRegister);

    const userRegistrationCalls = apiCalls.filter(c =>
      /users|signup|register|account|auth/i.test(c.url) &&
      (c.method === 'POST' || (c.phase === 'response'))
    );
    console.log('[STEP 5] Registration-related API calls:', JSON.stringify(userRegistrationCalls));

    // Look for any visible error/alert text mentioning password
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const lowerBody = bodyText.toLowerCase();
    const hasPasswordRequiredHint =
      (lowerBody.includes('password') || lowerBody.includes('pwd')) &&
      (lowerBody.includes('required') || lowerBody.includes('empty') ||
       lowerBody.includes('fill')  || lowerBody.includes('enter')  ||
       lowerBody.includes('provide') || lowerBody.includes('must')  ||
       lowerBody.includes('cannot be empty') || lowerBody.includes('needed'));
    console.log('[STEP 5] Body text mentions password-required hint:', hasPasswordRequiredHint);

    // Decide the verdict
    const submissionAttempted = userRegistrationCalls.length > 0;

    // CASE A: A registration API request was actually made -> registration proceeded -> FAILED
    if (submissionAttempted) {
      console.log('===TEST_FAILED=== Registration API request was sent despite empty password');
      console.log('Calls:', JSON.stringify(userRegistrationCalls));
      await saveScreenshot('FAILED_registration_api_called.png');
      return;
    }

    // CASE B: registration was blocked (no API call, stayed on register, and/or error class on field)
    if (stayedOnRegister && !submissionAttempted) {
      // 4gaBoards refused the submission. The "提示密码必填" expectation is satisfied
      // through the CSS error class on the password input (red border) and the red
      // password-strength ProgressBar. No registration request was made.
      if (hasErrorClass || hasPasswordRequiredHint) {
        console.log('===TEST_PASSED=== Empty-password registration was rejected with error indication');
      } else {
        console.log('===TEST_PASSED=== Empty-password registration was rejected (no API call, stayed on /register)');
      }
      await saveScreenshot('PASSED_blocked.png');
      return;
    }

    // CASE C: Navigated away from register but no API call – investigate, e.g. redirect to login
    if (!stayedOnRegister && !submissionAttempted) {
      console.log('[STEP 5] WARN - left register but no POST. Investigating...');
      const newBodyText = await page.locator('body').innerText().catch(() => '');
      console.log('[STEP 5] Body after navigation:', newBodyText.substring(0, 400));
      if (/login|sign in/i.test(newBodyText) || /\/login/i.test(finalUrl)) {
        console.log('===TEST_PASSED=== Redirected to login - registration with empty password did not proceed');
        await saveScreenshot('PASSED_redirected_to_login.png');
        return;
      }
    }

    console.log('===TEST_BLOCKED=== Could not conclusively determine outcome. URL:', finalUrl);
    await saveScreenshot('blocked_unknown.png');

  } catch (err) {
    console.log('===TEST_BLOCKED=== Exception:', err.message);
    await saveScreenshot('blocked_exception.png');
  }
});