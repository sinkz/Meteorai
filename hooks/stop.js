#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { stopHandler } from '../lib/hooks/stop.js';
runHookAsCli(stopHandler);
