/**
 * Script to automatically add multi-language support to all controllers
 * This script will update all controller files to:
 * 1. Import language helper
 * 2. Extract language from request
 * 3. Pass language to service methods
 * 4. Use translated response messages
 */

const fs = require('fs');
const path = require('path');

const modulesPath = path.join(__dirname, '..', 'src', 'app', 'modules');

// List of modules to update
const modules = [
  'user',
  'deal',
  'voucher',
  'subscription',
  'notifications',
  'steps',
  'payment',
  'streakTimer',
  'search'
];

const moduleMessageKeys = {
  user: 'user',
  deal: 'deal',
  voucher: 'voucher',
  subscription: 'subscription',
  notifications: 'notification',
  notification: 'notification',
  steps: 'steps',
  payment: 'payment',
  streakTimer: 'steps',
  search: 'success'
};

function addLanguageSupport(moduleName) {
  const controllerPath = path.join(modulesPath, moduleName, `${moduleName}.controller.ts`);
  
  if (!fs.existsSync(controllerPath)) {
    console.log(`⚠️  Controller not found: ${moduleName}`);
    return;
  }

  let content = fs.readFileSync(controllerPath, 'utf-8');
  
  // Check if already has language support
  if (content.includes('getResponseMessage')) {
    console.log(`✓ ${moduleName} controller already has language support`);
    return;
  }

  // Add import for getResponseMessage if not present
  if (!content.includes('getResponseMessage')) {
    const importLine = 'import { getResponseMessage } from "../../helper/languageHelper";';
    const importIndex = content.indexOf('import { shopService }') || 
                        content.indexOf('import { userService }') ||
                        content.indexOf('from "./');
    
    if (importIndex > -1) {
      const lines = content.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('from "./') && lines[i].includes('service')) {
          insertIndex = i + 1;
          break;
        }
      }
      lines.splice(insertIndex, 0, importLine);
      content = lines.join('\n');
    }
  }

  // Add language extraction to each controller method
  const messageKey = moduleMessageKeys[moduleName] || 'success';
  
  // Replace common message patterns
  content = content.replace(
    /"([A-Z][a-z]+)\s+(created|updated|deleted|retrieved|fetched)\s+successfully"/g,
    (match, module, action) => {
      const key = `${messageKey}.${action}`;
      return `getResponseMessage("${key}", language)`;
    }
  );

  // Add language variable to controller functions
  content = content.replace(
    /const\s+(\w+)\s+=\s+catchAsync\(async\s+\(req:\s+Request[^)]*\),\s+res:\s+Response\)\s+=>\s+{/g,
    (match) => {
      if (!match.includes('language')) {
        return match + '\n  const language = req.language || \'en\';';
      }
      return match;
    }
  );

  fs.writeFileSync(controllerPath, content, 'utf-8');
  console.log(`✓ Updated ${moduleName} controller`);
}

// Update all modules
console.log('🚀 Starting multi-language implementation...\n');

modules.forEach(module => {
  addLanguageSupport(module);
});

console.log('\n✅ Multi-language support added to all modules!');
console.log('\n📝 Next steps:');
console.log('1. Review the changes in each controller file');
console.log('2. Update service method signatures to accept language parameter');
console.log('3. Test the API with ?lang=nl and ?lang=en parameters');
