/**
 * Auto-update Service Files for Multi-Language Support
 * Run this script to add language parameter to all service methods
 * 
 * Usage: node scripts/updateServiceLanguageSupport.js
 */

const fs = require('fs');
const path = require('path');

// Service files to update
const serviceFiles = [
  'src/app/modules/shop/shop.service.ts',
  'src/app/modules/user/user.service.ts',
  'src/app/modules/deal/deal.service.ts',
  'src/app/modules/voucher/voucher.service.ts',
  'src/app/modules/subscription/subscription.service.ts',
  'src/app/modules/notifications/notification.service.ts',
  'src/app/modules/steps/steps.service.ts',
  'src/app/modules/payment/payment.service.ts',
  'src/app/modules/streakTimer/streakTimer.service.ts',
  'src/app/modules/auth/auth.service.ts',
];

// Import statement to add
const languageImport = `import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";`;

// Function to update a service file
function updateServiceFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let updated = false;

  // Step 1: Add import if not exists
  if (!content.includes('SupportedLanguage')) {
    const importRegex = /^import.*from.*;\n/m;
    const match = content.match(importRegex);
    
    if (match) {
      const lastImportIndex = content.lastIndexOf(match[0]) + match[0].length;
      content = content.slice(0, lastImportIndex) + languageImport + '\n' + content.slice(lastImportIndex);
      updated = true;
    }
  }

  // Step 2: Add language parameter to async function signatures
  // Pattern: const functionName = async (params) => {
  const functionPattern = /(const\s+\w+\s*=\s*async\s*\([^)]*)\)(\s*:?\s*[^{]*)\s*=>\s*{/g;
  
  content = content.replace(functionPattern, (match, params, returnType) => {
    // Skip if already has language parameter
    if (params.includes('language:') || params.includes('language =')) {
      return match;
    }
    
    // Add language parameter
    const hasParams = params.trim().endsWith('(') === false;
    if (hasParams) {
      return `${params}, language: SupportedLanguage = 'en')${returnType} => {`;
    } else {
      return `${params}language: SupportedLanguage = 'en')${returnType} => {`;
    }
  });

  // Step 3: Replace common error messages with getResponseMessage
  const errorReplacements = [
    { old: '"User not found"', new: 'getResponseMessage("user.notFound", language)' },
    { old: '"Shop not found"', new: 'getResponseMessage("shop.notFound", language)' },
    { old: '"Deal not found"', new: 'getResponseMessage("deal.notFound", language)' },
    { old: '"Voucher not found"', new: 'getResponseMessage("voucher.notFound", language)' },
    { old: '"Not found"', new: 'getResponseMessage("error.notFound", language)' },
    { old: '"Unauthorized"', new: 'getResponseMessage("error.unauthorized", language)' },
    { old: '"Forbidden"', new: 'getResponseMessage("error.forbidden", language)' },
    { old: '"Validation error"', new: 'getResponseMessage("error.validation", language)' },
    { old: '"Already exists"', new: 'getResponseMessage("error.alreadyExists", language)' },
  ];

  errorReplacements.forEach(({ old, new: newMsg }) => {
    if (content.includes(old)) {
      content = content.replace(new RegExp(old, 'g'), newMsg);
      updated = true;
    }
  });

  // Write back if updated
  if (updated) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
  }
}

// Main execution
console.log('🚀 Starting service file updates...\n');

serviceFiles.forEach(file => {
  try {
    updateServiceFile(file);
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
  }
});

console.log('\n✅ Service file update complete!');
console.log('\n📝 Next steps:');
console.log('1. Review the changes in each service file');
console.log('2. Test each endpoint with ?lang=nl and ?lang=en');
console.log('3. Update any custom error messages manually');
console.log('4. Run the project and verify everything works');
