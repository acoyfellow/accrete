import { DurableObject } from 'cloudflare:workers';
import type { Env } from './types';

const IMAGE = 'builder';
const PORT = 8080;
const READY_WAIT_MS = 120_000;
const READY_POLL_MS = 500;
const IDLE_STOP_MS = 60_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Builder extends DurableObject<Env> {
  private get container(): Container {
    const container = this.ctx.container;
    if (container === undefined) throw new Error('Builder has no container binding');
    return container;
  }

  private boot(): void {
    const container = this.container;
    if (container.running) return;
    container.start({ image: container.images[IMAGE] ?? IMAGE, enableInternet: true, instance: 'standard-1', labels: { app: 'accrete' } });
  }

  private async ready(request: Request): Promise<Response> {
    const deadline = Date.now() + READY_WAIT_MS;
    for (;;) {
      try {
        return await this.container.getTcpPort(PORT).fetch(request.clone());
      } catch (cause) {
        if (Date.now() >= deadline) throw cause;
        await pause(READY_POLL_MS);
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    this.boot();
    await this.container.setInactivityTimeout(IDLE_STOP_MS);
    return this.ready(request);
  }

  async shutdown(): Promise<void> {
    if (this.container.running) await this.container.destroy();
  }
}
