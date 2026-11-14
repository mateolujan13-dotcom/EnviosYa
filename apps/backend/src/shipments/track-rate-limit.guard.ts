import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { TRACKING_RATE_LIMIT_MESSAGE } from './tracking.constants';

const WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;
const MAX_ENTRIES = 5_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limit por IP en memoria (ventana fija) para el tracking público.
 * Límite configurable vía TRACK_RATE_LIMIT_MAX (default 30 req / 60 s).
 */
@Injectable()
export class TrackRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    const limit = this.resolveLimit();

    this.prune(now);

    const entry = this.hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    entry.count += 1;
    if (entry.count > limit) {
      throw new HttpException(
        { message: TRACKING_RATE_LIMIT_MESSAGE },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveLimit(): number {
    const raw = process.env.TRACK_RATE_LIMIT_MAX;
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_REQUESTS;
  }

  private prune(now: number): void {
    if (this.hits.size <= MAX_ENTRIES) {
      return;
    }

    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) {
        this.hits.delete(key);
      }
    }

    if (this.hits.size > MAX_ENTRIES) {
      const byResetAt = [...this.hits.entries()].sort(
        (a, b) => a[1].resetAt - b[1].resetAt,
      );
      const excess = this.hits.size - MAX_ENTRIES;
      for (let i = 0; i < excess; i += 1) {
        this.hits.delete(byResetAt[i][0]);
      }
    }
  }
}
