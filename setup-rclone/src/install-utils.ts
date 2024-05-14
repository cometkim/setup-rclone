import * as semver from 'semver';
import * as core from '@actions/core';
import * as gh from '@actions/github';
import * as tc from '@actions/tool-cache';

const UA = 'cometkim/rclone-actions/setup-rclone';

export async function chooseVersion(range: string): Promise<string | null> {
  if (range === 'latest' || range === 'current') {
    return await retrieveCurrentVersion();
  }
  const candidates = [];
  for await (const version of retrieveAllVersions()) {
    candidates.push(version);
  }
  return semver.maxSatisfying(candidates, range, { includePrerelease: true });
}

export async function installRclone(version: string, platform: string, arch: string): Promise<void> {
  const target = `${platform}-${arch}`;

  let cachePath = tc.find('rclone', version, target);
  if (cachePath) {
    core.info(`Found in cache @ ${cachePath}`);
  } else {
    const zipUrl = isOnCloud()
      ? `https://github.com/rclone/rclone/releases/download/v${version}/rclone-v${version}-${platform}-${arch}.zip`
      : `https://downloads.rclone.org/v${version}/rclone-v${version}-${platform}-${arch}.zip`;
    core.info(`Downloading rclone from ${zipUrl}`);

    const zipPath = await tc.downloadTool(zipUrl, undefined, undefined, { 'user-agent': UA });
    const toolPath = await tc.extractZip(zipPath);
    core.debug(`Extracted tool path: ${toolPath}`);

    cachePath = await tc.cacheDir(toolPath, 'rclone', version, target);
    core.info(`Stored in cache @ ${cachePath}`);
  }

  core.addPath(cachePath);
}

async function retrieveCurrentVersion(): Promise<string> {
  const res = await fetch('https://downloads.rclone.org/version.txt', {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/plain',
    },
  });
  const data = await res.text();
  // e.g. `rclone v1.66.0`
  return data.split(' ')[1].slice(1);
}

async function *retrieveAllVersions(): AsyncGenerator<string> {
  if (isOnCloud() && process.env.GITHUB_TOKEN) {
    // Using GitHub releases may accelerate speed significantly 
    const octokit = gh.getOctokit(process.env.GITHUB_TOKEN, { userAgent: UA });
    const iter = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
      owner: 'rclone',
      repo: 'rclone',
      per_page: 100,
    });
    for await (const { data: releases } of iter) {
      for (const release of releases) {
        yield release.tag_name;
      }
    }
  } else {
    // GHES network may block public GitHub access
    //
    // Use official downloads URL(`https://downloads.rclone.org`)
    // would be much easier to trust exceptionally
    const res = await fetch('https://downloads.rclone.org', {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      },
    });
    const data = await res.json() as Array<{
      name: string,
      size: number,
      url: string,
      mod_time: string,
      mode: number,
      is_dir: boolean,
      is_symlink: boolean,
    }>;
    for (const file of data) {
      if (file.is_dir && file.name.startsWith('v')) {
        // remove trailing slash
        yield file.name.slice(0, -1);
      }
    }
  }
}

function isOnCloud() {
  return gh.context.serverUrl === 'https://github.com';
}
