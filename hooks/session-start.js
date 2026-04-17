#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { sessionStartHandler } from '../lib/hooks/session-start.js';
runHookAsCli(sessionStartHandler);
