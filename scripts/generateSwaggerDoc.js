const fs = require("fs");
const path = require("path");

// Usage: node scripts/generateSwaggerDoc.js Room
const moduleName = process.argv[2];
if (!moduleName) {
  console.error("❌ Please provide a module name. Example: npm run genDoc Room");
  process.exit(1);
}

const pascal = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
const camel = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
const lower = moduleName.toLowerCase();
const moduleDir = path.join(__dirname, "..", "src", "app", "modules", pascal);

const routeFile = path.join(moduleDir, `${camel}.route.ts`);
const controllerFile = path.join(moduleDir, `${camel}.controller.ts`);
const docFile = path.join(moduleDir, `${camel}.doc.ts`);

if (!fs.existsSync(routeFile)) {
  console.error(`❌ Route file not found: ${routeFile}`);
  process.exit(1);
}

const routeContent = fs.readFileSync(routeFile, "utf8");
const controllerContent = fs.existsSync(controllerFile)
  ? fs.readFileSync(controllerFile, "utf8")
  : "";

// Helper: convert camelCase / function names to words
function camelToWords(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: generate smart summary
function getSummary(method, path, resourceName) {
  const cleaned = path.replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (method === 'get') {
    const lastPart = parts[parts.length - 1] || '';
    if (lastPart.startsWith(':')) {
      if (parts.length === 1) {
        return `Get Single ${resourceName}`;
      } else {
        const custom = parts.slice(0, -1).map(p => {
          return p.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')
                  .replace(/^./, s => s.toUpperCase());
        }).join(' ').trim();
        return `Get Single ${custom || resourceName}`;
      }
    } else if (parts.length === 0) {
      return `Get All ${resourceName}`;
    } else if (parts.length === 1) {
      return `Get All ${resourceName}`;
    } else {
      const custom = parts.map(p => {
        return p.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')
                .replace(/^./, s => s.toUpperCase());
      }).join(' ').trim();
      return `Get ${custom || resourceName}`;
    }
  }

  return `${method.toUpperCase()} ${resourceName}`;
}

// Parse routes: get last handler after middleware
const routeRegex = /router\.(get|post|patch|put|delete)\(['"`](.*?)['"`],([\s\S]*?)\)/g;
let match;
const endpoints = [];
while ((match = routeRegex.exec(routeContent))) {
  const handlers = match[3].split(',').map(h => h.trim());
  const handler = handlers[handlers.length - 1];
  endpoints.push({ method: match[1].toLowerCase(), path: match[2], handler });
}

if (endpoints.length === 0) {
  console.error("❌ No endpoints found in route file.");
  process.exit(1);
}

// Generate Swagger doc
let doc = `/**\n`;

endpoints.forEach(({ method, path, handler }) => {
  doc += ` * @openapi\n`;
  doc += ` * /${lower}${path === "/" ? "" : path}:\n`;
  doc += ` *   ${method}:\n`;

  // Summary
  const summary = getSummary(method, path, pascal);
  doc += ` *     summary: ${summary}\n`;
  doc += ` *     tags:\n`;
  doc += ` *       - ${pascal}\n`;

  // Request body for write endpoints
  if (["post", "patch", "put"].includes(method)) {
    // Detect fields from req.body
    let bodyFields = [];
    const bodyMatches = controllerContent.match(/req\.body\.([a-zA-Z0-9_]+)/g);
    if (bodyMatches) {
      bodyFields = [...new Set(bodyMatches.map(m => m.split('.')[2]))];
    }

    doc += ` *     requestBody:\n`;
    doc += ` *       required: true\n`;
    doc += ` *       content:\n`;
    doc += ` *         application/json:\n`;
    doc += ` *           schema:\n`;

    if (bodyFields.length > 0) {
      doc += ` *             type: object\n`;
      doc += ` *             properties:\n`;
      bodyFields.forEach(f => {
        doc += ` *               ${f}:\n`;
        doc += ` *                 type: string\n`;
        doc += ` *                 description: ${f} field\n`;
      });
    } else {
      doc += ` *             type: object\n`;
    }
  } 
  // Query parameters for GET endpoints
  else if (method === "get") {
    let matches = controllerContent.match(/req\.query\.([a-zA-Z0-9_]+)/g);
    let queryParams = matches ? [...new Set(matches.map(m => m.split('.')[2]))] : ["limit", "page"]; // need to add more query params as needed

    if (queryParams.length > 0) {
      doc += ` *     parameters:\n`;
      queryParams.forEach(param => {
        doc += ` *       - in: query\n`;
        doc += ` *         name: ${param}\n`;
        doc += ` *         schema:\n`;
        doc += ` *           type: string\n`;
        doc += ` *         required: false\n`;
        doc += ` *         description: Optional filter parameter\n`;
      });
    }
  }

  doc += ` *     responses:\n`;
  doc += ` *       200:\n`;
  doc += ` *         description: Success\n`;
});

doc += ` */\n`;

fs.writeFileSync(docFile, doc, "utf8");
console.log(`✅ Swagger doc generated: ${docFile}`);
