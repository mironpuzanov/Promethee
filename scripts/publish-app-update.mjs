import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://qnnqnfitlaffcadtunuk.supabase.co';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(`
Publish an active Promethee update manifest row to Supabase.

Required env:
  SUPABASE_SERVICE_ROLE_KEY

Optional env:
  SUPABASE_URL (defaults to the repo's project URL)

Required flags:
  --version <semver>
  --download-url <https://...>

Optional flags:
  --platform <darwin|win32|linux|all>   default: darwin
  --channel <stable|beta|...>           default: stable
  --release-url <https://...>           default: download-url
  --asset-name <name>                   default: basename(download-url)
  --notes <text>
  --mandatory                           default: false

Example:
  npm run publish:update -- \\
    --platform darwin \\
    --version 1.1.1 \\
    --download-url https://downloads.promethee.app/Promethee-1.1.1.dmg \\
    --release-url https://promethee.app/releases/1.1.1 \\
    --notes "Fixes auth restore and permission flow"
`);
}

function requiredArg(args, key) {
  const value = args[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required flag --${key}`);
  }
  return value.trim();
}

function truthyFlag(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    usage();
    process.exit(0);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  const version = requiredArg(args, 'version');
  const downloadUrl = requiredArg(args, 'download-url');
  const platform = String(args.platform || 'darwin').trim();
  const channel = String(args.channel || 'stable').trim();
  const releaseUrl = String(args['release-url'] || downloadUrl).trim();
  const assetName = String(
    args['asset-name'] || path.basename(new URL(downloadUrl).pathname || downloadUrl)
  ).trim();
  const notes = args.notes ? String(args.notes).trim() : null;
  const isMandatory = truthyFlag(args.mandatory);

  const supabase = createClient(DEFAULT_SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deactivateError } = await supabase
    .from('app_updates')
    .update({ active: false })
    .eq('platform', platform)
    .eq('channel', channel)
    .eq('active', true);

  if (deactivateError) {
    throw new Error(`Failed to deactivate previous update rows: ${deactivateError.message}`);
  }

  const payload = {
    platform,
    channel,
    version,
    download_url: downloadUrl,
    release_url: releaseUrl,
    asset_name: assetName || null,
    notes,
    is_mandatory: isMandatory,
    active: true,
  };

  const { data, error: insertError } = await supabase
    .from('app_updates')
    .insert(payload)
    .select('id, platform, channel, version, download_url, release_url, active, published_at')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert app update row: ${insertError.message}`);
  }

  console.log('Published app update:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(`publish-app-update failed: ${error.message}`);
  usage();
  process.exit(1);
});
