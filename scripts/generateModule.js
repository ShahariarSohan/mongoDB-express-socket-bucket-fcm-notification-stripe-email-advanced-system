const fs = require("fs");
const path = require("path");
const { getModulePaths } = require("./utils/helpers");
const routeTemplate = require("./templates/route.template");
const controllerTemplate = require("./templates/controller.template");
const serviceTemplate = require("./templates/service.template");
const constantsTemplate = require("./templates/constants.template");
const validationsTemplate = require("./templates/validation.template");

// CLI: node scripts/generateModule.js <ModuleName> [--overwrite]
const moduleName = process.argv[2];
const overwrite = process.argv.includes("--overwrite");

function isValidModuleName(name) {
  // Only allow alphanumeric and no spaces
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

if (!moduleName || !isValidModuleName(moduleName)) {
  console.error(
    "\x1b[31m❌ Please provide a valid module name (alphanumeric, no spaces). Example: npm run cModule Investor\x1b[0m"
  );
  process.exit(1);
}

let paths;
try {
  paths = getModulePaths(moduleName);
} catch (err) {
  console.error("\x1b[31m❌ Error in getModulePaths:", err, "\x1b[0m");
  process.exit(1);
}
const { baseDir, pascal, camel, lower } = paths;

if (!fs.existsSync(baseDir)) {
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    console.log(`\x1b[34m📁 Created: ${baseDir}\x1b[0m`);
  } catch (err) {
    console.error("\x1b[31m❌ Failed to create directory:", err, "\x1b[0m");
    process.exit(1);
  }
}

const files = [
  {
    name: `${camel}.route.ts`,
    template: routeTemplate,
    args: { pascal, camel, lower },
  },
  {
    name: `${camel}.controller.ts`,
    template: controllerTemplate,
    args: { pascal, camel },
  },
  {
    name: `${camel}.service.ts`,
    template: serviceTemplate,
    args: { pascal, camel, lower },
  },
  {
    name: `${lower}.validation.ts`,
    template: validationsTemplate,
    args: { pascal, camel, lower },
  }
];

files.forEach(({ name, template, args }) => {
  const filePath = path.join(baseDir, name);
  if (typeof template !== "function") {
    console.error(`\x1b[31m❌ Template missing for: ${name}\x1b[0m`);
    return;
  }
  try {
    if (fs.existsSync(filePath) && !overwrite) {
      console.log(`\x1b[33m⚠️  Skipped (already exists): ${filePath}\x1b[0m`);
      return;
    }
    fs.writeFileSync(filePath, template(args), "utf8");
    console.log(`\x1b[32m✅ Created: ${filePath}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m❌ Error writing file: ${filePath}\n`, err, "\x1b[0m");
  }
});
