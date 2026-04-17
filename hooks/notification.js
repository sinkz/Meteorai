#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { notificationHandler } from '../lib/hooks/notification.js';
runHookAsCli(notificationHandler);
