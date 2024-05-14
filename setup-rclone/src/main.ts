import * as os from 'node:os';
import * as core from '@actions/core';

import { chooseVersion, installRclone } from './install-utils.ts';

const platformToSupport: Partial<Record<string, string>> = {
  'freebsd': 'freebsd',
  'linux': 'linux',
  'netbsd': 'netbsd',
  'openbsd': 'openbsd',
  'darwin': 'osx',
  'win': 'windows',
  'windows': 'windows',
  'win32': 'windows',
};

const architectureToSupport: Partial<Record<string, string>> = {
  'i386': '386',
  'ia32': '386',
  'x86': '386',
  'x86_64': 'amd64',
  'x64': 'amd64',
  'amd64': 'amd64',
  'arm64': 'arm64',
  'aarch64': 'arm64',
  'armv7': 'arm-v7',
  'armv6': 'arm-v6',
  'mips': 'mips',
  'mipsel': 'mipsel',
};

async function main() {
  try {
    const inputVersion = core.getInput('rclone-version');
    const version = await chooseVersion(inputVersion);
    if (!version) {
      throw new Error(`rclone-version ${inputVersion} is not available`);
    }
    core.info(`rclone-version: ${version}`);

    const inputPlatform = core.getInput('platform');
    const searchPlatform = inputPlatform || os.platform();
    const platform = platformToSupport[searchPlatform];
    if (!platform) {
      throw new Error(`OS ${searchPlatform} is not supported`);
    }
    core.info(`target platform: ${platform}`);

    const inputArchitecture = core.getInput('architecture');
    const searchArchitecture = inputArchitecture || os.arch();
    const architecture = architectureToSupport[searchArchitecture];
    if (!architecture) {
      throw new Error(`Arch ${searchArchitecture} is not supported`);
    }
    core.info(`target arch: ${architecture}`);

    await installRclone(version, platform, architecture);
    core.setOutput('rclone-version', version);
  } catch (err) {
    core.setFailed(err as Error);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
