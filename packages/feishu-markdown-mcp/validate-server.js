import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs/promises';

async function main() {
  const schemaUrl =
    'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';
  const schemaResp = await fetch(schemaUrl);
  if (!schemaResp.ok) {
    console.error('Failed to fetch schema:', schemaResp.status);
    process.exit(2);
  }
  const schema = await schemaResp.json();
  const raw = await fs.readFile(new URL('./server.json', import.meta.url));
  const server = JSON.parse(raw.toString());

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(server);
  if (!valid) {
    console.error('server.json validation failed:');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(3);
  }
  console.log('server.json is valid ✅');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
