import { Container } from '@cloudflare/containers';
import type { Env } from './types';

export class Builder extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '1m';
  enableInternet = true;

  async shutdown(): Promise<void> {
    await this.destroy();
  }
}
