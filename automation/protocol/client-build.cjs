'use strict';

/** Client metadata is fetched from Ankama's public production bundle, not guessed. */
const OFFICIAL_SCRIPT_URL = 'https://dt-proxy-production-login.ankama-games.com/build/script.js';

function parseOfficialBuildVersion(bundle) {
  if (typeof bundle !== 'string') throw new Error('official_build_not_found');
  const match = bundle.match(/\bwindow\.buildVersion\s*=\s*["'](\d+\.\d+\.\d+)["']/);
  if (!match) throw new Error('official_build_not_found');
  return match[1];
}

async function fetchOfficialBuildVersion({fetchImpl = fetch} = {}) {
  const response = await fetchImpl(OFFICIAL_SCRIPT_URL, {signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error('official_build_download_failed');
  // Bound downloaded contents even when server announces a misleading length.
  if (Number(response.headers?.get?.('content-length') || 0) > 12 * 1024 * 1024)
    throw new Error('official_build_bundle_too_large');
  const content = await response.text();
  if (content.length > 12 * 1024 * 1024) throw new Error('official_build_bundle_too_large');
  return parseOfficialBuildVersion(content);
}

module.exports = {OFFICIAL_SCRIPT_URL, parseOfficialBuildVersion, fetchOfficialBuildVersion};
