#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { sessionEndHandler } from '../lib/hooks/session-end.js';
runHookAsCli(sessionEndHandler);
