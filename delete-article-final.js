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
  
  const editUrl = 'https://www.linkedin.com/article/edit/7475163204323655680/';
  console.log(`Navigating to edit URL: ${editUrl}`);
  await linkedIn.page.goto(editUrl, { waitUntil: 'domcontentloaded' });
  await linkedIn.page.waitForTimeout(5000);

  // Click "Manage" dropdown
  console.log('Clicking Manage dropdown...');
  const manageBtn = await linkedIn.page.waitForSelector('button:has-text("Manage"), button[aria-label="Manage menu"]', { timeout: 10000 });
  await manageBtn.click();
  await linkedIn.page.waitForTimeout(2000);

  // Click "Published" (which is a div.artdeco-dropdown__item)
  console.log('Clicking Published option...');
  const publishedBtn = await linkedIn.page.waitForSelector('div.artdeco-dropdown__item:has-text("Published")', { timeout: 5000 });
  await publishedBtn.click();
  await linkedIn.page.waitForTimeout(4000);

  // Click "Published" tab in modal explicitly
  console.log('Locating Published tab inside modal...');
  const tabClicked = await linkedIn.page.evaluate(() => {
    // Look for tablist
    const tablist = document.querySelector('.article-editor-article-management-modal__tablist, [class*="tablist"]');
    if (!tablist) return false;
    
    // Find button containing "Published"
    const tabs = Array.from(tablist.querySelectorAll('button'));
    const publishedTab = tabs.find(t => t.innerText && t.innerText.includes('Published'));
    if (publishedTab) {
      publishedTab.click();
      return true;
    }
    return false;
  });

  if (tabClicked) {
    console.log('Clicked Published tab explicitly. Waiting for list...');
    await linkedIn.page.waitForTimeout(3000);
  } else {
    console.log('⚠️ Could not click Published tab explicitly, proceeding with default...');
  }

  // Find and click the three-dots button for the target article
  console.log('Locating the target article and its three-dots button...');
  const clickSuccess = await linkedIn.page.evaluate(() => {
    // Find the title element containing the target article text
    const allElements = Array.from(document.querySelectorAll('*'));
    const titleEl = allElements.find(el => {
      return el.innerText && 
             el.innerText.includes('Lucknow Aliganj Fire Incident') &&
             (el.tagName === 'DIV' || el.tagName === 'H3' || el.tagName === 'SPAN' || el.tagName === 'A');
    });

    if (!titleEl) {
      console.error('Target article title element not found on page');
      return false;
    }

    // Traverse up to find the container list item (has class list-item or tagName LI)
    let container = titleEl;
    while (container && !container.className.includes('list-item') && container.tagName !== 'LI') {
      container = container.parentElement;
    }

    if (!container) {
      console.error('Could not find list item container wrapping the title');
      // Fallback: just use parent element if we can't find list-item class
      container = titleEl.parentElement;
      while (container && !container.querySelector('button')) {
        container = container.parentElement;
      }
    }

    if (!container) {
      console.error('Could not find parent container with a button');
      return false;
    }

    console.log('Found container for article:', container.className);

    // Find the three-dots button in this container
    const btn = container.querySelector('button');
    if (!btn) {
      console.error('Three-dots button not found inside container');
      return false;
    }

    btn.click();
    return true;
  });

  if (!clickSuccess) {
    throw new Error('❌ Could not locate or click target article three-dots button.');
  }

  await linkedIn.page.waitForTimeout(2000);

  // Take screenshot of the opened options menu
  const menuSp = path.join(__dirname, 'daily-banners', 'list_item_menu_opened.png');
  await linkedIn.page.screenshot({ path: menuSp });
  console.log(`📸 Saved list item menu screenshot to: ${menuSp}`);

  // Find the Delete option in the dropdown and click it
  console.log('Locating Delete option in dropdown...');
  const deleteClicked = await linkedIn.page.evaluate(() => {
    // Look for dropdown menu items
    const dropdowns = Array.from(document.querySelectorAll('.artdeco-dropdown__content--visible, [class*="visible"], [class*="dropdown-menu"]'));
    let found = false;
    dropdowns.forEach(d => {
      const items = Array.from(d.querySelectorAll('button, div, li, span'));
      const deleteItem = items.find(el => el.innerText && el.innerText.includes('Delete'));
      if (deleteItem) {
        deleteItem.click();
        found = true;
      }
    });
    return found;
  });

  if (!deleteClicked) {
    throw new Error('❌ Could not find or click Delete option in the list item dropdown.');
  }

  await linkedIn.page.waitForTimeout(3000);

  // Take screenshot of confirm modal
  const confirmSp = path.join(__dirname, 'daily-banners', 'list_item_delete_confirm.png');
  await linkedIn.page.screenshot({ path: confirmSp });
  console.log(`📸 Saved delete confirmation screenshot to: ${confirmSp}`);

  // Click final confirm delete button in modal
  console.log('Locating final confirm Delete button...');
  const confirmBtn = await linkedIn.page.waitForSelector('button.artdeco-modal__confirm-dialog-btn, button:has-text("Delete")', { timeout: 10000 });
  if (confirmBtn) {
    console.log('Clicking confirm button to delete article...');
    await confirmBtn.click();
    await linkedIn.page.waitForTimeout(5000);
    console.log('🎉 Article successfully deleted from management list!');

    // Take final screenshot
    const finalSp = path.join(__dirname, 'daily-banners', 'list_item_deleted_final.png');
    await linkedIn.page.screenshot({ path: finalSp });
    console.log(`📸 Saved final post-delete screenshot to: ${finalSp}`);
  } else {
    throw new Error('❌ Could not find final confirm Delete button in modal.');
  }

} catch (err) {
  console.error('❌ Error:', err.message);
  if (linkedIn.page) {
    await linkedIn.page.screenshot({ path: path.join(__dirname, 'daily-banners', 'delete_final_error.png') }).catch(() => {});
  }
} finally {
  await linkedIn.close();
}
