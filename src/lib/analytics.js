/**
 * analytics.js — single entry point for all PostHog tracking.
 *
 * Rules:
 * - All calls are fire-and-forget. Never await anything from this module in hot paths.
 * - PostHog is a no-op in dev (app.isPackaged === false) unless POSTHOG_FORCE_DEV is set.
 * - Never pass task names, chat content, or screen data in event properties.
 * - distinctId = Supabase user UUID only.
 */

import { app } from 'electron';
import { PostHog } from 'posthog-node';

let client = null;
let currentUserId = null;
let pendingEvents = []; // queued before identify() is called

export function initAnalytics() {
  if (!app.isPackaged && !process.env.POSTHOG_FORCE_DEV) return;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    console.warn('[analytics] POSTHOG_API_KEY not set — PostHog disabled');
    return;
  }

  client = new PostHog(apiKey, {
    host: 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  client.on('error', (err) => {
    console.error('[analytics] PostHog error:', err?.message || err);
  });
}

export function identify(userId) {
  if (!client || !userId) return;
  currentUserId = userId;

  client.identify({
    distinctId: userId,
    properties: {
      app_version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    },
  });

  // Flush events that fired before we knew the userId
  for (const { event, props } of pendingEvents) {
    try {
      client.capture({ distinctId: userId, event, properties: props });
    } catch { /* best-effort */ }
  }
  pendingEvents = [];

  client.flush().catch(() => {});
}

export function track(event, props = {}) {
  if (!client) return;

  if (!currentUserId) {
    pendingEvents.push({ event, props });
    return;
  }

  try {
    client.capture({ distinctId: currentUserId, event, properties: props });
  } catch (e) {
    console.warn(`[analytics] track failed: ${e.message}`);
  }
}

export function captureException(error, props = {}) {
  if (!client || !currentUserId) return;
  try {
    client.captureException(error, currentUserId, props);
  } catch {
    // never throw from analytics
  }
}

export async function shutdown() {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // best-effort
  }
}
