#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { preToolUseHandler } from '../lib/hooks/pre-tool-use.js';
runHookAsCli(preToolUseHandler);
