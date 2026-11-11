/* global self */
"use strict";

// Replace existing registrations so pending invoice syncs stop running.
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.registration.unregister()));
