import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// O processo de build do Next herda esta opção. O desenvolvimento Node permanece normal.
process.env.ANADE_CLOUDFLARE = '1';
export default defineCloudflareConfig();
