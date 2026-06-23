import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true
});

try {
  await linkedIn.launch();
  await linkedIn.verifyLogin();
  
  const manageUrl = 'https://www.linkedin.com/article/manage/published/';
  console.log(`Navigating directly to article management URL: ${manageUrl}`);
  await linkedIn.page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
  await linkedIn.page.waitForTimeout(6000);

  // Take screenshot of the loaded page to verify
  const loadSp = path.join(__dirname, 'daily-banners', 'direct_url_loaded.png');
  await linkedIn.page.screenshot({ path: loadSp });
  console.log(`📸 Saved loaded page screenshot to: ${loadSp}`);

  // Check if we are on the Published tab, if not, try to click it
  console.log('Ensuring Published tab is active...');
  const tabClicked = await linkedIn.page.evaluate(() => {
    const tablist = document.querySelector('.article-editor-article-management-modal__tablist, [class*="tablist"]');
    if (!tablist) return false;
    
    // Check if Published is already selected
    const publishedTab = Array.from(tablist.querySelectorAll('button')).find(t => t.innerText && t.innerText.includes('Published'));
    if (publishedTab && !publishedTab.className.includes('selected') && !publishedTab.className.includes('active')) {
      publishedTab.click();
      return true;
    }
    return false;
  });

  if (tabClicked) {
    console.log('Clicked Published tab. Waiting for list to load...');
    await linkedIn.page.waitForTimeout(3000);
    const postTabSp = path.join(__dirname, 'daily-banners', 'direct_url_after_tab_click.png');
    await linkedIn.page.screenshot({ path: postTabSp });
  }

  // Locate and click the target article three-dots button
  console.log('Locating target article three-dots button using aria-label...');
  const threeDotsBtn = await linkedIn.page.waitForSelector('button[aria-label*="Lucknow Aliganj Fire Incident"]', { timeout: 10000 });
  if (threeDotsBtn) {
    console.log('Found three-dots button! Clicking...');
    await threeDotsBtn.click();
  } else {
    throw new Error('❌ Could not locate target article three-dots button.');
  }

  await linkedIn.page.waitForTimeout(2000);

  // Take screenshot of the opened options menu
  const menuSp = path.join(__dirname, 'daily-banners', 'direct_url_menu_opened.png');
  await linkedIn.page.screenshot({ path: menuSp });
  console.log(`📸 Saved menu screenshot to: ${menuSp}`);

  // Find the Delete option in the dropdown and click it using Playwright's native click
  console.log('Locating Delete option in dropdown...');
  const deleteOption = await linkedIn.page.getByText('Delete', { exact: true }).first();
  if (deleteOption) {
    console.log('Found Delete option! Clicking...');
    await deleteOption.click();
  } else {
    throw new Error('❌ Could not find Delete option in the dropdown.');
  }

  await linkedIn.page.waitForTimeout(3000);

  // Take screenshot of confirm modal
  const confirmSp = path.join(__dirname, 'daily-banners', 'direct_url_delete_confirm.png');
  await linkedIn.page.screenshot({ path: confirmSp });
  console.log(`📸 Saved delete confirmation screenshot to: ${confirmSp}`);

  // Click final confirm delete button in modal
  console.log('Locating final confirm Delete button...');
  // We can target the confirm button in the modal specifically
  const confirmBtn = await linkedIn.page.waitForSelector('.artdeco-modal button.artdeco-button--primary, button.artdeco-modal__confirm-dialog-btn, button:has-text("Delete")', { timeout: 10000 });
  if (confirmBtn) {
    console.log('Clicking confirm button to delete article...');
    await confirmBtn.click();
    await linkedIn.page.waitForTimeout(5000);
    console.log('🎉 Article successfully deleted!');

    // Take final screenshot
    const finalSp = path.join(__dirname, 'daily-banners', 'direct_url_deleted_final.png');
    await linkedIn.page.screenshot({ path: finalSp });
    console.log(`📸 Saved final post-delete screenshot to: ${finalSp}`);
  } else {
    throw new Error('❌ Could not find final confirm Delete button in modal.');
  }

} catch (err) {
  console.error('❌ Error during deletion:', err.message);
  if (linkedIn.page) {
    await linkedIn.page.screenshot({ path: path.join(__dirname, 'daily-banners', 'direct_url_delete_error.png') }).catch(() => {});
  }
} finally {
  await linkedIn.close();
}
