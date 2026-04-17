#!/usr/bin/env node
import { runHookAsCli } from '../lib/hook-runtime.js';
import { postToolUseHandler } from '../lib/hooks/post-tool-use.js';
runHookAsCli(postToolUseHandler);
